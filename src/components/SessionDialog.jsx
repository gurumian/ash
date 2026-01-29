import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

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
  const [isExpanded, setIsExpanded] = useState(false);
  const { t } = useTranslation(['connection', 'common']);

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

  const handleDragStart = (e, index) => {
    e.dataTransfer.setData('text/plain', index.toString());
    e.dataTransfer.effectAllowed = 'move';
    e.currentTarget.style.opacity = '0.5';
  };

  const handleDragEnd = (e) => {
    e.currentTarget.style.opacity = '';
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e, targetIndex) => {
    e.preventDefault();
    const draggedIndex = parseInt(e.dataTransfer.getData('text/plain'), 10);

    if (isNaN(draggedIndex) || draggedIndex === targetIndex) {
      return;
    }

    const newCommands = [...postProcessing];
    const [draggedItem] = newCommands.splice(draggedIndex, 1);
    newCommands.splice(targetIndex, 0, draggedItem);

    setPostProcessing(newCommands);
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
    <div className="modal-overlay">
      <div className="connection-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{t('connection:sessionSettings', { name: session.name })}</h3>
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
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }} onClick={() => setIsExpanded(!isExpanded)}>
                <span style={{ fontSize: '12px', color: 'var(--theme-text)', userSelect: 'none' }}>
                  {isExpanded ? '▼' : '▶'}
                </span>
                <label style={{ margin: 0, cursor: 'pointer' }}>{t('connection:postProcessing')}</label>
              </div>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setEnabled(!enabled);
                }}
                style={{
                  padding: '6px 12px',
                  fontSize: '12px',
                  backgroundColor: enabled ? 'var(--theme-accent)' : 'var(--theme-border)',
                  border: `1px solid ${enabled ? 'var(--theme-accent)' : 'var(--theme-border)'}`,
                  color: enabled ? 'var(--theme-bg)' : 'var(--theme-text)',
                  cursor: 'pointer',
                  borderRadius: '4px',
                  fontWeight: 'bold'
                }}
                title={enabled ? t('connection:disablePostProcessing') : t('connection:enablePostProcessing')}
              >
                {enabled ? `● ${t('common:enabled')}` : `○ ${t('common:disabled')}`}
              </button>
            </div>
            {isExpanded && (
              <>
                <p style={{
                  fontSize: '12px',
                  color: 'var(--theme-text)',
                  opacity: 0.7,
                  marginBottom: '12px',
                  marginTop: '4px'
                }}>
                  {t('connection:postProcessingDescription')}
                </p>

                {/* Command list */}
                <div style={{
                  marginBottom: '12px',
                  maxHeight: '300px',
                  overflowY: 'auto',
                  border: '1px solid var(--theme-border)',
                  borderRadius: '4px',
                  padding: '8px',
                  backgroundColor: 'var(--theme-bg)'
                }}>
                  {postProcessing.length === 0 ? (
                    <div style={{
                      textAlign: 'center',
                      padding: '20px',
                      color: 'var(--theme-text)',
                      opacity: 0.5
                    }}>
                      {t('connection:noCommandsAdded')}
                    </div>
                  ) : (
                    postProcessing.map((cmd, index) => {
                      const cmdText = typeof cmd === 'string' ? cmd : cmd;
                      return (
                        <div
                          key={index}
                          draggable
                          onDragStart={(e) => handleDragStart(e, index)}
                          onDragEnd={handleDragEnd}
                          onDragOver={handleDragOver}
                          onDrop={(e) => handleDrop(e, index)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            padding: '8px',
                            marginBottom: '4px',
                            backgroundColor: 'var(--theme-border)',
                            borderRadius: '4px',
                            border: '1px solid var(--theme-border)',
                            opacity: enabled ? 1 : 0.5,
                            cursor: 'move'
                          }}
                        >
                          <span style={{
                            color: 'var(--theme-text)',
                            fontSize: '12px',
                            opacity: 0.5,
                            userSelect: 'none'
                          }}>
                            ⋮⋮
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
                            onClick={() => handleRemoveCommand(index)}
                            style={{
                              padding: '4px 8px',
                              fontSize: '12px',
                              backgroundColor: 'rgba(255, 68, 68, 0.1)',
                              border: '1px solid rgba(255, 68, 68, 0.3)',
                              color: '#ff4444',
                              cursor: 'pointer'
                            }}
                            title={t('connection:postProcessingRemove')}
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
                    placeholder={t('connection:enterCommandPlaceholder')}
                    style={{
                      flex: 1,
                      padding: '8px 12px',
                      backgroundColor: 'var(--theme-bg)',
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
                      color: 'var(--theme-bg)',
                      cursor: newCommand.trim() ? 'pointer' : 'not-allowed',
                      opacity: newCommand.trim() ? 1 : 0.5,
                      fontWeight: 'bold'
                    }}
                  >
                    +
                  </button>
                </div>
              </>
            )}
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
            {t('common:cancel')}
          </button>
          <button
            type="button"
            onClick={handleSave}
            style={{
              padding: '8px 16px',
              backgroundColor: 'var(--theme-accent)',
              border: 'none',
              borderRadius: '4px',
              color: 'var(--theme-bg)',
              cursor: 'pointer',
              fontWeight: 'bold'
            }}
          >
            {t('common:save')}
          </button>
        </div>
      </div>
    </div>
  );
}

