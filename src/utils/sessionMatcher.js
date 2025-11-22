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
  const connType = savedSession.connectionType || 'ssh';
  if (connType === 'serial') {
    return session.connectionType === 'serial' && 
           session.serialPort === savedSession.serialPort;
  } else {
    return session.connectionType === 'ssh' &&
           session.host === savedSession.host && 
           session.user === savedSession.user && 
           (session.port || '22') === (savedSession.port || '22');
  }
}

