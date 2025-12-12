import { spawn } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
import http from 'node:http';
import { app, ipcMain } from 'electron';

// Backend process management
let pyProc = null;
const BACKEND_PORT = 54111;
const BACKEND_URL = `http://127.0.0.1:${BACKEND_PORT}`;

/**
 * Kill any existing processes on the backend port
 */
async function killExistingProcesses() {
  try {
    const { exec } = require('node:child_process');
    const util = require('node:util');
    const execAsync = util.promisify(exec);
    
    let command, killCommand;
    
    if (process.platform === 'win32') {
      command = `netstat -ano | findstr :${BACKEND_PORT}`;
      killCommand = (pid) => `taskkill /F /PID ${pid}`;
    } else {
      command = `lsof -ti:${BACKEND_PORT}`;
      killCommand = (pid) => `kill -9 ${pid}`;
    }
    
    const { stdout } = await execAsync(command);
    if (stdout.trim()) {
      let pids;
      
      if (process.platform === 'win32') {
        const lines = stdout.trim().split('\n');
        pids = lines.map(line => {
          const parts = line.trim().split(/\s+/);
          return parts[parts.length - 1];
        }).filter(pid => pid && !isNaN(pid));
      } else {
        pids = stdout.trim().split('\n').filter(pid => pid && !isNaN(pid));
      }
      
      if (pids.length > 0) {
        console.log(`Found ${pids.length} existing process(es) on port ${BACKEND_PORT}:`, pids);
        
        const killPromises = pids.map(async (pid) => {
          try {
            await execAsync(killCommand(pid));
            console.log(`✅ Killed process ${pid}`);
            return { pid, success: true };
          } catch (error) {
            console.log(`❌ Failed to kill process ${pid}:`, error.message);
            return { pid, success: false, error: error.message };
          }
        });
        
        await Promise.all(killPromises);
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
  } catch (error) {
    // No processes found or other error - this is usually fine
    console.log('No existing processes found on port', BACKEND_PORT);
  }
}

/**
 * Wait for backend health check
 */
async function waitForHealth(url, timeoutMs = 30000) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const checkHealth = () => {
      const req = http.get(`${url}/health`, (res) => {
        if (res.statusCode === 200) {
          resolve(true);
        } else {
          retry();
        }
      });
      
      req.on('error', retry);
      req.setTimeout(3000, () => {
        req.destroy();
        retry();
      });
    };
    
    const retry = () => {
      if (Date.now() - start > timeoutMs) {
        reject(new Error('Backend health check timeout'));
      } else {
        setTimeout(checkHealth, 1000);
      }
    };
    
    checkHealth();
  });
}

/**
 * Start Python backend
 */
export async function startBackend() {
  try {
    console.log('Starting backend...');
    
    // First, kill any existing processes on the port
    await killExistingProcesses();
    
    const userDataPath = app.getPath('userData');
    console.log(`User data path: ${userDataPath}`);

    // Determine backend executable path
    let backendExecutable;
    if (process.env.NODE_ENV === 'development' || !app.isPackaged) {
      // Development mode: use uv or python to run the backend
      const backendDir = path.join(process.cwd(), 'backend');
      console.log('Development mode: using uv/python to run backend');
      console.log('Backend directory:', backendDir);
      
      if (!fs.existsSync(backendDir)) {
        throw new Error(`Backend directory not found: ${backendDir}`);
      }
      
      // Find uv or python executable
      let cmd = null;
      let args = [];
      
      // Try uv first
      const uvCmd = process.platform === 'win32' ? 'uv.cmd' : 'uv';
      try {
        const { execSync } = require('child_process');
        if (process.platform === 'win32') {
          execSync(`where ${uvCmd}`, { stdio: 'ignore' });
        } else {
          execSync(`which ${uvCmd}`, { stdio: 'ignore' });
        }
        cmd = uvCmd;
        args = ['run', 'uvicorn', 'app:app', '--host', '127.0.0.1', '--port', String(BACKEND_PORT), '--reload', '--limit-max-requests', '10000', '--timeout-keep-alive', '300'];
        console.log(`Using uv to run backend`);
      } catch (e) {
        // uv not found, try python
        const pythonCmd = process.platform === 'win32' ? 'python' : 'python3';
        try {
          if (process.platform === 'win32') {
            execSync(`where ${pythonCmd}`, { stdio: 'ignore' });
          } else {
            execSync(`which ${pythonCmd}`, { stdio: 'ignore' });
          }
          cmd = pythonCmd;
          args = ['-m', 'uvicorn', 'app:app', '--host', '127.0.0.1', '--port', String(BACKEND_PORT), '--reload', '--limit-max-requests', '10000', '--timeout-keep-alive', '300'];
          console.log(`Using python to run backend`);
        } catch (e2) {
          throw new Error('Neither uv nor python found. Please install uv or python.');
        }
      }
      
      console.log(`Starting backend with command: ${cmd} ${args.join(' ')}`);
      
      pyProc = spawn(cmd, args, {
        cwd: backendDir,
        env: { 
          ...process.env, 
          PYTHONUNBUFFERED: '1',
          ASH_DATA_DIR: userDataPath
        },
        stdio: ['pipe', 'pipe', 'pipe'],
        shell: process.platform === 'win32'
      });
    } else {
      // Production mode: use PyInstaller bundled executable
      console.log('Production mode: using PyInstaller bundled backend');
      console.log('process.resourcesPath:', process.resourcesPath);
      console.log('process.cwd():', process.cwd());
      console.log('app.getAppPath():', app.getAppPath());
      console.log('app.getPath(exe):', app.getPath('exe'));
      
      // Try multiple possible paths for the backend executable
      const exeExtension = process.platform === 'win32' ? '.exe' : '';
      const appPath = app.getAppPath();
      const exePath = app.getPath('exe');
      const exeDir = path.dirname(exePath);
      
      const possiblePaths = [
        // Most common: resources folder (extraResources)
        process.resourcesPath ? path.join(process.resourcesPath, `ash-backend${exeExtension}`) : null,
        // Unpacked asar resources (when asar is used)
        process.resourcesPath ? path.join(process.resourcesPath, 'app.asar.unpacked', `ash-backend${exeExtension}`) : null,
        // Same directory as exe (Windows installer sometimes puts resources here)
        path.join(exeDir, `ash-backend${exeExtension}`),
        // Resources relative to exe
        path.join(exeDir, 'resources', `ash-backend${exeExtension}`),
        // App path resources
        path.join(appPath, '..', 'resources', `ash-backend${exeExtension}`),
        path.join(appPath, '..', `ash-backend${exeExtension}`),
        // Development fallback
        path.join(process.cwd(), 'backend', 'dist', `ash-backend${exeExtension}`),
        // Alternative resource path
        path.join(__dirname, '..', '..', `ash-backend${exeExtension}`),
        // App bundle path (macOS)
        process.resourcesPath ? path.join(process.resourcesPath, '..', '..', `ash-backend${exeExtension}`) : null,
        // Windows-specific: try parent directories
        ...(process.platform === 'win32' ? [
          path.join(exeDir, '..', 'resources', `ash-backend${exeExtension}`),
          path.join(exeDir, '..', `ash-backend${exeExtension}`),
          // Try without extension as fallback
          process.resourcesPath ? path.join(process.resourcesPath, 'ash-backend') : null,
          process.resourcesPath ? path.join(process.resourcesPath, 'app.asar.unpacked', 'ash-backend') : null,
        ] : [])
      ].filter(Boolean);
      
      console.log('Checking possible backend paths:', possiblePaths);
      
      // Debug: List files in resources directory if it exists
      if (process.resourcesPath && fs.existsSync(process.resourcesPath)) {
        try {
          const files = fs.readdirSync(process.resourcesPath);
          console.log('Files in resourcesPath:', files);
          
          // Check subdirectories too
          for (const file of files) {
            const fullPath = path.join(process.resourcesPath, file);
            try {
              const stat = fs.statSync(fullPath);
              if (stat.isDirectory()) {
                const subFiles = fs.readdirSync(fullPath);
                console.log(`Files in ${file}/:`, subFiles);
              }
            } catch (e) {
              // Ignore
            }
          }
        } catch (err) {
          console.log('Could not read resourcesPath:', err.message);
        }
      }
      
      // Debug: List files in exe directory
      if (fs.existsSync(exeDir)) {
        try {
          const files = fs.readdirSync(exeDir);
          console.log('Files in exe directory:', files);
          
          // Check for resources subdirectory
          const resourcesDir = path.join(exeDir, 'resources');
          if (fs.existsSync(resourcesDir)) {
            const resFiles = fs.readdirSync(resourcesDir);
            console.log('Files in exe/resources/:', resFiles);
          }
        } catch (err) {
          console.log('Could not read exe directory:', err.message);
        }
      }
      
      let backendExecutable = null;
      for (const testPath of possiblePaths) {
        console.log(`Checking path: ${testPath}`);
        try {
          if (fs.existsSync(testPath)) {
            // Verify it's actually a file (not a directory)
            const stat = fs.statSync(testPath);
            if (stat.isFile()) {
              backendExecutable = testPath;
              console.log(`✅ Found backend executable at: ${testPath}`);
              break;
            } else {
              console.log(`⚠️ Path exists but is not a file: ${testPath}`);
            }
          } else {
            console.log(`❌ Backend executable not found at: ${testPath}`);
          }
        } catch (err) {
          console.log(`❌ Error checking path ${testPath}:`, err.message);
        }
      }
      
      if (!backendExecutable) {
        // Try a more aggressive search: look for any file matching the name pattern
        console.log('Attempting broader search for backend executable...');
        const searchDirs = [
          process.resourcesPath,
          exeDir,
          path.join(exeDir, 'resources'),
          appPath
        ].filter(Boolean);
        
        const searchPattern = `ash-backend${exeExtension}`;
        for (const searchDir of searchDirs) {
          if (fs.existsSync(searchDir)) {
            try {
              const files = fs.readdirSync(searchDir);
              for (const file of files) {
                if (file.includes('ash-backend') || file.includes('backend')) {
                  const fullPath = path.join(searchDir, file);
                  try {
                    const stat = fs.statSync(fullPath);
                    if (stat.isFile()) {
                      console.log(`🔍 Found potential backend file: ${fullPath}`);
                      // Try to execute it (just check if it exists and is executable)
                      backendExecutable = fullPath;
                      break;
                    }
                  } catch (e) {
                    // Continue
                  }
                }
              }
              if (backendExecutable) break;
            } catch (e) {
              // Continue
            }
          }
        }
      }
      
      if (!backendExecutable) {
        const errorMsg = `Backend executable not found. Searched in:\n${possiblePaths.map(p => `  - ${p}`).join('\n')}\n\nPlease ensure the backend executable (ash-backend${exeExtension}) is included in the app package.`;
        console.error(errorMsg);
        throw new Error(errorMsg);
      }
      
      console.log('Using backend executable:', backendExecutable);
      
      // Make executable on Unix-like systems
      if (process.platform !== 'win32') {
        try {
          fs.chmodSync(backendExecutable, '755');
        } catch (error) {
          console.warn('Failed to set executable permissions:', error.message);
        }
      }
      
      console.log(`Starting backend executable: ${backendExecutable}`);
      
      pyProc = spawn(backendExecutable, [], {
        env: { 
          ...process.env, 
          PYTHONUNBUFFERED: '1',
          ASH_DATA_DIR: userDataPath
        },
        stdio: ['pipe', 'pipe', 'pipe']
      });
    }
    
    console.log(`Backend process started with PID: ${pyProc.pid}`);
    
    // Log backend output to file
    const logPath = path.join(app.getPath('userData'), 'backend.log');
    console.log('Logging backend output to:', logPath);
    const logStream = fs.createWriteStream(logPath, { flags: 'a' });
    
    pyProc.stdout.on('data', (data) => {
      const message = data.toString().trim();
      console.log('[Backend]', message);
      logStream.write(`[stdout] ${message}\n`);
    });
    
    pyProc.stderr.on('data', (data) => {
      const message = data.toString().trim();
      console.error('[Backend Error]', message);
      logStream.write(`[stderr] ${message}\n`);
    });
    
    pyProc.on('exit', (code) => {
      console.log(`Backend process exited with code ${code}`);
      pyProc = null;
      logStream.end();
    });
    
    pyProc.on('error', (error) => {
      console.error('Failed to start backend:', error);
      pyProc = null;
      logStream.end();
    });
    
    // Wait a moment for the backend to fully initialize
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Wait for backend to be ready (with timeout handling)
    console.log('Waiting for backend to be ready...');
    try {
      await waitForHealth(BACKEND_URL, 30000);
      console.log('✅ Backend is ready');
      return true;
    } catch (healthError) {
      console.error('Backend health check failed:', healthError.message);
      // Don't kill the process - it might still be starting
      // Return false but let the process continue running
      return false;
    }
  } catch (error) {
    console.error('Failed to start backend:', error);
    if (pyProc) {
      pyProc.kill();
      pyProc = null;
    }
    return false;
  }
}

/**
 * Stop Python backend
 */
export async function stopBackend() {
  console.log('Stopping backend...');
  
  // First, try to stop the managed process
  if (pyProc) {
    try {
      console.log(`Stopping backend process with PID: ${pyProc.pid}`);
      
      // Try graceful shutdown first
      if (process.platform === 'win32') {
        // Windows: kill() without signal works
        pyProc.kill();
      } else {
        // Unix-like: use SIGTERM first
        pyProc.kill('SIGTERM');
      }
      
      // Wait for graceful shutdown with timeout
      await new Promise((resolve) => {
        const timeout = setTimeout(() => {
          if (pyProc && !pyProc.killed) {
            console.log('Graceful shutdown timeout, force killing backend process...');
            try {
              if (process.platform === 'win32') {
                pyProc.kill();
              } else {
                pyProc.kill('SIGKILL');
              }
            } catch (error) {
              console.error('Error force killing backend process:', error);
            }
          }
          resolve();
        }, 3000); // 3 second timeout
        
        pyProc.on('exit', (code) => {
          console.log(`Backend process exited with code: ${code}`);
          clearTimeout(timeout);
          resolve();
        });
      });
    } catch (error) {
      console.error('Error stopping backend process:', error);
    }
    
    pyProc = null;
  }
  
  // Always kill any remaining processes on the port as a safety measure
  console.log('Killing any remaining processes on backend port...');
  await killExistingProcesses();
  
  console.log('Backend stopped');
}

/**
 * Get backend URL
 */
export function getBackendUrl() {
  return BACKEND_URL;
}

/**
 * Check if backend is running
 */
export function isBackendRunning() {
  return pyProc !== null;
}

/**
 * Initialize IPC handlers for backend control
 */
export function initializeBackendHandlers() {
  // Start backend
  ipcMain.handle('backend-start', async () => {
    try {
      const result = await startBackend();
      return { success: result };
    } catch (error) {
      console.error('IPC: Failed to start backend:', error);
      return { success: false, error: error.message };
    }
  });

  // Stop backend
  ipcMain.handle('backend-stop', async () => {
    try {
      await stopBackend();
      return { success: true };
    } catch (error) {
      console.error('IPC: Failed to stop backend:', error);
      return { success: false, error: error.message };
    }
  });

  // Get backend status
  ipcMain.handle('backend-status-check', async () => {
    try {
      const isRunning = isBackendRunning();
      return { 
        success: true, 
        running: isRunning,
        url: BACKEND_URL 
      };
    } catch (error) {
      console.error('IPC: Failed to check backend status:', error);
      return { success: false, error: error.message };
    }
  });
}

