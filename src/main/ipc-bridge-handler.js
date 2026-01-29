import { ipcMain } from 'electron';
import http from 'node:http';
import { URL } from 'node:url';
import { getSSHConnections, executeSSHCommand } from './ssh-handler.js';
import { getTelnetConnections, executeTelnetCommand } from './telnet-handler.js';
import { getSerialConnections, executeSerialCommand } from './serial-handler.js';
import { getLocalSessions, executeLocalCommand } from './local-pty-handler.js';

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
 * Helper: Request user approval
 */
const requestUserApproval = async (question, isPassword = false) => {
  if (!mainWindow) {
    throw new Error('Main window not available');
  }

  return new Promise((resolve, reject) => {
    const requestId = Date.now().toString();
    const responseChannel = `ipc-ask-user-response-${requestId}`;

    // Timeout after 5 minutes
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

    mainWindow.webContents.send('ipc-ask-user', {
      requestId,
      question,
      isPassword
    });
  });
};

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
          let handler = 'unknown'; // Define here to be accessible in catch block
          try {
            const data = JSON.parse(body);
            handler = data.channel || data.handler;
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

              case 'serial-exec-command':
              case 'serial-execute': {
                console.log(`[IPC Bridge] Executing Serial command on connection ${args[0]}: ${args[1]}`);
                try {
                  result = await executeSerialCommand(args[0], args[1]);
                  console.log(`[IPC Bridge] Serial command completed successfully`);
                } catch (error) {
                  console.error(`[IPC Bridge] Serial command execution failed:`, error);
                  throw error;
                }
                break;
              }

              case 'local-exec-command':
              case 'local-execute': {
                console.log(`[IPC Bridge] Request to execute Local command on connection ${args[0]}: ${args[1]}`);
                const command = args[1];

                // SYSTEM SECURITY: Always ask for user approval for local commands
                try {
                  const decision = await requestUserApproval(
                    `⚠️ AI Agent requests to execute LOCAL command:\n\n${command}\n\nDo you allow this?`,
                    false
                  );

                  if (decision !== true && decision !== 'yes') {
                    throw new Error('User denied permission');
                  }
                } catch (err) {
                  console.log('[IPC Bridge] Local command execution denied or timed out');
                  throw new Error('Local command execution denied by user');
                }

                console.log(`[IPC Bridge] Executing Local command: ${command}`);
                try {
                  result = await executeLocalCommand(args[0], command);
                  console.log(`[IPC Bridge] Local command completed`);
                } catch (error) {
                  console.error(`[IPC Bridge] Local command execution failed:`, error);
                  throw error;
                }
                break;
              }

              case 'ssh-list-connections':
              case 'list-connections': {
                // Get all active connections (SSH, Telnet, Serial, Local)
                const sshConnections = getSSHConnections();
                const telnetConnections = getTelnetConnections();
                const serialConnections = getSerialConnections();
                const localConnections = getLocalSessions();

                console.log(`[IPC Bridge] Listing connections. SSH: ${sshConnections.size}, Telnet: ${telnetConnections.size}, Serial: ${serialConnections.size}, Local: ${localConnections.size}`);

                const sshList = Array.from(sshConnections.entries()).map(([id, conn]) => {
                  const isConnected = conn !== null && conn !== undefined;
                  return {
                    connectionId: id,
                    type: 'ssh',
                    connected: isConnected
                  };
                });

                const telnetList = Array.from(telnetConnections.entries()).map(([id, connInfo]) => {
                  const isConnected = connInfo !== null && connInfo !== undefined && connInfo.tSocket !== null;
                  return {
                    connectionId: id,
                    type: 'telnet',
                    connected: isConnected
                  };
                });

                const serialList = Array.from(serialConnections.entries()).map(([id, connInfo]) => {
                  const isConnected = connInfo && connInfo.port && connInfo.port.isOpen;
                  return {
                    connectionId: id,
                    type: 'serial',
                    connected: !!isConnected
                  };
                });

                const localList = Array.from(localConnections.entries()).map(([id, session]) => {
                  return {
                    connectionId: id,
                    type: 'local',
                    connected: true
                  };
                });

                const connections = [...sshList, ...telnetList, ...serialList, ...localList];
                result = { success: true, connections };
                console.log(`[IPC Bridge] Returning ${connections.length} total connections`);
                break;
              }

              case 'ask-user': {
                const question = args[0];
                const isPassword = args[1];
                console.log(`[IPC Bridge] Asking user: ${question} (isPassword=${isPassword})`);
                result = await requestUserApproval(question, isPassword);
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
