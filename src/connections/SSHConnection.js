/**
 * SSH Connection management class
 */
export class SSHConnection {
  constructor() {
    this.connectionId = null;
    this.isConnected = false;
    this.terminal = null;
  }

  async connect(host, port, user, password) {
    try {
      console.log(`SSH connecting to ${user}@${host}:${port}`);
      const result = await window.electronAPI.sshConnect({
        host,
        port: parseInt(port),
        username: user,
        password,
        // Add aggressive keepalive settings for faster disconnection detection (1s check)
        keepaliveInterval: 1000, // 1 second
        keepaliveCount: 3,       // 3 failures = disconnect (~3s total)
        readyTimeout: 5000       // 5s connection timeout
      });

      console.log('SSH connect result:', result);

      if (result.success) {
        this.connectionId = result.connectionId;
        this.isConnected = true;
        console.log(`SSH connection successful: ${this.connectionId}`);
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
      const result = await window.electronAPI.sshStartShell(this.connectionId, cols, rows);
      return result;
    } catch (error) {
      throw new Error(`Failed to start shell: ${error.message}`);
    }
  }

  resize(cols, rows) {
    if (!this.isConnected) {
      return;
    }

    window.electronAPI.sshResize(this.connectionId, cols, rows);
  }

  write(data) {
    if (!this.isConnected) {
      return;
    }

    window.electronAPI.sshWrite(this.connectionId, data);
  }

  disconnect() {
    if (this.isConnected && this.connectionId) {
      window.electronAPI.sshDisconnect(this.connectionId);
      this.isConnected = false;
      this.connectionId = null;
    }
  }
}

