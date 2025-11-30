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
  const [mode, setMode] = useState('ask');
  const [showModeDropdown, setShowModeDropdown] = useState(false);
  const inputRef = useRef(null);
  const modeDropdownRef = useRef(null);

  // Focus input when component becomes visible
  useEffect(() => {
    if (isVisible && inputRef.current) {
      // Small delay to ensure DOM is ready
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
  }, [isVisible]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (modeDropdownRef.current && !modeDropdownRef.current.contains(event.target)) {
        setShowModeDropdown(false);
      }
    };

    if (showModeDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [showModeDropdown]);

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      if (showModeDropdown) {
        setShowModeDropdown(false);
      } else {
        onClose();
      }
    } else if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (input.trim() && !isProcessing) {
        onExecute(input.trim(), mode);
      }
    }
  };

  const handleExecute = useCallback(() => {
    if (input.trim() && !isProcessing) {
      const command = input.trim();
      const selectedMode = mode;
      setInput(''); // Clear input after execution
      onExecute(command, selectedMode);
    }
  }, [input, mode, isProcessing, onExecute]);

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
        <div style={{ position: 'relative', display: 'inline-block' }}>
          <button
            type="button"
            onClick={() => setShowModeDropdown(!showModeDropdown)}
            disabled={isProcessing}
            style={{
              padding: '6px 24px 6px 12px',
              background: '#1a1a1a',
              border: '1px solid rgba(0, 255, 65, 0.3)',
              borderRadius: '4px',
              color: '#00ff41',
              fontSize: '12px',
              fontWeight: '600',
              cursor: isProcessing ? 'not-allowed' : 'pointer',
              fontFamily: 'var(--ui-font-family)',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              opacity: isProcessing ? 0.6 : 1,
              position: 'relative',
              minWidth: '80px'
            }}
            title="Select AI mode: ask (simple) or agent (multi-step)"
          >
            <span>{mode === 'ask' ? 'ask' : 'agent'}</span>
            <span style={{
              fontSize: '10px',
              position: 'absolute',
              right: '6px',
              top: '50%',
              transform: 'translateY(-50%)'
            }}>▲</span>
          </button>
          {showModeDropdown && (
            <div
              ref={modeDropdownRef}
              style={{
                position: 'absolute',
                bottom: '100%',
                left: 0,
                marginBottom: '4px',
                background: '#1a1a1a',
                border: '1px solid #2a2a2a',
                borderRadius: '4px',
                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.5)',
                zIndex: 1000,
                minWidth: '100px'
              }}
            >
              <button
                type="button"
                onClick={() => {
                  setMode('ask');
                  setShowModeDropdown(false);
                }}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  background: mode === 'ask' ? 'rgba(0, 255, 65, 0.15)' : 'transparent',
                  border: 'none',
                  color: '#00ff41',
                  fontSize: '12px',
                  textAlign: 'left',
                  cursor: 'pointer',
                  transition: 'background 0.15s'
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(0, 255, 65, 0.1)'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = mode === 'ask' ? 'rgba(0, 255, 65, 0.15)' : 'transparent'}
              >
                ask
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode('agent');
                  setShowModeDropdown(false);
                }}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  background: mode === 'agent' ? 'rgba(0, 255, 65, 0.15)' : 'transparent',
                  border: 'none',
                  color: '#00ff41',
                  fontSize: '12px',
                  textAlign: 'left',
                  cursor: 'pointer',
                  transition: 'background 0.15s'
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(0, 255, 65, 0.1)'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = mode === 'agent' ? 'rgba(0, 255, 65, 0.15)' : 'transparent'}
              >
                agent
              </button>
            </div>
          )}
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
            background: 'transparent',
            border: '1px solid rgba(0, 255, 65, 0.3)',
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
            background: input.trim() && !isProcessing ? 'rgba(0, 255, 65, 0.8)' : 'rgba(26, 26, 26, 0.3)',
            border: `1px solid ${input.trim() && !isProcessing ? '#00ff41' : 'rgba(0, 255, 65, 0.3)'}`,
            borderRadius: '4px',
            color: input.trim() && !isProcessing ? '#000' : '#00ff41',
            cursor: input.trim() && !isProcessing ? 'pointer' : 'not-allowed',
            fontSize: '12px',
            fontWeight: '600',
            transition: 'all 0.2s',
            backdropFilter: 'blur(3px)',
            WebkitBackdropFilter: 'blur(3px)'
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
            background: 'rgba(26, 26, 26, 0.3)',
            border: '1px solid rgba(0, 255, 65, 0.3)',
            borderRadius: '4px',
            color: '#00ff41',
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
          title="Close (Esc)"
        >
          ×
        </button>
      </div>
    </div>
  );
});

