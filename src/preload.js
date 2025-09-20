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
  
  // SSH data reception event
  onSSHData: (callback) => ipcRenderer.on('ssh-data', callback),
  
  // SSH connection close event
  onSSHClose: (callback) => ipcRenderer.on('ssh-close', callback),
  
  // Remove event listeners
  removeAllListeners: (channel) => ipcRenderer.removeAllListeners(channel),
  
  // Menu events
  onMenuNewSession: (callback) => ipcRenderer.on('menu-new-session', callback),
  onMenuCloseSession: (callback) => ipcRenderer.on('menu-close-session', callback),
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
