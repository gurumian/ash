import React from 'react';

/**
 * Connection Form component - Modal for creating new SSH/Serial connections
 */
export function ConnectionForm({
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
  onLoadSerialPorts
}) {
  if (!showConnectionForm) return null;

  return (
    <div className="modal-overlay">
      <div className="connection-modal">
        <div className="modal-header">
          <h3>New Connection</h3>
          <button 
            className="modal-close"
            onClick={onClose}
          >
            ×
          </button>
        </div>
        
        <form onSubmit={onSubmit}>
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
                    🔄
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
}

