import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

/**
 * Library Dialog component - Modal for managing library/cheat-sheet commands
 */
export function LibraryDialog({
  showDialog,
  library,
  terminalFontFamily,
  onClose,
  onSave
}) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [commands, setCommands] = useState([]);
  const [newCommand, setNewCommand] = useState('');
  const [newCommandDescription, setNewCommandDescription] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);
  const [editingCommandIndex, setEditingCommandIndex] = useState(null);
  const [editingCommand, setEditingCommand] = useState('');
  const [editingCommandDesc, setEditingCommandDesc] = useState('');

  useEffect(() => {
    if (showDialog && library) {
      setName(library.name || '');
      setDescription(library.description || '');
      setCommands(library.commands || []);
      setNewCommand('');
      setNewCommandDescription('');
      setEditingCommandIndex(null);
      setEditingCommand('');
      setEditingCommandDesc('');
    }
  }, [showDialog, library]);

  const { t } = useTranslation(['library', 'common']);

  if (!showDialog || !library) return null;

  const handleAddCommand = () => {
    if (newCommand.trim()) {
      const newCmd = {
        id: Date.now().toString() + Math.random(),
        command: newCommand.trim(),
        description: newCommandDescription.trim(),
        enabled: true
      };
      setCommands([...commands, newCmd]);
      setNewCommand('');
      setNewCommandDescription('');
    }
  };

  const handleRemoveCommand = (index) => {
    setCommands(commands.filter((_, i) => i !== index));
    if (editingCommandIndex === index) {
      setEditingCommandIndex(null);
      setEditingCommand('');
      setEditingCommandDesc('');
    } else if (editingCommandIndex > index) {
      setEditingCommandIndex(editingCommandIndex - 1);
    }
  };

  const handleEditCommand = (index) => {
    const cmd = commands[index];
    setEditingCommandIndex(index);
    setEditingCommand(cmd.command || '');
    setEditingCommandDesc(cmd.description || '');
  };

  const handleSaveEditCommand = () => {
    if (editingCommandIndex !== null && editingCommand.trim()) {
      const updatedCommands = [...commands];
      updatedCommands[editingCommandIndex] = {
        ...updatedCommands[editingCommandIndex],
        command: editingCommand.trim(),
        description: editingCommandDesc.trim()
      };
      setCommands(updatedCommands);
      setEditingCommandIndex(null);
      setEditingCommand('');
      setEditingCommandDesc('');
    }
  };

  const handleCancelEditCommand = () => {
    setEditingCommandIndex(null);
    setEditingCommand('');
    setEditingCommandDesc('');
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
    
    const newCommands = [...commands];
    const [draggedItem] = newCommands.splice(draggedIndex, 1);
    newCommands.splice(targetIndex, 0, draggedItem);
    
    setCommands(newCommands);
  };

  const handleSave = () => {
    onSave(library.id, {
      name: name.trim(),
      description: description.trim(),
      commands: commands
    });
    onClose();
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey && e.target.tagName !== 'TEXTAREA') {
      e.preventDefault();
      handleAddCommand();
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="connection-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{t('library:title', { name: library.name })}</h3>
          <button 
            className="modal-close"
            onClick={onClose}
          >
            ×
          </button>
        </div>
        
        <div style={{ padding: '20px' }}>
          {/* Library Name */}
          <div className="form-group" style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', marginBottom: '8px', color: '#00ff41' }}>
              {t('library:libraryName')}
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('library:libraryNamePlaceholder')}
              style={{
                width: '100%',
                padding: '8px 12px',
                backgroundColor: '#000000',
                border: '1px solid #1a1a1a',
                borderRadius: '4px',
                color: '#00ff41',
                fontSize: '13px'
              }}
            />
          </div>

          {/* Library Description */}
          <div className="form-group" style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', marginBottom: '8px', color: '#00ff41' }}>
              {t('library:description')}
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t('library:descriptionPlaceholder')}
              rows={3}
              style={{
                width: '100%',
                padding: '8px 12px',
                backgroundColor: '#000000',
                border: '1px solid #1a1a1a',
                borderRadius: '4px',
                color: '#00ff41',
                fontSize: '13px',
                fontFamily: 'inherit',
                resize: 'vertical'
              }}
            />
          </div>

          {/* Commands Section */}
          <div className="form-group">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }} onClick={() => setIsExpanded(!isExpanded)}>
                <span style={{ fontSize: '12px', color: '#00ff41', userSelect: 'none' }}>
                  {isExpanded ? '▼' : '▶'}
                </span>
                <label style={{ margin: 0, cursor: 'pointer' }}>{t('library:commands')}</label>
              </div>
            </div>
            {isExpanded && (
              <>
                <p style={{ 
                  fontSize: '12px', 
                  color: '#00ff41', 
                  opacity: 0.7, 
                  marginBottom: '12px',
                  marginTop: '4px'
                }}>
                  {t('library:commandsDescription')}
                </p>
                
                {/* Command list */}
                <div style={{ 
                  marginBottom: '12px',
                  maxHeight: '300px',
                  overflowY: 'auto',
                  border: '1px solid #1a1a1a',
                  borderRadius: '4px',
                  padding: '8px',
                  backgroundColor: '#000000'
                }}>
                  {commands.length === 0 ? (
                    <div style={{ 
                      textAlign: 'center', 
                      padding: '20px', 
                      color: '#00ff41', 
                      opacity: 0.5 
                    }}>
                      {t('library:noCommandsAdded')}
                    </div>
                  ) : (
                    commands.map((cmd, index) => {
                      const isEditing = editingCommandIndex === index;
                      return (
                        <div 
                          key={cmd.id || index}
                          draggable={!isEditing}
                          onDragStart={(e) => !isEditing && handleDragStart(e, index)}
                          onDragEnd={handleDragEnd}
                          onDragOver={handleDragOver}
                          onDrop={(e) => handleDrop(e, index)}
                          style={{
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '4px',
                            padding: '8px',
                            marginBottom: '4px',
                            backgroundColor: isEditing ? '#2a2a2a' : '#1a1a1a',
                            borderRadius: '4px',
                            border: isEditing ? '1px solid #00ff41' : '1px solid #1a1a1a',
                            cursor: isEditing ? 'default' : 'move'
                          }}
                        >
                          {isEditing ? (
                            <>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                <input
                                  type="text"
                                  value={editingCommand}
                                  onChange={(e) => setEditingCommand(e.target.value)}
                                  placeholder={t('library:commandPlaceholder')}
                                  style={{
                                    width: '100%',
                                    padding: '6px 8px',
                                    backgroundColor: '#000000',
                                    border: '1px solid #1a1a1a',
                                    borderRadius: '4px',
                                    color: '#00ff41',
                                    fontSize: '13px',
                                    fontFamily: terminalFontFamily || "'Monaco', 'Menlo', 'Ubuntu Mono', 'Courier New', 'Consolas', 'Liberation Mono', monospace"
                                  }}
                                  autoFocus
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter' && !e.shiftKey) {
                                      e.preventDefault();
                                      handleSaveEditCommand();
                                    } else if (e.key === 'Escape') {
                                      e.preventDefault();
                                      handleCancelEditCommand();
                                    }
                                  }}
                                />
                                <input
                                  type="text"
                                  value={editingCommandDesc}
                                  onChange={(e) => setEditingCommandDesc(e.target.value)}
                                  placeholder={t('library:descriptionPlaceholderOptional')}
                                  style={{
                                    width: '100%',
                                    padding: '6px 8px',
                                    backgroundColor: '#000000',
                                    border: '1px solid #1a1a1a',
                                    borderRadius: '4px',
                                    color: '#00ff41',
                                    fontSize: '12px'
                                  }}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter' && !e.shiftKey) {
                                      e.preventDefault();
                                      handleSaveEditCommand();
                                    } else if (e.key === 'Escape') {
                                      e.preventDefault();
                                      handleCancelEditCommand();
                                    }
                                  }}
                                />
                              </div>
                              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                                <button
                                  type="button"
                                  onClick={handleCancelEditCommand}
                                  style={{
                                    padding: '4px 12px',
                                    fontSize: '12px',
                                    backgroundColor: '#1a1a1a',
                                    border: '1px solid #1a1a1a',
                                    color: '#00ff41',
                                    cursor: 'pointer',
                                    borderRadius: '4px'
                                  }}
                                >
                                  {t('common:cancel')}
                                </button>
                                <button
                                  type="button"
                                  onClick={handleSaveEditCommand}
                                  disabled={!editingCommand.trim()}
                                  style={{
                                    padding: '4px 12px',
                                    fontSize: '12px',
                                    backgroundColor: '#1a1a1a',
                                    border: '1px solid #1a1a1a',
                                    color: editingCommand.trim() ? '#00ff41' : '#666',
                                    cursor: editingCommand.trim() ? 'pointer' : 'not-allowed',
                                    borderRadius: '4px',
                                    opacity: editingCommand.trim() ? 1 : 0.5
                                  }}
                                >
                                  {t('common:save')}
                                </button>
                              </div>
                            </>
                          ) : (
                            <>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span 
                                  style={{ 
                                    color: '#00ff41', 
                                    fontSize: '12px',
                                    opacity: 0.5,
                                    userSelect: 'none',
                                    cursor: 'grab'
                                  }}
                                  onMouseDown={(e) => e.stopPropagation()}
                                >
                                  ⋮⋮
                                </span>
                                <span 
                                  style={{ 
                                    flex: 1, 
                                    fontFamily: terminalFontFamily || "'Monaco', 'Menlo', 'Ubuntu Mono', 'Courier New', 'Consolas', 'Liberation Mono', monospace", 
                                    fontSize: '13px',
                                    color: '#00ff41',
                                    wordBreak: 'break-all',
                                    cursor: 'pointer'
                                  }}
                                  onClick={() => handleEditCommand(index)}
                                  title="Click to edit"
                                >
                                  {cmd.command}
                                </span>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleRemoveCommand(index);
                                  }}
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
                              {cmd.description && (
                                <div 
                                  style={{
                                    fontSize: '11px',
                                    color: '#00ff41',
                                    opacity: 0.6,
                                    paddingLeft: '24px',
                                    fontStyle: 'italic',
                                    cursor: 'pointer'
                                  }}
                                  onClick={() => handleEditCommand(index)}
                                  title="Click to edit"
                                >
                                  {cmd.description}
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Add new command */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <input
                    type="text"
                    value={newCommand}
                    onChange={(e) => setNewCommand(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={t('library:commandPlaceholder')}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      backgroundColor: '#000000',
                      border: '1px solid #1a1a1a',
                      borderRadius: '4px',
                      color: '#00ff41',
                      fontSize: '13px',
                      fontFamily: terminalFontFamily || "'Monaco', 'Menlo', 'Ubuntu Mono', 'Courier New', 'Consolas', 'Liberation Mono', monospace"
                    }}
                  />
                  <input
                    type="text"
                    value={newCommandDescription}
                    onChange={(e) => setNewCommandDescription(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={t('library:descriptionPlaceholderOptional')}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      backgroundColor: '#000000',
                      border: '1px solid #1a1a1a',
                      borderRadius: '4px',
                      color: '#00ff41',
                      fontSize: '12px'
                    }}
                  />
                  <button
                    type="button"
                    onClick={handleAddCommand}
                    disabled={!newCommand.trim()}
                    style={{
                      padding: '8px 16px',
                      backgroundColor: '#1a1a1a',
                      border: '1px solid #1a1a1a',
                      borderRadius: '4px',
                      color: newCommand.trim() ? '#00ff41' : '#666',
                      cursor: newCommand.trim() ? 'pointer' : 'not-allowed',
                      opacity: newCommand.trim() ? 1 : 0.5
                    }}
                  >
                    {t('library:addCommand')}
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
              backgroundColor: 'var(--theme-surface)',
              border: '1px solid var(--theme-border)',
              borderRadius: '4px',
              color: 'var(--theme-text)',
              cursor: 'pointer'
            }}
          >
            {t('common:save')}
          </button>
        </div>
      </div>
    </div>
  );
}

