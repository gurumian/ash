import { ipcMain } from 'electron';

// SSH connection management
let sshConnections = new Map();
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

  // Helper: Upload file via SFTP
  async function uploadViaSFTP(conn, localPath, remotePath, webContents, connectionId) {
    return new Promise((resolve, reject) => {
      conn.sftp((err, sftp) => {
        if (err) {
          reject(new Error(`SFTP error: ${err.message}`));
          return;
        }

        const fs = require('fs');
        const stats = fs.statSync(localPath);
        const fileSize = stats.size;

        sftp.fastPut(
          localPath,
          remotePath,
          {
            concurrency: 64,
            chunkSize: 32768,
            step: (totalTransferred, chunk, total) => {
              const progress = (totalTransferred / total) * 100;
              if (!webContents.isDestroyed()) {
                webContents.send('ssh-upload-progress', {
                  connectionId,
                  progress,
                  transferred: totalTransferred,
                  total: total,
                  method: 'SFTP'
                });
              }
            }
          },
          (err) => {
            if (err) {
              reject(new Error(`SFTP upload failed: ${err.message}`));
            } else {
              resolve({
                success: true,
                localPath,
                remotePath,
                fileSize,
                method: 'SFTP'
              });
            }
          }
        );
      });
    });
  }

  // Helper: Upload file via SCP
  async function uploadViaSCP(conn, localPath, remotePath, webContents, connectionId) {
    return new Promise((resolve, reject) => {
      const fs = require('fs');
      const path = require('path');
      
      // Check if local file exists
      if (!fs.existsSync(localPath)) {
        reject(new Error(`Local file not found: ${localPath}`));
        return;
      }

      const stats = fs.statSync(localPath);
      const fileSize = stats.size;
      const fileName = path.basename(remotePath);
      const remoteDir = path.dirname(remotePath);

      // Use scp command on remote server
      // Note: This requires scp to be available on the remote server
      const scpCommand = `scp -t ${remoteDir}`;
      
      conn.exec(scpCommand, (err, stream) => {
        if (err) {
          reject(new Error(`SCP exec failed: ${err.message}`));
          return;
        }

        let errorOutput = '';
        stream.stderr.on('data', (data) => {
          errorOutput += data.toString();
        });

        stream.on('close', (code) => {
          if (code !== 0) {
            reject(new Error(`SCP upload failed: ${errorOutput || `Exit code ${code}`}`));
          } else {
            resolve({
              success: true,
              localPath,
              remotePath,
              fileSize,
              method: 'SCP'
            });
          }
        });

        // SCP protocol: C0644 <size> <filename>\n
        const fileMode = stats.mode & 0o777;
        stream.write(`C0${fileMode.toString(8).padStart(3, '0')} ${fileSize} ${fileName}\n`);
        
        // Send file data
        const fileStream = fs.createReadStream(localPath);
        let transferred = 0;
        
        fileStream.on('data', (chunk) => {
          stream.write(chunk);
          transferred += chunk.length;
          const progress = (transferred / fileSize) * 100;
          if (!webContents.isDestroyed()) {
            webContents.send('ssh-upload-progress', {
              connectionId,
              progress,
              transferred,
              total: fileSize,
              method: 'SCP'
            });
          }
        });

        fileStream.on('end', () => {
          stream.write('\x00'); // SCP protocol: send null byte to confirm
          stream.end();
        });

        fileStream.on('error', (err) => {
          stream.end();
          reject(new Error(`File read error: ${err.message}`));
        });
      });
    });
  }

  // Helper: Upload file via CAT (most compatible method)
  async function uploadViaCAT(conn, localPath, remotePath, webContents, connectionId) {
    return new Promise((resolve, reject) => {
      const fs = require('fs');
      
      // Check if local file exists
      if (!fs.existsSync(localPath)) {
        reject(new Error(`Local file not found: ${localPath}`));
        return;
      }

      const stats = fs.statSync(localPath);
      const fileSize = stats.size;

      // Escape remote path for shell
      const escapedRemotePath = remotePath.replace(/'/g, "'\"'\"'");
      const catCommand = `cat > '${escapedRemotePath}'`;

      conn.exec(catCommand, (err, stream) => {
        if (err) {
          reject(new Error(`CAT exec failed: ${err.message}`));
          return;
        }

        let errorOutput = '';
        stream.stderr.on('data', (data) => {
          errorOutput += data.toString();
        });

        stream.on('close', (code) => {
          if (code !== 0) {
            reject(new Error(`CAT upload failed: ${errorOutput || `Exit code ${code}`}`));
          } else {
            resolve({
              success: true,
              localPath,
              remotePath,
              fileSize,
              method: 'CAT'
            });
          }
        });

        // Send file data
        const fileStream = fs.createReadStream(localPath);
        let transferred = 0;
        
        fileStream.on('data', (chunk) => {
          stream.write(chunk);
          transferred += chunk.length;
          const progress = (transferred / fileSize) * 100;
          if (!webContents.isDestroyed()) {
            webContents.send('ssh-upload-progress', {
              connectionId,
              progress,
              transferred,
              total: fileSize,
              method: 'CAT'
            });
          }
        });

        fileStream.on('end', () => {
          stream.end();
        });

        fileStream.on('error', (err) => {
          stream.end();
          reject(new Error(`File read error: ${err.message}`));
        });
      });
    });
  }

  // File upload with fallback: SFTP → SCP → CAT
  ipcMain.handle('ssh-upload-file', async (event, { connectionId, localPath, remotePath }) => {
    const conn = sshConnections.get(connectionId);
    if (!conn) {
      throw new Error('SSH connection not found');
    }

    const fs = require('fs');
    const webContents = event.sender;

    // Check if local file exists
    if (!fs.existsSync(localPath)) {
      throw new Error(`Local file not found: ${localPath}`);
    }

    // Try methods in order: SFTP → SCP → CAT
    let lastError = null;

    // Method 1: Try SFTP
    try {
      console.log(`[SSH Upload] Attempting SFTP upload: ${localPath} → ${remotePath}`);
      const result = await uploadViaSFTP(conn, localPath, remotePath, webContents, connectionId);
      console.log(`[SSH Upload] SFTP upload successful`);
      return result;
    } catch (err) {
      console.log(`[SSH Upload] SFTP failed: ${err.message}, trying SCP...`);
      lastError = err;
    }

    // Method 2: Try SCP
    try {
      console.log(`[SSH Upload] Attempting SCP upload: ${localPath} → ${remotePath}`);
      const result = await uploadViaSCP(conn, localPath, remotePath, webContents, connectionId);
      console.log(`[SSH Upload] SCP upload successful`);
      return result;
    } catch (err) {
      console.log(`[SSH Upload] SCP failed: ${err.message}, trying CAT...`);
      lastError = err;
    }

    // Method 3: Try CAT (most compatible, should always work if SSH works)
    try {
      console.log(`[SSH Upload] Attempting CAT upload: ${localPath} → ${remotePath}`);
      const result = await uploadViaCAT(conn, localPath, remotePath, webContents, connectionId);
      console.log(`[SSH Upload] CAT upload successful`);
      return result;
    } catch (err) {
      console.error(`[SSH Upload] All methods failed. Last error: ${err.message}`);
      throw new Error(`All upload methods failed. Last error: ${err.message}. Previous errors: ${lastError?.message || 'none'}`);
    }
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

