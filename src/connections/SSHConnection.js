/**
 * SSH Connection management class
 * 
 * Manages SSH connections with clear separation between:
 * - sessionConnectionId: Unique ID per session (for IPC communication)
 * - connectionKey: Logical key for chat history (shared across sessions with same connection info)
 */
export class SSHConnection {
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

  async connect(host, port, user, password, sessionName, sessionId = null) {
    try {
      this.sessionId = sessionId;
      console.log(`SSH connecting to ${user}@${host}:${port} (${sessionName || 'no session name'}) [sessionId: ${sessionId}]`);
      const result = await window.electronAPI.sshConnect({
        host,
        port: parseInt(port),
        username: user,
        password,
        sessionName: sessionName || '',
        sessionId: sessionId,
        // Add aggressive keepalive settings for faster disconnection detection (1s check)
        keepaliveInterval: 1000, // 1 second
        keepaliveCount: 3,       // 3 failures = disconnect (~3s total)
        readyTimeout: 5000       // 5s connection timeout
      });

      console.log('SSH connect result:', result);

      if (result.success) {
        this.sessionConnectionId = result.sessionConnectionId || result.connectionId; // Fallback for backward compatibility
        this.connectionKey = result.connectionKey || result.logicalConnectionId || result.sessionConnectionId || result.connectionId;
        this.isConnected = true;
        console.log(`SSH connection successful: sessionConnectionId=${this.sessionConnectionId}, connectionKey=${this.connectionKey}`);
        return result;
      } else {
        throw new Error('SSH connection failed');
      }
    } catch (error) {
      console.error('SSH connection error:', error);
      throw new Error(`SSH connection failed: ${error.message}`);
    }
  }

  async startShell(cols = 80, rows = 24) {
    if (!this.isConnected) {
      throw new Error('Not connected to SSH server');
    }

    try {
      const result = await window.electronAPI.sshStartShell(this.sessionConnectionId, cols, rows);
      return result;
    } catch (error) {
      throw new Error(`Failed to start shell: ${error.message}`);
    }
  }

  resize(cols, rows) {
    if (!this.isConnected) {
      return;
    }

    window.electronAPI.sshResize(this.sessionConnectionId, cols, rows);
  }

  write(data) {
    if (!this.isConnected) {
      return;
    }

    window.electronAPI.sshWrite(this.sessionConnectionId, data);
  }

  disconnect() {
    if (this.isConnected && this.sessionConnectionId) {
      window.electronAPI.sshDisconnect(this.sessionConnectionId);
      this.isConnected = false;
      this.sessionConnectionId = null;
      this.connectionKey = null;
    }
  }
}

