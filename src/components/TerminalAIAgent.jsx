import React, { useState, useRef, useEffect, memo, useCallback } from 'react';

/**
 * Terminal AI Agent component - Intelligent diagnosis agent
 */
export const TerminalAIAgent = memo(function TerminalAIAgent({
  terminal,
  isVisible,
  onClose,
  onExecute,
  isProcessing = false,
  progress = null
}) {
  const [input, setInput] = useState('');
  const inputRef = useRef(null);

  // Focus input when component becomes visible
  useEffect(() => {
    if (isVisible && inputRef.current && !isProcessing) {
      inputRef.current.focus();
    }
  }, [isVisible, isProcessing]);

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    } else if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (input.trim() && !isProcessing) {
        onExecute(input.trim());
        setInput(''); // Clear input after execution
      }
    }
  };

  const handleExecute = useCallback(() => {
    if (input.trim() && !isProcessing) {
      onExecute(input.trim());
      setInput(''); // Clear input after execution
    }
  }, [input, isProcessing, onExecute]);

  if (!isVisible) {
    return null;
  }

  const getPhaseColor = (phase) => {
    switch (phase) {
      case 'planning': return '#00aaff';
      case 'executing': return '#00ff41';
      case 'analyzing': return '#ffaa00';
      case 'replanning': return '#ff6600';
      case 'reporting': return '#aa00ff';
      case 'complete': return '#00ff41';
      default: return '#00ff41';
    }
  };

  const getPhaseIcon = (phase) => {
    switch (phase) {
      case 'planning': return '📋';
      case 'executing': return '⚙️';
      case 'analyzing': return '🔍';
      case 'replanning': return '🔄';
      case 'reporting': return '📊';
      case 'complete': return '✅';
      case 'generating': return '⚡';
      default: return '🤖';
    }
  };

  return (
    <div className="terminal-ai-agent">
      <div className="ai-agent-container">
        {/* Input section */}
        {!isProcessing && (
          <div className="ai-input-group">
            <div className="ai-input-label">
              <span style={{ color: '#00ff41', fontSize: '12px', fontWeight: '600' }}>Agent:</span>
            </div>
            <input
              ref={inputRef}
              type="text"
              className="ai-input"
              placeholder="Describe what you want to do... (e.g., 'list files' or 'diagnose router status')"
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
                fontFamily: 'var(--ui-font-family)'
              }}
            />
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
              Start
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
        )}

        {/* Progress section */}
        {isProcessing && progress && (
          <div className="ai-progress-section">
            <div className="ai-progress-header">
              <span style={{ 
                color: getPhaseColor(progress.phase),
                fontSize: '14px',
                fontWeight: '600',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <span>{getPhaseIcon(progress.phase)}</span>
                <span>{progress.message}</span>
              </span>
              <button
                onClick={onClose}
                style={{
                  padding: '4px 8px',
                  background: 'rgba(255, 0, 0, 0.2)',
                  border: '1px solid rgba(255, 0, 0, 0.5)',
                  borderRadius: '4px',
                  color: '#ff6666',
                  cursor: 'pointer',
                  fontSize: '11px',
                  fontWeight: '600'
                }}
                title="Cancel"
              >
                Cancel
              </button>
            </div>

            {/* Current step info */}
            {progress.step && (
              <div className="ai-step-info" style={{
                marginTop: '8px',
                padding: '8px',
                background: 'rgba(0, 255, 65, 0.05)',
                border: '1px solid rgba(0, 255, 65, 0.2)',
                borderRadius: '4px',
                fontSize: '12px',
                color: '#00ff41'
              }}>
                <div style={{ fontWeight: '600', marginBottom: '4px' }}>
                  Step {progress.step.step}: {progress.step.purpose}
                </div>
                <div style={{ 
                  fontFamily: 'monospace',
                  color: '#88ff88',
                  fontSize: '11px',
                  wordBreak: 'break-all'
                }}>
                  $ {progress.step.command}
                </div>
              </div>
            )}

            {/* Plan overview */}
            {progress.plan && progress.plan.steps && (
              <div className="ai-plan-overview" style={{
                marginTop: '8px',
                padding: '8px',
                background: 'rgba(0, 170, 255, 0.05)',
                border: '1px solid rgba(0, 170, 255, 0.2)',
                borderRadius: '4px',
                fontSize: '11px',
                color: '#88ccff'
              }}>
                <div style={{ fontWeight: '600', marginBottom: '4px' }}>
                  Plan: {progress.plan.steps.length} steps
                </div>
                <div style={{ 
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: '4px',
                  marginTop: '4px'
                }}>
                  {progress.plan.steps.map((step, idx) => (
                    <span
                      key={idx}
                      style={{
                        padding: '2px 6px',
                        background: progress.step && progress.step.step === step.step
                          ? 'rgba(0, 255, 65, 0.3)'
                          : 'rgba(0, 170, 255, 0.1)',
                        border: `1px solid ${progress.step && progress.step.step === step.step ? '#00ff41' : 'rgba(0, 170, 255, 0.3)'}`,
                        borderRadius: '3px',
                        fontSize: '10px'
                      }}
                    >
                      {step.step}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Execution history count */}
            {progress.history && progress.history.length > 0 && (
              <div style={{
                marginTop: '8px',
                fontSize: '11px',
                color: '#88ff88',
                opacity: 0.7
              }}>
                Executed {progress.history.length} command(s)
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
});

