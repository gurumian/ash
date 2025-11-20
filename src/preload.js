// See the Electron documentation for details on how to use preload scripts:
// https://www.electronjs.org/docs/latest/tutorial/process-model#preload-scripts

const { contextBridge, ipcRenderer } = require('electron');

// Expose SSH-related APIs to renderer process
contextBridge.exposeInMainWorld('electronAPI', {
  // SSH connection
  sshConnect: (connectionInfo) => ipcRenderer.invoke('ssh-connect', connectionInfo),
  
  // Start SSH terminal session
  sshStartShell: (connectionId, cols, rows) => ipcRenderer.invoke('ssh-start-shell', connectionId, cols, rows),
  
  // Resize SSH terminal
  sshResize: (connectionId, cols, rows) => ipcRenderer.invoke('ssh-resize', connectionId, cols, rows),
  
  // Send data to SSH terminal
  sshWrite: (connectionId, data) => ipcRenderer.invoke('ssh-write', { connectionId, data }),
  
  // Disconnect SSH connection
  sshDisconnect: (connectionId) => ipcRenderer.invoke('ssh-disconnect', connectionId),
  
  onSSHData: (callback) => ipcRenderer.on('ssh-data', callback),
  
  // SSH connection close event
  onSSHClose: (callback) => ipcRenderer.on('ssh-closed', callback),
  
  // Remove SSH event listeners
  offSSHData: (callback) => ipcRenderer.off('ssh-data', callback),
  offSSHClose: (callback) => ipcRenderer.off('ssh-closed', callback),
  
  // Serial port APIs
  serialListPorts: () => ipcRenderer.invoke('serial-list-ports'),
  serialConnect: (sessionId, options) => ipcRenderer.invoke('serial-connect', sessionId, options),
  serialWrite: (sessionId, data) => ipcRenderer.invoke('serial-write', sessionId, data),
  serialDisconnect: (sessionId) => ipcRenderer.invoke('serial-disconnect', sessionId),
  
  // Serial port events
  onSerialData: (callback) => ipcRenderer.on('serial-data', callback),
  onSerialClose: (callback) => ipcRenderer.on('serial-close', callback),
  onSerialError: (callback) => ipcRenderer.on('serial-error', callback),
  
  // Remove event listeners
  removeAllListeners: (channel) => ipcRenderer.removeAllListeners(channel),
  
  // Menu events
  onMenuNewSession: (callback) => ipcRenderer.on('menu-new-session', callback),
  onMenuCloseSession: (callback) => ipcRenderer.on('menu-close-session', callback),
  onMenuToggleSessionManager: (callback) => ipcRenderer.on('menu-toggle-session-manager', callback),
  onMenuSettings: (callback) => ipcRenderer.on('menu-settings', callback),
  onMenuCheckUpdates: (callback) => ipcRenderer.on('menu-check-updates', callback),
  onMenuAbout: (callback) => ipcRenderer.on('menu-about', callback),
  
  // Change window title
  setWindowTitle: async (title) => {
    try {
      return await ipcRenderer.invoke('set-window-title', title);
    } catch (error) {
      console.log('setWindowTitle failed:', error);
      return { success: false };
    }
  },

  // Save log to file
  saveLogToFile: async (sessionId, logContent, sessionName, groupName, isNewFile = false) => {
    try {
      return await ipcRenderer.invoke('save-log-to-file', { sessionId, logContent, sessionName, groupName, isNewFile });
    } catch (error) {
      console.log('saveLogToFile failed:', error);
      return { success: false };
    }
  },
  
  // Append log to existing file
  appendLogToFile: async (sessionId, logContent, filePath) => {
    try {
      return await ipcRenderer.invoke('append-log-to-file', { sessionId, logContent, filePath });
    } catch (error) {
      console.log('appendLogToFile failed:', error);
      return { success: false };
    }
  },

  // Window controls (for Windows frameless window)
  windowMinimize: () => ipcRenderer.invoke('window-minimize'),
  windowMaximize: () => ipcRenderer.invoke('window-maximize'),
  windowClose: () => ipcRenderer.invoke('window-close'),
  windowIsMaximized: () => ipcRenderer.invoke('window-is-maximized'),
  onWindowMaximized: (callback) => ipcRenderer.on('window-maximized', callback),
  onWindowUnmaximized: (callback) => ipcRenderer.on('window-unmaximized', callback),

  // Platform info
  platform: process.platform,

  // Detach tab to new window
  detachTab: (sessionId) => ipcRenderer.invoke('detach-tab', sessionId),
  
  // Listen for detached session
  onDetachedSession: (callback) => ipcRenderer.on('detached-session', (event, data) => callback(data)),
  offDetachedSession: (callback) => ipcRenderer.off('detached-session', callback),
  
  // Listen for remove detached session
  onRemoveDetachedSession: (callback) => ipcRenderer.on('remove-detached-session', (event, sessionId) => callback(sessionId)),
  offRemoveDetachedSession: (callback) => ipcRenderer.off('remove-detached-session', callback),

  // Auto-update APIs
  checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
  quitAndInstall: () => ipcRenderer.invoke('quit-and-install'),
  
  // Developer Tools
  toggleDevTools: () => ipcRenderer.invoke('toggle-dev-tools'),
  
  // App info
  getAppInfo: () => ipcRenderer.invoke('get-app-info'),
  
  // Settings
  getSettings: () => ipcRenderer.invoke('get-settings'),
  saveSettings: (settings) => ipcRenderer.invoke('save-settings', settings),
  
  // Update events
  onUpdateAvailable: (callback) => ipcRenderer.on('update-available', (event, data) => callback(data)),
  onUpdateNotAvailable: (callback) => ipcRenderer.on('update-not-available', callback),
  onUpdateDownloadProgress: (callback) => ipcRenderer.on('update-download-progress', (event, data) => callback(data)),
  onUpdateDownloaded: (callback) => ipcRenderer.on('update-downloaded', (event, data) => callback(data)),
  onUpdateError: (callback) => ipcRenderer.on('update-error', (event, data) => callback(data)),
  onUpdateStatusLog: (callback) => ipcRenderer.on('update-status-log', (event, data) => {
    console.log('[UPDATE]', data);
    if (callback) callback(data);
  }),
  
  // Remove update event listeners
  offUpdateAvailable: (callback) => ipcRenderer.off('update-available', callback),
  offUpdateNotAvailable: (callback) => ipcRenderer.off('update-not-available', callback),
  offUpdateDownloadProgress: (callback) => ipcRenderer.off('update-download-progress', callback),
  offUpdateDownloaded: (callback) => ipcRenderer.off('update-downloaded', callback),
  offUpdateError: (callback) => ipcRenderer.off('update-error', callback),
});
