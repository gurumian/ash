/**
 * Serial Connection management class
 */
export class SerialConnection {
  constructor() {
    this.connectionId = null;
    this.isConnected = false;
    this.sessionId = null;
  }

  async connect(options) {
    try {
      this.sessionId = Date.now().toString();
      const result = await window.electronAPI.serialConnect(this.sessionId, options);
      
      if (result.success) {
        this.connectionId = this.sessionId;
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
    
    window.electronAPI.serialWrite(this.connectionId, data);
  }

  disconnect() {
    if (this.isConnected && this.connectionId) {
      window.electronAPI.serialDisconnect(this.connectionId);
      this.isConnected = false;
      this.connectionId = null;
    }
  }
}

