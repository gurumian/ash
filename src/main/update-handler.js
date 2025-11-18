import { autoUpdater } from 'electron-updater';
import { ipcMain, app } from 'electron';

// Update server configuration
const UPDATE_SERVER = 'https://cdn.toktoktalk.com';
const APP_NAME = 'ash';

// Determine platform-specific update URL
// electron-updater will automatically append platform-specific filenames:
// - Windows: latest.yml
// - macOS: latest-mac.yml (or latest-mac-arm64.yml, latest-mac-x64.yml)
// - Linux: latest-linux.yml (or latest-linux-x86_64.yml, etc.)
autoUpdater.setFeedURL({
  provider: 'generic',
  url: `${UPDATE_SERVER}/update/${APP_NAME}`,
});

// Configure auto-updater behavior
autoUpdater.autoDownload = true; // Automatically download updates
autoUpdater.autoInstallOnAppQuit = true; // Automatically install on app quit

// Only check for updates in production (not in development)
const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

let checkOnStartupTimeout;

if (!isDev) {
  
  // Check for updates 5 seconds after app is ready
  function scheduleStartupCheck() {
    checkOnStartupTimeout = setTimeout(() => {
      autoUpdater.checkForUpdatesAndNotify().catch(err => {
        console.error('Auto-update check failed:', err);
      });
    }, 5000);
  }
  
  // Auto-check for updates every 4 hours
  setInterval(() => {
    autoUpdater.checkForUpdatesAndNotify().catch(err => {
      console.error('Auto-update check failed:', err);
    });
  }, 4 * 60 * 60 * 1000); // 4 hours
  
  // Update available
  autoUpdater.on('update-available', (info) => {
    console.log('Update available:', info.version);
    // Notify all windows about the update
    const { BrowserWindow } = require('electron');
    BrowserWindow.getAllWindows().forEach(window => {
      window.webContents.send('update-available', {
        version: info.version,
        releaseDate: info.releaseDate,
        releaseNotes: info.releaseNotes,
      });
    });
  });
  
  // Update not available
  autoUpdater.on('update-not-available', (info) => {
    console.log('Update not available. Current version is latest.');
    const { BrowserWindow } = require('electron');
    BrowserWindow.getAllWindows().forEach(window => {
      window.webContents.send('update-not-available');
    });
  });
  
  // Update download progress
  autoUpdater.on('download-progress', (progressObj) => {
    const { BrowserWindow } = require('electron');
    BrowserWindow.getAllWindows().forEach(window => {
      window.webContents.send('update-download-progress', {
        percent: progressObj.percent,
        transferred: progressObj.transferred,
        total: progressObj.total,
        bytesPerSecond: progressObj.bytesPerSecond,
      });
    });
  });
  
  // Update downloaded and ready to install
  autoUpdater.on('update-downloaded', (info) => {
    console.log('Update downloaded:', info.version);
    const { BrowserWindow } = require('electron');
    BrowserWindow.getAllWindows().forEach(window => {
      window.webContents.send('update-downloaded', {
        version: info.version,
        releaseDate: info.releaseDate,
        releaseNotes: info.releaseNotes,
      });
    });
  });
  
  // Update error
  autoUpdater.on('error', (error) => {
    console.error('Auto-updater error:', error);
    const { BrowserWindow } = require('electron');
    BrowserWindow.getAllWindows().forEach(window => {
      window.webContents.send('update-error', {
        message: error.message,
        stack: error.stack,
      });
    });
  });
}

/**
 * Initialize update handlers
 * @param {Function} scheduleCheck - Function to call to schedule startup check
 */
export function initializeUpdateHandlers(scheduleCheck) {
  if (isDev) {
    console.log('Auto-update is disabled in development mode');
    return;
  }
  
  // IPC handlers for manual update check
  ipcMain.handle('check-for-updates', async () => {
    try {
      const result = await autoUpdater.checkForUpdates();
      return {
        success: true,
        updateInfo: result?.updateInfo || null,
      };
    } catch (error) {
      console.error('Manual update check failed:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  });
  
  ipcMain.handle('quit-and-install', () => {
    autoUpdater.quitAndInstall(false, true);
  });
  
  // Schedule startup check
  if (scheduleCheck) {
    scheduleCheck();
  } else {
    // Default: check after 5 seconds
    setTimeout(() => {
      autoUpdater.checkForUpdatesAndNotify().catch(err => {
        console.error('Auto-update check failed:', err);
      });
    }, 5000);
  }
}

/**
 * Cleanup update handlers
 */
export function cleanupUpdateHandlers() {
  if (isDev) {
    return;
  }
  
  ipcMain.removeHandler('check-for-updates');
  ipcMain.removeHandler('quit-and-install');
  
  // Clear any pending timeouts
  if (checkOnStartupTimeout) {
    clearTimeout(checkOnStartupTimeout);
  }
}

