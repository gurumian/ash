/**
 * Local Terminal Connection management class
 * 
 * Manages Local PTY connections with clear separation between:
 * - sessionConnectionId: Unique ID per session (for IPC communication)
 * - connectionKey: Logical key (shared across sessions)
 */
export class LocalConnection {
    constructor() {
        /** @type {string|null} Session-specific connection ID (unique per session) */
        this.sessionConnectionId = null;
        /** @type {string|null} Connection key */
        this.connectionKey = null;
        this.isConnected = false;
        this.terminal = null;
        this.sessionId = null;

        // Deprecated: Keep for backward compatibility
        Object.defineProperty(this, 'connectionId', {
            get: () => this.sessionConnectionId,
            set: (value) => { this.sessionConnectionId = value; }
        });
        Object.defineProperty(this, 'logicalConnectionId', {
            get: () => this.connectionKey,
            set: (value) => { this.connectionKey = value; }
        });
    }

    async connect(sessionId = null) {
        try {
            this.sessionId = sessionId;
            console.log(`Local Terminal connecting [sessionId: ${sessionId}]`);
            const result = await window.electronAPI.localConnect({
                sessionId: sessionId,
                // Add any local specific options here if needed
            });

            console.log('Local connect result:', result);

            if (result.success) {
                this.sessionConnectionId = result.sessionConnectionId;
                this.connectionKey = result.connectionKey;
                this.isConnected = true;
                console.log(`Local connection successful: sessionConnectionId=${this.sessionConnectionId}`);
                return result;
            } else {
                throw new Error('Local connection failed');
            }
        } catch (error) {
            console.error('Local connection error:', error);
            throw new Error(`Local connection failed: ${error.message}`);
        }
    }

    async startShell(cols = 80, rows = 24) {
        if (!this.isConnected) {
            throw new Error('Not connected to Local session');
        }

        try {
            const result = await window.electronAPI.localStartShell(this.sessionConnectionId, cols, rows);
            return result;
        } catch (error) {
            throw new Error(`Failed to start local shell: ${error.message}`);
        }
    }

    resize(cols, rows) {
        if (!this.isConnected) {
            return;
        }

        window.electronAPI.localResize(this.sessionConnectionId, cols, rows);
    }

    write(data) {
        if (!this.isConnected) {
            return;
        }

        window.electronAPI.localWrite(this.sessionConnectionId, data);
    }

    disconnect() {
        if (this.isConnected && this.sessionConnectionId) {
            window.electronAPI.localDisconnect(this.sessionConnectionId);
            this.isConnected = false;
            this.sessionConnectionId = null;
            this.connectionKey = null;
        }
    }
}
