import { ipcMain } from 'electron';

// Serial port support
const serialConnections = new Map();

// Load serialport
let SerialPort;
try {
  const serialport = require('serialport');
  SerialPort = serialport.SerialPort;
  console.log('SerialPort loaded successfully');
} catch (error) {
  console.error('Failed to load serialport:', error);
}

/**
 * Initialize Serial port handlers
 */
export function initializeSerialHandlers() {
  // List available serial ports
  ipcMain.handle('serial-list-ports', async () => {
    try {
      if (!SerialPort) {
        console.error('SerialPort not available');
        return [];
      }
      
      const ports = await SerialPort.list();
      return ports.map(port => ({
        path: port.path,
        manufacturer: port.manufacturer,
        serialNumber: port.serialNumber,
        pnpId: port.pnpId,
        locationId: port.locationId,
        vendorId: port.vendorId,
        productId: port.productId
      }));
    } catch (error) {
      console.error('Error listing serial ports:', error);
      return [];
    }
  });

  // Connect to serial port
  ipcMain.handle('serial-connect', async (event, sessionId, options) => {
    try {
      if (!SerialPort) {
        throw new Error('SerialPort not available');
      }

      const port = new SerialPort({
        path: options.path,
        baudRate: options.baudRate || 9600,
        dataBits: options.dataBits || 8,
        stopBits: options.stopBits || 1,
        parity: options.parity || 'none',
        flowControl: options.flowControl || 'none'
      });

      const webContents = event.sender;
      serialConnections.set(sessionId, { port, webContents });

      port.on('data', (data) => {
        try {
          if (!webContents.isDestroyed()) {
            webContents.send('serial-data', sessionId, data.toString());
          }
        } catch (error) {
          console.warn('Failed to send serial data:', error.message);
        }
      });

      port.on('close', () => {
        try {
          if (!webContents.isDestroyed()) {
            webContents.send('serial-close', sessionId);
          }
        } catch (error) {
          console.warn('Failed to send serial close event:', error.message);
        }
        serialConnections.delete(sessionId);
      });

      port.on('error', (error) => {
        console.error('Serial port error:', error);
        try {
          if (!webContents.isDestroyed()) {
            webContents.send('serial-error', sessionId, error.message);
          }
        } catch (sendError) {
          console.warn('Failed to send serial error event:', sendError.message);
        }
      });

      return { success: true };
    } catch (error) {
      console.error('Serial connection error:', error);
      return { success: false, error: error.message };
    }
  });

  // Write to serial port
  ipcMain.handle('serial-write', async (event, sessionId, data) => {
    try {
      const connInfo = serialConnections.get(sessionId);
      if (!connInfo || !connInfo.port) {
        throw new Error('Serial port not connected');
      }

      connInfo.port.write(data);
      return { success: true };
    } catch (error) {
      console.error('Serial write error:', error);
      return { success: false, error: error.message };
    }
  });
  
  // Disconnect serial port
  ipcMain.handle('serial-disconnect', async (event, sessionId) => {
    try {
      const connInfo = serialConnections.get(sessionId);
      if (connInfo && connInfo.port) {
        connInfo.port.close();
        serialConnections.delete(sessionId);
      }
      return { success: true };
    } catch (error) {
      console.error('Serial disconnect error:', error);
      return { success: false, error: error.message };
    }
  });
}

/**
 * Cleanup serial connections
 */
export function cleanupSerialConnections() {
  serialConnections.forEach((connInfo) => {
    if (connInfo.port) {
      connInfo.port.close();
    }
  });
  serialConnections.clear();
}

