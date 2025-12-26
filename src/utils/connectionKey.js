import crypto from 'crypto';

/**
 * Generate connection key string for chat history persistence
 * 
 * Connection keys allow chat history to be shared across sessions with the same connection info.
 * This function generates the string representation that will be hashed.
 * 
 * @param {string} type - Connection type: 'ssh' | 'telnet' | 'serial'
 * @param {Object} params - Connection parameters
 * @param {string} [params.sessionName] - Optional session name
 * @param {string} [params.username] - SSH/Telnet username (required for ssh/telnet)
 * @param {string} [params.host] - SSH/Telnet host (required for ssh/telnet)
 * @param {number} [params.port] - SSH/Telnet port (required for ssh/telnet)
 * @param {string} [params.portPath] - Serial port path (required for serial)
 * @returns {string} Connection key string (not hashed)
 * @throws {Error} If type is unknown or required parameters are missing
 */
export function generateConnectionKeyString(type, params) {
  const sessionName = params.sessionName || '';
  
  if (type === 'ssh') {
    const { username, host, port } = params;
    if (!username || !host || !port) {
      throw new Error('SSH connection key requires username, host, and port');
    }
    return `${sessionName}:${username}@${host}:${port}`;
  } else if (type === 'telnet') {
    const { host, port } = params;
    if (!host || !port) {
      throw new Error('Telnet connection key requires host and port');
    }
    return `telnet:${sessionName}:${host}:${port}`;
  } else if (type === 'serial') {
    const { portPath } = params;
    if (!portPath) {
      throw new Error('Serial connection key requires portPath');
    }
    return `serial:${sessionName}:${portPath}`;
  } else {
    throw new Error(`Unknown connection type: ${type}`);
  }
}

/**
 * Generate hashed connection key for chat history persistence
 * 
 * This function generates a SHA256 hash of the connection key string.
 * Use this function in main process handlers.
 * 
 * @param {string} type - Connection type: 'ssh' | 'telnet' | 'serial'
 * @param {Object} params - Connection parameters
 * @returns {string} Hashed connection key (SHA256 hex digest)
 */
export function generateConnectionKey(type, params) {
  const keyString = generateConnectionKeyString(type, params);
  return crypto.createHash('sha256').update(keyString).digest('hex');
}
