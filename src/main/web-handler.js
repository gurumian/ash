import { ipcMain, BrowserWindow } from 'electron';
import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';
import express from 'express';

// Web server management
let webServer = null;
let webPort = 8080; // Default web server port
let rootDir = null;
let isListening = false;
let mainWindow = null;

/**
 * Set main window reference for error dialogs
 */
export function setMainWindow(window) {
  mainWindow = window;
}

/**
 * Format bytes to human readable size
 */
function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

/**
 * Create default root directory: ${HOME}/Documents/ash/web/
 */
function createDefaultRootDirectory() {
  const homeDir = os.homedir();
  
  // Build path: ${HOME}/Documents/ash/web/
  const rootPath = path.join(
    homeDir,
    'Documents',
    'ash',
    'web'
  );
  
  // Create directory if it doesn't exist
  if (!fs.existsSync(rootPath)) {
    fs.mkdirSync(rootPath, { recursive: true });
    console.log(`[Web Server] Created root directory: ${rootPath}`);
  }
  
  rootDir = rootPath;
  return rootPath;
}


/**
 * Initialize Web Server handlers
 */
export function initializeWebHandlers() {
  // Get Web Server status
  ipcMain.handle('web-status', async () => {
    return { running: !!webServer, port: webServer ? webPort : null, rootDir };
  });

  // Start Web Server
  ipcMain.handle('web-start', async (_event, params) => {
    try {
      if (webServer) {
        return { success: true, running: true, port: webPort, rootDir };
      }
      
      const requestedPort = params?.port || webPort;
      const bindAddr = params?.host || '0.0.0.0';
      webPort = requestedPort;
      
      // Use user-selected directory or create default directory
      let rootPath;
      if (params?.rootDir) {
        // User selected directory - use as-is
        rootPath = params.rootDir;
        if (!fs.existsSync(rootPath)) {
          fs.mkdirSync(rootPath, { recursive: true });
          console.log(`[Web Server] Created user-selected root directory: ${rootPath}`);
        }
      } else {
        // Use default directory
        rootPath = createDefaultRootDirectory();
      }
      
      // Update global rootDir variable to persist the path
      rootDir = rootPath;
      
      // Create Express app
      const app = express();
      
      // Serve static files
      app.use(express.static(rootPath, {
        index: ['index.html', 'index.htm'],
        dotfiles: 'ignore'
      }));
      
      // Handle directory listing when index.html doesn't exist
      app.use((req, res, next) => {
        const filePath = path.join(rootPath, req.path);
        fs.stat(filePath, (err, stats) => {
          if (err || !stats.isDirectory()) {
            return next();
          }
          
          // Check if index.html exists
          const indexPath = path.join(filePath, 'index.html');
          fs.access(indexPath, (err) => {
            if (err) {
              // No index.html, show directory listing
              fs.readdir(filePath, (err, files) => {
                if (err) return next(err);
                
                const items = files.map(file => {
                  const fullPath = path.join(filePath, file);
                  const stat = fs.statSync(fullPath);
                  const isDir = stat.isDirectory();
                  const url = path.join(req.path, file).replace(/\\/g, '/') + (isDir ? '/' : '');
                  const size = isDir ? '-' : formatBytes(stat.size);
                  return `<tr><td><a href="${url}">${file}${isDir ? '/' : ''}</a></td><td>${size}</td></tr>`;
                }).join('');
                
                res.send(`<!DOCTYPE html>
<html>
<head>
  <title>Index of ${req.path}</title>
  <style>
    body { font-family: monospace; background: #000; color: #0f0; padding: 20px; }
    table { border-collapse: collapse; width: 100%; }
    th, td { padding: 8px; text-align: left; border-bottom: 1px solid #333; }
    a { color: #0f0; text-decoration: none; }
    a:hover { text-decoration: underline; }
  </style>
</head>
<body>
  <h1>Index of ${req.path}</h1>
  <table>
    <tr><th>Name</th><th>Size</th></tr>
    ${items}
  </table>
</body>
</html>`);
              });
            } else {
              next();
            }
          });
        });
      });
      
      // Create HTTP server from Express app
      webServer = app.listen(webPort, bindAddr);
      
      // Track listening state
      isListening = false;
      let listeningError = null;
      
      // Set up event handlers
      webServer.on('listening', () => {
        isListening = true;
        const address = webServer.address();
        console.log(`[Web Server] Server listening on ${address.address}:${address.port}`);
        console.log(`[Web Server] Serving files from: ${rootPath}`);
      });

      webServer.on('error', (err) => {
        isListening = false;
        listeningError = err;
        console.error('[Web Server] Server error:', err);
        
        let errorMsg = `Web server error: ${err.message || err}`;
        let title = 'Web Server Error';
        
        if (err.code === 'EACCES') {
          errorMsg = `Permission denied - port ${webPort} requires administrator privileges on Windows.\n\nPlease run this application as Administrator.`;
          title = 'Web Server Permission Denied';
        } else if (err.code === 'EADDRINUSE') {
          errorMsg = `Port ${webPort} is already in use by another application.\n\nPlease close the other application or use a different port.`;
          title = 'Web Port In Use';
        }
        
        // Send error event to renderer to show ErrorDialog
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('web-server-error', {
            title: title,
            message: 'Failed to start Web server',
            detail: errorMsg,
            error: { code: err.code, message: err.message }
          });
        }
      });
      
      console.log(`[Web Server] Server starting on ${bindAddr}:${webPort}`);
      console.log(`[Web Server] Files will be served from: ${rootPath}`);
      
      // Wait for listening event or error (with timeout)
      await new Promise((resolve) => {
        const timeout = setTimeout(() => {
          resolve(); // Timeout reached
        }, 2000); // 2 second timeout
        
        const onListening = () => {
          clearTimeout(timeout);
          webServer.off('error', onError);
          resolve();
        };
        
        const onError = () => {
          clearTimeout(timeout);
          webServer.off('listening', onListening);
          resolve();
        };
        
        if (isListening) {
          // Already listening
          clearTimeout(timeout);
          resolve();
        } else {
          webServer.once('listening', onListening);
          webServer.once('error', onError);
        }
      });
      
      // Check result
      if (!isListening) {
        let errorMsg = listeningError 
          ? `Server failed to start: ${listeningError.message}`
          : `Server failed to start on port ${webPort}. Port may be in use or require administrator privileges.`;
        
        // Enhance error message based on error code
        if (listeningError) {
          if (listeningError.code === 'EACCES') {
            errorMsg = `Permission denied - port ${webPort} requires administrator privileges on Windows.\n\nPlease run this application as Administrator.`;
          } else if (listeningError.code === 'EADDRINUSE') {
            errorMsg = `Port ${webPort} is already in use by another application.\n\nPlease close the other application or use a different port.`;
          }
        }
        
        console.error(`[Web Server] ${errorMsg}`);
        
        // Send error event to renderer to show ErrorDialog
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('web-server-error', {
            title: 'Web Server Error',
            message: 'Failed to start Web server',
            detail: errorMsg,
            error: listeningError ? { code: listeningError.code, message: listeningError.message } : null
          });
        }
        
        try { webServer?.close(); } catch {}
        webServer = null;
        isListening = false;
        return { success: false, running: false, error: errorMsg };
      }
      
      return { success: true, running: true, port: webPort, host: bindAddr, rootDir: rootPath };
    } catch (e) {
      // cleanup on failure
      console.error('[Web Server] Server creation error:', e);
      if (e.code === 'EACCES') {
        console.error(`[Web Server] Permission denied - port ${webPort} requires administrator privileges on Windows`);
      }
      try { webServer?.close(); } catch {}
      webServer = null;
      return { success: false, running: false, error: e.message };
    }
  });

  // Get root directory
  ipcMain.handle('web-get-root-dir', async () => {
    return { rootDir: rootDir || null };
  });

  // Network interfaces handler moved to window-handler (net-get-network-interfaces)

  // Stop Web Server
  ipcMain.handle('web-stop', async () => {
    try {
      if (!webServer) return { success: true, running: false };
      webServer.close();
      webServer = null;
      isListening = false;
      console.log('[Web Server] Server stopped');
      return { success: true, running: false };
    } catch (e) {
      return { success: false, running: !!webServer, error: e.message };
    }
  });
}

/**
 * Cleanup Web Server on app quit
 */
export function cleanupWebServer() {
  if (webServer) {
    try {
      webServer.close();
      webServer = null;
      isListening = false;
      console.log('[Web Server] Server stopped on app quit');
    } catch (e) {
      console.error('[Web Server] Error stopping server on quit:', e);
    }
  }
}

