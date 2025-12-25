/**
 * Serial Connection management class
 * 
 * Manages Serial connections with clear separation between:
 * - sessionConnectionId: Unique ID per session (for IPC communication)
 * - connectionKey: Logical key for chat history (shared across sessions with same connection info)
 * 
 * Note: Serial ports can only have one active connection at a time per port.
 * Attempting to connect to an already-in-use port will result in an error.
 */
export class SerialConnection {
  constructor() {
    /** @type {string|null} Session-specific connection ID (unique per session) */
    this.sessionConnectionId = null;
    /** @type {string|null} Connection key for chat history persistence (shared across sessions) */
    this.connectionKey = null;
    this.isConnected = false;
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

  async connect(sessionId, options) {
    try {
      this.sessionId = sessionId;
      const result = await window.electronAPI.serialConnect(this.sessionId, options);

      if (result.success) {
        this.sessionConnectionId = result.sessionConnectionId || result.connectionId; // Fallback for backward compatibility
        this.connectionKey = result.connectionKey || result.logicalConnectionId || result.sessionConnectionId || result.connectionId;
        this.isConnected = true;
        return result;
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      throw new Error(`Serial connection failed: ${error.message}`);
    }
  }

  async startShell() {
    // Serial connections don't need shell initialization
    return Promise.resolve();
  }

  write(data) {
    if (!this.isConnected) {
      return;
    }

    window.electronAPI.serialWrite(this.sessionConnectionId, data);
  }

  disconnect() {
    if (this.isConnected && this.sessionConnectionId) {
      window.electronAPI.serialDisconnect(this.sessionConnectionId);
      this.isConnected = false;
      this.sessionConnectionId = null;
      this.connectionKey = null;
    }
  }
}

