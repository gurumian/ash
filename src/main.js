import { app, BrowserWindow } from 'electron';
import started from 'electron-squirrel-startup';
import { createMenu } from './main/menu.js';
import { createWindow } from './main/window.js';
import { initializeSSHHandlers, cleanupSSHConnections } from './main/ssh-handler.js';
import { initializeSerialHandlers, cleanupSerialConnections } from './main/serial-handler.js';
import { initializeWindowHandlers } from './main/window-handler.js';
import { initializeUpdateHandlers, cleanupUpdateHandlers, scheduleStartupCheck } from './main/update-handler.js';
import { initializeTftpHandlers, cleanupTftpServer, setMainWindow as setTftpMainWindow } from './main/tftp-handler.js';
import { initializeWebHandlers, cleanupWebServer, setMainWindow as setWebMainWindow } from './main/web-handler.js';
import { initializeIperfHandlers, cleanupIperfServer, setMainWindow as setIperfMainWindow } from './main/iperf-handler.js';

// Set app name
app.setName('ash');

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (started) {
  app.quit();
}

// Initialize all IPC handlers
initializeSSHHandlers();
initializeSerialHandlers();
initializeWindowHandlers();
initializeTftpHandlers();
initializeWebHandlers();
initializeIperfHandlers();

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  createMenu(); // Create system menu
  const mainWindow = createWindow();
  
  // Set main window reference for TFTP, Web, and iperf handlers
  setTftpMainWindow(mainWindow);
  setWebMainWindow(mainWindow);
  setIperfMainWindow(mainWindow);

  // Initialize update handlers after app is ready
  initializeUpdateHandlers(scheduleStartupCheck);

  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// Quit when all windows are closed, including on macOS
app.on('window-all-closed', () => {
  app.quit();
});

// Cleanup on app quit
app.on('before-quit', () => {
  cleanupSSHConnections();
  cleanupSerialConnections();
  cleanupUpdateHandlers();
  cleanupTftpServer();
  cleanupWebServer();
  cleanupIperfServer();
});
