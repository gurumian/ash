// See the Electron documentation for details on how to use preload scripts:
// https://www.electronjs.org/docs/latest/tutorial/process-model#preload-scripts

const { contextBridge, ipcRenderer } = require('electron');

// SSH 관련 API를 renderer 프로세스에 노출
contextBridge.exposeInMainWorld('electronAPI', {
  // SSH 연결
  sshConnect: (connectionInfo) => ipcRenderer.invoke('ssh-connect', connectionInfo),
  
  // SSH 터미널 세션 시작
  sshStartShell: (connectionId) => ipcRenderer.invoke('ssh-start-shell', connectionId),
  
  // SSH 터미널에 데이터 전송
  sshWrite: (connectionId, data) => ipcRenderer.invoke('ssh-write', { connectionId, data }),
  
  // SSH 연결 해제
  sshDisconnect: (connectionId) => ipcRenderer.invoke('ssh-disconnect', connectionId),
  
  // SSH 데이터 수신 이벤트
  onSSHData: (callback) => ipcRenderer.on('ssh-data', callback),
  
  // SSH 연결 종료 이벤트
  onSSHClose: (callback) => ipcRenderer.on('ssh-close', callback),
  
  // 이벤트 리스너 제거
  removeAllListeners: (channel) => ipcRenderer.removeAllListeners(channel),
  
  // 메뉴 이벤트
  onMenuNewSession: (callback) => ipcRenderer.on('menu-new-session', callback),
  onMenuCloseSession: (callback) => ipcRenderer.on('menu-close-session', callback),
  onMenuSettings: (callback) => ipcRenderer.on('menu-settings', callback),
  onMenuAbout: (callback) => ipcRenderer.on('menu-about', callback),
  
  // 창 제목 변경
  setWindowTitle: async (title) => {
    try {
      return await ipcRenderer.invoke('set-window-title', title);
    } catch (error) {
      console.log('setWindowTitle failed:', error);
      return { success: false };
    }
  }
});
