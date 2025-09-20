// See the Electron documentation for details on how to use preload scripts:
// https://www.electronjs.org/docs/latest/tutorial/process-model#preload-scripts

const { contextBridge, ipcRenderer } = require('electron');

// Expose SSH-related APIs to renderer process
contextBridge.exposeInMainWorld('electronAPI', {
  // SSH connection
  sshConnect: (connectionInfo) => ipcRenderer.invoke('ssh-connect', connectionInfo),
  
  // Start SSH terminal session
  sshStartShell: (connectionId) => ipcRenderer.invoke('ssh-start-shell', connectionId),
  
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
  onMenuAbout: (callback) => ipcRenderer.on('menu-about', callback),
  
  // Change window title
  setWindowTitle: async (title) => {
    try {
      return await ipcRenderer.invoke('set-window-title', title);
    } catch (error) {
      console.log('setWindowTitle failed:', error);
      return { success: false };
    }
  }
});
