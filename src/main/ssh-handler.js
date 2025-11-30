import { ipcMain } from 'electron';

// SSH connection management
export const sshConnections = new Map();
let sshStreams = new Map();

// ssh2 is dynamically imported only in main process
let Client;

/**
 * Initialize SSH handlers
 */
export function initializeSSHHandlers() {
  // SSH connection IPC handler
  ipcMain.handle('ssh-connect', async (event, connectionInfo) => {
    const { host, port, username, password } = connectionInfo;
    const connectionId = require('crypto').randomUUID();
    
    try {
      // Dynamically import ssh2
      if (!Client) {
        const ssh2 = require('ssh2');
        Client = ssh2.Client;
      }
      
      const conn = new Client();
      
      return new Promise((resolve, reject) => {
        conn.on('ready', () => {
          sshConnections.set(connectionId, conn);
          console.log(`SSH connection established: ${connectionId}`);
          resolve({ success: true, connectionId });
        });
        
        conn.on('error', (err) => {
          reject(new Error(`SSH connection failed: ${err.message}`));
        });
        
        conn.connect({
          host: host,
          port: parseInt(port),
          username: username,
          password: password
        });
      });
    } catch (error) {
      throw new Error(`SSH connection failed: ${error.message}`);
    }
  });

  // Start SSH terminal session
  ipcMain.handle('ssh-start-shell', async (event, connectionId, cols = 80, rows = 24) => {
    const conn = sshConnections.get(connectionId);
    if (!conn) {
      throw new Error('SSH connection not found');
    }
    
    return new Promise((resolve, reject) => {
      conn.shell({
        cols: cols,
        rows: rows,
        width: cols * 8, // Approximate pixel width (8 pixels per character)
        height: rows * 16 // Approximate pixel height (16 pixels per character)
      }, (err, stream) => {
        if (err) {
          reject(new Error(`Failed to start shell: ${err.message}`));
          return;
        }
        
        // Save stream with webContents reference
        const webContents = event.sender;
        sshStreams.set(connectionId, { stream, webContents });
        
        resolve({ success: true, streamId: stream.id });
        
        // Send terminal data to renderer
        stream.on('data', (data) => {
          // Removed console.log for performance - logs on every data chunk cause significant overhead
          try {
            if (!webContents.isDestroyed()) {
              webContents.send('ssh-data', { connectionId: connectionId, data: data.toString() });
            }
          } catch (error) {
            console.warn('Failed to send SSH data:', error.message);
          }
        });
        
        stream.on('close', () => {
          console.log(`SSH connection closed: ${connectionId}`);
          try {
            if (!webContents.isDestroyed()) {
              webContents.send('ssh-closed', { connectionId: connectionId });
            }
          } catch (error) {
            console.warn('Failed to send SSH closed event:', error.message);
          }
          sshStreams.delete(connectionId);
        });
      });
    });
  });

  // Send data to SSH terminal
  ipcMain.handle('ssh-write', async (event, { connectionId, data }) => {
    const streamInfo = sshStreams.get(connectionId);
    if (!streamInfo || !streamInfo.stream) {
      throw new Error('SSH stream not found');
    }
    
    // Removed console.log for performance - logs on every write cause significant overhead
    streamInfo.stream.write(data);
    return { success: true };
  });
  
  // Resize SSH terminal
  ipcMain.handle('ssh-resize', async (event, connectionId, cols, rows) => {
    const streamInfo = sshStreams.get(connectionId);
    if (!streamInfo || !streamInfo.stream) {
      return { success: false, error: 'SSH stream not found' };
    }
    
    try {
      streamInfo.stream.setWindow(rows, cols, 0, 0);
      return { success: true };
    } catch (error) {
      console.error(`Failed to resize SSH terminal for connectionId ${connectionId}:`, error);
      return { success: false, error: error.message };
    }
  });

  // Disconnect SSH connection
  ipcMain.handle('ssh-disconnect', async (event, connectionId) => {
    const streamInfo = sshStreams.get(connectionId);
    if (streamInfo && streamInfo.stream) {
      streamInfo.stream.end();
      sshStreams.delete(connectionId);
    }
    
    const conn = sshConnections.get(connectionId);
    if (conn) {
      conn.end();
      sshConnections.delete(connectionId);
      return { success: true };
    }
    return { success: false };
  });

  // SFTP file upload
  ipcMain.handle('ssh-upload-file', async (event, { connectionId, localPath, remotePath }) => {
    const conn = sshConnections.get(connectionId);
    if (!conn) {
      throw new Error('SSH connection not found');
    }

    const fs = require('fs');
    const path = require('path');

    return new Promise((resolve, reject) => {
      conn.sftp((err, sftp) => {
        if (err) {
          reject(new Error(`SFTP error: ${err.message}`));
          return;
        }

        // Check if local file exists
        if (!fs.existsSync(localPath)) {
          reject(new Error(`Local file not found: ${localPath}`));
          return;
        }

        // Get file stats for progress tracking
        const stats = fs.statSync(localPath);
        const fileSize = stats.size;

        // Use fastPut for efficient file transfer
        sftp.fastPut(
          localPath,
          remotePath,
          {
            concurrency: 64,
            chunkSize: 32768,
            step: (totalTransferred, chunk, total) => {
              // Send progress updates
              const progress = (totalTransferred / total) * 100;
              const webContents = event.sender;
              if (!webContents.isDestroyed()) {
                webContents.send('ssh-upload-progress', {
                  connectionId,
                  progress,
                  transferred: totalTransferred,
                  total: total
                });
              }
            }
          },
          (err) => {
            if (err) {
              reject(new Error(`Upload failed: ${err.message}`));
            } else {
              resolve({
                success: true,
                localPath,
                remotePath,
                fileSize
              });
            }
          }
        );
      });
    });
  });
}

/**
 * Cleanup SSH connections
 */
export function cleanupSSHConnections() {
  sshStreams.forEach((streamInfo) => {
    if (streamInfo.stream) {
      streamInfo.stream.end();
    }
  });
  sshConnections.forEach((conn) => conn.end());
  sshStreams.clear();
  sshConnections.clear();
}

