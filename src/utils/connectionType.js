/**
 * Utility functions for connection type checks
 */

/**
 * Check if a session/connection is a serial connection
 * @param {Object} sessionOrConnection - Session or connection object
 * @returns {boolean} - True if serial connection
 */
export function isSerialConnection(sessionOrConnection) {
  return sessionOrConnection?.connectionType === 'serial';
}

/**
 * Check if a session/connection is an SSH connection
 * @param {Object} sessionOrConnection - Session or connection object
 * @returns {boolean} - True if SSH connection
 */
export function isSSHConnection(sessionOrConnection) {
  return sessionOrConnection?.connectionType === 'ssh' || 
         (!sessionOrConnection?.connectionType && sessionOrConnection?.host && sessionOrConnection?.connectionType !== 'telnet');
}

/**
 * Check if a session/connection is a Telnet connection
 * @param {Object} sessionOrConnection - Session or connection object
 * @returns {boolean} - True if Telnet connection
 */
export function isTelnetConnection(sessionOrConnection) {
  return sessionOrConnection?.connectionType === 'telnet';
}

/**
 * Get the connection type (defaults to 'ssh' if not specified)
 * @param {Object} sessionOrConnection - Session or connection object
 * @returns {string} - Connection type ('ssh', 'telnet', or 'serial')
 */
export function getConnectionType(sessionOrConnection) {
  return sessionOrConnection?.connectionType || 'ssh';
}

