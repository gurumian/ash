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
  uiFontFamily,
  llmSettings,
  onChangeTheme,
  onChangeScrollbackLines,
  onChangeTerminalFontSize,
  onChangeTerminalFontFamily,
  onChangeUiFontFamily,
  onChangeLlmSettings,
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
              <label>Terminal Font Family</label>
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
                <option value="'Arial', monospace">Arial</option>
                <option value="monospace">System Monospace</option>
              </select>
              <p className="setting-description">
                Terminal font family. Changes apply to all terminals. Requires page refresh for some fonts.
              </p>
            </div>

            <div className="setting-group">
              <label>UI Font Family</label>
              <select
                value={uiFontFamily}
                onChange={onChangeUiFontFamily}
                style={{ width: '300px', padding: '8px 12px', background: '#1a1a1a', border: '1px solid #1a1a1a', borderRadius: '4px', color: '#00ff41', fontSize: '13px' }}
              >
                <option value="'Monaco', 'Menlo', 'Ubuntu Mono', 'Courier New', 'Consolas', 'Liberation Mono', monospace">Monaco / Menlo (Default)</option>
                <option value="'Courier New', monospace">Courier New</option>
                <option value="'Consolas', 'Courier New', monospace">Consolas</option>
                <option value="'Ubuntu Mono', monospace">Ubuntu Mono</option>
                <option value="'Fira Code', 'Courier New', monospace">Fira Code</option>
                <option value="'JetBrains Mono', 'Courier New', monospace">JetBrains Mono</option>
                <option value="'Source Code Pro', 'Courier New', monospace">Source Code Pro</option>
                <option value="'Arial', sans-serif">Arial</option>
                <option value="'Helvetica', 'Arial', sans-serif">Helvetica</option>
                <option value="'Times New Roman', serif">Times New Roman</option>
                <option value="'Georgia', serif">Georgia</option>
                <option value="'Verdana', sans-serif">Verdana</option>
                <option value="sans-serif">System Sans-serif</option>
                <option value="serif">System Serif</option>
                <option value="monospace">System Monospace</option>
              </select>
              <p className="setting-description">
                UI font family for menus, buttons, and other interface elements. Changes apply immediately.
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
            <h4>AI / LLM</h4>
            
            <div className="setting-group">
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                <label style={{ margin: 0, flex: 1, cursor: 'pointer' }} onClick={() => onChangeLlmSettings?.({ enabled: !llmSettings?.enabled })}>
                  Enable AI command assistance
                </label>
                <div 
                  className="toggle-switch"
                  style={{
                    position: 'relative',
                    width: '48px',
                    height: '24px',
                    backgroundColor: llmSettings?.enabled ? '#00ff41' : '#2a2a2a',
                    borderRadius: '12px',
                    cursor: 'pointer',
                    transition: 'background-color 0.2s',
                    border: '1px solid',
                    borderColor: llmSettings?.enabled ? '#00ff41' : '#1a1a1a'
                  }}
                  onClick={() => onChangeLlmSettings?.({ enabled: !llmSettings?.enabled })}
                >
                  <div
                    style={{
                      position: 'absolute',
                      top: '2px',
                      left: llmSettings?.enabled ? '26px' : '2px',
                      width: '18px',
                      height: '18px',
                      backgroundColor: '#000000',
                      borderRadius: '50%',
                      transition: 'left 0.2s',
                      boxShadow: '0 2px 4px rgba(0, 0, 0, 0.3)'
                    }}
                  />
                </div>
                <span style={{ 
                  fontSize: '12px', 
                  color: llmSettings?.enabled ? '#00ff41' : '#555',
                  fontWeight: '600',
                  minWidth: '40px'
                }}>
                  {llmSettings?.enabled ? 'ON' : 'OFF'}
                </span>
              </div>
              <p className="setting-description">
                Convert natural language to shell commands using LLM
              </p>
            </div>

            {llmSettings?.enabled && (
              <>
                <div className="setting-group">
                  <label>Provider</label>
                  <select
                    value={llmSettings?.provider || 'ollama'}
                    onChange={(e) => {
                      const provider = e.target.value;
                      const updates = { provider };
                      // Set default baseURL and model for ollama
                      if (provider === 'ollama') {
                        updates.baseURL = 'http://localhost:11434';
                        updates.model = 'llama3.2';
                      } else if (provider === 'openai') {
                        updates.baseURL = 'https://api.openai.com/v1';
                        updates.model = 'gpt-4o-mini';
                      } else if (provider === 'anthropic') {
                        updates.baseURL = 'https://api.anthropic.com/v1';
                        updates.model = 'claude-3-5-sonnet-20241022';
                      }
                      onChangeLlmSettings?.(updates);
                    }}
                    style={{ width: '200px', padding: '8px 12px', background: '#1a1a1a', border: '1px solid #1a1a1a', borderRadius: '4px', color: '#00ff41', fontSize: '13px' }}
                  >
                    <option value="ollama">Ollama (Local)</option>
                    <option value="openai">OpenAI</option>
                    <option value="anthropic">Anthropic (Claude)</option>
                  </select>
                  <p className="setting-description">
                    LLM provider. Ollama runs locally, others require API keys.
                  </p>
                </div>

                {llmSettings?.provider !== 'ollama' && (
                  <div className="setting-group">
                    <label>API Key</label>
                    <input
                      type="password"
                      value={llmSettings?.apiKey || ''}
                      onChange={(e) => onChangeLlmSettings?.({ apiKey: e.target.value })}
                      placeholder={llmSettings?.provider === 'openai' ? 'sk-...' : 'sk-ant-...'}
                      style={{ width: '400px', padding: '8px 12px', background: '#1a1a1a', border: '1px solid #1a1a1a', borderRadius: '4px', color: '#00ff41', fontSize: '13px' }}
                    />
                    <p className="setting-description">
                      API key for {llmSettings?.provider === 'openai' ? 'OpenAI' : 'Anthropic'}. Keep this secure.
                    </p>
                  </div>
                )}

                <div className="setting-group">
                  <label>Base URL</label>
                  <input
                    type="text"
                    value={llmSettings?.baseURL || ''}
                    onChange={(e) => onChangeLlmSettings?.({ baseURL: e.target.value })}
                    placeholder={llmSettings?.provider === 'ollama' ? 'http://localhost:11434' : 'https://api.openai.com/v1'}
                    style={{ width: '400px', padding: '8px 12px', background: '#1a1a1a', border: '1px solid #1a1a1a', borderRadius: '4px', color: '#00ff41', fontSize: '13px' }}
                  />
                  <p className="setting-description">
                    API endpoint URL. For Ollama, default is http://localhost:11434
                  </p>
                </div>

                <div className="setting-group">
                  <label>Model</label>
                  <input
                    type="text"
                    value={llmSettings?.model || ''}
                    onChange={(e) => onChangeLlmSettings?.({ model: e.target.value })}
                    placeholder={llmSettings?.provider === 'ollama' ? 'llama3.2' : llmSettings?.provider === 'openai' ? 'gpt-4o-mini' : 'claude-3-5-sonnet-20241022'}
                    style={{ width: '300px', padding: '8px 12px', background: '#1a1a1a', border: '1px solid #1a1a1a', borderRadius: '4px', color: '#00ff41', fontSize: '13px' }}
                  />
                  <p className="setting-description">
                    Model name to use. For Ollama, use models you have installed (e.g., llama3.2, qwen2.5).
                  </p>
                </div>

                <div className="setting-group">
                  <label>Temperature</label>
                  <input
                    type="number"
                    min="0"
                    max="2"
                    step="0.1"
                    value={llmSettings?.temperature || 0.7}
                    onChange={(e) => onChangeLlmSettings?.({ temperature: parseFloat(e.target.value) })}
                    style={{ width: '100px', padding: '8px 12px', background: '#1a1a1a', border: '1px solid #1a1a1a', borderRadius: '4px', color: '#00ff41', fontSize: '13px' }}
                  />
                  <p className="setting-description">
                    Controls randomness (0.0 = deterministic, 2.0 = very creative). Recommended: 0.7
                  </p>
                </div>

                <div className="setting-group">
                  <label>Max Tokens</label>
                  <input
                    type="number"
                    min="100"
                    max="4000"
                    step="100"
                    value={llmSettings?.maxTokens || 1000}
                    onChange={(e) => onChangeLlmSettings?.({ maxTokens: parseInt(e.target.value) })}
                    style={{ width: '100px', padding: '8px 12px', background: '#1a1a1a', border: '1px solid #1a1a1a', borderRadius: '4px', color: '#00ff41', fontSize: '13px' }}
                  />
                  <p className="setting-description">
                    Maximum tokens in response. Higher values allow longer commands but cost more.
                  </p>
                </div>
              </>
            )}
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

