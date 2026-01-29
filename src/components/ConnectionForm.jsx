import React, { memo, useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { CustomSelect } from './CustomSelect';

/**
 * Connection Form component - Modal for creating new SSH/Serial connections
 * ... (props remain same)
 */
export const ConnectionForm = memo(function ConnectionForm({
  // ... props
  showConnectionForm,
  connectionForm,
  formError,
  isConnecting,
  availableSerialPorts,
  onClose,
  onSubmit,
  onInputChange,
  onConnectionTypeChange,
  onSavePasswordChange,
  onLoadSerialPorts,
  onPostProcessingChange
}) {
  // ... implementation (hooks and helpers remain same)
  const { t } = useTranslation(['connection', 'common']);
  const [postProcessing, setPostProcessing] = useState([]);
  const [postProcessingEnabled, setPostProcessingEnabled] = useState(true);
  const [newCommand, setNewCommand] = useState('');
  const [isPostProcessingExpanded, setIsPostProcessingExpanded] = useState(false);

  useEffect(() => {
    if (showConnectionForm) {
      setPostProcessing(connectionForm.postProcessing || []);
      setPostProcessingEnabled(connectionForm.postProcessingEnabled !== false);
      setNewCommand('');
    }
  }, [showConnectionForm, connectionForm.postProcessing, connectionForm.postProcessingEnabled]);

  // Update parent form when post-processing changes
  const updateParentForm = (newPostProcessing, newEnabled) => {
    if (onPostProcessingChange) {
      onPostProcessingChange(newPostProcessing, newEnabled);
    }
  };

  const handleAddCommand = () => {
    if (newCommand.trim()) {
      const newCommands = [...postProcessing, newCommand.trim()];
      setPostProcessing(newCommands);
      setNewCommand('');
      updateParentForm(newCommands, postProcessingEnabled);
    }
  };

  const handleRemoveCommand = (index) => {
    const newCommands = postProcessing.filter((_, i) => i !== index);
    setPostProcessing(newCommands);
    updateParentForm(newCommands, postProcessingEnabled);
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
    updateParentForm(newCommands, postProcessingEnabled);
  };

  const handleToggleEnabled = () => {
    const newEnabled = !postProcessingEnabled;
    setPostProcessingEnabled(newEnabled);
    updateParentForm(postProcessing, newEnabled);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleAddCommand();
    }
  };

  if (!showConnectionForm) return null;

  return (
    <div className="modal-overlay">
      <div className="connection-modal">
        <div className="modal-header">
          <h3>{connectionForm.sessionName || connectionForm.host || connectionForm.serialPort || (connectionForm.connectionType === 'local' && 'Local Terminal') ? t('connection:editSession') : t('connection:newSession')}</h3>
          <button
            className="modal-close"
            onClick={onClose}
          >
            ×
          </button>
        </div>

        <form onSubmit={onSubmit} noValidate>
          <div className="form-group">
            <label>{t('connection:connectionType')}</label>
            <div className="connection-type-selector">
              <button
                type="button"
                className={`type-btn ${connectionForm.connectionType === 'ssh' ? 'active' : ''}`}
                onClick={() => onConnectionTypeChange('ssh')}
              >
                SSH
              </button>
              <button
                type="button"
                className={`type-btn ${connectionForm.connectionType === 'serial' ? 'active' : ''}`}
                onClick={() => onConnectionTypeChange('serial')}
              >
                Serial
              </button>
              <button
                type="button"
                className={`type-btn ${connectionForm.connectionType === 'local' ? 'active' : ''}`}
                onClick={() => onConnectionTypeChange('local')}
              >
                Local
              </button>
            </div>
          </div>

          {formError && (
            <div className="form-error" style={{
              color: '#ff4444', // Error color - can be made theme-aware later
              backgroundColor: 'rgba(255, 68, 68, 0.1)',
              padding: '8px 12px',
              borderRadius: '4px',
              marginBottom: '16px',
              border: '1px solid rgba(255, 68, 68, 0.3)',
              fontSize: '12px'
            }}>
              {formError}
            </div>
          )}

          <div className="form-group">
            <label htmlFor="sessionName">{t('connection:sessionName')}</label>
            <input
              type="text"
              id="sessionName"
              name="sessionName"
              value={connectionForm.sessionName}
              onChange={onInputChange}
              placeholder={connectionForm.connectionType === 'ssh' ? t('connection:sessionNamePlaceholderSSH') : connectionForm.connectionType === 'local' ? 'Local Terminal' : t('connection:sessionNamePlaceholderSerial')}
            />
          </div>

          {connectionForm.connectionType === 'ssh' && (
            <>
              <div className="form-group">
                <label htmlFor="host">{t('connection:host')}</label>
                <input
                  type="text"
                  id="host"
                  name="host"
                  value={connectionForm.host}
                  onChange={onInputChange}
                  placeholder={t('connection:hostPlaceholder')}
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="port">{t('connection:port')}</label>
                <input
                  type="number"
                  id="port"
                  name="port"
                  value={connectionForm.port}
                  onChange={onInputChange}
                  placeholder={t('connection:portPlaceholder')}
                  min="1"
                  max="65535"
                />
              </div>

              <div className="form-group">
                <label htmlFor="user">{t('connection:username')}</label>
                <input
                  type="text"
                  id="user"
                  name="user"
                  value={connectionForm.user}
                  onChange={onInputChange}
                  placeholder={t('connection:usernamePlaceholder')}
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="password">{t('connection:password')}</label>
                <input
                  type="password"
                  id="password"
                  name="password"
                  value={connectionForm.password}
                  onChange={onInputChange}
                  placeholder={t('connection:passwordPlaceholder')}
                />
              </div>

              <div className="form-group checkbox-group">
                <label className="checkbox-label">
                  <span className="checkbox-text">Use Telnet</span>
                  <input
                    type="checkbox"
                    name="useTelnet"
                    checked={connectionForm.useTelnet || false}
                    onChange={onInputChange}
                  />
                </label>
                <div className="checkbox-help" style={{ fontSize: '11px', color: 'var(--theme-text-secondary, #888)' }}>
                  Connect using Telnet instead of SSH
                </div>
              </div>
            </>
          )}

          {connectionForm.connectionType === 'serial' && (
            <>
              <div className="form-group">
                <label htmlFor="serialPort">{t('connection:serialPort')}</label>
                <div className="serial-port-selector" style={{ display: 'flex', gap: '8px' }}>
                  <div style={{ flex: 1 }}>
                    <CustomSelect
                      id="serialPort"
                      name="serialPort"
                      value={connectionForm.serialPort}
                      onChange={onInputChange}
                      options={availableSerialPorts.map(port => ({
                        value: port.path,
                        label: `${port.path} ${port.manufacturer ? `(${port.manufacturer})` : ''}`
                      }))}
                      placeholder={t('connection:selectPort')}
                    />
                  </div>
                  <button
                    type="button"
                    className="refresh-ports-btn"
                    onClick={onLoadSerialPorts}
                    title={t('connection:refreshPorts')}
                  >
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
                      <path d="M21 3v5h-5" />
                      <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
                      <path d="M3 21v-5h5" />
                    </svg>
                  </button>
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="baudRate">{t('connection:baudRate')}</label>
                  <CustomSelect
                    id="baudRate"
                    name="baudRate"
                    value={connectionForm.baudRate}
                    onChange={onInputChange}
                    options={[
                      300, 600, 1200, 2400, 4800, 9600, 14400, 19200,
                      28800, 38400, 57600, 76800, 115200, 230400, 460800,
                      921600, 1000000, 2000000
                    ]}
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="dataBits">{t('connection:dataBits')}</label>
                  <CustomSelect
                    id="dataBits"
                    name="dataBits"
                    value={connectionForm.dataBits}
                    onChange={onInputChange}
                    options={[7, 8]}
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="stopBits">{t('connection:stopBits')}</label>
                  <CustomSelect
                    id="stopBits"
                    name="stopBits"
                    value={connectionForm.stopBits}
                    onChange={onInputChange}
                    options={[1, 2]}
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="parity">{t('connection:parity')}</label>
                  <CustomSelect
                    id="parity"
                    name="parity"
                    value={connectionForm.parity}
                    onChange={onInputChange}
                    options={[
                      { value: 'none', label: t('connection:parityNone') },
                      { value: 'even', label: t('connection:parityEven') },
                      { value: 'odd', label: t('connection:parityOdd') }
                    ]}
                  />
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="flowControl">{t('connection:flowControl')}</label>
                <CustomSelect
                  id="flowControl"
                  name="flowControl"
                  value={connectionForm.flowControl}
                  onChange={onInputChange}
                  options={[
                    { value: 'none', label: t('connection:flowControlNone') },
                    { value: 'xon', label: t('connection:flowControlXon') },
                    { value: 'rts', label: t('connection:flowControlRts') }
                  ]}
                />
              </div>
            </>
          )}

          {connectionForm.connectionType === 'ssh' && (
            <div className="form-group checkbox-group">
              <label className="checkbox-label">
                <span className="checkbox-text">{t('connection:savePassword')}</span>
                <input
                  type="checkbox"
                  name="savePassword"
                  checked={connectionForm.savePassword}
                  onChange={onSavePasswordChange}
                />
              </label>
              <div className="checkbox-help">
                {t('connection:passwordWarning')}
              </div>
            </div>
          )}

          {/* Auto Reconnect */}
          <div className="form-group checkbox-group">
            <label className="checkbox-label">
              <span className="checkbox-text">{t('connection:autoReconnect')}</span>
              <input
                type="checkbox"
                name="autoReconnect"
                checked={connectionForm.autoReconnect || false}
                onChange={onInputChange}
              />
            </label>
            <div className="checkbox-help">
              {t('connection:autoReconnectDesc')}
            </div>
          </div>

          {/* Post-Processing Commands */}
          <div className="form-group">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }} onClick={() => setIsPostProcessingExpanded(!isPostProcessingExpanded)}>
                <span style={{ fontSize: '12px', color: 'var(--theme-text, #00ff41)', userSelect: 'none' }}>
                  {isPostProcessingExpanded ? '▼' : '▶'}
                </span>
                <label style={{ margin: 0, cursor: 'pointer' }}>{t('connection:postProcessing')}</label>
              </div>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleToggleEnabled();
                }}
                style={{
                  padding: '4px 8px',
                  fontSize: '11px',
                  backgroundColor: postProcessingEnabled ? 'var(--theme-accent, #00ff41)' : 'var(--theme-surface, #1a1a1a)',
                  border: `1px solid ${postProcessingEnabled ? 'var(--theme-accent, #00ff41)' : 'var(--theme-surface, #1a1a1a)'}`,
                  color: postProcessingEnabled ? '#000000' : 'var(--theme-text, #00ff41)',
                  cursor: 'pointer',
                  borderRadius: '3px',
                  fontWeight: 'bold'
                }}
                title={postProcessingEnabled ? t('common:disabled') : t('common:enabled')}
              >
                {postProcessingEnabled ? `● ${t('common:enabled')}` : `○ ${t('common:disabled')}`}
              </button>
            </div>
            {isPostProcessingExpanded && (
              <>
                <p style={{
                  fontSize: '11px',
                  color: 'var(--theme-text, #00ff41)',
                  opacity: 0.7,
                  marginBottom: '8px',
                  marginTop: '4px'
                }}>
                  {t('connection:postProcessingDesc')}
                </p>

                {/* Command list */}
                <div style={{
                  marginBottom: '8px',
                  maxHeight: '150px',
                  overflowY: 'auto',
                  border: '1px solid var(--theme-border, #1a1a1a)',
                  borderRadius: '4px',
                  padding: '6px',
                  backgroundColor: 'var(--theme-background, #000000)'
                }}>
                  {postProcessing.length === 0 ? (
                    <div style={{
                      textAlign: 'center',
                      padding: '12px',
                      color: 'var(--theme-text, #00ff41)',
                      opacity: 0.5,
                      fontSize: '11px'
                    }}>
                      {t('connection:postProcessingEmpty')}
                    </div>
                  ) : (
                    postProcessing.map((cmd, index) => (
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
                          gap: '6px',
                          padding: '6px',
                          marginBottom: '4px',
                          backgroundColor: 'var(--theme-surface, #1a1a1a)',
                          borderRadius: '3px',
                          border: '1px solid var(--theme-border, #1a1a1a)',
                          opacity: postProcessingEnabled ? 1 : 0.5,
                          cursor: 'move'
                        }}
                      >
                        <span style={{
                          color: 'var(--theme-text, #00ff41)',
                          fontSize: '11px',
                          opacity: 0.5,
                          userSelect: 'none'
                        }}>
                          ⋮⋮
                        </span>
                        <span style={{
                          flex: 1,
                          fontFamily: 'monospace',
                          fontSize: '11px',
                          color: 'var(--theme-text, #00ff41)',
                          wordBreak: 'break-all',
                          textDecoration: postProcessingEnabled ? 'none' : 'line-through'
                        }}>
                          {cmd}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleRemoveCommand(index)}
                          style={{
                            padding: '2px 6px',
                            fontSize: '11px',
                            backgroundColor: 'rgba(255, 68, 68, 0.1)',
                            border: '1px solid rgba(255, 68, 68, 0.3)',
                            color: '#ff4444',
                            cursor: 'pointer',
                            borderRadius: '3px'
                          }}
                          title={t('connection:postProcessingRemove')}
                        >
                          ×
                        </button>
                      </div>
                    ))
                  )}
                </div>

                {/* Add new command */}
                <div style={{ display: 'flex', gap: '6px' }}>
                  <input
                    type="text"
                    value={newCommand}
                    onChange={(e) => setNewCommand(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={t('connection:postProcessingPlaceholder')}
                    style={{
                      flex: 1,
                      padding: '6px 10px',
                      backgroundColor: 'var(--theme-background, #000000)',
                      border: '1px solid var(--theme-border, #1a1a1a)',
                      borderRadius: '4px',
                      color: 'var(--theme-text, #00ff41)',
                      fontSize: '12px',
                      fontFamily: 'monospace'
                    }}
                  />
                  <button
                    type="button"
                    onClick={handleAddCommand}
                    disabled={!newCommand.trim()}
                    style={{
                      padding: '6px 12px',
                      backgroundColor: 'var(--theme-accent, #00ff41)',
                      border: 'none',
                      borderRadius: '4px',
                      color: '#000000',
                      cursor: newCommand.trim() ? 'pointer' : 'not-allowed',
                      opacity: newCommand.trim() ? 1 : 0.5,
                      fontWeight: 'bold',
                      fontSize: '12px'
                    }}
                  >
                    +
                  </button>
                </div>
              </>
            )}
          </div>

          <div className="modal-actions">
            <button
              type="button"
              className="cancel-btn"
              onClick={onClose}
            >
              {t('common:cancel')}
            </button>
            <button
              type="submit"
              className="connect-btn"
              disabled={isConnecting}
            >
              {isConnecting ? t('connection:connecting') : t('connection:connect')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
});

