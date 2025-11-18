import { ipcMain, BrowserWindow } from 'electron';
import path from 'node:path';

/**
 * Initialize window-related IPC handlers
 */
export function initializeWindowHandlers() {
  // Toggle Developer Tools
  ipcMain.handle('toggle-dev-tools', () => {
    const focusedWindow = BrowserWindow.getFocusedWindow();
    if (focusedWindow && !focusedWindow.isDestroyed()) {
      focusedWindow.webContents.toggleDevTools();
    }
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

  // Window controls IPC handlers (for Windows frameless window)
  ipcMain.handle('window-minimize', async (event) => {
    const focusedWindow = BrowserWindow.getFocusedWindow();
    if (focusedWindow) {
      focusedWindow.minimize();
      return { success: true };
    }
    return { success: false };
  });

  ipcMain.handle('window-maximize', async (event) => {
    const focusedWindow = BrowserWindow.getFocusedWindow();
    if (focusedWindow) {
      if (focusedWindow.isMaximized()) {
        focusedWindow.unmaximize();
      } else {
        focusedWindow.maximize();
      }
      return { success: true };
    }
    return { success: false };
  });

  ipcMain.handle('window-close', async (event) => {
    const focusedWindow = BrowserWindow.getFocusedWindow();
    if (focusedWindow) {
      focusedWindow.close();
      return { success: true };
    }
    return { success: false };
  });

  ipcMain.handle('window-is-maximized', async (event) => {
    const focusedWindow = BrowserWindow.getFocusedWindow();
    if (focusedWindow) {
      return { isMaximized: focusedWindow.isMaximized() };
    }
    return { isMaximized: false };
  });

  // Detach tab to new window
  ipcMain.handle('detach-tab', async (event, sessionId) => {
    try {
      // Get session data from renderer
      const sessionData = await event.sender.executeJavaScript(`
        (() => {
          const session = window.__sessions__?.find(s => s.id === '${sessionId}');
          return session ? JSON.stringify(session) : null;
        })()
      `);
      
      if (!sessionData) {
        return { success: false, error: 'Session not found' };
      }
      
      // Create new window
      const newWindow = new BrowserWindow({
        width: 800,
        height: 600,
        title: 'ash',
        backgroundColor: '#000000',
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
      
      // Load the app
      if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
        newWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
      } else {
        newWindow.loadFile(path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`));
      }
      
      // Wait for window to be ready, then send session data
      newWindow.webContents.once('did-finish-load', () => {
        try {
          if (!newWindow.isDestroyed() && !newWindow.webContents.isDestroyed()) {
            newWindow.webContents.send('detached-session', sessionData);
          }
        } catch (error) {
          console.error('Failed to send detached session data:', error);
        }
      });
      
      // Remove session from original window
      try {
        if (!event.sender.isDestroyed()) {
          event.sender.send('remove-detached-session', sessionId);
        }
      } catch (error) {
        console.error('Failed to send remove detached session:', error);
      }
      
      return { success: true };
    } catch (error) {
      console.error('Detach tab error:', error);
      return { success: false, error: error.message };
    }
  });

  // Save log to file
  ipcMain.handle('save-log-to-file', async (event, { sessionId, logContent, sessionName, groupName = 'default' }) => {
    try {
      const fs = require('fs');
      const path = require('path');
      const os = require('os');
      
      // Create logs directory: $HOME/Documents/ash/logs/
      const documentsDir = path.join(os.homedir(), 'Documents', 'ash', 'logs');
      if (!fs.existsSync(documentsDir)) {
        fs.mkdirSync(documentsDir, { recursive: true });
      }
      
      // Generate filename: $GROUP-$SESSION-NAME-$DATE-$TIME.log
      const now = new Date();
      const date = now.toISOString().split('T')[0]; // YYYY-MM-DD
      const time = now.toTimeString().split(' ')[0].replace(/:/g, '-'); // HH-MM-SS
      const filename = `${groupName}-${sessionName}-${date}-${time}.log`;
      const filePath = path.join(documentsDir, filename);
      
      // Write log content to file
      fs.writeFileSync(filePath, logContent, 'utf8');
      
      console.log(`Log saved to: ${filePath}`);
      return { success: true, filePath };
    } catch (error) {
      console.error('Save log error:', error);
      return { success: false, error: error.message };
    }
  });

  // Get app info (version, author, etc.)
  ipcMain.handle('get-app-info', async () => {
    try {
      const fs = require('fs');
      const path = require('path');
      const app = require('electron').app;
      
      // Try multiple paths for package.json
      let packageJsonPath;
      if (app.isPackaged) {
        // In production, package.json should be in the app's resources directory
        packageJsonPath = path.join(process.resourcesPath, 'app', 'package.json');
      } else {
        // In development, it's in the project root
        packageJsonPath = path.join(__dirname, '../../../package.json');
      }
      
      // Fallback: try project root
      if (!fs.existsSync(packageJsonPath)) {
        packageJsonPath = path.join(process.cwd(), 'package.json');
      }
      
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
      
      return {
        success: true,
        version: packageJson.version || app.getVersion() || '1.0.0',
        author: packageJson.author || { name: 'Bryce Ghim', email: 'gurumlab@gmail.com' },
        description: packageJson.description || 'A modern SSH client built with Electron and React',
      };
    } catch (error) {
      console.error('Get app info error:', error);
      const app = require('electron').app;
      return {
        success: false,
        error: error.message,
        version: app.getVersion() || '1.0.0',
        author: { name: 'Bryce Ghim', email: 'gurumlab@gmail.com' },
      };
    }
  });
}

