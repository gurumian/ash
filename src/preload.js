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
  
  // SFTP file upload
  sshUploadFile: ({ connectionId, localPath, remotePath }) => ipcRenderer.invoke('ssh-upload-file', { connectionId, localPath, remotePath }),
  
  onSSHData: (callback) => ipcRenderer.on('ssh-data', callback),
  
  // SSH connection close event
  onSSHClose: (callback) => ipcRenderer.on('ssh-closed', callback),
  
  // SFTP upload progress event
  onSSHUploadProgress: (callback) => ipcRenderer.on('ssh-upload-progress', (event, data) => callback(data)),
  offSSHUploadProgress: (callback) => ipcRenderer.off('ssh-upload-progress', callback),
  
  // Remove SSH event listeners
  offSSHData: (callback) => ipcRenderer.off('ssh-data', callback),
  offSSHClose: (callback) => ipcRenderer.off('ssh-closed', callback),
  
  // Telnet connection
  telnetConnect: (connectionInfo) => ipcRenderer.invoke('telnet-connect', connectionInfo),
  
  // Send data to Telnet connection
  telnetWrite: (connectionId, data) => ipcRenderer.invoke('telnet-write', { connectionId, data }),
  
  // Disconnect Telnet connection
  telnetDisconnect: (connectionId) => ipcRenderer.invoke('telnet-disconnect', connectionId),
  
  onTelnetData: (callback) => ipcRenderer.on('telnet-data', callback),
  
  // Telnet connection close event
  onTelnetClose: (callback) => ipcRenderer.on('telnet-closed', callback),
  
  // Remove Telnet event listeners
  offTelnetData: (callback) => ipcRenderer.off('telnet-data', callback),
  offTelnetClose: (callback) => ipcRenderer.off('telnet-closed', callback),
  
  // Serial port APIs
  serialListPorts: () => ipcRenderer.invoke('serial-list-ports'),
  serialConnect: (sessionId, options) => ipcRenderer.invoke('serial-connect', sessionId, options),
  serialWrite: (sessionId, data) => ipcRenderer.invoke('serial-write', sessionId, data),
  serialDisconnect: (sessionId) => ipcRenderer.invoke('serial-disconnect', sessionId),
  
  // Serial port events
  onSerialData: (callback) => ipcRenderer.on('serial-data', callback),
  onSerialClose: (callback) => ipcRenderer.on('serial-close', callback),
  onSerialError: (callback) => ipcRenderer.on('serial-error', callback),
  
  // Remove Serial event listeners
  offSerialData: (callback) => ipcRenderer.off('serial-data', callback),
  offSerialClose: (callback) => ipcRenderer.off('serial-close', callback),
  offSerialError: (callback) => ipcRenderer.off('serial-error', callback),
  
  // Remove event listeners
  removeAllListeners: (channel) => ipcRenderer.removeAllListeners(channel),
  
  // Menu events
  onMenuNewSession: (callback) => ipcRenderer.on('menu-new-session', callback),
  onMenuCloseSession: (callback) => ipcRenderer.on('menu-close-session', callback),
  onMenuToggleSessionManager: (callback) => ipcRenderer.on('menu-toggle-session-manager', callback),
  onMenuSettings: (callback) => ipcRenderer.on('menu-settings', callback),
  onMenuIperfServer: (callback) => ipcRenderer.on('menu-iperf-server', callback),
  onMenuIperfClient: (callback) => ipcRenderer.on('menu-iperf-client', callback),
  onMenuCheckUpdates: (callback) => ipcRenderer.on('menu-check-updates', callback),
  onMenuAbout: (callback) => ipcRenderer.on('menu-about', callback),
  onMenuThirdPartyLicenses: (callback) => ipcRenderer.on('menu-third-party-licenses', callback),
  onMenuTftpServer: (callback) => ipcRenderer.on('menu-tftp-server', callback),
  onMenuWebServer: (callback) => ipcRenderer.on('menu-web-server', callback),
  onMenuAICommand: (callback) => ipcRenderer.on('menu-ai-command', callback),
  
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
  
  // System locale
  getSystemLocale: () => ipcRenderer.invoke('get-system-locale'),
  
  // Settings
  getSettings: () => ipcRenderer.invoke('get-settings'),
  saveSettings: (settings) => ipcRenderer.invoke('save-settings', settings),
  
  // Open path in file manager
  openPath: (path) => ipcRenderer.invoke('open-path', path),
  
  // Open external URL in default browser
  openExternal: (url) => ipcRenderer.invoke('open-external', url),
  
  // Show directory picker dialog
  showDirectoryPicker: (defaultPath) => ipcRenderer.invoke('show-directory-picker', defaultPath),
  
  // Show file picker dialog
  showFilePicker: (defaultPath) => ipcRenderer.invoke('show-file-picker', defaultPath),
  
  // Library export/import
  exportLibrary: (libraryData, defaultFileName) => ipcRenderer.invoke('export-library', libraryData, defaultFileName),
  importLibrary: () => ipcRenderer.invoke('import-library'),
  
  // TFTP Server APIs
  tftpStatus: () => ipcRenderer.invoke('tftp-status'),
  tftpStart: (params) => ipcRenderer.invoke('tftp-start', params),
  tftpStop: () => ipcRenderer.invoke('tftp-stop'),
  tftpGetOutputDir: () => ipcRenderer.invoke('tftp-get-output-dir'),
  onTftpTransferComplete: (callback) => {
    ipcRenderer.on('tftp-transfer-complete', (_event, data) => callback(data));
  },
  offTftpTransferComplete: (callback) => {
    ipcRenderer.removeListener('tftp-transfer-complete', callback);
  },
  
  // Web Server APIs
  webStatus: () => ipcRenderer.invoke('web-status'),
  webStart: (params) => ipcRenderer.invoke('web-start', params),
  webStop: () => ipcRenderer.invoke('web-stop'),
  webGetRootDir: () => ipcRenderer.invoke('web-get-root-dir'),
  
  // Shared network interfaces API
  getNetworkInterfaces: () => ipcRenderer.invoke('net-get-network-interfaces'),
  onWebServerError: (callback) => ipcRenderer.on('web-server-error', (event, data) => callback(data)),
  offWebServerError: (callback) => ipcRenderer.off('web-server-error', callback),
  
  // iperf3 Server APIs
  iperfCheckAvailable: () => ipcRenderer.invoke('iperf-check-available'),
  iperfStatus: () => ipcRenderer.invoke('iperf-status'),
  iperfStart: (params) => ipcRenderer.invoke('iperf-start', params),
  iperfStop: () => ipcRenderer.invoke('iperf-stop'),
  onIperfServerError: (callback) => ipcRenderer.on('iperf-server-error', (event, data) => callback(data)),
  offIperfServerError: (callback) => ipcRenderer.off('iperf-server-error', callback),
  onIperfServerStopped: (callback) => ipcRenderer.on('iperf-server-stopped', (event, data) => callback(data)),
  offIperfServerStopped: (callback) => ipcRenderer.off('iperf-server-stopped', callback),
  
  // iperf3 Client APIs
  iperfClientStatus: () => ipcRenderer.invoke('iperf-client-status'),
  iperfClientStart: (params) => ipcRenderer.invoke('iperf-client-start', params),
  iperfClientStop: () => ipcRenderer.invoke('iperf-client-stop'),
  onIperfClientError: (callback) => ipcRenderer.on('iperf-client-error', (event, data) => callback(data)),
  offIperfClientError: (callback) => ipcRenderer.off('iperf-client-error', callback),
  onIperfClientStarted: (callback) => ipcRenderer.on('iperf-client-started', (event, data) => callback(data)),
  offIperfClientStarted: (callback) => ipcRenderer.off('iperf-client-started', callback),
  onIperfClientOutput: (callback) => ipcRenderer.on('iperf-client-output', (event, data) => callback(data)),
  offIperfClientOutput: (callback) => ipcRenderer.off('iperf-client-output', callback),
  onIperfClientStopped: (callback) => ipcRenderer.on('iperf-client-stopped', (event, data) => callback(data)),
  offIperfClientStopped: (callback) => ipcRenderer.off('iperf-client-stopped', callback),
  
  // TFTP Server error events
  onTftpServerError: (callback) => ipcRenderer.on('tftp-server-error', (event, data) => callback(data)),
  offTftpServerError: (callback) => ipcRenderer.off('tftp-server-error', callback),
  
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
  
  // Third-party licenses
  readThirdPartyLicenses: () => ipcRenderer.invoke('read-third-party-licenses'),
  
  // Backend APIs (for on-demand startup)
  startBackend: () => ipcRenderer.invoke('backend-start'),
  stopBackend: () => ipcRenderer.invoke('backend-stop'),
  checkBackendStatus: () => ipcRenderer.invoke('backend-status-check'),
});
