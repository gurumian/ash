import { BrowserWindow, app } from 'electron';
import path from 'node:path';
import fs from 'fs';

/**
 * Get preload script path with fallback handling
 */
function getPreloadPath() {
  if (app.isPackaged) {
    // In production, try multiple possible locations
    const resourcesPath = process.resourcesPath || app.getAppPath();
    const appPath = app.getAppPath();
    
    const possiblePaths = [
      path.join(resourcesPath, 'app', '.vite', 'build', 'preload.js'),
      path.join(appPath, '.vite', 'build', 'preload.js'),
      path.join(__dirname, 'preload.js'),
      path.join(__dirname, '../preload.js'),
      path.join(__dirname, '../../preload.js'),
      path.join(__dirname, '../../../preload.js'),
      path.join(process.cwd(), '.vite', 'build', 'preload.js'),
    ];
    
    for (const possiblePath of possiblePaths) {
      try {
        if (fs.existsSync(possiblePath)) {
          return possiblePath;
        }
      } catch (e) {
        // Continue to next path
      }
    }
  }
  
  // In development or fallback
  const devPath = path.join(__dirname, 'preload.js');
  if (fs.existsSync(devPath)) {
    return devPath;
  }
  
  // Final fallback - return even if doesn't exist (let Electron handle the error)
  return devPath;
}

/**
 * Get index.html path with fallback handling
 */
function getIndexHtmlPath() {
  const rendererName = typeof MAIN_WINDOW_VITE_NAME !== 'undefined' ? MAIN_WINDOW_VITE_NAME : 'main_window';
  
  if (app.isPackaged) {
    // In production, try multiple possible locations
    const resourcesPath = process.resourcesPath || app.getAppPath();
    const appPath = app.getAppPath();
    
    const possiblePaths = [
      path.join(resourcesPath, 'app', '.vite', 'renderer', rendererName, 'index.html'),
      path.join(appPath, '.vite', 'renderer', rendererName, 'index.html'),
      path.join(__dirname, `../renderer/${rendererName}/index.html`),
      path.join(__dirname, `../../renderer/${rendererName}/index.html`),
      path.join(__dirname, `../../../renderer/${rendererName}/index.html`),
      path.join(process.cwd(), '.vite', 'renderer', rendererName, 'index.html'),
    ];
    
    for (const possiblePath of possiblePaths) {
      try {
        if (fs.existsSync(possiblePath)) {
          return possiblePath;
        }
      } catch (e) {
        // Continue to next path
      }
    }
  }
  
  // In development or fallback
  const devPath = path.join(__dirname, `../renderer/${rendererName}/index.html`);
  if (fs.existsSync(devPath)) {
    return devPath;
  }
  
  // Final fallback - return even if doesn't exist (let Electron handle the error)
  return devPath;
}

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
      preload: getPreloadPath(),
    },
  });

  // Listen for window maximize/unmaximize events (Windows/Linux only)
  if (process.platform !== 'darwin') {
    mainWindow.on('maximize', () => {
      try {
        if (!mainWindow.isDestroyed() && !mainWindow.webContents.isDestroyed()) {
          mainWindow.webContents.send('window-maximized');
        }
      } catch (error) {
        // Window was destroyed, ignore
      }
    });
    mainWindow.on('unmaximize', () => {
      try {
        if (!mainWindow.isDestroyed() && !mainWindow.webContents.isDestroyed()) {
          mainWindow.webContents.send('window-unmaximized');
        }
      } catch (error) {
        // Window was destroyed, ignore
      }
    });
  }

  // and load the index.html of the app.
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
    // Open the DevTools only in development mode
    mainWindow.webContents.openDevTools();
  } else {
    const indexPath = getIndexHtmlPath();
    mainWindow.loadFile(indexPath);
  }

  return mainWindow;
}

