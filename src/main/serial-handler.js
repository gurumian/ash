import { ipcMain } from 'electron';
import { SerialBufferedTransform } from './serial-buffer-transform.js';
import crypto from 'crypto';


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
      // On macOS, prefer /dev/cu.* over /dev/tty.* for proper non-blocking input/output
      let portPath = options.path;
      if (process.platform === 'darwin' && portPath.startsWith('/dev/tty.')) {
        portPath = portPath.replace('/dev/tty.', '/dev/cu.');
      }

      const port = new SerialPort({
        path: portPath,
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

      // Generate session-specific connection ID (unique per session)
      const sessionConnectionString = `serial:${sessionId}:${portPath}`;
      const sessionConnectionId = crypto.createHash('sha256').update(sessionConnectionString).digest('hex');

      // Generate connection key for chat history persistence
      // This allows chat history to be shared across sessions with the same connection info
      // Format: serial:sessionName:portPath
      const sessionName = options.sessionName || '';
      const connectionKeyString = `serial:${sessionName}:${portPath}`;
      const connectionKey = crypto.createHash('sha256').update(connectionKeyString).digest('hex');

      const webContents = event.sender;

      // For serial ports, check if the port is already in use by another session
      // Serial ports can only have one active connection at a time per port
      // This is a physical limitation, so we throw an explicit error instead of silently closing
      let existingSessionConnectionId = null;
      for (const [connId, connInfo] of serialConnections.entries()) {
        if (connInfo.portPath === portPath) {
          existingSessionConnectionId = connId;
          break;
        }
      }

      // If port is already in use, throw explicit error
      // User should explicitly disconnect the existing session first
      if (existingSessionConnectionId) {
        // Close the port we just opened since we can't use it
        try {
          port.close();
        } catch (e) {
          // ignore
        }
        throw new Error(`Serial port ${portPath} is already in use by another session. Please disconnect the existing session first.`);
      }

      serialConnections.set(sessionConnectionId, { port, webContents, portPath });

      // Use buffered transform stream to prevent IPC flooding
      // This is necessary for macOS 'cu' devices which may emit single-byte chunks
      const parser = port.pipe(new SerialBufferedTransform({
        maxBufferSize: 8192,
        flushInterval: 16
      }));

      // Store parser reference for cleanup
      // We store it on the connection object so we can unpipe/destroy it later
      const connInfo = serialConnections.get(sessionConnectionId);
      if (connInfo) {
        connInfo.parser = parser;
      }

      parser.on('data', (data) => {
        try {
          if (!webContents.isDestroyed()) {
            webContents.send('serial-data', sessionConnectionId, data.toString());
          }
        } catch (error) {
          console.warn('Failed to send serial data:', error.message);
        }
      });

      port.on('close', () => {
        try {
          if (!webContents.isDestroyed()) {
            webContents.send('serial-close', sessionConnectionId);
          }
        } catch (error) {
          console.warn('Failed to send serial close event:', error.message);
        }
        serialConnections.delete(sessionConnectionId);
      });

      port.on('error', (error) => {
        console.error('Serial port error:', error);
        try {
          if (!webContents.isDestroyed()) {
            webContents.send('serial-error', sessionConnectionId, error.message);
          }
        } catch (sendError) {
          console.warn('Failed to send serial error event:', sendError.message);
        }
      });

      return { success: true, sessionConnectionId, connectionKey };
    } catch (error) {
      console.error('Serial connection error:', error);
      return { success: false, error: error.message };
    }
  });

  // Write to serial port
  // Note: IPC interface uses 'connectionId' parameter name, but it's actually sessionConnectionId
  ipcMain.handle('serial-write', async (event, connectionId, data) => {
    const sessionConnectionId = connectionId; // IPC parameter name kept for compatibility
    try {
      const connInfo = serialConnections.get(sessionConnectionId);
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
  // Note: IPC interface uses 'connectionId' parameter name, but it's actually sessionConnectionId
  ipcMain.handle('serial-disconnect', async (event, connectionId) => {
    const sessionConnectionId = connectionId; // IPC parameter name kept for compatibility
    try {
      const connInfo = serialConnections.get(sessionConnectionId);
      if (connInfo && connInfo.port) {
        if (connInfo.parser) {
          connInfo.parser.destroy();
        }
        // Check if port is open before closing to prevent native crashes
        if (connInfo.port.isOpen) {
          try {
            await new Promise((resolve) => {
              connInfo.port.close((err) => {
                // Ignore errors on close, just ensure it's done
                resolve();
              });
            });
          } catch (e) {
            console.warn(`Error closing port ${sessionConnectionId}:`, e.message);
          }
        }
        serialConnections.delete(sessionConnectionId);
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
 * Returns a Promise that resolves when all connections are closed.
 */
export async function cleanupSerialConnections() {
  const closePromises = [];

  serialConnections.forEach((connInfo, sessionConnectionId) => {
    // Destroy parser first
    if (connInfo.parser) {
      try {
        connInfo.parser.destroy();
      } catch (e) {
            console.warn(`Error destroying parser for ${sessionConnectionId}:`, e.message);
      }
    }

    if (connInfo.port && connInfo.port.isOpen) {
      const closePromise = new Promise((resolve) => {
        try {
          connInfo.port.close((err) => {
            if (err) {
              console.warn(`Error closing port ${sessionConnectionId} during cleanup:`, err.message);
            }
            resolve();
          });
        } catch (e) {
          console.warn(`Exception closing port ${sessionConnectionId} during cleanup:`, e.message);
          resolve();
        }
      });
      closePromises.push(closePromise);
    }
  });

  serialConnections.clear();

  if (closePromises.length > 0) {
    try {
      // Wait for all ports to close, with a timeout to prevent hanging
      await Promise.race([
        Promise.all(closePromises),
        new Promise(resolve => setTimeout(resolve, 1000)) // 1s timeout
      ]);
    } catch (e) {
      console.warn('Error during serial cleanup wait:', e.message);
    }
  }
}


/**
 * Get Serial connections Map (for IPC bridge)
 */
export function getSerialConnections() {
  return serialConnections;
}

/**
 * Execute command on Serial connection (for IPC bridge)
 * @param {string} connectionId - Session-specific connection ID (IPC bridge uses 'connectionId' name)
 * 
 * Works similarly to Telnet:
 * 1. Send the command
 * 2. Capture output until we see a prompt or timeout
 * 3. Return the result
 */
export async function executeSerialCommand(connectionId, command) {
  const sessionConnectionId = connectionId; // IPC bridge parameter name kept for compatibility
  const connInfo = serialConnections.get(sessionConnectionId);
  if (!connInfo || !connInfo.port) {
    const availableIds = Array.from(serialConnections.keys());
    throw new Error(`Serial connection not found: ${sessionConnectionId}. Available: ${availableIds.join(', ')}`);
  }

  if (!connInfo.port.isOpen) {
    throw new Error(`Serial port is closed: ${sessionConnectionId}`);
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
