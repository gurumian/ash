import { ipcMain } from 'electron';
import http from 'node:http';
import { URL } from 'node:url';
import { getSSHConnections, executeSSHCommand } from './ssh-handler.js';

/**
 * IPC Bridge Handler
 * 
 * Exposes Electron IPC handlers as HTTP API for Python backend.
 * This allows the Python backend to call Electron IPC handlers.
 */

const IPC_BRIDGE_PORT = 54112;
let ipcBridgeServer = null;

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
                console.log(`[IPC Bridge] Executing command on connection ${args[0]}: ${args[1]}`);
                try {
                  result = await executeSSHCommand(args[0], args[1]);
                  console.log(`[IPC Bridge] Command completed successfully`);
                } catch (error) {
                  console.error(`[IPC Bridge] Command execution failed:`, error);
                  throw error;
                }
                break;
              }
                
              case 'ssh-list-connections':
              case 'list-connections': {
                // Get all active connections
                const sshConnections = getSSHConnections();
                console.log(`[IPC Bridge] Listing connections. Total: ${sshConnections.size}`);
                const connections = Array.from(sshConnections.entries()).map(([id, conn]) => {
                  // ssh2 Client 객체가 Map에 있으면 연결이 활성화되어 있다고 간주
                  const isConnected = conn !== null && conn !== undefined;
                  console.log(`[IPC Bridge] Connection ${id}: exists=${isConnected}`);
                  return {
                    connectionId: id,
                    type: 'ssh',
                    connected: isConnected
                  };
                });
                result = { success: true, connections };
                console.log(`[IPC Bridge] Returning ${connections.length} connections`);
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
