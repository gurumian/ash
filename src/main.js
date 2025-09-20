import { app, BrowserWindow, ipcMain, Menu } from 'electron';
import path from 'node:path';
import started from 'electron-squirrel-startup';

// Set app name
app.setName('ash');

// ssh2 is dynamically imported only in main process
let Client;

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (started) {
  app.quit();
}

// SSH connection management
let sshConnections = new Map();
let sshStreams = new Map();

// Create system menu
function createMenu() {
  const template = [
    {
      label: 'File',
      submenu: [
        {
          label: 'New Session',
          accelerator: 'CmdOrCtrl+N',
          click: () => {
            // Send new session creation event to renderer
            const focusedWindow = BrowserWindow.getFocusedWindow();
            if (focusedWindow) {
              focusedWindow.webContents.send('menu-new-session');
            }
          }
        },
        {
          label: 'Close Session',
          accelerator: 'CmdOrCtrl+W',
          click: () => {
            const focusedWindow = BrowserWindow.getFocusedWindow();
            if (focusedWindow) {
              focusedWindow.webContents.send('menu-close-session');
            }
          }
        },
        { type: 'separator' },
        {
          label: 'Quit',
          accelerator: process.platform === 'darwin' ? 'Cmd+Q' : 'Ctrl+Q',
          click: () => {
            app.quit();
          }
        }
      ]
    },
    {
      label: 'Edit',
      submenu: [
        {
          label: 'Copy',
          accelerator: 'CmdOrCtrl+C',
          role: 'copy'
        },
        {
          label: 'Paste',
          accelerator: 'CmdOrCtrl+V',
          role: 'paste'
        },
        { type: 'separator' },
        {
          label: 'Select All',
          accelerator: 'CmdOrCtrl+A',
          role: 'selectall'
        }
      ]
    },
    {
      label: 'Window',
      submenu: [
        {
          label: 'Minimize',
          accelerator: 'CmdOrCtrl+M',
          role: 'minimize'
        },
        {
          label: 'Close',
          accelerator: 'CmdOrCtrl+W',
          role: 'close'
        }
      ]
    },
    {
      label: 'View',
      submenu: [
        {
          label: 'Toggle Session Manager',
          type: 'checkbox',
          checked: true,
          click: (menuItem) => {
            const focusedWindow = BrowserWindow.getFocusedWindow();
            if (focusedWindow) {
              focusedWindow.webContents.send('menu-toggle-session-manager', menuItem.checked);
            }
          }
        },
        { type: 'separator' },
        {
          label: 'Settings',
          accelerator: 'CmdOrCtrl+,',
          click: () => {
            const focusedWindow = BrowserWindow.getFocusedWindow();
            if (focusedWindow) {
              focusedWindow.webContents.send('menu-settings');
            }
          }
        },
        { type: 'separator' },
        {
          label: 'Reload',
          accelerator: 'CmdOrCtrl+R',
          click: (item, focusedWindow) => {
            if (focusedWindow) {
              focusedWindow.reload();
            }
          }
        },
        {
          label: 'Toggle Developer Tools',
          accelerator: process.platform === 'darwin' ? 'Alt+Cmd+I' : 'Ctrl+Shift+I',
          click: (item, focusedWindow) => {
            if (focusedWindow) {
              focusedWindow.webContents.toggleDevTools();
            }
          }
        },
        { type: 'separator' },
        {
          label: 'Actual Size',
          accelerator: 'CmdOrCtrl+0',
          click: (item, focusedWindow) => {
            if (focusedWindow) {
              focusedWindow.webContents.setZoomLevel(0);
            }
          }
        },
        {
          label: 'Zoom In',
          accelerator: 'CmdOrCtrl+Plus',
          click: (item, focusedWindow) => {
            if (focusedWindow) {
              const currentZoom = focusedWindow.webContents.getZoomLevel();
              focusedWindow.webContents.setZoomLevel(currentZoom + 0.5);
            }
          }
        },
        {
          label: 'Zoom Out',
          accelerator: 'CmdOrCtrl+-',
          click: (item, focusedWindow) => {
            if (focusedWindow) {
              const currentZoom = focusedWindow.webContents.getZoomLevel();
              focusedWindow.webContents.setZoomLevel(currentZoom - 0.5);
            }
          }
        }
      ]
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'About ash',
          click: () => {
            const focusedWindow = BrowserWindow.getFocusedWindow();
            if (focusedWindow) {
              focusedWindow.webContents.send('menu-about');
            }
          }
        }
      ]
    }
  ];

  // On macOS, change the first menu to app name
  if (process.platform === 'darwin') {
    template.unshift({
      label: app.getName(),
      submenu: [
        {
          label: 'About ' + app.getName(),
          role: 'about'
        },
        { type: 'separator' },
        {
          label: 'Services',
          role: 'services',
          submenu: []
        },
        { type: 'separator' },
        {
          label: 'Hide ' + app.getName(),
          accelerator: 'Command+H',
          role: 'hide'
        },
        {
          label: 'Hide Others',
          accelerator: 'Command+Shift+H',
          role: 'hideothers'
        },
        {
          label: 'Show All',
          role: 'unhide'
        },
        { type: 'separator' },
        {
          label: 'Quit',
          accelerator: 'Command+Q',
          click: () => {
            app.quit();
          }
        }
      ]
    });
  }

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

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

// Window title change IPC handler
ipcMain.handle('set-window-title', async (event, title) => {
  const focusedWindow = BrowserWindow.getFocusedWindow();
  if (focusedWindow) {
    focusedWindow.setTitle(title);
    return { success: true };
  }
  return { success: false };
});

const createWindow = () => {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    title: 'ash',
    titleBarStyle: 'default',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  // and load the index.html of the app.
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`));
  }

  // Open the DevTools.
  mainWindow.webContents.openDevTools();
};

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  createMenu(); // Create system menu
  createWindow();

  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// Quit when all windows are closed, including on macOS
app.on('window-all-closed', () => {
  app.quit();
});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and import them here.

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

// Save log to file
ipcMain.handle('save-log-to-file', async (event, { sessionId, logContent, sessionName }) => {
  try {
    const fs = require('fs');
    const path = require('path');
    const os = require('os');
    
    // Create logs directory in user's home folder
    const logsDir = path.join(os.homedir(), 'ash-logs');
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
    }
    
    // Generate filename
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `${sessionName}_${timestamp}.log`;
    const filePath = path.join(logsDir, filename);
    
    // Write log content to file
    fs.writeFileSync(filePath, logContent, 'utf8');
    
    console.log(`Log saved to: ${filePath}`);
    return { success: true, filePath };
  } catch (error) {
    console.error('Save log error:', error);
    return { success: false, error: error.message };
  }
});
