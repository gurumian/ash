import React, { memo, useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { changeLanguage } from '../i18n';

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
  reconnectRetry,
  onChangeTheme,
  onChangeScrollbackLines,
  onChangeTerminalFontSize,
  onChangeTerminalFontFamily,
  onChangeUiFontFamily,
  onChangeLlmSettings,
  onChangeReconnectRetry,
  onClose,
  onShowAbout
}) {
  const [ollamaModels, setOllamaModels] = useState([]);
  const [isLoadingModels, setIsLoadingModels] = useState(false);
  const [showModelDropdown, setShowModelDropdown] = useState(false);
  const [filteredModels, setFilteredModels] = useState([]);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const modelInputRef = useRef(null);
  const modelDropdownRef = useRef(null);
  const { t, i18n } = useTranslation(['settings', 'common']);

  // Fetch Ollama models when provider is ollama and baseURL is set
  useEffect(() => {
    const fetchOllamaModels = async () => {
      if (llmSettings?.provider === 'ollama' && llmSettings?.baseURL && llmSettings?.enabled) {
        setIsLoadingModels(true);
        try {
          const url = `${llmSettings.baseURL}/api/tags`;
          const response = await fetch(url, {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
            }
          });

          if (response.ok) {
            const data = await response.json();
            if (data.models && Array.isArray(data.models)) {
              const modelNames = data.models.map(model => model.name || model.model || model).filter(Boolean);
              setOllamaModels(modelNames);
              setFilteredModels(modelNames);
            }
          } else {
            // Silently fail - user might not have Ollama running
            setOllamaModels([]);
            setFilteredModels([]);
          }
        } catch (error) {
          // Silently fail - user might not have Ollama running
          setOllamaModels([]);
          setFilteredModels([]);
        } finally {
          setIsLoadingModels(false);
        }
      } else {
        setOllamaModels([]);
        setFilteredModels([]);
      }
    };

    // Debounce the fetch
    const timeoutId = setTimeout(fetchOllamaModels, 500);
    return () => clearTimeout(timeoutId);
  }, [llmSettings?.provider, llmSettings?.baseURL, llmSettings?.enabled]);

  // Filter models based on input
  useEffect(() => {
    if (llmSettings?.model && ollamaModels.length > 0) {
      const filter = llmSettings.model.toLowerCase();
      const filtered = ollamaModels.filter(model => 
        model.toLowerCase().includes(filter)
      );
      setFilteredModels(filtered);
    } else {
      setFilteredModels(ollamaModels);
    }
  }, [llmSettings?.model, ollamaModels]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        modelDropdownRef.current &&
        !modelDropdownRef.current.contains(event.target) &&
        modelInputRef.current &&
        !modelInputRef.current.contains(event.target)
      ) {
        setShowModelDropdown(false);
        setHighlightedIndex(-1);
      }
    };

    if (showModelDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showModelDropdown]);

  if (!showSettings) return null;

  return (
    <div className="modal-overlay">
      <div className="settings-modal">
        <div className="modal-header">
          <h3>{t('settings:title')}</h3>
          <button 
            className="modal-close"
            onClick={onClose}
          >
            ×
          </button>
        </div>
        
        <div className="settings-content">
          <div className="settings-section">
            <h4>{t('settings:theme')}</h4>
            
            <div className="setting-group">
              <label>{t('settings:theme')}</label>
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
                {t('settings:themeDesc')}
              </p>
            </div>

            <div className="setting-group">
              <label>{t('settings:language')}</label>
              <select
                value={i18n.language || 'en'}
                onChange={(e) => {
                  changeLanguage(e.target.value);
                }}
                style={{ width: '200px', padding: '8px 12px', background: '#1a1a1a', border: '1px solid #1a1a1a', borderRadius: '4px', color: '#00ff41', fontSize: '13px' }}
              >
                <option value="en">{t('settings:english')}</option>
                <option value="ko">{t('settings:korean')}</option>
              </select>
              <p className="setting-description">
                {t('settings:languageDesc')}
              </p>
            </div>
          </div>

          <div className="settings-section">
            <h4>{t('settings:terminal')}</h4>
            
            <div className="setting-group">
              <label>{t('settings:scrollbackLines')}</label>
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
                {t('settings:scrollbackLinesDesc')}
                {' '}{t('settings:scrollbackLinesCurrent')}: ~{Math.round(scrollbackLines * 80 * 10 / 1024 / 1024 * 10) / 10}{t('settings:scrollbackLinesMB')}
              </p>
            </div>

            <div className="setting-group">
              <label>{t('settings:terminalFontSize')}</label>
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
                {t('settings:fontSizeDesc')}
              </p>
            </div>

            <div className="setting-group">
              <label>{t('settings:terminalFontFamily')}</label>
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
                {t('settings:terminalFontFamilyDesc')}
              </p>
            </div>

            <div className="setting-group">
              <label>{t('settings:uiFontFamily')}</label>
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
                {t('settings:uiFontFamilyDesc')}
              </p>
            </div>
          </div>

          <div className="settings-section">
            <h4>{t('settings:connection')}</h4>
            
            <div className="setting-group">
              <label>
                <input
                  type="checkbox"
                  checked={true}
                  readOnly
                />
                {t('settings:saveConnectionHistory')}
              </label>
              <p className="setting-description">
                {t('settings:saveConnectionHistoryDesc')}
              </p>
            </div>

            <div className="setting-group">
              <label>
                <input
                  type="checkbox"
                  checked={true}
                  readOnly
                />
                {t('settings:enableFavorites')}
              </label>
              <p className="setting-description">
                {t('settings:enableFavoritesDesc')}
              </p>
            </div>

            <div className="setting-group">
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                <label style={{ margin: 0, flex: 1, cursor: 'pointer' }} onClick={() => onChangeReconnectRetry?.({ enabled: !reconnectRetry?.enabled })}>
                  {t('settings:reconnectEnabled')}
                </label>
                <div 
                  className="toggle-switch"
                  style={{
                    position: 'relative',
                    width: '48px',
                    height: '24px',
                    backgroundColor: reconnectRetry?.enabled !== false ? '#00ff41' : '#2a2a2a',
                    borderRadius: '12px',
                    cursor: 'pointer',
                    transition: 'background-color 0.2s',
                    border: '1px solid',
                    borderColor: reconnectRetry?.enabled !== false ? '#00ff41' : '#1a1a1a'
                  }}
                  onClick={() => onChangeReconnectRetry?.({ enabled: !reconnectRetry?.enabled })}
                >
                  <div
                    style={{
                      position: 'absolute',
                      top: '2px',
                      left: reconnectRetry?.enabled !== false ? '26px' : '2px',
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
                  color: reconnectRetry?.enabled !== false ? '#00ff41' : '#555',
                  fontWeight: '600',
                  minWidth: '40px'
                }}>
                  {reconnectRetry?.enabled !== false ? 'ON' : 'OFF'}
                </span>
              </div>
              <p className="setting-description">
                {t('settings:reconnectRetryDesc')}
              </p>
            </div>

            {reconnectRetry?.enabled !== false && (
              <>
                <div className="setting-group">
                  <label>{t('settings:reconnectInterval')}</label>
                  <input
                    type="number"
                    min="100"
                    max="10000"
                    step="100"
                    value={reconnectRetry?.interval || 1000}
                    onChange={(e) => {
                      const value = parseInt(e.target.value, 10);
                      if (!isNaN(value) && value >= 100 && value <= 10000) {
                        onChangeReconnectRetry?.({ interval: value });
                      }
                    }}
                    style={{ width: '150px', padding: '8px 12px', background: '#1a1a1a', border: '1px solid #1a1a1a', borderRadius: '4px', color: '#00ff41', fontSize: '13px' }}
                  />
                  <p className="setting-description">
                    {t('settings:reconnectIntervalDesc')}
                  </p>
                </div>

                <div className="setting-group">
                  <label>{t('settings:reconnectMaxAttempts')}</label>
                  <input
                    type="number"
                    min="1"
                    max="300"
                    step="1"
                    value={reconnectRetry?.maxAttempts || 60}
                    onChange={(e) => {
                      const value = parseInt(e.target.value, 10);
                      if (!isNaN(value) && value >= 1 && value <= 300) {
                        onChangeReconnectRetry?.({ maxAttempts: value });
                      }
                    }}
                    style={{ width: '150px', padding: '8px 12px', background: '#1a1a1a', border: '1px solid #1a1a1a', borderRadius: '4px', color: '#00ff41', fontSize: '13px' }}
                  />
                  <p className="setting-description">
                    {t('settings:reconnectMaxAttemptsDesc')}
                  </p>
                </div>
              </>
            )}
          </div>

          <div className="settings-section">
            <h4>{t('settings:llm')}</h4>
            
            <div className="setting-group">
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                <label style={{ margin: 0, flex: 1, cursor: 'pointer' }} onClick={() => onChangeLlmSettings?.({ enabled: !llmSettings?.enabled })}>
                  {t('settings:enableAI')}
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
                {t('settings:enableAIDesc')}
              </p>
            </div>

            {llmSettings?.enabled && (
              <>
                <div className="setting-group">
                  <label>{t('settings:provider')}</label>
                  <select
                    value={llmSettings?.provider || 'ollama'}
                    onChange={(e) => {
                      const provider = e.target.value;
                      const updates = { provider };
                      // Set default baseURL and model only if not already set
                      if (provider === 'ollama') {
                        if (!llmSettings?.baseURL) {
                          updates.baseURL = 'http://localhost:11434';
                        }
                        if (!llmSettings?.model) {
                          updates.model = 'llama3.2';
                        }
                      } else if (provider === 'openai') {
                        if (!llmSettings?.baseURL || llmSettings?.baseURL === 'http://localhost:11434') {
                          updates.baseURL = 'https://api.openai.com/v1';
                        }
                        if (!llmSettings?.model || llmSettings?.model === 'llama3.2') {
                          updates.model = 'gpt-4o-mini';
                        }
                      } else if (provider === 'anthropic') {
                        if (!llmSettings?.baseURL || llmSettings?.baseURL === 'http://localhost:11434') {
                          updates.baseURL = 'https://api.anthropic.com/v1';
                        }
                        if (!llmSettings?.model || llmSettings?.model === 'llama3.2') {
                          updates.model = 'claude-3-5-sonnet-20241022';
                        }
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
                    {t('settings:providerDesc')}
                  </p>
                </div>

                {llmSettings?.provider !== 'ollama' && (
                  <div className="setting-group">
                    <label>{t('settings:apiKey')}</label>
                    <input
                      type="password"
                      value={llmSettings?.apiKey || ''}
                      onChange={(e) => onChangeLlmSettings?.({ apiKey: e.target.value })}
                      placeholder={llmSettings?.provider === 'openai' ? 'sk-...' : 'sk-ant-...'}
                      style={{ width: '400px', padding: '8px 12px', background: '#1a1a1a', border: '1px solid #1a1a1a', borderRadius: '4px', color: '#00ff41', fontSize: '13px' }}
                    />
                    <p className="setting-description">
                      {t('settings:apiKeyDesc', { provider: llmSettings?.provider === 'openai' ? 'OpenAI' : 'Anthropic' })}
                    </p>
                  </div>
                )}

                <div className="setting-group">
                  <label>{t('settings:baseURL')}</label>
                  <input
                    type="text"
                    value={llmSettings?.baseURL || ''}
                    onChange={(e) => onChangeLlmSettings?.({ baseURL: e.target.value })}
                    placeholder={llmSettings?.provider === 'ollama' ? 'http://localhost:11434' : 'https://api.openai.com/v1'}
                    style={{ width: '400px', padding: '8px 12px', background: '#1a1a1a', border: '1px solid #1a1a1a', borderRadius: '4px', color: '#00ff41', fontSize: '13px' }}
                  />
                  <p className="setting-description">
                    {t('settings:baseURLDesc')}
                  </p>
                </div>

                <div className="setting-group">
                  <label>
                    {t('settings:model')}
                    {llmSettings?.provider === 'ollama' && ollamaModels.length > 0 && (
                      <span style={{ marginLeft: '8px', fontSize: '11px', color: '#888', fontWeight: 'normal' }}>
                        ({ollamaModels.length} {t('settings:available')})
                      </span>
                    )}
                    {llmSettings?.provider === 'ollama' && isLoadingModels && (
                      <span style={{ marginLeft: '8px', fontSize: '11px', color: '#888', fontWeight: 'normal' }}>
                        ({t('settings:loading')})
                      </span>
                    )}
                  </label>
                  <div style={{ position: 'relative', display: 'inline-block', width: '300px' }}>
                    <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                      <input
                        ref={modelInputRef}
                        type="text"
                        value={llmSettings?.model ?? ''}
                        onChange={(e) => {
                          const newValue = e.target.value;
                          onChangeLlmSettings?.({ model: newValue });
                          if (llmSettings?.provider === 'ollama' && ollamaModels.length > 0) {
                            setShowModelDropdown(true);
                            setHighlightedIndex(-1);
                          }
                        }}
                        onFocus={() => {
                          if (llmSettings?.provider === 'ollama' && ollamaModels.length > 0) {
                            setShowModelDropdown(true);
                          }
                        }}
                        onKeyDown={(e) => {
                          if (llmSettings?.provider === 'ollama' && ollamaModels.length > 0 && showModelDropdown) {
                            if (e.key === 'ArrowDown') {
                              e.preventDefault();
                              setHighlightedIndex(prev => 
                                prev < filteredModels.length - 1 ? prev + 1 : prev
                              );
                            } else if (e.key === 'ArrowUp') {
                              e.preventDefault();
                              setHighlightedIndex(prev => prev > 0 ? prev - 1 : -1);
                            } else if (e.key === 'Enter' && highlightedIndex >= 0) {
                              e.preventDefault();
                              onChangeLlmSettings?.({ model: filteredModels[highlightedIndex] });
                              setShowModelDropdown(false);
                              setHighlightedIndex(-1);
                            } else if (e.key === 'Escape') {
                              setShowModelDropdown(false);
                              setHighlightedIndex(-1);
                            }
                          }
                        }}
                        placeholder={llmSettings?.provider === 'ollama' ? 'llama3.2' : llmSettings?.provider === 'openai' ? 'gpt-4o-mini' : 'claude-3-5-sonnet-20241022'}
                        style={{ 
                          width: '100%', 
                          padding: '8px 32px 8px 12px', 
                          background: '#1a1a1a', 
                          border: '1px solid #1a1a1a', 
                          borderRadius: '4px', 
                          color: '#00ff41', 
                          fontSize: '13px',
                          boxSizing: 'border-box'
                        }}
                      />
                      {llmSettings?.provider === 'ollama' && (
                        <button
                          type="button"
                          onClick={() => setShowModelDropdown(!showModelDropdown)}
                          style={{
                            position: 'absolute',
                            right: '4px',
                            background: 'transparent',
                            border: 'none',
                            color: '#00ff41',
                            cursor: 'pointer',
                            padding: '4px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '12px'
                          }}
                        >
                          ▼
                        </button>
                      )}
                    </div>
                    {llmSettings?.provider === 'ollama' && showModelDropdown && filteredModels.length > 0 && (
                      <div
                        ref={modelDropdownRef}
                        style={{
                          position: 'absolute',
                          top: '100%',
                          left: 0,
                          right: 0,
                          marginTop: '4px',
                          background: '#1a1a1a',
                          border: '1px solid #2a2a2a',
                          borderRadius: '4px',
                          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.5)',
                          maxHeight: '200px',
                          overflowY: 'auto',
                          zIndex: 1000
                        }}
                      >
                        {filteredModels.map((model, index) => (
                          <button
                            key={index}
                            type="button"
                            onClick={() => {
                              onChangeLlmSettings?.({ model });
                              setShowModelDropdown(false);
                              setHighlightedIndex(-1);
                              modelInputRef.current?.focus();
                            }}
                            onMouseEnter={() => setHighlightedIndex(index)}
                            style={{
                              width: '100%',
                              padding: '8px 12px',
                              background: highlightedIndex === index ? 'rgba(0, 255, 65, 0.15)' : 'transparent',
                              border: 'none',
                              color: '#00ff41',
                              fontSize: '13px',
                              textAlign: 'left',
                              cursor: 'pointer',
                              transition: 'background 0.15s'
                            }}
                          >
                            {model}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <p className="setting-description">
                    {llmSettings?.provider === 'ollama' 
                      ? ollamaModels.length > 0 
                        ? t('settings:modelDescOllama')
                        : t('settings:modelDescOllamaLoading')
                      : t('settings:modelDesc')
                    }
                  </p>
                </div>

                <div className="setting-group">
                  <label>{t('settings:temperature')}</label>
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
                    {t('settings:temperatureDesc')}
                  </p>
                </div>

                <div className="setting-group">
                  <label>{t('settings:maxTokens')}</label>
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
                    {t('settings:maxTokensDesc')}
                  </p>
                </div>
              </>
            )}
          </div>

          <div className="settings-section">
            <h4>{t('settings:about')}</h4>
            <div className="about-info">
              <p><strong>{t('common:appName')}</strong></p>
              <p>{t('settings:appDescription')}</p>
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
                  {t('settings:showAbout')}
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
            {t('settings:close')}
          </button>
        </div>
      </div>
    </div>
  );
});

