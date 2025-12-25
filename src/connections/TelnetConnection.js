/**
 * Telnet Connection management class
 * 
 * Manages Telnet connections with clear separation between:
 * - sessionConnectionId: Unique ID per session (for IPC communication)
 * - connectionKey: Logical key for chat history (shared across sessions with same connection info)
 */
export class TelnetConnection {
  constructor() {
    /** @type {string|null} Session-specific connection ID (unique per session) */
    this.sessionConnectionId = null;
    /** @type {string|null} Connection key for chat history persistence (shared across sessions) */
    this.connectionKey = null;
    this.isConnected = false;
    this.terminal = null;
    this.sessionId = null;
    
    // Deprecated: Keep for backward compatibility during transition
    /** @deprecated Use sessionConnectionId instead */
    Object.defineProperty(this, 'connectionId', {
      get: () => this.sessionConnectionId,
      set: (value) => { this.sessionConnectionId = value; }
    });
    /** @deprecated Use connectionKey instead */
    Object.defineProperty(this, 'logicalConnectionId', {
      get: () => this.connectionKey,
      set: (value) => { this.connectionKey = value; }
    });
  }

  async connect(host, port, sessionId = null, sessionName = null) {
    try {
      this.sessionId = sessionId;
      const result = await window.electronAPI.telnetConnect({
        host,
        port: parseInt(port),
        sessionId: sessionId,
        sessionName: sessionName || ''
      });
      
      if (result.success) {
        this.sessionConnectionId = result.sessionConnectionId || result.connectionId; // Fallback for backward compatibility
        this.connectionKey = result.connectionKey || result.logicalConnectionId || result.sessionConnectionId || result.connectionId;
        this.isConnected = true;
        return result;
      } else {
        throw new Error('Telnet connection failed');
      }
    } catch (error) {
      console.error('Telnet connection error:', error);
      throw new Error(`Telnet connection failed: ${error.message}`);
    }
  }

  async startShell(cols = 80, rows = 24) {
    // Telnet doesn't require starting a shell separately
    // Connection is ready immediately after connect
    // This method exists for API compatibility with SSH
    if (!this.isConnected) {
      throw new Error('Not connected to Telnet server');
    }
    return { success: true };
  }

  resize(cols, rows) {
    // Telnet doesn't support dynamic terminal resizing like SSH
    // This method exists for API compatibility but does nothing
    if (!this.isConnected) {
      return;
    }
  }

  write(data) {
    if (!this.isConnected) {
      return;
    }
    
    window.electronAPI.telnetWrite(this.sessionConnectionId, data);
  }

  disconnect() {
    if (this.isConnected && this.sessionConnectionId) {
      window.electronAPI.telnetDisconnect(this.sessionConnectionId);
      this.isConnected = false;
      this.sessionConnectionId = null;
      this.connectionKey = null;
    }
  }
}







