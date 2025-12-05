import { ipcMain, BrowserWindow, app } from 'electron';
import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';
import { spawn, spawnSync } from 'child_process';

// iperf3 server management
let iperfProcess = null;
let iperfPort = 5201; // Standard iperf3 port
let iperfHost = '0.0.0.0';
let iperfProtocol = 'tcp';
let iperfStreams = 1;
let iperfBandwidth = null;
let mainWindow = null;

// iperf3 client management
let iperfClientProcess = null;

// Cache for found iperf3 full path (from isIperf3Available check)
let cachedIperf3FullPath = null;

/**
 * Set main window reference for error dialogs
 */
export function setMainWindow(window) {
  mainWindow = window;
}

/**
 * Check if iperf3 binary is available at the given path
 */
function isIperf3Available(binaryPath) {
  const platform = process.platform;
  
  if (platform === 'win32') {
    // For Windows, check if it's a full path (bundled binary)
    if (path.isAbsolute(binaryPath) || binaryPath.includes(path.sep)) {
      return fs.existsSync(binaryPath);
    }
    // For system PATH binary, try to execute it (same as actual execution)
    try {
      const result = spawnSync(binaryPath, ['--version'], { 
        stdio: 'ignore',
        timeout: 3000,
        env: process.env
      });
      if (result.status === 0) {
        // Find the actual path using 'where' command
        try {
          const whereResult = spawnSync('where', [binaryPath], { 
            stdio: 'pipe',
            timeout: 3000,
            env: process.env
          });
          if (whereResult.status === 0 && whereResult.stdout) {
            const fullPath = whereResult.stdout.toString().trim().split('\n')[0].trim();
            if (fullPath && fs.existsSync(fullPath)) {
              cachedIperf3FullPath = fullPath;
            }
          }
        } catch (e) {
          // Ignore where command failure
        }
        return true;
      }
      return false;
    } catch (e) {
      return false;
    }
  } else if (platform === 'darwin') {
    // macOS: check common installation paths first, then try PATH
    // This handles packaged apps where PATH may be restricted
    if (binaryPath === 'iperf3' || !path.isAbsolute(binaryPath)) {
      // Common Homebrew paths
      const commonPaths = [
        '/opt/homebrew/bin/iperf3',  // Apple Silicon Homebrew
        '/usr/local/bin/iperf3',     // Intel Mac Homebrew
        '/usr/bin/iperf3'            // System default
      ];

      // Check if binary exists at common paths
      for (const binPath of commonPaths) {
        if (fs.existsSync(binPath)) {
          // Verify it's executable by trying to run it
          try {
            const result = spawnSync(binPath, ['--version'], { 
              stdio: 'ignore',
              timeout: 3000
            });
            if (result.status === 0) {
              // Cache the full path for actual execution
              cachedIperf3FullPath = binPath;
              return true;
            }
          } catch (e) {
            // Continue to next path
          }
        }
      }

      // Fallback: try to execute iperf3 from PATH (may work in some cases)
      try {
        const result = spawnSync('iperf3', ['--version'], { 
          stdio: 'ignore',
          timeout: 3000
        });
        return result.status === 0;
      } catch (e) {
        return false;
      }
    } else {
      // Full path provided, check if it exists and is executable
      if (fs.existsSync(binaryPath)) {
        try {
          const result = spawnSync(binaryPath, ['--version'], { 
            stdio: 'ignore',
            timeout: 3000
          });
          return result.status === 0;
        } catch (e) {
          return false;
        }
      }
      return false;
    }
  } else {
    // Linux: try to execute iperf3 from PATH (same as actual execution)
    if (binaryPath === 'iperf3' || !path.isAbsolute(binaryPath)) {
      try {
        const result = spawnSync('iperf3', ['--version'], { 
          stdio: 'ignore',
          timeout: 3000,
          env: process.env
        });
        if (result.status === 0) {
          // Find the actual path using 'which' command
          try {
            const whichResult = spawnSync('which', ['iperf3'], { 
              stdio: 'pipe',
              timeout: 3000,
              env: process.env
            });
            if (whichResult.status === 0 && whichResult.stdout) {
              const fullPath = whichResult.stdout.toString().trim();
              if (fullPath && fs.existsSync(fullPath)) {
                cachedIperf3FullPath = fullPath;
              }
            }
          } catch (e) {
            // Ignore which command failure
          }
          return true;
        }
        return false;
      } catch (e) {
        return false;
      }
    } else {
      // Full path provided, check if it exists and is executable
      if (fs.existsSync(binaryPath)) {
        try {
          const result = spawnSync(binaryPath, ['--version'], { 
            stdio: 'ignore',
            timeout: 3000,
            env: process.env
          });
          return result.status === 0;
        } catch (e) {
          return false;
        }
      }
      return false;
    }
  }
}

/**
 * Get iperf3 binary path
 * - Windows: Use bundled binary from assets/bin (if exists) or system iperf3.exe
 * - macOS/Linux: Use cached full path if available, otherwise use system iperf3
 */
function getIperf3BinaryPath() {
  const platform = process.platform;
  const binaryName = platform === 'win32' ? 'iperf3.exe' : 'iperf3';
  
  // Windows: Use bundled binary (if exists) or system iperf3.exe
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
  
  // macOS/Linux: Use cached full path if available (from isIperf3Available check)
  if (cachedIperf3FullPath) {
    return cachedIperf3FullPath;
  }
  
  // Fallback to system iperf3 (will try PATH)
  return 'iperf3';
}

/**
 * Check if iperf3 is available on the system
 */
export function checkIperf3Available() {
  // Clear cache to force re-check
  cachedIperf3FullPath = null;
  const binaryPath = getIperf3BinaryPath();
  return isIperf3Available(binaryPath);
}

/**
 * Initialize iperf3 handlers
 */
export function initializeIperfHandlers() {
  // Check if iperf3 is available
  ipcMain.handle('iperf-check-available', async () => {
    return { available: checkIperf3Available() };
  });

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
      
      // Check if binary exists and is available
      if (!isIperf3Available(binaryPath)) {
        let errorMsg;
        if (process.platform === 'win32') {
          if (binaryPath !== 'iperf3.exe' && !fs.existsSync(binaryPath)) {
            // Bundled binary not found
            errorMsg = `iperf3 binary not found at: ${binaryPath}\n\nPlease run: npm run download-iperf3:all to download Windows binary.`;
          } else {
            // System iperf3.exe not found in PATH
            errorMsg = `iperf3 is not installed on your system.\n\nPlease install iperf3:\n  - Download from https://iperf.fr/iperf-download.php\n  - Or install via package manager (e.g., Chocolatey: choco install iperf3)`;
          }
        } else {
          // macOS/Linux: iperf3 not found in system PATH
          errorMsg = `iperf3 is not installed on your system.\n\nPlease install it:\n  macOS: brew install iperf3\n  Linux: sudo apt-get install iperf3 (or sudo yum install iperf3)`;
        }
        
        console.error(`[iperf3] ${errorMsg}`);
        
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('iperf-server-error', {
            title: 'iperf3 Server Error',
            message: 'iperf3 is not available',
            detail: errorMsg,
            error: null
          });
        }
        
        return { success: false, running: false, error: errorMsg };
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
        
        // Handle ENOENT (file not found) error specifically
        if (err.code === 'ENOENT') {
          let errorMsg;
          if (process.platform === 'win32') {
            errorMsg = `iperf3 is not installed on your system.\n\nPlease install iperf3:\n  - Download from https://iperf.fr/iperf-download.php\n  - Or install via package manager (e.g., Chocolatey: choco install iperf3)`;
          } else {
            errorMsg = `iperf3 is not installed on your system.\n\nPlease install it:\n  macOS: brew install iperf3\n  Linux: sudo apt-get install iperf3 (or sudo yum install iperf3)`;
          }
          serverError = errorMsg;
          
          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('iperf-server-error', {
              title: 'iperf3 Server Error',
              message: 'iperf3 is not available',
              detail: errorMsg,
              error: { code: err.code, message: err.message }
            });
          }
        } else {
          serverError = err.message || `Failed to start iperf3: ${err.code || 'Unknown error'}`;
        }
        
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

/**
 * Initialize iperf3 client handlers
 */
export function initializeIperfClientHandlers() {
  // Get iperf3 client status
  ipcMain.handle('iperf-client-status', async () => {
    return { 
      running: iperfClientProcess !== null && iperfClientProcess.exitCode === null
    };
  });

  // Start iperf3 client
  ipcMain.handle('iperf-client-start', async (_event, params) => {
    try {
      if (iperfClientProcess && iperfClientProcess.exitCode === null) {
        return { success: false, error: 'iperf3 client is already running' };
      }
      
      const targetHost = params?.host || 'localhost';
      const targetPort = params?.port || 5201;
      const protocol = (params?.protocol || 'tcp').toString().toLowerCase();
      const streams = parseInt(params?.streams, 10) || 1;
      const bandwidth = params?.bandwidth ? String(params.bandwidth).trim() : null;
      const duration = parseInt(params?.duration, 10) || 10;
      
      const binaryPath = getIperf3BinaryPath();
      
      // Check if binary exists and is available
      if (!isIperf3Available(binaryPath)) {
        let errorMsg;
        if (process.platform === 'win32') {
          if (binaryPath !== 'iperf3.exe' && !fs.existsSync(binaryPath)) {
            errorMsg = `iperf3 binary not found at: ${binaryPath}\n\nPlease run: npm run download-iperf3:all to download Windows binary.`;
          } else {
            errorMsg = `iperf3 is not installed on your system.\n\nPlease install iperf3:\n  - Download from https://iperf.fr/iperf-download.php\n  - Or install via package manager (e.g., Chocolatey: choco install iperf3)`;
          }
        } else {
          errorMsg = `iperf3 is not installed on your system.\n\nPlease install it:\n  macOS: brew install iperf3\n  Linux: sudo apt-get install iperf3 (or sudo yum install iperf3)`;
        }
        
        console.error(`[iperf3-client] ${errorMsg}`);
        
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('iperf-client-error', {
            title: 'iperf3 Client Error',
            message: 'iperf3 is not available',
            detail: errorMsg,
            error: null
          });
        }
        
        return { success: false, error: errorMsg };
      }
      
      // Build iperf3 client command
      const args = ['-c', targetHost, '-p', targetPort.toString(), '-t', duration.toString()];
      
      if (protocol === 'udp') {
        args.push('-u');
        if (bandwidth) {
          args.push('-b', bandwidth);
        }
      }
      
      if (streams > 1) {
        args.push('-P', streams.toString());
      }
      
      console.log(`[iperf3-client] Starting client: ${binaryPath} ${args.join(' ')}`);
      
      iperfClientProcess = spawn(binaryPath, args, {
        stdio: ['ignore', 'pipe', 'pipe']
      });
      
      let stderrOutput = '';
      let stdoutOutput = '';
      
      // Capture stdout
      iperfClientProcess.stdout.on('data', (data) => {
        const output = data.toString();
        stdoutOutput += output;
        console.log(`[iperf3-client] stdout: ${output}`);
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('iperf-client-output', { output });
        }
      });
      
      // Capture stderr
      iperfClientProcess.stderr.on('data', (data) => {
        const output = data.toString();
        stderrOutput += output;
        console.error(`[iperf3-client] stderr: ${output}`);
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('iperf-client-output', { output });
        }
      });
      
      // Handle process exit
      iperfClientProcess.on('exit', (code, signal) => {
        console.log(`[iperf3-client] Client exited with code ${code}, signal ${signal}`);
        const finalOutput = stdoutOutput + stderrOutput;
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('iperf-client-stopped', { 
            code, 
            signal,
            output: finalOutput ? `\n[Process exited with code ${code}]\n` : null
          });
        }
        iperfClientProcess = null;
      });
      
      // Handle process error (spawn failure)
      iperfClientProcess.on('error', (err) => {
        console.error(`[iperf3-client] Process error:`, err);
        
        let errorMsg;
        if (err.code === 'ENOENT') {
          if (process.platform === 'win32') {
            errorMsg = `iperf3 is not installed on your system.\n\nPlease install iperf3:\n  - Download from https://iperf.fr/iperf-download.php\n  - Or install via package manager (e.g., Chocolatey: choco install iperf3)`;
          } else {
            errorMsg = `iperf3 is not installed on your system.\n\nPlease install it:\n  macOS: brew install iperf3\n  Linux: sudo apt-get install iperf3 (or sudo yum install iperf3)`;
          }
        } else {
          errorMsg = err.message || `Failed to start iperf3 client: ${err.code || 'Unknown error'}`;
        }
        
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('iperf-client-error', {
            title: 'iperf3 Client Error',
            message: 'Failed to start iperf3 client',
            detail: errorMsg,
            error: { code: err.code, message: err.message }
          });
        }
        
        iperfClientProcess = null;
      });
      
      return { success: true };
    } catch (e) {
      console.error('[iperf3-client] Client creation error:', e);
      if (iperfClientProcess) {
        try {
          iperfClientProcess.kill();
        } catch (err) {}
        iperfClientProcess = null;
      }
      return { success: false, error: e.message };
    }
  });

  // Stop iperf3 client
  ipcMain.handle('iperf-client-stop', async () => {
    try {
      if (iperfClientProcess) {
        console.log('[iperf3-client] Stopping client...');
        iperfClientProcess.kill();
        iperfClientProcess = null;
        return { success: true };
      }
      return { success: true, running: false };
    } catch (error) {
      console.error('[iperf3-client] Error stopping client:', error);
      return { success: false, error: error.message };
    }
  });
}

/**
 * Cleanup iperf3 client
 */
export function cleanupIperfClient() {
  if (iperfClientProcess) {
    try {
      iperfClientProcess.kill();
    } catch (e) {
      // Ignore errors during cleanup
    }
    iperfClientProcess = null;
  }
}

