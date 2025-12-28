import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import './LibraryDialog.css';

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
    <div className="library-dialog-overlay" onClick={onClose}>
      <div className="library-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="library-dialog-header">
          <h3>{t('library:title', { name: library.name })}</h3>
          <button 
            className="library-dialog-close"
            onClick={onClose}
          >
            ×
          </button>
        </div>
        
        <div className="library-dialog-content">
          {/* Library Name */}
          <div className="library-form-group">
            <label className="library-label">
              {t('library:libraryName')}
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('library:libraryNamePlaceholder')}
              className="library-input"
            />
          </div>

          {/* Library Description */}
          <div className="library-form-group">
            <label className="library-label">
              {t('library:description')}
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t('library:descriptionPlaceholder')}
              rows={3}
              className="library-textarea"
            />
          </div>

          {/* Commands Section */}
          <div className="library-form-group">
            <div className="library-commands-header">
              <div className="library-commands-toggle" onClick={() => setIsExpanded(!isExpanded)}>
                <span className="library-commands-toggle-icon">
                  {isExpanded ? '▼' : '▶'}
                </span>
                <label style={{ margin: 0, cursor: 'pointer' }}>{t('library:commands')}</label>
              </div>
            </div>
            {isExpanded && (
              <>
                <p className="library-commands-description">
                  {t('library:commandsDescription')}
                </p>
                
                {/* Command list */}
                <div className="library-commands-list">
                  {commands.length === 0 ? (
                    <div className="library-commands-empty">
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
                          className={`library-command-item ${isEditing ? 'editing' : ''}`}
                        >
                          {isEditing ? (
                            <>
                              <div className="library-command-edit-form">
                                <input
                                  type="text"
                                  value={editingCommand}
                                  onChange={(e) => setEditingCommand(e.target.value)}
                                  placeholder={t('library:commandPlaceholder')}
                                  className="library-command-edit-input"
                                  style={{
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
                                  className="library-command-edit-input"
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
                              <div className="library-command-edit-actions">
                                <button
                                  type="button"
                                  onClick={handleCancelEditCommand}
                                  className="library-command-edit-btn"
                                >
                                  {t('common:cancel')}
                                </button>
                                <button
                                  type="button"
                                  onClick={handleSaveEditCommand}
                                  disabled={!editingCommand.trim()}
                                  className="library-command-edit-btn"
                                >
                                  {t('common:save')}
                                </button>
                              </div>
                            </>
                          ) : (
                            <>
                              <div className="library-command-view">
                                <span 
                                  className="library-command-drag-handle"
                                  onMouseDown={(e) => e.stopPropagation()}
                                >
                                  ⋮⋮
                                </span>
                                <span 
                                  className="library-command-text"
                                  style={{
                                    fontFamily: terminalFontFamily || "'Monaco', 'Menlo', 'Ubuntu Mono', 'Courier New', 'Consolas', 'Liberation Mono', monospace"
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
                                  className="library-command-remove-btn"
                                  title="Remove"
                                >
                                  ×
                                </button>
                              </div>
                              {cmd.description && (
                                <div 
                                  className="library-command-description"
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
                <div className="library-command-add-form">
                  <input
                    type="text"
                    value={newCommand}
                    onChange={(e) => setNewCommand(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={t('library:commandPlaceholder')}
                    className="library-input"
                    style={{
                      fontFamily: terminalFontFamily || "'Monaco', 'Menlo', 'Ubuntu Mono', 'Courier New', 'Consolas', 'Liberation Mono', monospace"
                    }}
                  />
                  <input
                    type="text"
                    value={newCommandDescription}
                    onChange={(e) => setNewCommandDescription(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={t('library:descriptionPlaceholderOptional')}
                    className="library-input"
                    style={{ fontSize: '12px' }}
                  />
                  <button
                    type="button"
                    onClick={handleAddCommand}
                    disabled={!newCommand.trim()}
                    className="library-command-add-btn"
                  >
                    {t('library:addCommand')}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        <div className="library-dialog-footer">
          <button
            type="button"
            onClick={onClose}
            className="library-dialog-btn"
          >
            {t('common:cancel')}
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="library-dialog-btn"
          >
            {t('common:save')}
          </button>
        </div>
      </div>
    </div>
  );
}

