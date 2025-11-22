import React, { useState, useRef, useEffect, memo, useCallback } from 'react';

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
          <span style={{ color: '#00ff41', fontSize: '12px', fontWeight: '600' }}>AI:</span>
        </div>
        <input
          ref={inputRef}
          type="text"
          className="ai-input"
          placeholder="Describe what you want to do... (e.g., 'find all jpg files in current directory')"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={isProcessing}
          style={{
            flex: 1,
            padding: '8px 12px',
            background: '#1a1a1a',
            border: '1px solid #00ff41',
            borderRadius: '4px',
            color: '#00ff41',
            fontSize: '13px',
            fontFamily: 'var(--ui-font-family)',
            opacity: isProcessing ? 0.6 : 1
          }}
        />
        {isProcessing && (
          <div className="ai-processing-indicator" style={{ 
            marginLeft: '8px', 
            color: '#00ff41', 
            fontSize: '12px',
            display: 'flex',
            alignItems: 'center',
            gap: '4px'
          }}>
            <span style={{ 
              display: 'inline-block',
              width: '12px',
              height: '12px',
              border: '2px solid #00ff41',
              borderTopColor: 'transparent',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite'
            }} />
            Processing...
          </div>
        )}
        <button
          className="ai-execute-btn"
          onClick={handleExecute}
          disabled={!input.trim() || isProcessing}
          style={{
            marginLeft: '8px',
            padding: '8px 16px',
            background: input.trim() && !isProcessing ? '#00ff41' : '#1a1a1a',
            border: `1px solid ${input.trim() && !isProcessing ? '#00ff41' : '#1a1a1a'}`,
            borderRadius: '4px',
            color: input.trim() && !isProcessing ? '#000' : '#555',
            cursor: input.trim() && !isProcessing ? 'pointer' : 'not-allowed',
            fontSize: '12px',
            fontWeight: '600',
            transition: 'all 0.2s'
          }}
          title="Execute (Enter)"
        >
          Execute
        </button>
        <button
          className="ai-close-btn"
          onClick={onClose}
          style={{
            marginLeft: '8px',
            padding: '8px 12px',
            background: 'transparent',
            border: '1px solid #1a1a1a',
            borderRadius: '4px',
            color: '#00ff41',
            cursor: 'pointer',
            fontSize: '16px',
            lineHeight: '1',
            width: '32px',
            height: '32px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
          title="Close (Esc)"
        >
          ×
        </button>
      </div>
    </div>
  );
});

