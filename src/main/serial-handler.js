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
      return ports.map(port => {
        let portPath = port.path;
        // On macOS, prefer /dev/cu.* over /dev/tty.* for outgoing connections
        // to avoid waiting for DCD (Data Carrier Detect)
        if (process.platform === 'darwin' && portPath.startsWith('/dev/tty.')) {
          portPath = portPath.replace('/dev/tty.', '/dev/cu.');
        }

        return {
          path: portPath,
          manufacturer: port.manufacturer,
          serialNumber: port.serialNumber,
          pnpId: port.pnpId,
          locationId: port.locationId,
          vendorId: port.vendorId,
          productId: port.productId
        };
      });
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
        flowControl: options.flowControl || 'none',
        autoOpen: false
      });

      // Wait for port to open
      await new Promise((resolve, reject) => {
        port.open((err) => {
          if (err) {
            reject(err);
          } else {
            resolve();
          }
        });
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


/**
 * Get Serial connections Map (for IPC bridge)
 */
export function getSerialConnections() {
  return serialConnections;
}

/**
 * Execute command on Serial connection (for IPC bridge)
 * 
 * Works similarly to Telnet:
 * 1. Send the command
 * 2. Capture output until we see a prompt or timeout
 * 3. Return the result
 */
export async function executeSerialCommand(connectionId, command) {
  const connInfo = serialConnections.get(connectionId);
  if (!connInfo || !connInfo.port) {
    const availableIds = Array.from(serialConnections.keys());
    throw new Error(`Serial connection not found: ${connectionId}. Available: ${availableIds.join(', ')}`);
  }

  if (!connInfo.port.isOpen) {
    throw new Error(`Serial port is closed: ${connectionId}`);
  }

  return new Promise((resolve, reject) => {
    let output = '';
    let errorOutput = '';
    let isResolved = false;

    // Common prompt patterns for embedded/serial devices
    const promptPatterns = [
      /\$\s*$/,           // $ prompt
      /#\s*$/,            // # prompt (root)
      />\s*$/,            // > prompt (common in routers/switches)
      /%\s*$/,            // % prompt
      /:\s*$/,            // : prompt
      /\[.*@.*\].*[#$%>]\s*$/,  // [user@host] prompt
      /\w+@\w+[:\s]+[#$%>]\s*$/, // user@host: prompt
      /Login:\s*$/i,      // Login prompt
      /Password:\s*$/i,   // Password prompt
    ];

    // Timeout for command execution (20 seconds for serial - can be slow)
    const timeout = 20000;
    const timeoutId = setTimeout(() => {
      if (!isResolved) {
        isResolved = true;
        cleanup();
        // Return what we have so far
        resolve({
          success: false,
          output: output.trim(),
          error: errorOutput.trim() || 'Command execution timed out (Serial)',
          exitCode: -1
        });
      }
    }, timeout);

    // Temporary data handler
    const dataHandler = (data) => {
      if (isResolved) return;

      const dataString = data.toString();
      output += dataString;

      // Check if we see a prompt
      const lines = output.split('\n');
      const lastLine = lines[lines.length - 1] || '';
      const hasPrompt = promptPatterns.some(pattern => pattern.test(lastLine.trim()));

      // Also check if we see echoing of the command plus a prompt
      if (hasPrompt && output.includes(command)) {
        // Wait a tiny bit more for flush
        setTimeout(() => {
          if (!isResolved) {
            isResolved = true;
            cleanup();
            clearTimeout(timeoutId);
            resolve({
              success: true,
              output: output.trim(),
              error: errorOutput.trim(),
              exitCode: 0
            });
          }
        }, 300);
      }
    };

    const cleanup = () => {
      try {
        if (connInfo.port) {
          connInfo.port.removeListener('data', dataHandler);
        }
      } catch (error) {
        console.warn('Failed to remove Serial data listener:', error.message);
      }
    };

    // Add temporary listener
    connInfo.port.on('data', dataHandler);

    // Send command
    try {
      // Use \r for max compatibility with serial consoles
      connInfo.port.write(command + '\r');
    } catch (error) {
      cleanup();
      clearTimeout(timeoutId);
      reject(new Error(`Failed to send Serial command: ${error.message}`));
      return;
    }

    // Fallback: If no prompt detected within 3 seconds, assume command updated state and return
    // This is crucial for serial where prompts might be weird or non-echoing
    setTimeout(() => {
      if (!isResolved) {
        isResolved = true;
        cleanup();
        clearTimeout(timeoutId);

        let cleanOutput = output;
        // Try to verify if it's just the command echo
        if (cleanOutput.trim() === command.trim()) {
          // It's just an echo, wait longer? No, just return.
        }

        resolve({
          success: true,
          output: cleanOutput.trim(),
          error: errorOutput.trim(),
          exitCode: 0
        });
      }
    }, 3000);
  });
}
