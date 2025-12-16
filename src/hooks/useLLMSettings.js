import { useState, useEffect, useRef } from 'react';

/**
 * Custom hook for LLM settings management
 */
export function useLLMSettings() {
  const [llmSettings, setLlmSettings] = useState(() => {
    const saved = localStorage.getItem('ash-llm-settings');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        // Only 'ash' and 'ollama' are supported for now. Normalize legacy values.
        const provider = (parsed.provider === 'ollama' || parsed.provider === 'ash') ? parsed.provider : 'ash';
        return {
          provider,
          apiKey: parsed.apiKey || '',
          baseURL:
            parsed.baseURL ||
            (provider === 'ollama' ? 'http://localhost:11434' : 'https://ash.toktoktalk.com/v1'),
          model:
            parsed.model ||
            (provider === 'ollama' ? 'llama3.2' : 'qwen3:14b'),
          enabled: parsed.enabled !== undefined ? parsed.enabled : false,
          temperature: parsed.temperature !== undefined ? parsed.temperature : 0.7,
          maxTokens: parsed.maxTokens !== undefined ? parsed.maxTokens : 1000
        };
      } catch (e) {
        console.error('Failed to parse LLM settings from localStorage:', e);
        return getDefaultSettings();
      }
    }
    return getDefaultSettings();
  });

  const isInitialLoad = useRef(true);

  // Default settings
  function getDefaultSettings() {
    return {
      provider: 'ash',
      apiKey: '',
      baseURL: 'https://ash.toktoktalk.com/v1',
      model: 'qwen3:14b',
      enabled: false,
      temperature: 0.7,
      maxTokens: 1000
    };
  }

  // Sync to localStorage whenever settings change (skip initial mount)
  useEffect(() => {
    if (isInitialLoad.current) {
      isInitialLoad.current = false;
      return; // Skip on initial mount
    }
    localStorage.setItem('ash-llm-settings', JSON.stringify(llmSettings));
  }, [llmSettings]);

  // Update settings
  const updateLlmSettings = (updates) => {
    setLlmSettings(prev => {
      const updated = { ...prev, ...updates };
      // Only auto-update baseURL/model when provider changes, not when user clears the field
      // Provider change is handled in Settings.jsx, so we don't auto-fill here
      // This allows users to clear and type new values without interference
      return updated;
    });
  };

  // Reset to defaults
  const resetLlmSettings = () => {
    const defaults = getDefaultSettings();
    setLlmSettings(defaults);
    localStorage.setItem('ash-llm-settings', JSON.stringify(defaults));
  };

  return {
    llmSettings,
    updateLlmSettings,
    resetLlmSettings
  };
}

