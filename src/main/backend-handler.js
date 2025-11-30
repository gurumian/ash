import { spawn } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
import http from 'node:http';
import { app } from 'electron';

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
        args = ['run', 'uvicorn', 'app:app', '--host', '127.0.0.1', '--port', String(BACKEND_PORT), '--reload'];
        console.log(`Using uv to run backend`);
      } catch (e) {
        // uv not found, try python
        const pythonCmd = process.platform === 'win32' ? 'python' : 'python3';
        try {
          execSync(`which ${pythonCmd}`, { stdio: 'ignore' });
          cmd = pythonCmd;
          args = ['-m', 'uvicorn', 'app:app', '--host', '127.0.0.1', '--port', String(BACKEND_PORT), '--reload'];
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
      // Production mode: use PyInstaller bundled executable (TODO: implement)
      console.log('Production mode: PyInstaller bundled backend not yet implemented');
      throw new Error('Production mode backend not yet implemented');
    }
    
    // Handle backend process output
    pyProc.stdout.on('data', (data) => {
      console.log(`[Backend] ${data.toString()}`);
    });
    
    pyProc.stderr.on('data', (data) => {
      console.error(`[Backend Error] ${data.toString()}`);
    });
    
    pyProc.on('close', (code) => {
      console.log(`Backend process exited with code ${code}`);
      pyProc = null;
    });
    
    pyProc.on('error', (error) => {
      console.error('Failed to start backend:', error);
      pyProc = null;
    });
    
    // Wait for backend to be ready
    console.log('Waiting for backend to be ready...');
    await waitForHealth(BACKEND_URL, 30000);
    console.log('✅ Backend is ready');
    
    return { success: true, url: BACKEND_URL };
  } catch (error) {
    console.error('Failed to start backend:', error);
    if (pyProc) {
      pyProc.kill();
      pyProc = null;
    }
    throw error;
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
      pyProc.kill('SIGTERM');
      
      // Wait for graceful shutdown with timeout
      await new Promise((resolve) => {
        const timeout = setTimeout(() => {
          if (pyProc && !pyProc.killed) {
            console.log('Graceful shutdown timeout, force killing backend process...');
            try {
              pyProc.kill('SIGKILL');
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

