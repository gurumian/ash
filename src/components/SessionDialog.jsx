import React, { useState, useEffect } from 'react';

/**
 * Session Dialog component - Modal for managing session post-processing commands
 */
export function SessionDialog({
  showDialog,
  session,
  onClose,
  onSave
}) {
  const [postProcessing, setPostProcessing] = useState([]);
  const [newCommand, setNewCommand] = useState('');
  const [enabled, setEnabled] = useState(true);

  useEffect(() => {
    if (showDialog && session) {
      // Convert old format (string array) to new format (object array)
      const commands = (session.postProcessing || []).map(cmd => 
        typeof cmd === 'string' ? cmd : cmd
      );
      setPostProcessing(commands);
      setEnabled(session.postProcessingEnabled !== false); // Default to true if not set
      setNewCommand('');
    }
  }, [showDialog, session]);

  if (!showDialog || !session) return null;

  const handleAddCommand = () => {
    if (newCommand.trim()) {
      setPostProcessing([...postProcessing, newCommand.trim()]);
      setNewCommand('');
    }
  };

  const handleRemoveCommand = (index) => {
    setPostProcessing(postProcessing.filter((_, i) => i !== index));
  };

  const handleMoveUp = (index) => {
    if (index > 0) {
      const newCommands = [...postProcessing];
      [newCommands[index - 1], newCommands[index]] = [newCommands[index], newCommands[index - 1]];
      setPostProcessing(newCommands);
    }
  };

  const handleMoveDown = (index) => {
    if (index < postProcessing.length - 1) {
      const newCommands = [...postProcessing];
      [newCommands[index], newCommands[index + 1]] = [newCommands[index + 1], newCommands[index]];
      setPostProcessing(newCommands);
    }
  };

  const handleSave = () => {
    onSave(session.id, postProcessing, enabled);
    onClose();
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleAddCommand();
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="connection-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Session Settings: {session.name}</h3>
          <button 
            className="modal-close"
            onClick={onClose}
          >
            ×
          </button>
        </div>
        
        <div style={{ padding: '20px' }}>
          <div className="form-group">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
              <label style={{ margin: 0 }}>Post-Processing Commands</label>
              <button
                type="button"
                onClick={() => setEnabled(!enabled)}
                style={{
                  padding: '6px 12px',
                  fontSize: '12px',
                  backgroundColor: enabled ? 'var(--theme-accent)' : 'var(--theme-surface)',
                  border: `1px solid ${enabled ? 'var(--theme-accent)' : 'var(--theme-border)'}`,
                  color: enabled ? '#000' : 'var(--theme-text)',
                  cursor: 'pointer',
                  borderRadius: '4px',
                  fontWeight: 'bold'
                }}
                title={enabled ? 'Disable all post-processing' : 'Enable all post-processing'}
              >
                {enabled ? '● Enabled' : '○ Disabled'}
              </button>
            </div>
            <p style={{ 
              fontSize: '12px', 
              color: 'var(--theme-text)', 
              opacity: 0.7, 
              marginBottom: '12px',
              marginTop: '4px'
            }}>
              Commands will be executed automatically after connection is established, in the order listed below.
            </p>
            
            {/* Command list */}
            <div style={{ 
              marginBottom: '12px',
              maxHeight: '300px',
              overflowY: 'auto',
              border: '1px solid var(--theme-border)',
              borderRadius: '4px',
              padding: '8px'
            }}>
              {postProcessing.length === 0 ? (
                <div style={{ 
                  textAlign: 'center', 
                  padding: '20px', 
                  color: 'var(--theme-text)', 
                  opacity: 0.5 
                }}>
                  No commands added yet
                </div>
              ) : (
                postProcessing.map((cmd, index) => {
                  const cmdText = typeof cmd === 'string' ? cmd : cmd;
                  return (
                  <div 
                    key={index}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '8px',
                      marginBottom: '4px',
                      backgroundColor: 'var(--theme-surface)',
                      borderRadius: '4px',
                      border: '1px solid var(--theme-border)',
                      opacity: enabled ? 1 : 0.5
                    }}
                  >
                    <span style={{ 
                      color: 'var(--theme-accent)', 
                      fontSize: '12px',
                      minWidth: '20px',
                      textAlign: 'center'
                    }}>
                      {index + 1}.
                    </span>
                    <span style={{ 
                      flex: 1, 
                      fontFamily: 'monospace', 
                      fontSize: '13px',
                      color: 'var(--theme-text)',
                      wordBreak: 'break-all',
                      textDecoration: enabled ? 'none' : 'line-through'
                    }}>
                      {cmdText}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleMoveUp(index)}
                      disabled={index === 0}
                      style={{
                        padding: '4px 8px',
                        fontSize: '12px',
                        backgroundColor: 'var(--theme-surface)',
                        border: '1px solid var(--theme-border)',
                        color: 'var(--theme-text)',
                        cursor: index === 0 ? 'not-allowed' : 'pointer',
                        opacity: index === 0 ? 0.5 : 1
                      }}
                      title="Move up"
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      onClick={() => handleMoveDown(index)}
                      disabled={index === postProcessing.length - 1}
                      style={{
                        padding: '4px 8px',
                        fontSize: '12px',
                        backgroundColor: 'var(--theme-surface)',
                        border: '1px solid var(--theme-border)',
                        color: 'var(--theme-text)',
                        cursor: index === postProcessing.length - 1 ? 'not-allowed' : 'pointer',
                        opacity: index === postProcessing.length - 1 ? 0.5 : 1
                      }}
                      title="Move down"
                    >
                      ↓
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRemoveCommand(index)}
                      style={{
                        padding: '4px 8px',
                        fontSize: '12px',
                        backgroundColor: 'rgba(255, 68, 68, 0.1)',
                        border: '1px solid rgba(255, 68, 68, 0.3)',
                        color: '#ff4444',
                        cursor: 'pointer'
                      }}
                      title="Remove"
                    >
                      ×
                    </button>
                  </div>
                  );
                })
              )}
            </div>

            {/* Add new command */}
            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                type="text"
                value={newCommand}
                onChange={(e) => setNewCommand(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Enter command (e.g., logread -f)"
                style={{
                  flex: 1,
                  padding: '8px 12px',
                  backgroundColor: 'var(--theme-surface)',
                  border: '1px solid var(--theme-border)',
                  borderRadius: '4px',
                  color: 'var(--theme-text)',
                  fontSize: '13px',
                  fontFamily: 'monospace'
                }}
              />
              <button
                type="button"
                onClick={handleAddCommand}
                disabled={!newCommand.trim()}
                style={{
                  padding: '8px 16px',
                  backgroundColor: 'var(--theme-accent)',
                  border: 'none',
                  borderRadius: '4px',
                  color: '#000',
                  cursor: newCommand.trim() ? 'pointer' : 'not-allowed',
                  opacity: newCommand.trim() ? 1 : 0.5,
                  fontWeight: 'bold'
                }}
              >
                +
              </button>
            </div>
          </div>
        </div>

        <div className="modal-footer" style={{ 
          display: 'flex', 
          justifyContent: 'flex-end', 
          gap: '8px', 
          padding: '16px 20px',
          borderTop: '1px solid var(--theme-border)'
        }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '8px 16px',
              backgroundColor: 'var(--theme-surface)',
              border: '1px solid var(--theme-border)',
              borderRadius: '4px',
              color: 'var(--theme-text)',
              cursor: 'pointer'
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            style={{
              padding: '8px 16px',
              backgroundColor: 'var(--theme-accent)',
              border: 'none',
              borderRadius: '4px',
              color: '#000',
              cursor: 'pointer',
              fontWeight: 'bold'
            }}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

