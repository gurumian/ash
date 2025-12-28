import { autoUpdater } from 'electron-updater';
import { ipcMain, app, dialog, BrowserWindow } from 'electron';

// Update server configuration
const UPDATE_SERVER = 'https://cdn.toktoktalk.com';
const APP_NAME = 'ash';

// Note: Feed URL will be set in initializeUpdateHandlers() after app is ready
// electron-updater will automatically append platform-specific filenames:
// - Windows: latest.yml
// - macOS: latest-mac.yml (or latest-mac-arm64.yml, latest-mac-x64.yml)
// - Linux: latest-linux.yml (or latest-linux-x86_64.yml, etc.)

// Only check for updates in production (not in development)
const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

let checkOnStartupTimeout;
let isAutoCheck = false; // Flag to distinguish auto checks from manual checks

// Check for updates 5 seconds after app is ready
export function scheduleStartupCheck() {
  console.log('scheduleStartupCheck called');
  console.log('isDev:', isDev);
  if (isDev) {
    console.log('Auto-update is disabled in development mode');
    console.log('To test updates, build the app with: npm run make');
    return;
  }
  
    console.log('Scheduling update check in 5 seconds...');
    checkOnStartupTimeout = setTimeout(() => {
      const { BrowserWindow } = require('electron');
      const status = {
        message: 'Executing startup update check...',
        timestamp: new Date().toISOString(),
      };
      
      console.log('========================================');
      console.log('Executing startup update check...');
      console.log('========================================');
      
      // Send to renderer
      BrowserWindow.getAllWindows().forEach(window => {
        try {
          if (!window.isDestroyed() && !window.webContents.isDestroyed()) {
            window.webContents.send('update-status-log', status);
          }
        } catch (error) {
          // Ignore errors
        }
      });
      
      // Mark as auto check (startup check is also automatic)
      isAutoCheck = true;
      autoUpdater.checkForUpdatesAndNotify().catch(err => {
        console.error('Auto-update check failed:', err);
        BrowserWindow.getAllWindows().forEach(window => {
          try {
            if (!window.isDestroyed() && !window.webContents.isDestroyed()) {
              window.webContents.send('update-status-log', {
                message: 'Update check failed',
                error: err.message,
                errorCode: err.code,
              });
            }
          } catch (error) {
            // Ignore errors
          }
        });
      }).finally(() => {
        // Reset flag after a short delay
        setTimeout(() => {
          isAutoCheck = false;
        }, 1000);
      });
    }, 5000);
}

// Variables for progress window (like FAC1)
let progressWindow = null;
let mainWindowRef = null;

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

// Send update status to renderer for debugging
const sendUpdateStatus = (status) => {
  sendToAllWindows('update-status-log', status);
};

// Setup update event handlers (like FAC1's setupEventHandlers method)
function setupUpdateEventHandlers() {
  // Auto-check for updates every 4 hours
  setInterval(() => {
    isAutoCheck = true; // Mark as auto check
    autoUpdater.checkForUpdatesAndNotify().catch(err => {
      console.error('Auto-update check failed:', err);
      // Don't show error dialog for auto checks - just log it
    }).finally(() => {
      // Reset flag after a short delay to allow error event to process
      setTimeout(() => {
        isAutoCheck = false;
      }, 1000);
    });
  }, 4 * 60 * 60 * 1000); // 4 hours
  
  // Update available - show dialog to user (like FAC1)
  autoUpdater.on('update-available', (info) => {
    console.log('Update available:', info.version);
    
    // Get main window reference
    const { BrowserWindow } = require('electron');
    mainWindowRef = BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0];
    
    sendToAllWindows('update-available', {
      version: info.version,
      releaseDate: info.releaseDate,
      releaseNotes: info.releaseNotes,
    });

    // Show dialog asking user if they want to download (like FAC1)
    dialog.showMessageBox({
      type: 'info',
      title: 'Update Available',
      message: `New version ${info.version} is available!`,
      detail: `Current version: ${app.getVersion()}\nNew version: ${info.version}\n\nWould you like to download it now?`,
      buttons: ['Download', 'Later'],
      defaultId: 0,
      cancelId: 1
    }).then(async (result) => {
      if (result.response === 0) {
        console.log('User chose to download update');
        
        // Get theme info from main window's localStorage
        const getThemeInfo = async () => {
          try {
            const { themes } = require('../themes/themes');
            let savedTheme = 'terminus'; // Default
            
            // Try to get theme from main window's localStorage
            if (mainWindowRef && !mainWindowRef.isDestroyed() && !mainWindowRef.webContents.isDestroyed()) {
              try {
                const themeResult = await mainWindowRef.webContents.executeJavaScript(`
                  (() => {
                    try {
                      return localStorage.getItem('ash-theme') || 'terminus';
                    } catch (e) {
                      return 'terminus';
                    }
                  })()
                `);
                savedTheme = themeResult || 'terminus';
              } catch (e) {
                console.warn('Failed to get theme from main window:', e);
              }
            }
            
            const theme = themes[savedTheme] || themes['terminus'];
            return {
              background: theme.background || '#000000',
              surface: theme.surface || '#000000',
              text: theme.text || '#00ff41',
              border: theme.border || '#1a1a1a',
              accent: theme.accent || '#00ff41'
            };
          } catch (e) {
            // Fallback to default theme
            return {
              background: '#000000',
              surface: '#000000',
              text: '#00ff41',
              border: '#1a1a1a',
              accent: '#00ff41'
            };
          }
        };

        const theme = await getThemeInfo();

        // Create progress window (like FAC1)
        progressWindow = new BrowserWindow({
          width: 450,
          height: 200,
          resizable: false,
          minimizable: false,
          maximizable: false,
          fullscreenable: false,
          title: 'Downloading Update',
          parent: mainWindowRef,
          modal: true,
          show: false,
          webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
          }
        });

        progressWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(`
          <!DOCTYPE html>
          <html>
          <head>
            <style>
              :root {
                --theme-bg: ${theme.background};
                --theme-surface: ${theme.surface};
                --theme-text: ${theme.text};
                --theme-border: ${theme.border};
                --theme-accent: ${theme.accent};
              }
              * {
                box-sizing: border-box;
                margin: 0;
                padding: 0;
              }
              body {
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
                padding: 0;
                margin: 0;
                background: var(--theme-bg);
                display: flex;
                align-items: center;
                justify-content: center;
                height: 100vh;
                width: 100vw;
                overflow: hidden;
              }
              html {
                overflow: hidden;
              }
              .container {
                background: var(--theme-surface);
                padding: 30px 35px;
                width: 100%;
                height: 100%;
                display: flex;
                flex-direction: column;
                justify-content: center;
                border: 1px solid color-mix(in srgb, var(--theme-accent) 20%, transparent);
              }
              .header {
                display: flex;
                align-items: center;
                margin-bottom: 20px;
              }
              .icon {
                width: 40px;
                height: 40px;
                background: var(--theme-accent);
                border-radius: 10px;
                display: flex;
                align-items: center;
                justify-content: center;
                margin-right: 15px;
                flex-shrink: 0;
              }
              .icon::after {
                content: '⬇';
                color: var(--theme-bg);
                font-size: 24px;
              }
              h2 {
                color: var(--theme-text);
                font-size: 18px;
                font-weight: 600;
                margin: 0;
              }
              .progress-wrapper {
                margin-bottom: 15px;
              }
              .progress-bar {
                width: 100%;
                height: 8px;
                background: color-mix(in srgb, var(--theme-text) 10%, transparent);
                border-radius: 20px;
                overflow: hidden;
                position: relative;
              }
              .progress-fill {
                height: 100%;
                background: var(--theme-accent);
                border-radius: 20px;
                transition: width 0.4s;
              }
              .stats {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-top: 12px;
              }
              .percent {
                font-size: 24px;
                font-weight: 700;
                color: var(--theme-accent);
              }
              .info {
                display: flex;
                gap: 20px;
                color: color-mix(in srgb, var(--theme-text) 50%, transparent);
                font-size: 13px;
              }
              .info-item {
                display: flex;
                align-items: center;
                gap: 6px;
              }
              .speed {
                color: var(--theme-accent);
                font-weight: 600;
              }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <div class="icon"></div>
                <h2>Downloading Update</h2>
              </div>
              <div class="progress-wrapper">
                <div class="progress-bar">
                  <div class="progress-fill" id="progress" style="width: 0%"></div>
                </div>
              </div>
              <div class="stats">
                <div class="percent" id="percent">0%</div>
                <div class="info">
                  <div class="info-item">
                    <span id="downloaded">0 MB</span> / <span id="total">0 MB</span>
                  </div>
                  <div class="info-item speed" id="speed">0 MB/s</div>
                </div>
              </div>
            </div>
            <script>
              const { ipcRenderer } = require('electron');
              ipcRenderer.on('download-progress', (event, data) => {
                document.getElementById('progress').style.width = data.percent + '%';
                document.getElementById('percent').textContent = data.percent + '%';
                document.getElementById('downloaded').textContent = data.downloaded + ' MB';
                document.getElementById('total').textContent = data.total + ' MB';
                document.getElementById('speed').textContent = data.speed + ' MB/s';
              });
            </script>
          </body>
          </html>
        `)}`);

        progressWindow.once('ready-to-show', () => {
          progressWindow.show();
        });

        autoUpdater.downloadUpdate();
      } else {
        console.log('User postponed update');
      }
    });
  });
  
  // Update not available
  autoUpdater.on('update-not-available', (info) => {
    console.log('Update not available. Current version is latest.');
    sendToAllWindows('update-not-available', null);
  });
  
  // Update download progress
  autoUpdater.on('download-progress', (progressObj) => {
    const percent = Math.round(progressObj.percent);
    const speed = (progressObj.bytesPerSecond / 1024 / 1024).toFixed(2);
    const downloaded = (progressObj.transferred / 1024 / 1024).toFixed(2);
    const total = (progressObj.total / 1024 / 1024).toFixed(2);
    
    const message = `Downloading... ${percent}%`;
    console.log(message);
    console.log(`Speed: ${speed} MB/s - ${downloaded}MB / ${total}MB`);
    
    // Send progress to progress window (like FAC1)
    if (progressWindow && !progressWindow.isDestroyed()) {
      progressWindow.webContents.send('download-progress', {
        percent,
        speed,
        downloaded,
        total
      });
    }
    
    // Update taskbar progress
    if (mainWindowRef && !mainWindowRef.isDestroyed()) {
      mainWindowRef.setProgressBar(progressObj.percent / 100);
    }
    
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
    
    // Close progress window (like FAC1)
    if (progressWindow && !progressWindow.isDestroyed()) {
      progressWindow.close();
      progressWindow = null;
    }
    
    // Clear progress bar
    if (mainWindowRef && !mainWindowRef.isDestroyed()) {
      mainWindowRef.setProgressBar(-1);
    }
    
    sendToAllWindows('update-downloaded', {
      version: info.version,
      releaseDate: info.releaseDate,
      releaseNotes: info.releaseNotes,
    });

    // Show dialog asking user if they want to install now (like FAC1)
    dialog.showMessageBox({
      type: 'info',
      title: 'Update Ready',
      message: 'Update has been downloaded successfully!',
      detail: `Version ${info.version} is ready to install.\n\nThe application will restart to complete the installation.`,
      buttons: ['Restart Now', 'Restart Later'],
      defaultId: 0,
      cancelId: 1
    }).then((result) => {
      if (result.response === 0) {
        console.log('User chose to restart and install');
        autoUpdater.quitAndInstall();
      } else {
        console.log('User postponed restart - will install on next app start');
      }
    });
  });
  
  // Update error
  autoUpdater.on('error', (err) => {
    console.error('Auto-updater error:', err);
    
    // Close progress window if open (like FAC1)
    if (progressWindow && !progressWindow.isDestroyed()) {
      progressWindow.close();
      progressWindow = null;
    }
    
    // Clear progress bar
    if (mainWindowRef && !mainWindowRef.isDestroyed()) {
      mainWindowRef.setProgressBar(-1);
    }
    
    sendToAllWindows('update-error', {
      message: err.message,
      stack: err.stack,
      code: err.code,
    });

    // Only show error dialog for manual checks, not for automatic background checks
    // This prevents annoying error dialogs when network is temporarily unavailable
    if (!isAutoCheck) {
      dialog.showMessageBox({
        type: 'error',
        title: 'Update Error',
        message: 'Failed to check for updates',
        detail: `Error: ${err.message || err}\n\nPlease try again later or download the update manually from our website.`,
        buttons: ['OK']
      });
    } else {
      // For auto checks, just log the error silently
      console.log('Auto-update check failed (silent):', err.message);
    }
  });
  
  // Log update check events for debugging
  autoUpdater.logger = {
    info: (message) => console.log('[electron-updater]', message),
    warn: (message) => console.warn('[electron-updater]', message),
    error: (message) => console.error('[electron-updater]', message),
    debug: (message) => console.log('[electron-updater] DEBUG', message),
  };
}

/**
 * Initialize update handlers
 * @param {Function} scheduleCheck - Function to call to schedule startup check
 */
export function initializeUpdateHandlers(scheduleCheck) {
  const { BrowserWindow } = require('electron');
  
  // Skip in development mode (like FAC1)
  if (!app.isPackaged) {
    console.log('Development mode - auto-updater disabled');
    return;
  }
  
  // Configure server URL (like FAC1 - URL must end with slash)
  // Server automatically generates latest.yml at /update/ash/latest.yml
  autoUpdater.setFeedURL({
    provider: 'generic',
    url: `${UPDATE_SERVER}/update/${APP_NAME}/`  // Note: trailing slash required (like FAC1)
  });
  
  // Configure auto-updater behavior
  autoUpdater.autoDownload = false; // Ask user before downloading (like FAC1)
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.logger = console; // Enable logging (like FAC1)
  
  const status = {
    message: 'Initializing update handlers...',
    isDev,
    isPackaged: app.isPackaged,
    nodeEnv: process.env.NODE_ENV,
    currentVersion: app.getVersion(),
    updateUrl: `${UPDATE_SERVER}/update/${APP_NAME}/`,
  };
  
  console.log('Auto-updater initialized');
  console.log('Feed URL:', `${UPDATE_SERVER}/update/${APP_NAME}/`);
  console.log('Current version:', app.getVersion());
  console.log('Platform:', process.platform);
  
  // Platform-specific update info (like FAC1)
  if (process.platform === 'win32') {
    console.log('Update format: NSIS installer (latest.yml)');
  } else if (process.platform === 'darwin') {
    console.log('Update format: DMG/ZIP (latest-mac.yml)');
  } else if (process.platform === 'linux') {
    console.log('Update format: AppImage (latest-linux.yml)');
    console.log('AppImage updates support automatic installation without sudo');
  }
  
  // Setup event handlers (like FAC1's setupEventHandlers)
  setupUpdateEventHandlers();
  
  // Send status to renderer for debugging
  BrowserWindow.getAllWindows().forEach(window => {
    try {
      if (!window.isDestroyed() && !window.webContents.isDestroyed()) {
        window.webContents.send('update-status-log', status);
      }
    } catch (error) {
      // Ignore errors
    }
  });
  
  // IPC handlers for manual update check (available in both dev and production)
  ipcMain.handle('check-for-updates', async () => {
    if (isDev) {
      console.log('Update check is disabled in development mode');
      return {
        success: false,
        error: 'Update check is disabled in development mode',
      };
    }
    
    // Mark as manual check (not auto check)
    isAutoCheck = false;
    
    try {
      console.log('Checking for updates...');
      console.log('Current version:', app.getVersion());
      console.log('Update feed URL:', `${UPDATE_SERVER}/update/${APP_NAME}`);
      const result = await autoUpdater.checkForUpdates();
      console.log('Update check result:', result);
      console.log('Update info:', result?.updateInfo);
      console.log('CancellationToken:', result?.cancellationToken);
      
      if (result?.updateInfo) {
        console.log('Update available:', result.updateInfo.version);
        console.log('Release date:', result.updateInfo.releaseDate);
        console.log('Release notes:', result.updateInfo.releaseNotes);
      } else {
        console.log('No update info returned');
      }
      
      return {
        success: true,
        updateInfo: result?.updateInfo || null,
      };
    } catch (error) {
      console.error('Manual update check failed:', error);
      console.error('Error details:', {
        message: error.message,
        stack: error.stack,
        code: error.code,
      });
      return {
        success: false,
        error: error.message,
        details: error.stack,
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
    console.log('Scheduling startup update check...');
    if (scheduleCheck) {
      console.log('Calling scheduleStartupCheck function...');
      scheduleCheck();
    } else {
      console.log('No scheduleCheck function provided, using default timeout...');
      // Default: check after 5 seconds
      setTimeout(() => {
        console.log('Executing default startup update check...');
        autoUpdater.checkForUpdatesAndNotify().catch(err => {
          console.error('Auto-update check failed:', err);
        });
      }, 5000);
    }
  } else {
    console.log('Auto-update is disabled in development mode');
    console.log('Note: Update checks will only work in production builds (app.isPackaged = true)');
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

