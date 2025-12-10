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


