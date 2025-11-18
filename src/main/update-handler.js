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

// Check for updates 5 seconds after app is ready
export function scheduleStartupCheck() {
  if (isDev) {
    console.log('Auto-update is disabled in development mode');
    return;
  }
  
  checkOnStartupTimeout = setTimeout(() => {
    console.log('Checking for updates...');
    autoUpdater.checkForUpdatesAndNotify().catch(err => {
      console.error('Auto-update check failed:', err);
    });
  }, 5000);
}

if (!isDev) {
  // Auto-check for updates every 4 hours
  setInterval(() => {
    autoUpdater.checkForUpdatesAndNotify().catch(err => {
      console.error('Auto-update check failed:', err);
    });
  }, 4 * 60 * 60 * 1000); // 4 hours
  
  // Helper function to safely send messages to all windows
  const sendToAllWindows = (channel, data) => {
    const { BrowserWindow } = require('electron');
    BrowserWindow.getAllWindows().forEach(window => {
      try {
        // Check if window and webContents are still valid
        if (!window.isDestroyed() && !window.webContents.isDestroyed()) {
          window.webContents.send(channel, data);
        }
      } catch (error) {
        // Silently ignore errors for destroyed windows
        console.warn(`Failed to send ${channel} to window:`, error.message);
      }
    });
  };
  
  // Update available
  autoUpdater.on('update-available', (info) => {
    console.log('Update available:', info.version);
    sendToAllWindows('update-available', {
      version: info.version,
      releaseDate: info.releaseDate,
      releaseNotes: info.releaseNotes,
    });
  });
  
  // Update not available
  autoUpdater.on('update-not-available', (info) => {
    console.log('Update not available. Current version is latest.');
    sendToAllWindows('update-not-available', null);
  });
  
  // Update download progress
  autoUpdater.on('download-progress', (progressObj) => {
    sendToAllWindows('update-download-progress', {
      percent: progressObj.percent,
      transferred: progressObj.transferred,
      total: progressObj.total,
      bytesPerSecond: progressObj.bytesPerSecond,
    });
  });
  
  // Update downloaded and ready to install
  autoUpdater.on('update-downloaded', (info) => {
    console.log('Update downloaded:', info.version);
    sendToAllWindows('update-downloaded', {
      version: info.version,
      releaseDate: info.releaseDate,
      releaseNotes: info.releaseNotes,
    });
  });
  
  // Update error
  autoUpdater.on('error', (error) => {
    console.error('Auto-updater error:', error);
    sendToAllWindows('update-error', {
      message: error.message,
      stack: error.stack,
    });
  });
}

/**
 * Initialize update handlers
 * @param {Function} scheduleCheck - Function to call to schedule startup check
 */
export function initializeUpdateHandlers(scheduleCheck) {
  // IPC handlers for manual update check (available in both dev and production)
  ipcMain.handle('check-for-updates', async () => {
    if (isDev) {
      console.log('Update check is disabled in development mode');
      return {
        success: false,
        error: 'Update check is disabled in development mode',
      };
    }
    
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
    if (isDev) {
      console.log('Quit and install is disabled in development mode');
      return;
    }
    autoUpdater.quitAndInstall(false, true);
  });
  
  // Schedule startup check (only in production)
  if (!isDev) {
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
  } else {
    console.log('Auto-update is disabled in development mode');
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

