import { app, BrowserWindow } from 'electron';
import { execFileSync, spawn } from 'node:child_process';
import fs from 'node:fs';
import started from 'electron-squirrel-startup';
import { installAppImageCommand } from './main/appimage-command.js';
import { createMenu } from './main/menu.js';
import { createWindow } from './main/window.js';
import { initializeSSHHandlers, cleanupSSHConnections } from './main/ssh-handler.js';
import { initializeTelnetHandlers, cleanupTelnetConnections } from './main/telnet-handler.js';
import { initializeSerialHandlers, cleanupSerialConnections } from './main/serial-handler.js';
import { initializeWindowHandlers } from './main/window-handler.js';
import { initializeUpdateHandlers, cleanupUpdateHandlers, scheduleStartupCheck } from './main/update-handler.js';
import { initializeTftpHandlers, cleanupTftpServer, setMainWindow as setTftpMainWindow } from './main/tftp-handler.js';
import { initializeWebHandlers, cleanupWebServer, setMainWindow as setWebMainWindow } from './main/web-handler.js';
import { initializeIperfHandlers, cleanupIperfServer, setMainWindow as setIperfMainWindow, initializeIperfClientHandlers, cleanupIperfClient } from './main/iperf-handler.js';
import { initializeNetcatHandlers, cleanupNetcat, setMainWindow as setNetcatMainWindow } from './main/netcat-handler.js';
import { initializeLocalHandlers, cleanupLocalConnections } from './main/local-pty-handler.js';
import { startBackend, stopBackend, initializeBackendHandlers } from './main/backend-handler.js';
import { startIPCBridge, stopIPCBridge, setMainWindow as setIpcMainWindow } from './main/ipc-bridge-handler.js';

// Set app name
app.setName('ash');

// Disable sandbox on Linux to avoid SUID sandbox helper issues in some environments
if (process.platform === 'linux') {
  app.commandLine.appendSwitch('no-sandbox');
}

/** A packaged deb stays in the terminal session and dies with it. AppImage must stay attached so its mount is not dropped. */
function detachPackagedTerminalLaunch() {
  if (process.platform !== 'linux' || process.env.APPIMAGE) return;
  if (process.env.ASH_DETACHED === '1' || process.env.ASH_FOREGROUND === '1') return;
  if (!app.isPackaged || !process.stdout.isTTY) return;
  const child = spawn(process.execPath, process.argv.slice(1), {
    detached: true,
    stdio: 'ignore',
    env: { ...process.env, ASH_DETACHED: '1' },
  });
  child.unref();
  process.exit(0);
}

detachPackagedTerminalLaunch();

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (started) {
  app.quit();
}

// Initialize all IPC handlers
initializeSSHHandlers();
initializeTelnetHandlers();
initializeSerialHandlers();
initializeWindowHandlers();
initializeTftpHandlers();
initializeWebHandlers();
initializeIperfHandlers();
initializeIperfClientHandlers();
initializeNetcatHandlers();
initializeLocalHandlers();
initializeBackendHandlers(); // Initialize backend handlers for on-demand startup

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(async () => {
  installAppImageCommand();

  // Start IPC Bridge first (backend needs it)
  startIPCBridge();

  createMenu(); // Create system menu
  const mainWindow = await createWindow();

  // Set main window reference for TFTP, Web, and iperf handlers
  setTftpMainWindow(mainWindow);
  setWebMainWindow(mainWindow);
  setIperfMainWindow(mainWindow);
  setIpcMainWindow(mainWindow);
  setNetcatMainWindow(mainWindow);

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

let shutdownStarted = false;

function childPids(pid) {
  try {
    const raw = fs.readFileSync(`/proc/${pid}/task/${pid}/children`, 'utf8').trim();
    if (!raw) return [];
    return raw.split(/\s+/).map((part) => Number(part)).filter((n) => Number.isInteger(n) && n > 0);
  } catch {
    return [];
  }
}

function relaunchDetached() {
  try {
    execFileSync('sh', ['-c', 'nohup "$1" >/dev/null 2>&1 &', 'sh', process.execPath], { stdio: 'ignore' });
  } catch {
    /* the current process still exits */
  }
}

/** serialport's N-API destructor throws during Node teardown and can leave the process stuck. */
function forceExitLinux() {
  if (process.env.ASH_RELAUNCH === '1') relaunchDetached();
  const killChildren = (pid) => {
    for (const child of childPids(pid)) {
      killChildren(child);
      try {
        process.kill(child, 'SIGKILL');
      } catch {
        /* already exited */
      }
    }
  };
  killChildren(process.pid);
  try {
    process.kill(process.pid, 'SIGKILL');
  } catch {
    /* already exiting */
  }
}

// Close serial ports before exit, then force the process down on Linux so a stuck native destructor cannot hang quit or an update relaunch.
app.on('before-quit', (event) => {
  if (shutdownStarted) return;
  event.preventDefault();
  shutdownStarted = true;
  void (async () => {
    try {
      await stopBackend();
      stopIPCBridge();
    } catch (error) {
      console.error('Error stopping backend/IPC bridge:', error);
    }

    cleanupSSHConnections();
    cleanupTelnetConnections();
    try {
      await cleanupSerialConnections();
    } catch (error) {
      console.error('Error closing serial ports:', error);
    }
    cleanupUpdateHandlers();
    cleanupTftpServer();
    cleanupWebServer();
    cleanupIperfServer();
    cleanupIperfClient();
    cleanupNetcat();
    cleanupLocalConnections();

    if (process.platform === 'linux') app.once('quit', () => forceExitLinux());
    app.quit();
  })();
});
