import { ipcMain, BrowserWindow, app } from 'electron';
import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'child_process';

// iperf3 server management
let iperfProcess = null;
let iperfPort = 5201; // Standard iperf3 port
let iperfHost = '0.0.0.0';
let iperfProtocol = 'tcp';
let iperfStreams = 1;
let iperfBandwidth = null;
let mainWindow = null;

/**
 * Set main window reference for error dialogs
 */
export function setMainWindow(window) {
  mainWindow = window;
}

/**
 * Get iperf3 binary path
 * - Windows: Use bundled binary from assets/bin
 * - macOS/Linux: Use system iperf3 (brew install iperf3 / apt-get install iperf3)
 */
function getIperf3BinaryPath() {
  const platform = process.platform;
  const binaryName = platform === 'win32' ? 'iperf3.exe' : 'iperf3';
  
  // Windows: Use bundled binary
  if (platform === 'win32') {
    // In development
    if (!app.isPackaged) {
      const devPath = path.join(__dirname, '../../assets/bin', 'win32', 'x64', binaryName);
      if (fs.existsSync(devPath)) {
        return devPath;
      }
    }
    
    // In production
    const resourcesPath = process.resourcesPath || app.getAppPath();
    const binaryPath = path.join(resourcesPath, 'assets', 'bin', 'win32', 'x64', binaryName);
    if (fs.existsSync(binaryPath)) {
      return binaryPath;
    }
    
    // Fallback to system iperf3.exe (if in PATH)
    return 'iperf3.exe';
  }
  
  // macOS/Linux: Use system iperf3
  return 'iperf3';
}

/**
 * Initialize iperf3 handlers
 */
export function initializeIperfHandlers() {
  // Get iperf3 server status
  ipcMain.handle('iperf-status', async () => {
    return { 
      running: iperfProcess !== null && iperfProcess.exitCode === null,
      port: iperfProcess ? iperfPort : null,
      host: iperfProcess ? iperfHost : null,
      protocol: iperfProcess ? iperfProtocol : null,
      streams: iperfProcess ? iperfStreams : null,
      bandwidth: iperfProcess ? iperfBandwidth : null
    };
  });

  // Start iperf3 server
  ipcMain.handle('iperf-start', async (_event, params) => {
    try {
      if (iperfProcess && iperfProcess.exitCode === null) {
        return { success: true, running: true, port: iperfPort, host: iperfHost };
      }
      
      const requestedPort = params?.port || iperfPort;
      const bindAddr = params?.host || '0.0.0.0';
      iperfPort = requestedPort;
      iperfHost = bindAddr;
      // Keep protocol/streams/bandwidth only for status/clients; server itself uses common listener
      const requestedProtocol = (params?.protocol || 'tcp').toString().toLowerCase();
      const requestedStreams = parseInt(params?.streams, 10) || 1;
      const requestedBandwidth = params?.bandwidth ? String(params.bandwidth).trim() : null;
      iperfProtocol = (requestedProtocol === 'udp' ? 'udp' : 'tcp');
      iperfStreams = requestedStreams > 0 ? requestedStreams : 1;
      iperfBandwidth = requestedBandwidth || null;
      
      const binaryPath = getIperf3BinaryPath();
      
      // Check if binary exists
      if (process.platform === 'win32') {
        // Windows: Check if bundled binary exists
        if (binaryPath !== 'iperf3.exe' && !fs.existsSync(binaryPath)) {
          const errorMsg = `iperf3 binary not found at: ${binaryPath}\n\nPlease run: npm run download-iperf3:all to download Windows binary.`;
          console.error(`[iperf3] ${errorMsg}`);
          
          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('iperf-server-error', {
              title: 'iperf3 Server Error',
              message: 'iperf3 binary not found',
              detail: errorMsg,
              error: null
            });
          }
          
          return { success: false, running: false, error: errorMsg };
        }
      } else {
        // macOS/Linux: Check if iperf3 is available in system
        try {
          const { execSync } = require('child_process');
          execSync(`which ${binaryPath}`, { stdio: 'ignore' });
        } catch (e) {
          const errorMsg = `iperf3 is not installed on your system.\n\nPlease install it:\n  macOS: brew install iperf3\n  Linux: sudo apt-get install iperf3 (or sudo yum install iperf3)`;
          console.error(`[iperf3] ${errorMsg}`);
          
          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('iperf-server-error', {
              title: 'iperf3 Server Error',
              message: 'iperf3 is not installed',
              detail: errorMsg,
              error: null
            });
          }
          
          return { success: false, running: false, error: errorMsg };
        }
      }
      
      // Start iperf3 server (server side does not use client-only flags like -u, -P, -b)
      const args = ['-s', '-p', iperfPort.toString()];
      if (bindAddr !== '0.0.0.0') {
        args.push('-B', bindAddr);
      }
      
      console.log(`[iperf3] Starting server: ${binaryPath} ${args.join(' ')}`);
      
      iperfProcess = spawn(binaryPath, args, {
        stdio: ['ignore', 'pipe', 'pipe']
      });
      
      let serverReady = false;
      let serverError = null;
      let stderrOutput = '';
      let stdoutOutput = '';
      
      // Capture stdout
      iperfProcess.stdout.on('data', (data) => {
        const output = data.toString();
        stdoutOutput += output;
        console.log(`[iperf3] stdout: ${output}`);
        if (output.includes('Server listening') || output.includes('listening')) {
          serverReady = true;
        }
      });
      
      // Capture stderr
      iperfProcess.stderr.on('data', (data) => {
        const output = data.toString();
        stderrOutput += output;
        console.error(`[iperf3] stderr: ${output}`);
        // Check for various error conditions
        if (output.includes('bind') || output.includes('Address already in use') || output.includes('EADDRINUSE')) {
          serverError = `Port ${iperfPort} is already in use. Please choose a different port.`;
        } else if (output.includes('error') || output.includes('Error') || output.includes('failed')) {
          if (!serverError) {
            serverError = output.trim();
          }
        }
      });
      
      // Handle process exit
      iperfProcess.on('exit', (code, signal) => {
        console.log(`[iperf3] Server exited with code ${code}, signal ${signal}`);
        if (code !== null && code !== 0) {
          // Process exited with error
          if (!serverError) {
            if (stderrOutput) {
              serverError = stderrOutput.trim();
            } else if (stdoutOutput) {
              serverError = stdoutOutput.trim();
            } else {
              serverError = `Server exited with code ${code}`;
            }
          }
        }
        iperfProcess = null;
        
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('iperf-server-stopped', { code, signal });
        }
      });
      
      // Handle process error (spawn failure)
      iperfProcess.on('error', (err) => {
        console.error(`[iperf3] Process error:`, err);
        serverError = err.message || `Failed to start iperf3: ${err.code || 'Unknown error'}`;
        iperfProcess = null;
      });
      
      // Wait a bit to see if server starts successfully
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // Check if process is still running
      if (iperfProcess && iperfProcess.exitCode === null && !serverError) {
        // Process is running, check if it's actually listening
          if (serverReady || stdoutOutput.includes('listening') || stdoutOutput.includes('Server listening')) {
            console.log(`[iperf3] Server listening on ${bindAddr}:${iperfPort}`);
            return { 
              success: true, 
              running: true, 
              port: iperfPort, 
              host: bindAddr,
              protocol: iperfProtocol,
              streams: iperfStreams,
              bandwidth: iperfBandwidth
            };
        } else {
          // Process is running but no confirmation yet, assume it's working
          console.log(`[iperf3] Server process started on ${bindAddr}:${iperfPort}`);
            return { 
              success: true, 
              running: true, 
              port: iperfPort, 
              host: bindAddr,
              protocol: iperfProtocol,
              streams: iperfStreams,
              bandwidth: iperfBandwidth
            };
        }
      } else {
        // Process failed or exited
        let errorMsg = serverError;
        if (!errorMsg) {
          if (iperfProcess && iperfProcess.exitCode !== null) {
            errorMsg = `Server exited with code ${iperfProcess.exitCode}`;
            if (stderrOutput) {
              errorMsg += `: ${stderrOutput.trim()}`;
            }
          } else {
            errorMsg = `Server failed to start on port ${iperfPort}.`;
            if (stderrOutput) {
              errorMsg += ` ${stderrOutput.trim()}`;
            } else {
              errorMsg += ` Port may be in use or binary may be invalid.`;
            }
          }
        }
        
        console.error(`[iperf3] ${errorMsg}`);
        
        if (iperfProcess) {
          try {
            iperfProcess.kill();
          } catch (e) {}
          iperfProcess = null;
        }
        
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('iperf-server-error', {
            title: 'iperf3 Server Error',
            message: 'Failed to start iperf3 server',
            detail: errorMsg,
            error: serverError ? { message: serverError } : null
          });
        }
        
        return { success: false, running: false, error: errorMsg };
      }
    } catch (e) {
      console.error('[iperf3] Server creation error:', e);
      if (iperfProcess) {
        try {
          iperfProcess.kill();
        } catch (err) {}
        iperfProcess = null;
      }
      return { success: false, running: false, error: e.message };
    }
  });

  // Stop iperf3 server
  ipcMain.handle('iperf-stop', async () => {
    try {
      if (iperfProcess) {
        console.log('[iperf3] Stopping server...');
        iperfProcess.kill();
        iperfProcess = null;
        return { success: true };
      }
      return { success: true, running: false };
    } catch (error) {
      console.error('[iperf3] Error stopping server:', error);
      return { success: false, error: error.message };
    }
  });
}

/**
 * Cleanup iperf3 server
 */
export function cleanupIperfServer() {
  if (iperfProcess) {
    try {
      iperfProcess.kill();
    } catch (e) {
      // Ignore errors during cleanup
    }
    iperfProcess = null;
  }
}

