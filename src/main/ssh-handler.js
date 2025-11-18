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
  ipcMain.handle('ssh-start-shell', async (event, connectionId) => {
    const conn = sshConnections.get(connectionId);
    if (!conn) {
      throw new Error('SSH connection not found');
    }
    
    return new Promise((resolve, reject) => {
      conn.shell((err, stream) => {
        if (err) {
          reject(new Error(`Failed to start shell: ${err.message}`));
          return;
        }
        
        // Save stream
        sshStreams.set(connectionId, stream);
        
        resolve({ success: true, streamId: stream.id });
        
        // Send terminal data to renderer
        stream.on('data', (data) => {
          console.log(`SSH data for connectionId ${connectionId}`);
          event.sender.send('ssh-data', { connectionId: connectionId, data: data.toString() });
        });
        
        stream.on('close', () => {
          console.log(`SSH connection closed: ${connectionId}`);
          event.sender.send('ssh-closed', { connectionId: connectionId });
          sshStreams.delete(connectionId);
        });
      });
    });
  });

  // Send data to SSH terminal
  ipcMain.handle('ssh-write', async (event, { connectionId, data }) => {
    const stream = sshStreams.get(connectionId);
    if (!stream) {
      throw new Error('SSH stream not found');
    }
    
    console.log(`SSH write to connectionId ${connectionId}: ${data.length} bytes`);
    stream.write(data);
    return { success: true };
  });

  // Disconnect SSH connection
  ipcMain.handle('ssh-disconnect', async (event, connectionId) => {
    const stream = sshStreams.get(connectionId);
    if (stream) {
      stream.end();
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
}

/**
 * Cleanup SSH connections
 */
export function cleanupSSHConnections() {
  sshStreams.forEach((stream) => stream.end());
  sshConnections.forEach((conn) => conn.end());
  sshStreams.clear();
  sshConnections.clear();
}

