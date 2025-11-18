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

      serialConnections.set(sessionId, port);

      port.on('data', (data) => {
        event.sender.send('serial-data', sessionId, data.toString());
      });

      port.on('close', () => {
        event.sender.send('serial-close', sessionId);
        serialConnections.delete(sessionId);
      });

      port.on('error', (error) => {
        console.error('Serial port error:', error);
        event.sender.send('serial-error', sessionId, error.message);
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
      const port = serialConnections.get(sessionId);
      if (!port) {
        throw new Error('Serial port not connected');
      }

      port.write(data);
      return { success: true };
    } catch (error) {
      console.error('Serial write error:', error);
      return { success: false, error: error.message };
    }
  });

  // Disconnect serial port
  ipcMain.handle('serial-disconnect', async (event, sessionId) => {
    try {
      const port = serialConnections.get(sessionId);
      if (port) {
        port.close();
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
  serialConnections.forEach((port) => port.close());
  serialConnections.clear();
}

