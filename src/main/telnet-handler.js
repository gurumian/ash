import { ipcMain } from 'electron';
import net from 'net';

// Telnet connection management
let telnetConnections = new Map();
let telnetStreams = new Map();

// telnet-stream is dynamically imported only in main process
let TelnetSocket;

/**
 * Initialize Telnet handlers
 */
export function initializeTelnetHandlers() {
  // Telnet connection IPC handler
  ipcMain.handle('telnet-connect', async (event, connectionInfo) => {
    const { host, port } = connectionInfo;
    const connectionId = require('crypto').randomUUID();
    
    try {
      // Dynamically import telnet-stream
      if (!TelnetSocket) {
        const telnetStream = require('telnet-stream');
        TelnetSocket = telnetStream.TelnetSocket;
      }
      
      return new Promise((resolve, reject) => {
        // Create TCP socket - following example style: net.createConnection(port, host)
        const socket = net.createConnection(parseInt(port), host);
        
        // Disable timeout to prevent idle timeout issues
        socket.setTimeout(0);
        
        // Decorate socket as TelnetSocket - do this immediately like in examples
        const tSocket = new TelnetSocket(socket);
        
        // Save webContents reference for later use
        const webContents = event.sender;
        
        // IMPORTANT: Save to maps immediately so data handlers can work right away
        // This ensures we don't miss any data that arrives immediately after connection
        telnetConnections.set(connectionId, { socket, tSocket });
        telnetStreams.set(connectionId, { tSocket, webContents });
        
        let isConnected = false;
        let isClosed = false;
        
        const handleClose = () => {
          if (isClosed) return;
          isClosed = true;
          
          telnetConnections.delete(connectionId);
          telnetStreams.delete(connectionId);
          
          try {
            if (!webContents.isDestroyed()) {
              webContents.send('telnet-closed', { connectionId: connectionId });
            }
          } catch (error) {
            console.warn('Failed to send Telnet closed event:', error.message);
          }
        };
        
        // Set up Telnet event listeners BEFORE connection (following example pattern)
        // Telnet option codes
        const ECHO = 1; // RFC 857
        const SUPPRESS_GO_AHEAD = 3; // RFC 858
        
        // Handle Telnet option negotiations
        tSocket.on('do', (option) => {
          // Server wants us to enable an option
          if (option === ECHO) {
            // Server wants to echo - accept it (DO ECHO)
            tSocket.writeWill(option);
          } else if (option === SUPPRESS_GO_AHEAD) {
            // Server wants to suppress go ahead - accept it
            tSocket.writeWill(option);
          } else {
            // Refuse other options
            tSocket.writeWont(option);
          }
        });
        
        tSocket.on('will', (option) => {
          // Server offers to enable an option
          if (option === ECHO) {
            // Server offers to echo - accept it (DO ECHO)
            tSocket.writeDo(option);
          } else if (option === SUPPRESS_GO_AHEAD) {
            // Server offers to suppress go ahead - accept it
            tSocket.writeDo(option);
          } else {
            // Tell server we don't want other options
            tSocket.writeDont(option);
          }
        });
        
        // Send terminal data to renderer
        // IMPORTANT: Data can arrive immediately when connection is established
        // even before socket.on('connect') event fires, so we must be ready
        tSocket.on('data', (data) => {
          try {
            if (!webContents.isDestroyed() && !isClosed) {
              const dataString = data.toString();
              webContents.send('telnet-data', { connectionId: connectionId, data: dataString });
            }
          } catch (error) {
            console.error(`Error in Telnet data handler:`, error);
          }
        });
        
        // Handle telnet stream close event
        tSocket.on('close', () => {
          handleClose();
        });
        
        // Handle telnet stream end event
        tSocket.on('end', () => {
          handleClose();
        });
        
        // Handle telnet errors
        tSocket.on('error', (err) => {
          console.error(`Telnet stream error: ${connectionId}`, err);
          if (!isConnected && !isClosed) {
            reject(new Error(`Telnet connection failed: ${err.message}`));
          }
        });
        
        // Handle connection established
        socket.on('connect', () => {
          if (isClosed) return;
          
          isConnected = true;
          // Maps already set above - no need to set again
          resolve({ success: true, connectionId });
        });
        
        // Handle connection errors (only reject if not yet connected)
        socket.on('error', (err) => {
          console.error(`Telnet socket error: ${connectionId}`, err);
          if (!isConnected && !isClosed) {
            reject(new Error(`Telnet connection failed: ${err.message}`));
          }
        });
        
        // Handle socket close event
        socket.on('close', (hadError) => {
          if (isConnected && !isClosed) {
            handleClose();
          }
        });
      });
    } catch (error) {
      throw new Error(`Telnet connection failed: ${error.message}`);
    }
  });

  // Send data to Telnet connection
  ipcMain.handle('telnet-write', async (event, { connectionId, data }) => {
    const connInfo = telnetConnections.get(connectionId);
    if (!connInfo || !connInfo.tSocket) {
      throw new Error('Telnet connection not found');
    }
    
    try {
      connInfo.tSocket.write(data);
      return { success: true };
    } catch (error) {
      console.error(`Failed to write to Telnet:`, error);
      throw new Error(`Failed to write to Telnet: ${error.message}`);
    }
  });
  
  // Disconnect Telnet connection
  ipcMain.handle('telnet-disconnect', async (event, connectionId) => {
    const connInfo = telnetConnections.get(connectionId);
    if (connInfo) {
      try {
        connInfo.tSocket.end();
        connInfo.socket.end();
      } catch (error) {
        console.warn('Error closing Telnet connection:', error);
      }
      telnetConnections.delete(connectionId);
      telnetStreams.delete(connectionId);
      return { success: true };
    }
    return { success: false };
  });

  // Telnet file upload using base64 encoding
  ipcMain.handle('telnet-upload-file', async (event, { connectionId, localPath, remotePath }) => {
    const connInfo = telnetConnections.get(connectionId);
    if (!connInfo || !connInfo.tSocket) {
      throw new Error('Telnet connection not found');
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

    // For large files, warn but allow (base64 increases size by ~33%)
    if (fileSize > 10 * 1024 * 1024) { // 10MB
      console.warn(`[Telnet Upload] Large file detected: ${fileSize} bytes. Base64 encoding will increase size.`);
    }

    try {
      // Read file and encode to base64
      const fileData = fs.readFileSync(localPath);
      const base64Data = fileData.toString('base64');
      
      const webContents = event.sender;
      
      // Send progress update (encoding complete)
      if (!webContents.isDestroyed()) {
        webContents.send('telnet-upload-progress', {
          connectionId,
          progress: 30,
          transferred: fileSize,
          total: fileSize
        });
      }

      // Create remote directory if needed
      const remoteDir = path.dirname(remotePath);
      const mkdirCommand = `mkdir -p "${remoteDir}"\r\n`;
      
      // Wait a bit for mkdir to complete
      await new Promise((resolve) => {
        connInfo.tSocket.write(mkdirCommand);
        setTimeout(resolve, 200);
      });

      // Send progress update (directory created)
      if (!webContents.isDestroyed()) {
        webContents.send('telnet-upload-progress', {
          connectionId,
          progress: 50,
          transferred: fileSize,
          total: fileSize
        });
      }

      // Send base64 data using echo and pipe to base64 -d
      // Split into smaller chunks to avoid command line length limits
      const chunkSize = 32 * 1024; // 32KB chunks (base64 encoded)
      const totalChunks = Math.ceil(base64Data.length / chunkSize);
      
      // Create a temporary file to store base64 data
      const base64TempFile = `${remotePath}.b64`;
      
      // Send command to create temp file and start writing base64
      const startCommand = `cat > "${base64TempFile}" << 'EOF_BASE64'\r\n`;
      connInfo.tSocket.write(startCommand);
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Send base64 data in chunks
      for (let i = 0; i < totalChunks; i++) {
        const start = i * chunkSize;
        const end = Math.min(start + chunkSize, base64Data.length);
        const chunk = base64Data.substring(start, end);
        
        connInfo.tSocket.write(chunk);
        
        // Send progress update
        const progress = 50 + (i / totalChunks) * 40; // 50% to 90%
        if (!webContents.isDestroyed()) {
          webContents.send('telnet-upload-progress', {
            connectionId,
            progress: Math.min(progress, 90),
            transferred: fileSize,
            total: fileSize
          });
        }
        
        // Small delay between chunks
        await new Promise((resolve) => setTimeout(resolve, 20));
      }

      // Close heredoc and decode base64 to final file
      const decodeCommand = `\r\nEOF_BASE64\r\nbase64 -d "${base64TempFile}" > "${remotePath}" && rm -f "${base64TempFile}"\r\n`;
      connInfo.tSocket.write(decodeCommand);

      // Wait for command to complete (longer wait for decode operation)
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Send final progress update
      if (!webContents.isDestroyed()) {
        webContents.send('telnet-upload-progress', {
          connectionId,
          progress: 100,
          transferred: fileSize,
          total: fileSize
        });
      }

      return {
        success: true,
        localPath,
        remotePath,
        fileSize,
        method: 'base64'
      };
    } catch (error) {
      console.error('[Telnet Upload] Error:', error);
      throw new Error(`Telnet file upload failed: ${error.message}`);
    }
  });
}

/**
 * Cleanup Telnet connections
 */
export function cleanupTelnetConnections() {
  telnetConnections.forEach((connInfo) => {
    try {
      connInfo.tSocket.end();
      connInfo.socket.end();
    } catch (error) {
      console.warn('Error closing Telnet connection:', error);
    }
  });
  telnetStreams.forEach((streamInfo) => {
    try {
      streamInfo.tSocket.end();
    } catch (error) {
      console.warn('Error closing Telnet stream:', error);
    }
  });
  telnetConnections.clear();
  telnetStreams.clear();
}



