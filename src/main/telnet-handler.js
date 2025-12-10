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
            console.log(`[TELNET-DEBUG] Server requests ECHO, accepting`);
            tSocket.writeWill(option);
          } else if (option === SUPPRESS_GO_AHEAD) {
            // Server wants to suppress go ahead - accept it
            console.log(`[TELNET-DEBUG] Server requests SUPPRESS_GO_AHEAD, accepting`);
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
            console.log(`[TELNET-DEBUG] Server offers ECHO, accepting`);
            tSocket.writeDo(option);
          } else if (option === SUPPRESS_GO_AHEAD) {
            // Server offers to suppress go ahead - accept it
            console.log(`[TELNET-DEBUG] Server offers SUPPRESS_GO_AHEAD, accepting`);
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
            console.log(`[TELNET-DEBUG] Received data for ${connectionId}, length: ${data.length}, isConnected: ${isConnected}, isClosed: ${isClosed}`);
            if (!webContents.isDestroyed() && !isClosed) {
              const dataString = data.toString();
              console.log(`[TELNET-DEBUG] Sending to renderer: ${dataString.substring(0, 100)}...`);
              webContents.send('telnet-data', { connectionId: connectionId, data: dataString });
            } else {
              console.log(`[TELNET-DEBUG] Skipping send - destroyed: ${webContents.isDestroyed()}, closed: ${isClosed}`);
            }
          } catch (error) {
            console.error(`[TELNET-DEBUG] Error in data handler:`, error);
          }
        });
        
        // Handle telnet stream close event
        tSocket.on('close', () => {
          console.log(`Telnet stream closed: ${connectionId}`);
          handleClose();
        });
        
        // Handle telnet stream end event
        tSocket.on('end', () => {
          console.log(`Telnet stream ended: ${connectionId}`);
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
          console.log(`[TELNET-DEBUG] Connection established: ${connectionId}, webContents exists: ${!!webContents}, destroyed: ${webContents.isDestroyed()}`);
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
            console.log(`Telnet socket closed: ${connectionId}${hadError ? ' (with error)' : ''}`);
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
    console.log(`[TELNET-DEBUG] telnet-write called: connectionId=${connectionId}, data length=${data.length}`);
    const connInfo = telnetConnections.get(connectionId);
    if (!connInfo || !connInfo.tSocket) {
      console.error(`[TELNET-DEBUG] Connection not found: connectionId=${connectionId}`);
      throw new Error('Telnet connection not found');
    }
    
    try {
      console.log(`[TELNET-DEBUG] Writing to tSocket: "${data.substring(0, 50)}"`);
      connInfo.tSocket.write(data);
      console.log(`[TELNET-DEBUG] Write successful`);
      return { success: true };
    } catch (error) {
      console.error(`[TELNET-DEBUG] Write error:`, error);
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

