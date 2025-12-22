import { ipcMain } from 'electron';
import Netcat from 'netcat';

let client = null;
let server = null;
let mainWindow = null;

export function setMainWindow(window) {
    mainWindow = window;
}

export function initializeNetcatHandlers() {
    // --- Start (Client or Server) ---
    ipcMain.handle('netcat-start', async (_event, params) => {
        const { mode, host, port, protocol } = params;

        // Reset/Cleanup previous instances
        cleanupNetcat();

        try {
            if (mode === 'client') {
                const p = protocol === 'udp' ? 'udp' : 'tcp';
                // Netcat package import might be tricky. 
                // If 'netcat' exports a class or object directly.
                // CommonJS: const netcat = require('netcat'); client = new netcat.client();
                // ESM: import Netcat from 'netcat'; client = new Netcat.client(); OR import * as netcat ...
                // Let's stick to consistent usage.
                client = new Netcat.client();

                client.addr(host)
                    .port(parseInt(port))
                    .retry(5000); // optional retry

                if (p === 'udp') {
                    client.udp();
                }

                // Event: Connected
                client.on('connect', () => {
                    if (mainWindow) mainWindow.webContents.send('netcat-connected');
                });

                // Event: Data
                client.on('data', (data) => {
                    if (mainWindow) mainWindow.webContents.send('netcat-data', data.toString());
                });

                // Event: Error
                client.on('error', (err) => {
                    if (mainWindow) mainWindow.webContents.send('netcat-error', err.message);
                });

                // Event: Close
                client.on('close', () => {
                    if (mainWindow) mainWindow.webContents.send('netcat-closed');
                });

                client.connect();

            } else {
                // --- SERVER MODE ---
                const p = protocol === 'udp' ? 'udp' : 'tcp';
                server = new Netcat.server();

                server.port(parseInt(port));

                if (p === 'udp') {
                    server.udp();
                }

                // Event: Ready/Listening
                server.on('ready', () => {
                    if (mainWindow) mainWindow.webContents.send('netcat-connected', { message: `Listening on ${port}` });
                });

                // Event: Data received
                server.on('data', (data) => {
                    // In server mode, we receive data from clients
                    if (mainWindow) mainWindow.webContents.send('netcat-data', data.toString());
                });

                // Event: Client Connected (only for TCP usually)
                server.on('connection', (socket) => {
                    if (mainWindow) mainWindow.webContents.send('netcat-data', `[Client connected]\n`);
                });

                // Event: Error
                server.on('error', (err) => {
                    if (mainWindow) mainWindow.webContents.send('netcat-error', err.message);
                });

                // Event: Close
                server.on('close', () => {
                    if (mainWindow) mainWindow.webContents.send('netcat-closed');
                });

                server.listen();
            }

            return { success: true };
        } catch (error) {
            console.error('Netcat start error:', error);
            return { success: false, error: error.message };
        }
    });

    // --- Send Data ---
    ipcMain.handle('netcat-send', async (_event, data) => {
        try {
            if (client) {
                client.send(data); // Send to server
            } else if (server) {
                // Netcat package server send is a bit limited, often broadcasts or replies to last
                // For basic netcat functionality, this might be a limitation of the package
                // But let's try generic send if available or 'write'
                // The 'netcat' npm doc says `server.send(msg, cb)`
                server.send(data);
                // Also echo to our own UI so we see what we sent
                if (mainWindow) mainWindow.webContents.send('netcat-data', `[You]: ${data}\n`);
            }
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    });

    // --- Stop ---
    ipcMain.handle('netcat-stop', async () => {
        cleanupNetcat();
        if (mainWindow) mainWindow.webContents.send('netcat-closed');
        return { success: true };
    });

    // --- Status (Optional) ---
    ipcMain.handle('netcat-status', async () => {
        // Simple check
        if (client) return 'connected';
        if (server) return 'listening';
        return 'stopped';
    });
}

export function cleanupNetcat() {
    try {
        if (client) {
            client.close();
            client = null;
        }
        if (server) {
            server.close();
            server = null;
        }
    } catch (err) {
        console.error('Error cleaning up netcat:', err);
    }
}
