/**
 * Utility functions for generating session names
 */

/**
 * Generate a display name for a session or connection
 * @param {Object} sessionOrConnection - Session or connection object
 * @param {Object} options - Options for name generation
 * @param {string} options.preferField - Prefer this field if available (e.g., 'sessionName', 'name', 'label')
 * @returns {string} - Generated display name
 */
export function getSessionDisplayName(sessionOrConnection, options = {}) {
  const { preferField = 'sessionName' } = options;
  
  // Check preferred field first
  if (preferField && sessionOrConnection[preferField]) {
    return sessionOrConnection[preferField];
  }
  
  // Check other common name fields
  if (sessionOrConnection.name) {
    return sessionOrConnection.name;
  }
  
  if (sessionOrConnection.label) {
    return sessionOrConnection.label;
  }
  
  // Generate default name based on connection type
  if (sessionOrConnection.connectionType === 'serial') {
    return `Serial: ${sessionOrConnection.serialPort}`;
  } else {
    const user = sessionOrConnection.user || '';
    const host = sessionOrConnection.host || '';
    return `${user}@${host}`;
  }
}

/**
 * Generate a session label (for saved sessions in groups)
 * @param {Object} sessionOrConnection - Session or connection object
 * @returns {string} - Generated label
 */
export function getSessionLabel(sessionOrConnection) {
  return getSessionDisplayName(sessionOrConnection, { preferField: 'sessionName' });
}

