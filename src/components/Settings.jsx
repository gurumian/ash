import React, { memo } from 'react';

/**
 * Settings component - Modal for application settings
 */
export const Settings = memo(function Settings({
  showSettings,
  theme,
  themes,
  scrollbackLines,
  onChangeTheme,
  onChangeScrollbackLines,
  onClose
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
                style={{ width: '150px' }}
              />
              <p className="setting-description">
                Number of lines to keep in terminal buffer (ring buffer). 
                Higher values use more memory. Recommended: 2000-10000 for multiple concurrent sessions.
                Current: ~{Math.round(scrollbackLines * 80 * 10 / 1024 / 1024 * 10) / 10}MB per session
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
              <p><strong>ash SSH Client</strong></p>
              <p>Version 1.0.0</p>
              <p>A modern SSH client built with Electron and React</p>
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

