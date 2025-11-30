import { ipcMain } from 'electron';
import http from 'node:http';
import { URL } from 'node:url';
import { sshConnections } from './ssh-handler.js';

/**
 * IPC Bridge Handler
 * 
 * Exposes Electron IPC handlers as HTTP API for Python backend.
 * This allows the Python backend to call Electron IPC handlers.
 */

const IPC_BRIDGE_PORT = 54112;
let ipcBridgeServer = null;

// Helper functions to call SSH handlers directly
async function callSSHExecute(connectionId, command) {
  console.log(`[IPC Bridge] callSSHExecute: connectionId=${connectionId}, command=${command}`);
  console.log(`[IPC Bridge] Active connections:`, Array.from(sshConnections.keys()));
  
  const conn = sshConnections.get(connectionId);
  if (!conn) {
    const availableIds = Array.from(sshConnections.keys());
    console.error(`[IPC Bridge] Connection not found: ${connectionId}`);
    console.error(`[IPC Bridge] Available connection IDs:`, availableIds);
    throw new Error(`SSH connection not found: ${connectionId}. Available: ${availableIds.join(', ')}`);
  }
  
  console.log(`[IPC Bridge] Executing command on connection ${connectionId}...`);
  
  return new Promise((resolve, reject) => {
    conn.exec(command, (err, stream) => {
      if (err) {
        console.error(`[IPC Bridge] Command execution failed:`, err);
        reject(new Error(`Failed to execute command: ${err.message}`));
        return;
      }
      
      let output = '';
      let errorOutput = '';
      
      stream.on('data', (data) => {
        output += data.toString();
      });
      
      stream.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });
      
      stream.on('close', (code) => {
        console.log(`[IPC Bridge] Command completed: exitCode=${code}, output length=${output.length}`);
        resolve({
          success: code === 0,
          output: output.trim(),
          error: errorOutput.trim(),
          exitCode: code
        });
      });
      
      stream.on('error', (error) => {
        console.error(`[IPC Bridge] Stream error:`, error);
        reject(new Error(`Command execution error: ${error.message}`));
      });
    });
  });
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
            
            let result;
            
            switch (handler) {
              case 'ssh-exec-command':
              case 'ssh-execute': {
                result = await callSSHExecute(args[0], args[1]);
                break;
              }
                
              case 'ssh-list-connections':
              case 'list-connections': {
                // Get all active connections
                console.log(`[IPC Bridge] Listing connections. Total: ${sshConnections.size}`);
                const connections = Array.from(sshConnections.entries()).map(([id, conn]) => {
                  // ssh2 Client 객체가 Map에 있으면 연결이 활성화되어 있다고 간주
                  // readyState 속성은 없지만, 객체가 존재하면 연결이 준비된 상태
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
  });
  
  ipcBridgeServer.on('error', (error) => {
    console.error('IPC bridge server error:', error);
  });
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

