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
    const { host, port, username, password, keepaliveInterval, keepaliveCount, readyTimeout } = connectionInfo;
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
          password: password,
          // Apply keepalive settings if provided
          keepaliveInterval: keepaliveInterval || 0, // Default to 0 (disabled) if not provided
          keepaliveCount: keepaliveCount || 3,        // Default to 3
          readyTimeout: readyTimeout || 20000         // Default to 20s
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
  ipcMain.on('ssh-write', (event, { connectionId, data }) => {
    const streamInfo = sshStreams.get(connectionId);
    if (!streamInfo || !streamInfo.stream) {
      // For one-way IPC, we can't throw/return error to caller, so we log it
      console.warn('SSH stream not found for write:', connectionId);
      return;
    }

    // Removed console.log for performance - logs on every write cause significant overhead
    try {
      streamInfo.stream.write(data);
    } catch (error) {
      console.error('SSH write error:', error);
    }
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

  // SFTP file upload with fallback to cat method
  ipcMain.handle('ssh-upload-file', async (event, { connectionId, localPath, remotePath }) => {
    const conn = sshConnections.get(connectionId);
    if (!conn) {
      throw new Error('SSH connection not found');
    }

    const fs = require('fs');
    const path = require('path');

    // Check if local file exists
    if (!fs.existsSync(localPath)) {
      throw new Error(`Local file not found: ${localPath}`);
    }

    // Get file stats for progress tracking
    const stats = fs.statSync(localPath);
    const fileSize = stats.size;

    // Try SFTP first
    try {
      return await new Promise((resolve, reject) => {
        conn.sftp((err, sftp) => {
          if (err) {
            // SFTP failed, try fallback method
            console.warn(`SFTP failed: ${err.message}, trying fallback method...`);
            reject(err); // Reject to trigger fallback
            return;
          }

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
                reject(err);
              } else {
                resolve({
                  success: true,
                  localPath,
                  remotePath,
                  fileSize,
                  method: 'sftp'
                });
              }
            }
          );
        });
      });
    } catch (sftpError) {
      // SFTP failed, try fallback: cat via SSH exec
      console.log('SFTP not available, using cat fallback method...');

      try {
        return await new Promise((resolve, reject) => {
          // Create remote directory if needed
          const remoteDir = path.dirname(remotePath);

          // Use cat to write file directly via stdin
          // This is simpler and more efficient than base64 encoding
          const command = `mkdir -p "${remoteDir}" && cat > "${remotePath}"`;

          console.log(`[SSH Upload] Starting cat fallback: ${localPath} -> ${remotePath}`);

          // Execute command via SSH
          conn.exec(command, (err, stream) => {
            if (err) {
              console.error(`[SSH Upload] Exec failed:`, err);
              reject(new Error(`Fallback upload failed: ${err.message}`));
              return;
            }

            let errorOutput = '';
            let stdoutOutput = '';
            let transferred = 0;
            let isComplete = false;
            let fileStreamEnded = false;

            // Read file as stream
            const fileStream = fs.createReadStream(localPath);

            console.log(`[SSH Upload] File stream created, size: ${fileSize} bytes`);

            // Track progress
            const sendProgress = () => {
              const progress = Math.min(100, (transferred / fileSize) * 100);
              const webContents = event.sender;
              if (!webContents.isDestroyed()) {
                webContents.send('ssh-upload-progress', {
                  connectionId,
                  progress,
                  transferred,
                  total: fileSize
                });
              }
            };

            // Track transferred bytes and write to stream
            fileStream.on('data', (chunk) => {
              transferred += chunk.length;
              sendProgress();

              // Write chunk to SSH stream
              const canContinue = stream.write(chunk);
              if (!canContinue) {
                // Buffer is full, pause file stream
                fileStream.pause();
                stream.once('drain', () => {
                  fileStream.resume();
                });
              }
            });

            fileStream.on('end', () => {
              console.log(`[SSH Upload] File stream ended, transferred: ${transferred}/${fileSize}`);
              fileStreamEnded = true;
              // End the SSH stream after all data is written
              stream.end();
            });

            fileStream.on('error', (err) => {
              console.error(`[SSH Upload] File stream error:`, err);
              if (!isComplete) {
                reject(new Error(`File read error: ${err.message}`));
              }
            });

            stream.stdout.on('data', (data) => {
              stdoutOutput += data.toString();
            });

            stream.stderr.on('data', (data) => {
              errorOutput += data.toString();
              console.log(`[SSH Upload] stderr:`, data.toString());
            });

            stream.on('close', (code, signal) => {
              console.log(`[SSH Upload] Stream closed, code: ${code}, signal: ${signal}`);
              console.log(`[SSH Upload] stdout:`, stdoutOutput);
              console.log(`[SSH Upload] stderr:`, errorOutput);

              isComplete = true;
              transferred = fileSize;
              sendProgress();

              if (code === 0) {
                console.log(`[SSH Upload] Upload completed successfully`);
                resolve({
                  success: true,
                  localPath,
                  remotePath,
                  fileSize,
                  method: 'cat'
                });
              } else {
                console.error(`[SSH Upload] Upload failed with exit code ${code}`);
                reject(new Error(`Fallback upload failed with exit code ${code}: ${errorOutput || stdoutOutput || 'Unknown error'}`));
              }
            });

            stream.on('error', (err) => {
              console.error(`[SSH Upload] Stream error:`, err);
              if (!isComplete) {
                reject(new Error(`Fallback upload error: ${err.message}`));
              }
            });
          });
        });
      } catch (fallbackError) {
        // If fallback also fails, provide helpful error message
        const sftpErrorMsg = sftpError.message || String(sftpError);
        const fallbackErrorMsg = fallbackError.message || String(fallbackError);
        throw new Error(`File upload failed. SFTP error: ${sftpErrorMsg}. Fallback error: ${fallbackErrorMsg}. The remote system may not support SFTP.`);
      }
    }
  });
}

/**
 * Get SSH connections Map (for IPC bridge)
 */
export function getSSHConnections() {
  return sshConnections;
}

/**
 * Execute command on SSH connection (for IPC bridge)
 */
export async function executeSSHCommand(connectionId, command) {
  const conn = sshConnections.get(connectionId);
  if (!conn) {
    const availableIds = Array.from(sshConnections.keys());
    throw new Error(`SSH connection not found: ${connectionId}. Available: ${availableIds.join(', ')}`);
  }

  return new Promise((resolve, reject) => {
    conn.exec(command, (err, stream) => {
      if (err) {
        reject(new Error(`Failed to execute command: ${err.message}`));
        return;
      }

      let output = '';
      let errorOutput = '';

      stream.on('data', (data) => {
        output += data.toString();
      });

      stream.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });

      stream.on('close', (code) => {
        resolve({
          success: code === 0,
          output: output.trim(),
          error: errorOutput.trim(),
          exitCode: code
        });
      });

      stream.on('error', (error) => {
        reject(new Error(`Command execution error: ${error.message}`));
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

