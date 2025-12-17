/**
 * Telnet Connection management class
 */
export class TelnetConnection {
  constructor() {
    this.connectionId = null;
    this.isConnected = false;
    this.terminal = null;
  }

  async connect(host, port) {
    try {
      const result = await window.electronAPI.telnetConnect({
        host,
        port: parseInt(port)
      });
      
      if (result.success) {
        this.connectionId = result.connectionId;
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
    
    window.electronAPI.telnetWrite(this.connectionId, data);
  }

  disconnect() {
    if (this.isConnected && this.connectionId) {
      window.electronAPI.telnetDisconnect(this.connectionId);
      this.isConnected = false;
      this.connectionId = null;
    }
  }
}





