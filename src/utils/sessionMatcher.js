/**
 * Utility functions for matching sessions
 */

/**
 * Match a saved session (with UUID) with an active session
 * @param {Object} savedSession - The saved session from group/connection history
 * @param {Object} session - The active session
 * @returns {boolean} - True if sessions match
 */
export function matchSavedSessionWithActiveSession(savedSession, session) {
  // Check connection type matches first
  if (savedSession.connectionType === 'local') {
    return session.connectionType === 'local' &&
      session.name === (savedSession.label || savedSession.sessionName || savedSession.name);
  } else if (savedSession.connectionType === 'telnet') {
    return session.connectionType === 'telnet' &&
      session.host === savedSession.host &&
      (session.port || '23') === (savedSession.port || '23');
  } else if (savedSession.connectionType === 'serial') {
    return session.connectionType === 'serial' &&
      session.serialPort === savedSession.serialPort;
  } else {
    // Default to SSH
    return session.connectionType === 'ssh' &&
      session.host === savedSession.host &&
      session.user === savedSession.user &&
      (session.port || '22') === (savedSession.port || '22');
  }
}

