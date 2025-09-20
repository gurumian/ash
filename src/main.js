import { app, BrowserWindow, ipcMain } from 'electron';
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

const createWindow = () => {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
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
