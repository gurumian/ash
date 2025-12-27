import React, { useState, useRef, useEffect, memo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';

/**
 * Terminal AI Command Input component - Natural language to shell command conversion
 */
export const TerminalAICommandInput = memo(function TerminalAICommandInput({
  terminal,
  isVisible,
  onClose,
  onExecute,
  isProcessing = false
}) {
  const [input, setInput] = useState('');
  const inputRef = useRef(null);
  const { t } = useTranslation('common');

  // Focus input when component becomes visible
  useEffect(() => {
    if (isVisible && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isVisible]);

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    } else if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (input.trim() && !isProcessing) {
        onExecute(input.trim());
      }
    }
  };

  const handleExecute = useCallback(() => {
    if (input.trim() && !isProcessing) {
      onExecute(input.trim());
    }
  }, [input, isProcessing, onExecute]);

  // Debug log
  useEffect(() => {
    console.log('TerminalAICommandInput - isVisible:', isVisible);
  }, [isVisible]);

  if (!isVisible) {
    console.log('TerminalAICommandInput - not visible, returning null');
    return null;
  }

  console.log('TerminalAICommandInput - rendering');

  return (
    <div className="terminal-ai-command-input">
      <div className="ai-input-group">
        <div className="ai-input-label">
          <span style={{ color: 'var(--theme-text)', fontSize: '12px', fontWeight: '600' }}>AI:</span>
        </div>
        <input
          ref={inputRef}
          type="text"
          className="ai-input"
          placeholder={t('common:aiCommandPlaceholder')}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={isProcessing}
          style={{
            flex: 1,
            padding: '8px 12px',
            background: 'transparent',
            border: '1px solid color-mix(in srgb, var(--theme-accent) 30%, transparent)',
            borderRadius: '4px',
            color: 'var(--theme-text)',
            fontSize: '13px',
            fontFamily: 'var(--ui-font-family)',
            opacity: isProcessing ? 0.6 : 1
          }}
        />
        {isProcessing && (
          <div className="ai-processing-indicator" style={{ 
            marginLeft: '8px', 
            color: 'var(--theme-text)', 
            fontSize: '12px',
            display: 'flex',
            alignItems: 'center',
            gap: '4px'
          }}>
            <span style={{ 
              display: 'inline-block',
              width: '12px',
              height: '12px',
              border: '2px solid var(--theme-accent)',
              borderTopColor: 'transparent',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite'
            }} />
            {t('common:processing')}
          </div>
        )}
        <button
          className="ai-execute-btn"
          onClick={handleExecute}
          disabled={!input.trim() || isProcessing}
          style={{
            marginLeft: '8px',
            padding: '8px 16px',
            background: input.trim() && !isProcessing ? 'var(--theme-accent)' : 'color-mix(in srgb, var(--theme-surface) 40%, transparent)',
            border: `1px solid ${input.trim() && !isProcessing ? 'var(--theme-accent)' : 'color-mix(in srgb, var(--theme-accent) 30%, transparent)'}`,
            borderRadius: '4px',
            color: input.trim() && !isProcessing ? 'var(--theme-bg)' : 'var(--theme-text)',
            cursor: input.trim() && !isProcessing ? 'pointer' : 'not-allowed',
            fontSize: '12px',
            fontWeight: '600',
            transition: 'all 0.2s',
            backdropFilter: 'blur(3px)',
            WebkitBackdropFilter: 'blur(3px)'
          }}
          title={`${t('common:execute')} (Enter)`}
        >
          {t('common:execute')}
        </button>
        <button
          className="ai-close-btn"
          onClick={onClose}
          style={{
            marginLeft: '8px',
            padding: '8px 12px',
            background: 'color-mix(in srgb, var(--theme-surface) 40%, transparent)',
            border: '1px solid color-mix(in srgb, var(--theme-accent) 30%, transparent)',
            borderRadius: '4px',
            color: 'var(--theme-text)',
            cursor: 'pointer',
            fontSize: '16px',
            lineHeight: '1',
            width: '32px',
            height: '32px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backdropFilter: 'blur(3px)',
            WebkitBackdropFilter: 'blur(3px)'
          }}
          title={`${t('common:close')} (Esc)`}
        >
          ×
        </button>
      </div>
    </div>
  );
});

