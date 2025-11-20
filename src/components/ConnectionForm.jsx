import React, { memo, useState, useEffect } from 'react';

/**
 * Connection Form component - Modal for creating new SSH/Serial connections
 */
export const ConnectionForm = memo(function ConnectionForm({
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
  const [postProcessing, setPostProcessing] = useState([]);
  const [postProcessingEnabled, setPostProcessingEnabled] = useState(true);
  const [newCommand, setNewCommand] = useState('');

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

  const handleMoveUp = (index) => {
    if (index > 0) {
      const newCommands = [...postProcessing];
      [newCommands[index - 1], newCommands[index]] = [newCommands[index], newCommands[index - 1]];
      setPostProcessing(newCommands);
      updateParentForm(newCommands, postProcessingEnabled);
    }
  };

  const handleMoveDown = (index) => {
    if (index < postProcessing.length - 1) {
      const newCommands = [...postProcessing];
      [newCommands[index], newCommands[index + 1]] = [newCommands[index + 1], newCommands[index]];
      setPostProcessing(newCommands);
      updateParentForm(newCommands, postProcessingEnabled);
    }
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
          <h3>{connectionForm.sessionName || connectionForm.host || connectionForm.serialPort ? 'Edit Session' : 'New Session'}</h3>
          <button 
            className="modal-close"
            onClick={onClose}
          >
            ×
          </button>
        </div>
        
        <form onSubmit={onSubmit} noValidate>
          <div className="form-group">
            <label>Connection Type</label>
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
            </div>
          </div>

          {formError && (
            <div className="form-error" style={{ 
              color: '#ff4444', 
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
            <label htmlFor="sessionName">Session Name</label>
            <input
              type="text"
              id="sessionName"
              name="sessionName"
              value={connectionForm.sessionName}
              onChange={onInputChange}
              placeholder={connectionForm.connectionType === 'ssh' ? "My Server" : "My Serial Device"}
            />
          </div>

          {connectionForm.connectionType === 'ssh' && (
            <>
              <div className="form-group">
                <label htmlFor="host">Host</label>
                <input
                  type="text"
                  id="host"
                  name="host"
                  value={connectionForm.host}
                  onChange={onInputChange}
                  placeholder="192.168.1.100 or server.example.com"
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="port">Port</label>
                <input
                  type="number"
                  id="port"
                  name="port"
                  value={connectionForm.port}
                  onChange={onInputChange}
                  placeholder="22"
                  min="1"
                  max="65535"
                />
              </div>

              <div className="form-group">
                <label htmlFor="user">Username</label>
                <input
                  type="text"
                  id="user"
                  name="user"
                  value={connectionForm.user}
                  onChange={onInputChange}
                  placeholder="root, admin, ubuntu"
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="password">Password</label>
                <input
                  type="password"
                  id="password"
                  name="password"
                  value={connectionForm.password}
                  onChange={onInputChange}
                  placeholder="Password"
                />
              </div>
            </>
          )}

          {connectionForm.connectionType === 'serial' && (
            <>
              <div className="form-group">
                <label htmlFor="serialPort">Serial Port</label>
                <div className="serial-port-selector">
                  <select
                    id="serialPort"
                    name="serialPort"
                    value={connectionForm.serialPort}
                    onChange={onInputChange}
                    required
                  >
                    <option value="">Select a port</option>
                    {availableSerialPorts.map((port, index) => (
                      <option key={index} value={port.path}>
                        {port.path} {port.manufacturer ? `(${port.manufacturer})` : ''}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    className="refresh-ports-btn"
                    onClick={onLoadSerialPorts}
                    title="Refresh ports"
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
                  <label htmlFor="baudRate">Baud Rate</label>
                  <select
                    id="baudRate"
                    name="baudRate"
                    value={connectionForm.baudRate}
                    onChange={onInputChange}
                  >
                    <option value="300">300</option>
                    <option value="600">600</option>
                    <option value="1200">1200</option>
                    <option value="2400">2400</option>
                    <option value="4800">4800</option>
                    <option value="9600">9600</option>
                    <option value="14400">14400</option>
                    <option value="19200">19200</option>
                    <option value="28800">28800</option>
                    <option value="38400">38400</option>
                    <option value="57600">57600</option>
                    <option value="76800">76800</option>
                    <option value="115200">115200</option>
                    <option value="230400">230400</option>
                    <option value="460800">460800</option>
                    <option value="921600">921600</option>
                    <option value="1000000">1000000</option>
                    <option value="2000000">2000000</option>
                  </select>
                </div>

                <div className="form-group">
                  <label htmlFor="dataBits">Data Bits</label>
                  <select
                    id="dataBits"
                    name="dataBits"
                    value={connectionForm.dataBits}
                    onChange={onInputChange}
                  >
                    <option value="7">7</option>
                    <option value="8">8</option>
                  </select>
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="stopBits">Stop Bits</label>
                  <select
                    id="stopBits"
                    name="stopBits"
                    value={connectionForm.stopBits}
                    onChange={onInputChange}
                  >
                    <option value="1">1</option>
                    <option value="2">2</option>
                  </select>
                </div>

                <div className="form-group">
                  <label htmlFor="parity">Parity</label>
                  <select
                    id="parity"
                    name="parity"
                    value={connectionForm.parity}
                    onChange={onInputChange}
                  >
                    <option value="none">None</option>
                    <option value="even">Even</option>
                    <option value="odd">Odd</option>
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="flowControl">Flow Control</label>
                <select
                  id="flowControl"
                  name="flowControl"
                  value={connectionForm.flowControl}
                  onChange={onInputChange}
                >
                  <option value="none">None</option>
                  <option value="xon">XON/XOFF</option>
                  <option value="rts">RTS/CTS</option>
                </select>
              </div>
            </>
          )}

          {connectionForm.connectionType === 'ssh' && (
            <div className="form-group checkbox-group">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  name="savePassword"
                  checked={connectionForm.savePassword}
                  onChange={onSavePasswordChange}
                />
                <span className="checkbox-text">Save password</span>
              </label>
              <div className="checkbox-help">
                ⚠️ Passwords are stored locally and not encrypted
              </div>
            </div>
          )}

          {/* Post-Processing Commands */}
          <div className="form-group">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <label style={{ margin: 0 }}>Post-Processing Commands</label>
              <button
                type="button"
                onClick={handleToggleEnabled}
                style={{
                  padding: '4px 8px',
                  fontSize: '11px',
                  backgroundColor: postProcessingEnabled ? '#00ff41' : '#1a1a1a',
                  border: `1px solid ${postProcessingEnabled ? '#00ff41' : '#1a1a1a'}`,
                  color: postProcessingEnabled ? '#000000' : '#00ff41',
                  cursor: 'pointer',
                  borderRadius: '3px',
                  fontWeight: 'bold'
                }}
                title={postProcessingEnabled ? 'Disable all post-processing' : 'Enable all post-processing'}
              >
                {postProcessingEnabled ? '● Enabled' : '○ Disabled'}
              </button>
            </div>
            <p style={{ 
              fontSize: '11px', 
              color: '#00ff41', 
              opacity: 0.7, 
              marginBottom: '8px',
              marginTop: '4px'
            }}>
              Commands will be executed automatically after connection is established.
            </p>
            
            {/* Command list */}
            <div style={{ 
              marginBottom: '8px',
              maxHeight: '150px',
              overflowY: 'auto',
              border: '1px solid #1a1a1a',
              borderRadius: '4px',
              padding: '6px',
              backgroundColor: '#000000'
            }}>
              {postProcessing.length === 0 ? (
                <div style={{ 
                  textAlign: 'center', 
                  padding: '12px', 
                  color: '#00ff41', 
                  opacity: 0.5,
                  fontSize: '11px'
                }}>
                  No commands added yet
                </div>
              ) : (
                postProcessing.map((cmd, index) => (
                  <div 
                    key={index}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '6px',
                      marginBottom: '4px',
                      backgroundColor: '#1a1a1a',
                      borderRadius: '3px',
                      border: '1px solid #1a1a1a',
                      opacity: postProcessingEnabled ? 1 : 0.5
                    }}
                  >
                    <span style={{ 
                      color: '#00ff41', 
                      fontSize: '11px',
                      minWidth: '18px',
                      textAlign: 'center'
                    }}>
                      {index + 1}.
                    </span>
                    <span style={{ 
                      flex: 1, 
                      fontFamily: 'monospace', 
                      fontSize: '11px',
                      color: '#00ff41',
                      wordBreak: 'break-all',
                      textDecoration: postProcessingEnabled ? 'none' : 'line-through'
                    }}>
                      {cmd}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleMoveUp(index)}
                      disabled={index === 0}
                      style={{
                        padding: '2px 6px',
                        fontSize: '11px',
                        backgroundColor: '#000000',
                        border: '1px solid #1a1a1a',
                        color: '#00ff41',
                        cursor: index === 0 ? 'not-allowed' : 'pointer',
                        opacity: index === 0 ? 0.5 : 1,
                        borderRadius: '3px'
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
                        padding: '2px 6px',
                        fontSize: '11px',
                        backgroundColor: '#000000',
                        border: '1px solid #1a1a1a',
                        color: '#00ff41',
                        cursor: index === postProcessing.length - 1 ? 'not-allowed' : 'pointer',
                        opacity: index === postProcessing.length - 1 ? 0.5 : 1,
                        borderRadius: '3px'
                      }}
                      title="Move down"
                    >
                      ↓
                    </button>
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
                      title="Remove"
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
                placeholder="Enter command (e.g., logread -f)"
                style={{
                  flex: 1,
                  padding: '6px 10px',
                  backgroundColor: '#000000',
                  border: '1px solid #1a1a1a',
                  borderRadius: '4px',
                  color: '#00ff41',
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
                  backgroundColor: '#00ff41',
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
          </div>

          <div className="modal-actions">
            <button 
              type="button"
              className="cancel-btn"
              onClick={onClose}
            >
              Cancel
            </button>
            <button 
              type="submit" 
              className="connect-btn"
              disabled={isConnecting}
            >
              {isConnecting ? 'Connecting...' : 'Connect'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
});

