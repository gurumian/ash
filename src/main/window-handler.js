import { ipcMain, BrowserWindow, app, shell, dialog } from 'electron';
import path from 'node:path';
import fs from 'fs';

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
  ipcMain.handle('save-log-to-file', async (event, { sessionId, logContent, sessionName, groupName = 'default', isNewFile = false }) => {
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
      
      // Write or append log content to file
      if (isNewFile || !fs.existsSync(filePath)) {
        fs.writeFileSync(filePath, logContent, 'utf8');
      } else {
        fs.appendFileSync(filePath, logContent, 'utf8');
      }
      
      console.log(`Log saved to: ${filePath}`);
      return { success: true, filePath };
    } catch (error) {
      console.error('Save log error:', error);
      return { success: false, error: error.message };
    }
  });

  // Append log to existing file
  ipcMain.handle('append-log-to-file', async (event, { sessionId, logContent, filePath }) => {
    try {
      const fs = require('fs');
      
      if (!filePath || !fs.existsSync(filePath)) {
        return { success: false, error: 'File path not found' };
      }
      
      // Append log content to existing file
      fs.appendFileSync(filePath, logContent, 'utf8');
      
      console.log(`Log appended to: ${filePath}`);
      return { success: true, filePath };
    } catch (error) {
      console.error('Append log error:', error);
      return { success: false, error: error.message };
    }
  });

  // Get app info (version, author, etc.)
  ipcMain.handle('get-app-info', async () => {
    const app = require('electron').app;
    const fs = require('fs');
    const path = require('path');
    
    // Use app.getVersion() - it reads from Info.plist (macOS) or version resource (Windows)
    // This is the most reliable method for packaged apps (same as FAC1)
    // Electron Forge automatically sets this from package.json during build
    let version = app.getVersion();
    
    // Fallback: if app.getVersion() returns empty or undefined, try to read from package.json
    if (!version || version.trim() === '') {
      console.warn('app.getVersion() returned empty, trying to read from package.json');
      try {
        let packageJsonPath;
        if (app.isPackaged) {
          // In production, package.json is inside app.asar
          // Try to read it using require (works even inside asar)
          try {
            // In packaged app, we can try to require package.json if it's accessible
            // But app.asar might not expose it directly, so we use app.getVersion() as primary
            packageJsonPath = path.join(process.resourcesPath, 'app', 'package.json');
            if (!fs.existsSync(packageJsonPath)) {
              packageJsonPath = path.join(__dirname, '../../package.json');
            }
          } catch (e) {
            // Ignore
          }
        } else {
          // In development, it's in the project root
          packageJsonPath = path.join(__dirname, '../../../package.json');
        }
        
        if (packageJsonPath && fs.existsSync(packageJsonPath)) {
          const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
          version = packageJson.version || '1.0.0';
        }
      } catch (error) {
        console.error('Failed to read version from package.json:', error);
        version = '1.0.0'; // Final fallback
      }
    }
    
    // Try to get author and description from package.json, but don't fail if not found
    let author = { name: 'Bryce Ghim', email: 'admin@toktoktalk.com' };
    let description = 'A modern SSH and Serial terminal client';
    
    try {
      let packageJsonPath;
      if (app.isPackaged) {
        // In production, try multiple possible locations
        const possiblePaths = [
          path.join(process.resourcesPath, 'app', 'package.json'),
          path.join(__dirname, '../../package.json'),
          path.join(__dirname, '../../../package.json'),
        ];
        
        for (const possiblePath of possiblePaths) {
          if (fs.existsSync(possiblePath)) {
            packageJsonPath = possiblePath;
            break;
          }
        }
      } else {
        // In development, it's in the project root
        packageJsonPath = path.join(__dirname, '../../../package.json');
      }
      
      // Fallback: try project root
      if (!packageJsonPath || !fs.existsSync(packageJsonPath)) {
        packageJsonPath = path.join(process.cwd(), 'package.json');
      }
      
      if (packageJsonPath && fs.existsSync(packageJsonPath)) {
        const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
        if (packageJson.author) {
          author = packageJson.author;
        }
        if (packageJson.description) {
          description = packageJson.description;
        }
      }
    } catch (error) {
      // Non-fatal error - we already have version from app.getVersion()
      console.warn('Could not read package.json for author/description:', error.message);
    }
    
    return {
      success: true,
      version: version,
      author: author,
      description: description,
    };
  });

  // Get settings file path
  const getSettingsPath = () => {
    const userDataPath = app.getPath('userData');
    return path.join(userDataPath, 'settings.json');
  };

  // Load settings from file
  ipcMain.handle('get-settings', async () => {
    try {
      const settingsPath = getSettingsPath();
      if (fs.existsSync(settingsPath)) {
        const data = fs.readFileSync(settingsPath, 'utf8');
        const settings = JSON.parse(data);
        return { success: true, settings };
      }
      return { success: true, settings: {} };
    } catch (error) {
      console.error('Failed to load settings:', error);
      return { success: false, error: error.message };
    }
  });

  // Save settings to file
  ipcMain.handle('save-settings', async (event, settings) => {
    try {
      const settingsPath = getSettingsPath();
      const userDataPath = app.getPath('userData');
      
      // Ensure userData directory exists
      if (!fs.existsSync(userDataPath)) {
        fs.mkdirSync(userDataPath, { recursive: true });
      }
      
      // Read existing settings if file exists
      let existingSettings = {};
      if (fs.existsSync(settingsPath)) {
        try {
          const data = fs.readFileSync(settingsPath, 'utf8');
          existingSettings = JSON.parse(data);
        } catch (e) {
          console.warn('Failed to read existing settings, creating new file');
        }
      }
      
      // Merge with new settings
      const mergedSettings = { ...existingSettings, ...settings };
      
      // Write to file
      fs.writeFileSync(settingsPath, JSON.stringify(mergedSettings, null, 2), 'utf8');
      return { success: true };
    } catch (error) {
      console.error('Failed to save settings:', error);
      return { success: false, error: error.message };
    }
  });

  // Open path in file manager
  ipcMain.handle('open-path', async (event, pathToOpen) => {
    try {
      await shell.openPath(pathToOpen);
      return { success: true };
    } catch (error) {
      console.error('Failed to open path:', error);
      return { success: false, error: error.message };
    }
  });

  // Show directory picker dialog
  ipcMain.handle('show-directory-picker', async (event, defaultPath) => {
    try {
      const focusedWindow = BrowserWindow.getFocusedWindow();
      const result = await dialog.showOpenDialog(focusedWindow || null, {
        properties: ['openDirectory'],
        defaultPath: defaultPath || undefined,
      });
      
      if (result.canceled || result.filePaths.length === 0) {
        return { success: false, canceled: true };
      }
      
      return { success: true, path: result.filePaths[0] };
    } catch (error) {
      console.error('Failed to show directory picker:', error);
      return { success: false, error: error.message };
    }
  });
}

