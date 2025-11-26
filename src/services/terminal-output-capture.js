/**
 * Terminal Output Capture Service
 * Captures terminal output for specific command executions
 */

class TerminalOutputCapture {
  constructor(sessionId) {
    this.sessionId = sessionId;
    this.captures = new Map(); // captureId -> { output, handler, active }
    this.sshDataHandler = null;
    this.setupSSHListener();
  }

  /**
   * Setup SSH data listener
   */
  setupSSHListener() {
    // Listen for SSH data events
    if (window.electronAPI) {
      // Store reference to handler for cleanup
      this.sshDataHandler = (event, { connectionId, data }) => {
        // Forward to all active captures
        this.captures.forEach((capture, captureId) => {
          if (capture.active) {
            capture.handler(data);
          }
        });
      };

      // Note: In Electron, we need to listen via IPC
      // This will be set up in the component that uses this service
      // For now, we'll use a callback-based approach
    }
  }

  /**
   * Start capturing output
   * @returns {string} captureId
   */
  startCapture() {
    const captureId = `capture_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const capture = {
      output: '',
      handler: (data) => {
        capture.output += data;
      },
      active: true
    };
    
    this.captures.set(captureId, capture);
    return captureId;
  }

  /**
   * Stop capturing and get output
   * @param {string} captureId
   * @returns {string} captured output
   */
  stopCapture(captureId) {
    const capture = this.captures.get(captureId);
    if (capture) {
      capture.active = false;
      const output = capture.output;
      this.captures.delete(captureId);
      return output;
    }
    return '';
  }

  /**
   * Register output handler for a capture
   * @param {string} captureId
   * @param {Function} handler
   */
  onOutput(captureId, handler) {
    const capture = this.captures.get(captureId);
    if (capture) {
      capture.handler = handler;
    }
  }

  /**
   * Feed data to captures (called from external source)
   * @param {string} data
   */
  feedData(data) {
    this.captures.forEach((capture, captureId) => {
      if (capture.active) {
        capture.handler(data);
      }
    });
  }

  /**
   * Cleanup all captures
   */
  cleanup() {
    this.captures.clear();
  }
}

export default TerminalOutputCapture;

