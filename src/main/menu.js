import { app, BrowserWindow, Menu } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import { checkIperf3Available } from './iperf-handler.js';

/**
 * Check if iperf3 is available on this system.
 * Reuses the same logic from iperf-handler.js for consistency.
 */
function isIperfAvailable() {
  try {
    return checkIperf3Available();
  } catch (e) {
    // If any error occurs, treat as not available
    console.warn('Failed to detect iperf3 availability:', e.message);
    return false;
  }
}

/**
 * Creates the application menu
 */
export function createMenu() {
  const iperfAvailable = isIperfAvailable();

  const template = [
    {
      label: 'File',
      submenu: [
        {
          label: 'New Session',
          accelerator: 'CmdOrCtrl+N',
          click: () => {
            const focusedWindow = BrowserWindow.getFocusedWindow();
            try {
              if (focusedWindow && !focusedWindow.isDestroyed() && !focusedWindow.webContents.isDestroyed()) {
                focusedWindow.webContents.send('menu-new-session');
              }
            } catch (error) {
              console.error('Failed to send menu-new-session:', error);
            }
          }
        },
        {
          label: 'Close Session',
          accelerator: 'CmdOrCtrl+W',
          click: () => {
            const focusedWindow = BrowserWindow.getFocusedWindow();
            try {
              if (focusedWindow && !focusedWindow.isDestroyed() && !focusedWindow.webContents.isDestroyed()) {
                focusedWindow.webContents.send('menu-close-session');
              }
            } catch (error) {
              console.error('Failed to send menu-close-session:', error);
            }
          }
        },
        { type: 'separator' },
        {
          label: 'Quit',
          accelerator: process.platform === 'darwin' ? 'Cmd+Q' : 'Ctrl+Q',
          click: () => {
            app.quit();
          }
        }
      ]
    },
    {
      label: 'Edit',
      submenu: [
        {
          label: 'Copy',
          accelerator: 'CmdOrCtrl+C',
          role: 'copy'
        },
        {
          label: 'Paste',
          accelerator: 'CmdOrCtrl+V',
          role: 'paste'
        },
        { type: 'separator' },
        {
          label: 'Select All',
          accelerator: 'CmdOrCtrl+A',
          role: 'selectall'
        }
      ]
    },
    {
      label: 'Window',
      submenu: [
        {
          label: 'Minimize',
          accelerator: 'CmdOrCtrl+M',
          role: 'minimize'
        },
        {
          label: 'Close',
          accelerator: 'CmdOrCtrl+W',
          role: 'close'
        }
      ]
    },
    {
      label: 'Tools',
      submenu: [
        {
          label: 'AI Command',
          accelerator: 'CmdOrCtrl+Shift+A',
          click: () => {
            const focusedWindow = BrowserWindow.getFocusedWindow();
            try {
              if (focusedWindow && !focusedWindow.isDestroyed() && !focusedWindow.webContents.isDestroyed()) {
                focusedWindow.webContents.send('menu-ai-command');
              }
            } catch (error) {
              console.error('Failed to send menu-ai-command:', error);
            }
          }
        },
        { type: 'separator' },
        {
          label: 'TFTP Server',
          accelerator: 'CmdOrCtrl+Shift+T',
          click: () => {
            const focusedWindow = BrowserWindow.getFocusedWindow();
            try {
              if (focusedWindow && !focusedWindow.isDestroyed() && !focusedWindow.webContents.isDestroyed()) {
                focusedWindow.webContents.send('menu-tftp-server');
              }
            } catch (error) {
              console.error('Failed to send menu-tftp-server:', error);
            }
          }
        },
        {
          label: 'Web Server',
          accelerator: 'CmdOrCtrl+Shift+W',
          click: () => {
            const focusedWindow = BrowserWindow.getFocusedWindow();
            try {
              if (focusedWindow && !focusedWindow.isDestroyed() && !focusedWindow.webContents.isDestroyed()) {
                focusedWindow.webContents.send('menu-web-server');
              }
            } catch (error) {
              console.error('Failed to send menu-web-server:', error);
            }
          }
        },
        {
          label: 'iperf3 Server',
          accelerator: 'CmdOrCtrl+Shift+I',
          enabled: iperfAvailable,
          // Lightweight hint instead of tooltip
          sublabel: iperfAvailable ? '' : 'Install iperf3 to enable',
          click: () => {
            const focusedWindow = BrowserWindow.getFocusedWindow();
            try {
              if (focusedWindow && !focusedWindow.isDestroyed() && !focusedWindow.webContents.isDestroyed()) {
                focusedWindow.webContents.send('menu-iperf-server');
              }
            } catch (error) {
              console.error('Failed to send menu-iperf-server:', error);
            }
          }
        },
        {
          label: 'iperf3 Client',
          accelerator: 'CmdOrCtrl+Shift+K',
          enabled: iperfAvailable,
          // Lightweight hint instead of tooltip
          sublabel: iperfAvailable ? '' : 'Install iperf3 to enable',
          click: () => {
            const focusedWindow = BrowserWindow.getFocusedWindow();
            try {
              if (focusedWindow && !focusedWindow.isDestroyed() && !focusedWindow.webContents.isDestroyed()) {
                focusedWindow.webContents.send('menu-iperf-client');
              }
            } catch (error) {
              console.error('Failed to send menu-iperf-client:', error);
            }
          }
        }
      ]
    },
    {
      label: 'View',
      submenu: [
        {
          label: 'Toggle Developer Tools',
          accelerator: process.platform === 'darwin' ? 'Alt+Cmd+I' : 'Ctrl+Shift+I',
          click: (item, focusedWindow) => {
            if (focusedWindow) {
              focusedWindow.webContents.toggleDevTools();
            }
          }
        },
        { type: 'separator' },
        {
          label: 'Appearance',
          submenu: [
            {
              label: 'Primary Side Bar',
              type: 'checkbox',
              checked: true,
              click: (menuItem) => {
                const focusedWindow = BrowserWindow.getFocusedWindow();
                try {
                  if (focusedWindow && !focusedWindow.isDestroyed() && !focusedWindow.webContents.isDestroyed()) {
                    focusedWindow.webContents.send('menu-toggle-session-manager', menuItem.checked);
                  }
                } catch (error) {
                  console.error('Failed to send menu-toggle-session-manager:', error);
                }
              }
            }
          ]
        },
        { type: 'separator' },
        {
          label: 'Settings',
          accelerator: 'CmdOrCtrl+,',
          click: () => {
            const focusedWindow = BrowserWindow.getFocusedWindow();
            try {
              if (focusedWindow && !focusedWindow.isDestroyed() && !focusedWindow.webContents.isDestroyed()) {
                focusedWindow.webContents.send('menu-settings');
              }
            } catch (error) {
              console.error('Failed to send menu-settings:', error);
            }
          }
        },
        { type: 'separator' },
        {
          label: 'Reload',
          accelerator: 'CmdOrCtrl+R',
          click: (item, focusedWindow) => {
            if (focusedWindow) {
              focusedWindow.reload();
            }
          }
        },
        ...(!app.isPackaged ? [{
          label: 'Toggle Developer Tools',
          accelerator: process.platform === 'darwin' ? 'Alt+Cmd+I' : 'Ctrl+Shift+I',
          click: (item, focusedWindow) => {
            if (focusedWindow) {
              focusedWindow.webContents.toggleDevTools();
            }
          }
        }] : []),
        { type: 'separator' },
        {
          label: 'Actual Size',
          accelerator: 'CmdOrCtrl+0',
          click: (item, focusedWindow) => {
            if (focusedWindow) {
              focusedWindow.webContents.setZoomLevel(0);
            }
          }
        },
        {
          label: 'Zoom In',
          accelerator: 'CmdOrCtrl+Plus',
          click: (item, focusedWindow) => {
            if (focusedWindow) {
              const currentZoom = focusedWindow.webContents.getZoomLevel();
              focusedWindow.webContents.setZoomLevel(currentZoom + 0.5);
            }
          }
        },
        {
          label: 'Zoom Out',
          accelerator: 'CmdOrCtrl+-',
          click: (item, focusedWindow) => {
            if (focusedWindow) {
              const currentZoom = focusedWindow.webContents.getZoomLevel();
              focusedWindow.webContents.setZoomLevel(currentZoom - 0.5);
            }
          }
        }
      ]
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'Check for Updates',
          click: () => {
            const focusedWindow = BrowserWindow.getFocusedWindow();
            try {
              if (focusedWindow && !focusedWindow.isDestroyed() && !focusedWindow.webContents.isDestroyed()) {
                focusedWindow.webContents.send('menu-check-updates');
              }
            } catch (error) {
              console.error('Failed to send menu-check-updates:', error);
            }
          }
        },
        { type: 'separator' },
        {
          label: 'About ash',
          click: () => {
            const focusedWindow = BrowserWindow.getFocusedWindow();
            try {
              if (focusedWindow && !focusedWindow.isDestroyed() && !focusedWindow.webContents.isDestroyed()) {
                focusedWindow.webContents.send('menu-about');
              }
            } catch (error) {
              console.error('Failed to send menu-about:', error);
            }
          }
        },
        {
          label: 'Third-Party Licenses',
          click: () => {
            const focusedWindow = BrowserWindow.getFocusedWindow();
            try {
              if (focusedWindow && !focusedWindow.isDestroyed() && !focusedWindow.webContents.isDestroyed()) {
                focusedWindow.webContents.send('menu-third-party-licenses');
              }
            } catch (error) {
              console.error('Failed to send menu-third-party-licenses:', error);
            }
          }
        }
      ]
    }
  ];

  // On macOS, change the first menu to app name
  if (process.platform === 'darwin') {
    template.unshift({
      label: app.getName(),
      submenu: [
        {
          label: 'About ' + app.getName(),
          click: () => {
            const focusedWindow = BrowserWindow.getFocusedWindow();
            try {
              if (focusedWindow && !focusedWindow.isDestroyed() && !focusedWindow.webContents.isDestroyed()) {
                focusedWindow.webContents.send('menu-about');
              }
            } catch (error) {
              console.error('Failed to send menu-about:', error);
            }
          }
        },
        {
          label: 'Check for Updates',
          click: () => {
            const focusedWindow = BrowserWindow.getFocusedWindow();
            try {
              if (focusedWindow && !focusedWindow.isDestroyed() && !focusedWindow.webContents.isDestroyed()) {
                focusedWindow.webContents.send('menu-check-updates');
              }
            } catch (error) {
              console.error('Failed to send menu-check-updates:', error);
            }
          }
        },
        { type: 'separator' },
        {
          label: 'Services',
          role: 'services',
          submenu: []
        },
        { type: 'separator' },
        {
          label: 'Hide ' + app.getName(),
          accelerator: 'Command+H',
          role: 'hide'
        },
        {
          label: 'Hide Others',
          accelerator: 'Command+Shift+H',
          role: 'hideothers'
        },
        {
          label: 'Show All',
          role: 'unhide'
        },
        { type: 'separator' },
        {
          label: 'Quit',
          accelerator: 'Command+Q',
          click: () => {
            app.quit();
          }
        }
      ]
    });
  }

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

