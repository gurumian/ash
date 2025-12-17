import { ipcMain } from 'electron';
import http from 'node:http';
import { URL } from 'node:url';
import { getSSHConnections, executeSSHCommand } from './ssh-handler.js';
import { getTelnetConnections, executeTelnetCommand } from './telnet-handler.js';

/**
 * IPC Bridge Handler
 * 
 * Exposes Electron IPC handlers as HTTP API for Python backend.
 * This allows the Python backend to call Electron IPC handlers.
 */

const IPC_BRIDGE_PORT = 54112;
let ipcBridgeServer = null;
let mainWindow = null;

export function setMainWindow(window) {
  mainWindow = window;
}

/**
 * Start IPC bridge HTTP server
 */
export function startIPCBridge() {
  if (ipcBridgeServer) {
    console.log('IPC bridge server already running');
    return;
  }

  ipcBridgeServer = http.createServer(async (req, res) => {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.writeHead(200);
      res.end();
      return;
    }

    try {
      const url = new URL(req.url, `http://${req.headers.host}`);
      const path = url.pathname;

      if (req.method === 'POST' && path === '/ipc-invoke') {
        let body = '';
        req.on('data', chunk => {
          body += chunk.toString();
        });

        req.on('end', async () => {
          try {
            const data = JSON.parse(body);
            const handler = data.channel || data.handler;
            const args = data.args || [];

            console.log(`[IPC Bridge] Received request: handler=${handler}, args count=${args.length}`);

            // Set a longer timeout for the request (5 minutes for long-running commands)
            req.setTimeout(300000); // 5 minutes

            let result;

            switch (handler) {
              case 'ssh-exec-command':
              case 'ssh-execute': {
                console.log(`[IPC Bridge] Executing SSH command on connection ${args[0]}: ${args[1]}`);
                try {
                  result = await executeSSHCommand(args[0], args[1]);
                  console.log(`[IPC Bridge] SSH command completed successfully`);
                } catch (error) {
                  console.error(`[IPC Bridge] SSH command execution failed:`, error);
                  throw error;
                }
                break;
              }

              case 'telnet-exec-command':
              case 'telnet-execute': {
                console.log(`[IPC Bridge] Executing Telnet command on connection ${args[0]}: ${args[1]}`);
                try {
                  result = await executeTelnetCommand(args[0], args[1]);
                  console.log(`[IPC Bridge] Telnet command completed successfully`);
                } catch (error) {
                  console.error(`[IPC Bridge] Telnet command execution failed:`, error);
                  throw error;
                }
                break;
              }

              case 'ssh-list-connections':
              case 'list-connections': {
                // Get all active connections (SSH and Telnet)
                const sshConnections = getSSHConnections();
                const telnetConnections = getTelnetConnections();
                console.log(`[IPC Bridge] Listing connections. SSH: ${sshConnections.size}, Telnet: ${telnetConnections.size}`);

                const sshList = Array.from(sshConnections.entries()).map(([id, conn]) => {
                  const isConnected = conn !== null && conn !== undefined;
                  console.log(`[IPC Bridge] SSH Connection ${id}: exists=${isConnected}`);
                  return {
                    connectionId: id,
                    type: 'ssh',
                    connected: isConnected
                  };
                });

                const telnetList = Array.from(telnetConnections.entries()).map(([id, connInfo]) => {
                  const isConnected = connInfo !== null && connInfo !== undefined && connInfo.tSocket !== null;
                  console.log(`[IPC Bridge] Telnet Connection ${id}: exists=${isConnected}`);
                  return {
                    connectionId: id,
                    type: 'telnet',
                    connected: isConnected
                  };
                });

                const connections = [...sshList, ...telnetList];
                result = { success: true, connections };
                console.log(`[IPC Bridge] Returning ${connections.length} total connections`);
                break;
              }

              case 'ask-user': {
                const question = args[0];
                const isPassword = args[1];
                console.log(`[IPC Bridge] Asking user: ${question} (isPassword=${isPassword})`);

                if (!mainWindow) {
                  throw new Error('Main window not available');
                }

                // Send request to renderer and wait for response
                result = await new Promise((resolve, reject) => {
                  // Generate a unique ID for this request
                  const requestId = Date.now().toString();

                  // Setup one-time listener for response
                  const responseChannel = `ipc-ask-user-response-${requestId}`;

                  // Timeout after 5 minutes (same as overall timeout)
                  const timeout = setTimeout(() => {
                    ipcMain.removeHandler(responseChannel);
                    reject(new Error('User response timed out'));
                  }, 290000);

                  ipcMain.handleOnce(responseChannel, (event, response) => {
                    clearTimeout(timeout);
                    console.log(`[IPC Bridge] Received user response for ${requestId}`);
                    if (response.rejected) {
                      reject(new Error('User rejected the request'));
                    } else {
                      resolve(response.value);
                    }
                  });

                  // Send event to renderer
                  mainWindow.webContents.send('ipc-ask-user', {
                    requestId,
                    question,
                    isPassword
                  });
                });
                break;
              }

              default:
                throw new Error(`Unknown IPC handler: ${handler}`);
            }

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true, result: result }));
          } catch (error) {
            console.error(`[IPC Bridge] Error for handler ${handler}:`, error);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: error.message }));
          }
        });
      } else if (req.method === 'GET' && path === '/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'ok', port: IPC_BRIDGE_PORT }));
      } else {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Not found' }));
      }
    } catch (error) {
      console.error('IPC bridge server error:', error);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: error.message }));
    }
  });

  ipcBridgeServer.listen(IPC_BRIDGE_PORT, '127.0.0.1', () => {
    console.log(`✅ IPC bridge server listening on http://127.0.0.1:${IPC_BRIDGE_PORT}`);
    console.log(`✅ IPC bridge is ready to accept connections from Python backend`);
  });

  ipcBridgeServer.on('error', (error) => {
    if (error.code === 'EADDRINUSE') {
      console.warn(`⚠️ Port ${IPC_BRIDGE_PORT} is already in use. IPC bridge might already be running from a previous instance.`);
      console.warn('⚠️ This is usually safe - the existing server will be used.');
      // Don't throw error, just log warning - existing server might be fine
    } else {
      console.error('❌ IPC bridge server error:', error);
      throw error; // Re-throw to make startup failure visible
    }
  });

  // Set server timeout to 5 minutes for long-running commands
  ipcBridgeServer.timeout = 300000; // 5 minutes
  ipcBridgeServer.keepAliveTimeout = 300000;
}

/**
 * Stop IPC bridge HTTP server
 */
export function stopIPCBridge() {
  if (ipcBridgeServer) {
    ipcBridgeServer.close();
    ipcBridgeServer = null;
    console.log('IPC bridge server stopped');
  }
}

/**
 * Get IPC bridge URL
 */
export function getIPCBridgeUrl() {
  return `http://127.0.0.1:${IPC_BRIDGE_PORT}`;
}
