import { ipcMain, BrowserWindow } from 'electron';
import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';
import tftp from 'tftp';

// TFTP server management
let tftpServer = null;
let tftpPort = 69; // Standard TFTP port
let outputDir = null;
let isListening = false;
let mainWindow = null;

/**
 * Set main window reference for error dialogs
 */
export function setMainWindow(window) {
  mainWindow = window;
}

/**
 * Create output directory: ${HOME}/Documents/ash/tftp/
 */
function createOutputDirectory() {
  const homeDir = os.homedir();
  
  // Build path: ${HOME}/Documents/ash/tftp/
  const outputPath = path.join(
    homeDir,
    'Documents',
    'ash',
    'tftp'
  );
  
  // Create directory if it doesn't exist
  if (!fs.existsSync(outputPath)) {
    fs.mkdirSync(outputPath, { recursive: true });
    console.log(`[TFTP] Created output directory: ${outputPath}`);
  }
  
  outputDir = outputPath;
  return outputPath;
}

/**
 * Initialize TFTP handlers
 */
export function initializeTftpHandlers() {
  // Get TFTP server status
  ipcMain.handle('tftp-status', async () => {
    return { running: !!tftpServer, port: tftpServer ? tftpPort : null, outputDir };
  });

  // Start TFTP server
  ipcMain.handle('tftp-start', async (_event, params) => {
    try {
      if (tftpServer) {
        return { success: true, running: true, port: tftpPort, outputDir };
      }
      
      const requestedPort = params?.port || tftpPort;
      const bindAddr = params?.host || '0.0.0.0';
      tftpPort = requestedPort;
      
      // Use user-selected directory or create default directory
      let outputPath;
      if (params?.outputDir) {
        // User selected directory - use as-is
        outputPath = params.outputDir;
        if (!fs.existsSync(outputPath)) {
          fs.mkdirSync(outputPath, { recursive: true });
          console.log(`[TFTP] Created user-selected output directory: ${outputPath}`);
        }
      } else {
        // Use default directory
        outputPath = createOutputDirectory();
      }
      
      // Update global outputDir variable to persist the path
      outputDir = outputPath;
      
      // Create TFTP server using tftp package
      tftpServer = tftp.createServer({
        host: bindAddr,
        port: tftpPort,
        root: outputPath
      });
      
      // Track listening state
      isListening = false;
      let listeningError = null;
      
      // Set up event handlers BEFORE calling listen()
      tftpServer.on('listening', () => {
        isListening = true;
        console.log(`[TFTP] Server listening on ${bindAddr}:${tftpPort}`);
        console.log(`[TFTP] Ready to receive files at: ${outputPath}`);
      });

      tftpServer.on('error', (err) => {
        isListening = false;
        listeningError = err;
        console.error('[TFTP] Server error:', err);
        
        let errorMsg = `TFTP server error: ${err.message || err}`;
        let title = 'TFTP Server Error';
        
        if (err.code === 'EACCES') {
          errorMsg = `Permission denied - port ${tftpPort} requires administrator privileges on Windows.\n\nPlease run this application as Administrator.`;
          title = 'TFTP Server Permission Denied';
        } else if (err.code === 'EADDRINUSE') {
          errorMsg = `Port ${tftpPort} is already in use by another application.\n\nPlease close the other application or use a different port.`;
          title = 'TFTP Port In Use';
        }
        
        // Send error event to renderer to show ErrorDialog
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('tftp-server-error', {
            title: title,
            message: 'Failed to start TFTP server',
            detail: errorMsg,
            error: { code: err.code, message: err.message }
          });
        }
      });
      
      // Listen for requests to log them
      tftpServer.on('request', (req, res) => {
        const clientInfo = req.stats 
          ? `${req.stats.remoteAddress}:${req.stats.remotePort}` 
          : 'unknown';
        console.log(`[TFTP] Request received: ${req.method || 'PUT'} ${req.file || 'unknown'} from ${clientInfo}`);
        
        req.on('error', (err) => {
          const clientInfo = req.stats 
            ? `[${req.stats.remoteAddress}:${req.stats.remotePort}] (${req.file || 'unknown'})`
            : `[${req.file || 'unknown'}]`;
          console.error(`[TFTP] ${clientInfo} ${err.message || err}`);
        });

        // Log when PUT transfer completes
        if (req.method === 'PUT' || !req.method) { // PUT is the default
          const filePath = path.join(outputPath, req.file || 'unknown');
          
          res.on('end', () => {
            // Wait for file to stabilize and verify size
            setTimeout(() => {
              try {
                if (fs.existsSync(filePath)) {
                  const stats = fs.statSync(filePath);
                  console.log(`[TFTP] Transfer complete: ${req.file} (${stats.size} bytes) at ${filePath}`);
                  
                  // Send IPC event to notify transfer completion
                  if (mainWindow && !mainWindow.isDestroyed()) {
                    mainWindow.webContents.send('tftp-transfer-complete', {
                      filename: req.file,
                      filePath: filePath,
                      size: stats.size,
                      success: true
                    });
                  }
                } else {
                  console.warn(`[TFTP] Transfer ended but file not found: ${filePath}`);
                  if (mainWindow && !mainWindow.isDestroyed()) {
                    mainWindow.webContents.send('tftp-transfer-complete', {
                      filename: req.file,
                      filePath: filePath,
                      success: false,
                      error: 'File not found after transfer'
                    });
                  }
                }
              } catch (e) {
                console.warn(`[TFTP] Could not verify file after end: ${filePath} - ${e.message}`);
                if (mainWindow && !mainWindow.isDestroyed()) {
                  mainWindow.webContents.send('tftp-transfer-complete', {
                    filename: req.file,
                    filePath: filePath,
                    success: false,
                    error: e.message
                  });
                }
              }
            }, 500);
          });
        }
      });

      console.log(`[TFTP] Server starting on ${bindAddr}:${tftpPort}`);
      console.log(`[TFTP] Files will be saved to: ${outputPath}`);
      
      // Start listening (async operation)
      tftpServer.listen();
      
      // Wait for listening event or error (with timeout)
      await new Promise((resolve) => {
        const timeout = setTimeout(() => {
          resolve(); // Timeout reached
        }, 2000); // 2 second timeout
        
        const onListening = () => {
          clearTimeout(timeout);
          tftpServer.off('error', onError);
          resolve();
        };
        
        const onError = () => {
          clearTimeout(timeout);
          tftpServer.off('listening', onListening);
          resolve();
        };
        
        if (isListening) {
          // Already listening
          clearTimeout(timeout);
          resolve();
        } else {
          tftpServer.once('listening', onListening);
          tftpServer.once('error', onError);
        }
      });
      
      // Check result
      if (!isListening) {
        let errorMsg = listeningError 
          ? `Server failed to start: ${listeningError.message}`
          : `Server failed to start on port ${tftpPort}. Port may be in use or require administrator privileges.`;
        
        // Enhance error message based on error code
        if (listeningError) {
          if (listeningError.code === 'EACCES') {
            errorMsg = `Permission denied - port ${tftpPort} requires administrator privileges on Windows.\n\nPlease run this application as Administrator.`;
          } else if (listeningError.code === 'EADDRINUSE') {
            errorMsg = `Port ${tftpPort} is already in use by another application.\n\nPlease close the other application or use a different port.`;
          }
        }
        
        console.error(`[TFTP] ${errorMsg}`);
        
        // Send error event to renderer to show ErrorDialog
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('tftp-server-error', {
            title: 'TFTP Server Error',
            message: 'Failed to start TFTP server',
            detail: errorMsg,
            error: listeningError ? { code: listeningError.code, message: listeningError.message } : null
          });
        }
        
        try { tftpServer?.close(); } catch {}
        tftpServer = null;
        isListening = false;
        return { success: false, running: false, error: errorMsg };
      }
      
      return { success: true, running: true, port: tftpPort, host: bindAddr, outputDir: outputPath };
    } catch (e) {
      // cleanup on failure
      console.error('[TFTP] Server creation error:', e);
      if (e.code === 'EACCES') {
        console.error('[TFTP] Permission denied - port 69 requires administrator privileges on Windows');
      }
      try { tftpServer?.close(); } catch {}
      tftpServer = null;
      return { success: false, running: false, error: e.message };
    }
  });

  // Get output directory
  ipcMain.handle('tftp-get-output-dir', async () => {
    return { outputDir: outputDir || null };
  });

  // Stop TFTP server
  ipcMain.handle('tftp-stop', async () => {
    try {
      if (!tftpServer) return { success: true, running: false };
      tftpServer.close();
      tftpServer = null;
      isListening = false;
      console.log('[TFTP] Server stopped');
      return { success: true, running: false };
    } catch (e) {
      return { success: false, running: !!tftpServer, error: e.message };
    }
  });
}

/**
 * Cleanup TFTP server on app quit
 */
export function cleanupTftpServer() {
  if (tftpServer) {
    try {
      tftpServer.close();
      tftpServer = null;
      isListening = false;
      console.log('[TFTP] Server stopped on app quit');
    } catch (e) {
      console.error('[TFTP] Error stopping server on quit:', e);
    }
  }
}

