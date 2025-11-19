import React, { memo } from 'react';

/**
 * Settings component - Modal for application settings
 */
export const Settings = memo(function Settings({
  showSettings,
  theme,
  themes,
  scrollbackLines,
  terminalFontSize,
  terminalFontFamily,
  onChangeTheme,
  onChangeScrollbackLines,
  onChangeTerminalFontSize,
  onChangeTerminalFontFamily,
  onClose,
  onShowAbout
}) {
  if (!showSettings) return null;

  return (
    <div className="modal-overlay">
      <div className="settings-modal">
        <div className="modal-header">
          <h3>Settings</h3>
          <button 
            className="modal-close"
            onClick={onClose}
          >
            ×
          </button>
        </div>
        
        <div className="settings-content">
          <div className="settings-section">
            <h4>Appearance</h4>
            
            <div className="setting-group">
              <label>Theme</label>
              <div className="theme-options">
                {Object.entries(themes).map(([key, themeData]) => (
                  <button
                    key={key}
                    className={`theme-option ${theme === key ? 'active' : ''}`}
                    onClick={() => onChangeTheme(key)}
                  >
                    <div 
                      className="theme-preview"
                      style={{ backgroundColor: themeData.background }}
                    />
                    {themeData.name}
                  </button>
                ))}
              </div>
              <p className="setting-description">
                Changes both UI and terminal appearance
              </p>
            </div>
          </div>

          <div className="settings-section">
            <h4>Terminal</h4>
            
            <div className="setting-group">
              <label>Scrollback Lines</label>
              <input
                type="number"
                min="100"
                max="50000"
                step="100"
                value={scrollbackLines}
                onChange={onChangeScrollbackLines}
                style={{ width: '150px', padding: '8px 12px', background: '#1a1a1a', border: '1px solid #1a1a1a', borderRadius: '4px', color: '#00ff41', fontSize: '13px' }}
              />
              <p className="setting-description">
                Number of lines to keep in terminal buffer (ring buffer). 
                Higher values use more memory. Recommended: 2000-10000 for multiple concurrent sessions.
                Current: ~{Math.round(scrollbackLines * 80 * 10 / 1024 / 1024 * 10) / 10}MB per session
              </p>
            </div>

            <div className="setting-group">
              <label>Font Size</label>
              <input
                type="number"
                min="8"
                max="32"
                step="1"
                value={terminalFontSize}
                onChange={onChangeTerminalFontSize}
                style={{ width: '100px', padding: '8px 12px', background: '#1a1a1a', border: '1px solid #1a1a1a', borderRadius: '4px', color: '#00ff41', fontSize: '13px' }}
              />
              <p className="setting-description">
                Terminal font size in pixels. Range: 8-32px. Changes apply to all terminals.
              </p>
            </div>

            <div className="setting-group">
              <label>Font Family</label>
              <select
                value={terminalFontFamily}
                onChange={onChangeTerminalFontFamily}
                style={{ width: '300px', padding: '8px 12px', background: '#1a1a1a', border: '1px solid #1a1a1a', borderRadius: '4px', color: '#00ff41', fontSize: '13px' }}
              >
                <option value="'Monaco', 'Menlo', 'Ubuntu Mono', 'Courier New', 'Consolas', 'Liberation Mono', monospace">Monaco / Menlo (Default)</option>
                <option value="'Courier New', monospace">Courier New</option>
                <option value="'Consolas', 'Courier New', monospace">Consolas</option>
                <option value="'Ubuntu Mono', monospace">Ubuntu Mono</option>
                <option value="'Fira Code', 'Courier New', monospace">Fira Code</option>
                <option value="'JetBrains Mono', 'Courier New', monospace">JetBrains Mono</option>
                <option value="'Source Code Pro', 'Courier New', monospace">Source Code Pro</option>
                <option value="monospace">System Monospace</option>
              </select>
              <p className="setting-description">
                Terminal font family. Changes apply to all terminals. Requires page refresh for some fonts.
              </p>
            </div>
          </div>

          <div className="settings-section">
            <h4>Connection</h4>
            
            <div className="setting-group">
              <label>
                <input
                  type="checkbox"
                  checked={true}
                  readOnly
                />
                Save connection history
              </label>
              <p className="setting-description">
                Automatically save recent connections for quick access
              </p>
            </div>

            <div className="setting-group">
              <label>
                <input
                  type="checkbox"
                  checked={true}
                  readOnly
                />
                Enable favorites
              </label>
              <p className="setting-description">
                Allow marking connections as favorites
              </p>
            </div>
          </div>

          <div className="settings-section">
            <h4>About</h4>
            <div className="about-info">
              <p><strong>ash</strong></p>
              <p>A modern SSH and Serial terminal client</p>
              {onShowAbout && (
                <button 
                  className="about-button"
                  onClick={() => {
                    onClose();
                    setTimeout(() => onShowAbout(), 100);
                  }}
                  style={{
                    marginTop: '12px',
                    padding: '8px 16px',
                    backgroundColor: '#00ff41',
                    color: '#000',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: '500',
                    transition: 'background-color 0.2s'
                  }}
                  onMouseEnter={(e) => e.target.style.backgroundColor = '#00cc35'}
                  onMouseLeave={(e) => e.target.style.backgroundColor = '#00ff41'}
                >
                  Show About
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="modal-actions">
          <button 
            className="close-btn"
            onClick={onClose}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
});

