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
  terminalBufferLimit,
  maxOutputSize,
  terminalFontSize,
  terminalFontFamily,
  uiFontFamily,
  llmSettings,
  reconnectRetry,
  onChangeTheme,
  onChangeScrollbackLines,
  onChangeTerminalBufferLimit,
  onChangeMaxOutputSize,
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
  const [showProviderDropdown, setShowProviderDropdown] = useState(false);
  const modelInputRef = useRef(null);
  const modelDropdownRef = useRef(null);
  const providerDropdownRef = useRef(null);
  const { t, i18n } = useTranslation(['settings', 'common']);

  // Fetch Ollama models when provider is ollama and baseURL is set
  useEffect(() => {
    let cancelled = false;

    // Helper function to check if baseURL is an Ollama URL
    const isOllamaURL = (url) => {
      if (!url) return false;
      // Check if URL contains ollama-specific patterns
      // Ollama typically runs on localhost with port 11434 or custom ports
      try {
        const urlObj = new URL(url);
        // Check if it's a known Ollama endpoint pattern
        // OpenAI: api.openai.com, Anthropic: api.anthropic.com
        const hostname = urlObj.hostname.toLowerCase();
        if (hostname.includes('openai.com') || hostname.includes('anthropic.com')) {
          return false;
        }
        // If it's localhost or 127.0.0.1, likely Ollama
        return hostname === 'localhost' || hostname === '127.0.0.1' || !hostname.includes('.');
      } catch {
        // If URL parsing fails, check if it starts with http://localhost (common Ollama pattern)
        return url.startsWith('http://localhost') || url.startsWith('http://127.0.0.1');
      }
    };

    // Helper function to check if provider supports model listing
    const supportsModelListing = (provider) => {
      return provider === 'ollama' || provider === 'ash';
    };

    // Early return if provider doesn't support model listing
    if (!supportsModelListing(llmSettings?.provider)) {
      setOllamaModels([]);
      setFilteredModels([]);
      setIsLoadingModels(false);
      return;
    }

    // For ash provider, use /v1/tags endpoint
    if (llmSettings?.provider === 'ash') {
      // Capture current values to avoid closure issues
      const currentProvider = llmSettings.provider;
      const currentBaseURL = llmSettings.baseURL;
      const currentEnabled = llmSettings.enabled;

      // Don't fetch if not enabled
      if (!currentEnabled) {
        setOllamaModels([]);
        setFilteredModels([]);
        setIsLoadingModels(false);
        return;
      }

      const fetchAshModels = async () => {
        if (cancelled || currentProvider !== 'ash') {
          setOllamaModels([]);
          setFilteredModels([]);
          setIsLoadingModels(false);
          return;
        }

        setIsLoadingModels(true);
        try {
          const baseURL = currentBaseURL.endsWith('/v1') ? currentBaseURL : `${currentBaseURL.replace(/\/$/, '')}/v1`;
          const url = `${baseURL}/tags`;

          // Build headers
          const headers = {
            'Content-Type': 'application/json',
          };
          const apiKey = llmSettings?.apiKey;
          if (apiKey) {
            headers['X-API-Key'] = apiKey;
          }

          const response = await fetch(url, {
            method: 'GET',
            headers: headers
          });

          if (cancelled || currentProvider !== 'ash') {
            return;
          }

          if (response.ok) {
            const data = await response.json();
            // OpenAI-compatible format: { data: [{ id: "model1", ... }, ...] }
            // Ollama native format: { models: [{ name: "model1", ... }, ...] }
            const models = data.data || data.models || [];
            if (Array.isArray(models)) {
              const modelNames = models.map(model => model.id || model.name || model.model || model).filter(Boolean);
              setOllamaModels(modelNames);
              setFilteredModels(modelNames);
            }
          } else {
            setOllamaModels([]);
            setFilteredModels([]);
          }
        } catch (error) {
          if (!cancelled && currentProvider === 'ash') {
            console.debug('Failed to fetch Ash models:', error);
          }
          setOllamaModels([]);
          setFilteredModels([]);
        } finally {
          if (!cancelled && currentProvider === 'ash') {
            setIsLoadingModels(false);
          }
        }
      };

      const timeoutId = setTimeout(fetchAshModels, 500);
      return () => {
        cancelled = true;
        clearTimeout(timeoutId);
      };
    }

    // For ollama provider, use existing logic
    if (llmSettings?.provider !== 'ollama' || !isOllamaURL(llmSettings?.baseURL)) {
      setOllamaModels([]);
      setFilteredModels([]);
      setIsLoadingModels(false);
      return;
    }

    // Capture current values to avoid closure issues
    const currentProvider = llmSettings.provider;
    const currentBaseURL = llmSettings.baseURL;
    const currentEnabled = llmSettings.enabled;

    // Don't fetch if not enabled
    if (!currentEnabled) {
      setOllamaModels([]);
      setFilteredModels([]);
      setIsLoadingModels(false);
      return;
    }

    const fetchOllamaModels = async () => {
      // Double-check everything before fetching
      if (cancelled || currentProvider !== 'ollama' || !isOllamaURL(currentBaseURL)) {
        setOllamaModels([]);
        setFilteredModels([]);
        setIsLoadingModels(false);
        return;
      }

      setIsLoadingModels(true);
      try {
        const url = `${currentBaseURL}/api/tags`;
        const response = await fetch(url, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          }
        });

        // Check if cancelled after async operation
        if (cancelled || currentProvider !== 'ollama') {
          return;
        }

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
        // Silently fail - don't log CORS errors for non-Ollama providers
        if (!cancelled && currentProvider === 'ollama') {
          console.debug('Failed to fetch Ollama models:', error);
        }
        setOllamaModels([]);
        setFilteredModels([]);
      } finally {
        if (!cancelled && currentProvider === 'ollama') {
          setIsLoadingModels(false);
        }
      }
    };

    // Debounce the fetch
    const timeoutId = setTimeout(fetchOllamaModels, 500);
    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
    };
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
      if (
        providerDropdownRef.current &&
        !providerDropdownRef.current.contains(event.target)
      ) {
        setShowProviderDropdown(false);
      }
    };

    if (showModelDropdown || showProviderDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showModelDropdown, showProviderDropdown]);

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
                className="settings-select"
                style={{ width: '200px' }}
              >
                <option value="en">English</option>
                <option value="ko">한국어</option>
                <option value="ja">日本語</option>
                <option value="vi">Tiếng Việt</option>
                <option value="zh">中文</option>
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
                className="settings-input"
                style={{ width: '150px' }}
              />
              <p className="setting-description">
                {t('settings:scrollbackLinesDesc')}
                {' '}{t('settings:scrollbackLinesCurrent')}: ~{Math.round(scrollbackLines * 80 * 10 / 1024 / 1024 * 10) / 10}{t('settings:scrollbackLinesMB')}
              </p>
            </div>

            <div className="setting-group">
              <label>{t('settings:terminalBufferLimit') || 'Output Buffer Limit (Chunks)'}</label>
              <input
                type="number"
                min="10"
                max="10000"
                step="10"
                value={terminalBufferLimit || 500}
                onChange={onChangeTerminalBufferLimit}
                className="settings-input"
                style={{ width: '150px' }}
              />
              <p className="setting-description">
                {t('settings:terminalBufferLimitDesc') || 'Limit the number of data chunks buffered when terminal is not ready (Default: 500)'}
              </p>
            </div>

            <div className="setting-group">
              <label>{t('settings:maxOutputSize') || 'Max Command Output Limit (MB)'}</label>
              <input
                type="number"
                min="0.1"
                max="100"
                step="0.1"
                value={(maxOutputSize || 1024 * 1024) / (1024 * 1024)} // Convert bytes to MB for display
                onChange={(e) => {
                  const mb = parseFloat(e.target.value);
                  if (!isNaN(mb) && mb > 0) {
                    // Convert MB to bytes for handler
                    onChangeMaxOutputSize && onChangeMaxOutputSize({ target: { value: Math.floor(mb * 1024 * 1024) } });
                  }
                }}
                className="settings-input"
                style={{ width: '150px' }}
              />
              <p className="setting-description">
                {t('settings:maxOutputSizeDesc') || 'Limit the maximum output size for SSH execution commands (Default: 1MB)'}
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
                className="settings-input"
                style={{ width: '100px' }}
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
                className="settings-select"
                style={{ width: '300px' }}
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
                className="settings-select"
                style={{ width: '300px' }}
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
                  className={`settings-toggle-switch ${reconnectRetry?.enabled !== false ? 'active' : ''}`}
                  onClick={() => onChangeReconnectRetry?.({ enabled: !reconnectRetry?.enabled })}
                >
                  <div className="settings-toggle-knob" />
                </div>
                <span className={`settings-toggle-label ${reconnectRetry?.enabled !== false ? 'active' : ''}`}>
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
                    className="settings-input"
                    style={{ width: '150px' }}
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
                    className="settings-input"
                    style={{ width: '150px' }}
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
                  className={`settings-toggle-switch ${llmSettings?.enabled ? 'active' : ''}`}
                  onClick={() => onChangeLlmSettings?.({ enabled: !llmSettings?.enabled })}
                >
                  <div className="settings-toggle-knob" />
                </div>
                <span className={`settings-toggle-label ${llmSettings?.enabled ? 'active' : ''}`}>
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
                  <div style={{ position: 'relative', display: 'inline-block' }}>
                    <button
                      type="button"
                      onClick={() => setShowProviderDropdown(!showProviderDropdown)}
                      className="settings-dropdown"
                    >
                      <span>
                        {llmSettings?.provider === 'ollama'
                          ? 'Ollama (Local)'
                          : 'Ash'}
                      </span>
                      <span className={`settings-dropdown-arrow ${showProviderDropdown ? 'open' : ''}`}>
                        ▼
                      </span>
                    </button>
                    {showProviderDropdown && (
                      <div
                        ref={providerDropdownRef}
                        className="settings-dropdown-menu"
                      >
                        <button
                          type="button"
                          onClick={() => {
                            const provider = 'ollama';
                            const updates = { provider };
                            // Always reset baseURL to Ollama default when switching to Ollama
                            // unless it's already an Ollama URL
                            const currentBaseURL = llmSettings?.baseURL || '';
                            if (!currentBaseURL ||
                              currentBaseURL.includes('openai.com') ||
                              currentBaseURL.includes('anthropic.com')) {
                              updates.baseURL = 'http://localhost:11434';
                            }
                            if (!llmSettings?.model ||
                              llmSettings?.model.includes('claude')) {
                              updates.model = 'llama3.2';
                            }
                            onChangeLlmSettings?.(updates);
                            setShowProviderDropdown(false);
                          }}
                          className={`settings-dropdown-item ${llmSettings?.provider === 'ollama' ? 'active' : ''}`}
                        >
                          Ollama (Local)
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const provider = 'ash';
                            const updates = { provider };
                            if (!llmSettings?.baseURL ||
                              llmSettings?.baseURL === 'http://localhost:11434' ||
                              llmSettings?.baseURL.includes('openai.com') ||
                              llmSettings?.baseURL.includes('anthropic.com')) {
                              updates.baseURL = 'https://ash.toktoktalk.com/v1';
                            }
                            if (!llmSettings?.model ||
                              llmSettings?.model === 'llama3.2' ||
                              llmSettings?.model.includes('claude')) {
                              updates.model = 'qwen3:14b';
                            }
                            onChangeLlmSettings?.(updates);
                            setShowProviderDropdown(false);
                          }}
                          className={`settings-dropdown-item ${llmSettings?.provider === 'ash' ? 'active' : ''}`}
                        >
                          Ash
                        </button>
                      </div>
                    )}
                  </div>
                  <p className="setting-description">
                    {t('settings:providerDesc')}
                  </p>
                </div>

                {llmSettings?.provider === 'ash' && (
                  <div className="setting-group">
                    <label>{t('settings:apiKey')}</label>
                    <input
                      type="password"
                      value={llmSettings?.apiKey || ''}
                      onChange={(e) => onChangeLlmSettings?.({ apiKey: e.target.value })}
                      placeholder="Optional API key"
                      className="settings-input"
                      style={{ width: '400px' }}
                    />
                    <p className="setting-description">
                      Optional API key for Ash provider
                    </p>
                  </div>
                )}

                <div className="setting-group">
                  <label>{t('settings:baseURL')}</label>
                  <input
                    type="text"
                    value={llmSettings?.baseURL || ''}
                    onChange={(e) => onChangeLlmSettings?.({ baseURL: e.target.value })}
                    placeholder={
                      llmSettings?.provider === 'ollama'
                        ? 'http://localhost:11434'
                        : 'https://ash.toktoktalk.com/v1'
                    }
                    className="settings-input"
                    style={{ width: '400px' }}
                  />
                  <p className="setting-description">
                    {t('settings:baseURLDesc')}
                  </p>
                </div>

                <div className="setting-group">
                  <label>
                    {t('settings:model')}
                    {(llmSettings?.provider === 'ollama' || llmSettings?.provider === 'ash') && ollamaModels.length > 0 && (
                      <span className="setting-description" style={{ marginLeft: '8px', fontSize: '11px', display: 'inline', fontWeight: 'normal' }}>
                        ({ollamaModels.length} {t('settings:available')})
                      </span>
                    )}
                    {(llmSettings?.provider === 'ollama' || llmSettings?.provider === 'ash') && isLoadingModels && (
                      <span className="setting-description" style={{ marginLeft: '8px', fontSize: '11px', display: 'inline', fontWeight: 'normal' }}>
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
                          if ((llmSettings?.provider === 'ollama' || llmSettings?.provider === 'ash') && ollamaModels.length > 0) {
                            setShowModelDropdown(true);
                            setHighlightedIndex(-1);
                          }
                        }}
                        onFocus={() => {
                          if ((llmSettings?.provider === 'ollama' || llmSettings?.provider === 'ash') && ollamaModels.length > 0) {
                            setShowModelDropdown(true);
                          }
                        }}
                        onKeyDown={(e) => {
                          if ((llmSettings?.provider === 'ollama' || llmSettings?.provider === 'ash') && ollamaModels.length > 0 && showModelDropdown) {
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
                        placeholder={llmSettings?.provider === 'ollama' ? 'llama3.2' : 'qwen3:14b'}
                        className="settings-input"
                        style={{
                          width: '100%',
                          paddingRight: '32px',
                          boxSizing: 'border-box'
                        }}
                      />
                      {(llmSettings?.provider === 'ollama' || llmSettings?.provider === 'ash') && (
                        <button
                          type="button"
                          onClick={() => setShowModelDropdown(!showModelDropdown)}
                          className={`settings-dropdown-arrow ${showModelDropdown ? 'open' : ''}`}
                          style={{
                            position: 'absolute',
                            right: '4px',
                            background: 'transparent',
                            border: 'none',
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
                    {(llmSettings?.provider === 'ollama' || llmSettings?.provider === 'ash') && showModelDropdown && filteredModels.length > 0 && (
                      <div
                        ref={modelDropdownRef}
                        className="settings-dropdown-menu"
                        style={{
                          right: 0,
                          maxHeight: '200px',
                          overflowY: 'auto'
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
                            className={`settings-dropdown-item ${highlightedIndex === index ? 'active' : ''}`}
                          >
                            {model}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <p className="setting-description">
                    {(llmSettings?.provider === 'ollama' || llmSettings?.provider === 'ash')
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
                    className="settings-input"
                    style={{ width: '100px' }}
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
                    className="settings-input"
                    style={{ width: '100px' }}
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

