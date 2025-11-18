import { BrowserWindow } from 'electron';
import path from 'node:path';

/**
 * Create the main application window
 */
export function createWindow() {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    title: 'ash',
    backgroundColor: '#000000',
    // macOS: hidden title bar with black overlay for traffic lights area
    // Windows/Linux: frame false for fully custom titlebar (like macOS)
    ...(process.platform === 'darwin' 
      ? { 
          titleBarStyle: 'hidden',
          titleBarOverlay: {
            color: '#000000',
            symbolColor: '#00ff41',
            height: 28
          }
        }
      : { 
          frame: false,
          titleBarOverlay: {
            color: '#000000',
            symbolColor: '#00ff41',
            height: 30
          }
        }
    ),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  // Listen for window maximize/unmaximize events (Windows/Linux only)
  if (process.platform !== 'darwin') {
    mainWindow.on('maximize', () => {
      mainWindow.webContents.send('window-maximized');
    });
    mainWindow.on('unmaximize', () => {
      mainWindow.webContents.send('window-unmaximized');
    });
  }

  // and load the index.html of the app.
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
    // Open the DevTools only in development mode
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`));
  }

  return mainWindow;
}

