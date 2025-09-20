import { app, BrowserWindow, ipcMain, Menu } from 'electron';
import path from 'node:path';
import started from 'electron-squirrel-startup';

// ssh2는 main 프로세스에서만 동적으로 import
let Client;

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (started) {
  app.quit();
}

// SSH 연결 관리
let sshConnections = new Map();
let sshStreams = new Map();

// 시스템 메뉴 생성
function createMenu() {
  const template = [
    {
      label: 'File',
      submenu: [
        {
          label: 'New Session',
          accelerator: 'CmdOrCtrl+N',
          click: () => {
            // 새 세션 생성 이벤트를 renderer로 전송
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

  // macOS에서는 첫 번째 메뉴를 앱 이름으로 변경
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

// SSH 연결 IPC 핸들러
ipcMain.handle('ssh-connect', async (event, connectionInfo) => {
  const { host, port, username, password } = connectionInfo;
  const connectionId = `${username}@${host}:${port}`;
  
  try {
    // 동적으로 ssh2 import
    if (!Client) {
      const ssh2 = require('ssh2');
      Client = ssh2.Client;
    }
    
    const conn = new Client();
    
    return new Promise((resolve, reject) => {
      conn.on('ready', () => {
        sshConnections.set(connectionId, conn);
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

// SSH 터미널 세션 시작
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
      
      // 스트림 저장
      sshStreams.set(connectionId, stream);
      
      resolve({ success: true, streamId: stream.id });
      
      // 터미널 데이터를 renderer로 전송
      stream.on('data', (data) => {
        event.sender.send('ssh-data', { connectionId, data: data.toString() });
      });
      
      stream.on('close', () => {
        sshStreams.delete(connectionId);
        event.sender.send('ssh-close', { connectionId });
      });
    });
  });
});

// SSH 터미널에 데이터 전송
ipcMain.handle('ssh-write', async (event, { connectionId, data }) => {
  const stream = sshStreams.get(connectionId);
  if (!stream) {
    throw new Error('SSH stream not found');
  }
  
  stream.write(data);
  return { success: true };
});

// SSH 연결 해제
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

// 창 제목 변경 IPC 핸들러
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
  createMenu(); // 시스템 메뉴 생성
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
