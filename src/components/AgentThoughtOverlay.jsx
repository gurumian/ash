import React, { memo, useEffect, useRef } from 'react';

/**
 * Agent Thought Overlay - Shows real-time thinking process during agent execution
 */
export const AgentThoughtOverlay = memo(function AgentThoughtOverlay({
  isVisible,
  thought,
  step,
  totalSteps
}) {
  const overlayRef = useRef(null);

  // Auto-scroll to bottom when thought updates
  useEffect(() => {
    if (overlayRef.current) {
      overlayRef.current.scrollTop = overlayRef.current.scrollHeight;
    }
  }, [thought]);

  if (!isVisible) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        width: '600px',
        maxWidth: '90vw',
        maxHeight: '400px',
        backgroundColor: '#1a1a1a',
        border: '1px solid #2a2a2a',
        borderRadius: '8px',
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.7)',
        zIndex: 10001,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden'
      }}
    >
      <div
        style={{
          padding: '12px 16px',
          borderBottom: '1px solid #2a2a2a',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}
      >
        <h3 style={{ margin: 0, fontSize: '14px', fontWeight: '600', color: '#00ff41' }}>
          Agent Thinking
        </h3>
        <span style={{ fontSize: '12px', color: '#888' }}>
          Step {step}/{totalSteps}
        </span>
      </div>
      <div
        ref={overlayRef}
        style={{
          flex: 1,
          padding: '16px',
          overflowY: 'auto',
          color: '#00ff41',
          fontSize: '13px',
          fontFamily: 'var(--ui-font-family)',
          lineHeight: '1.6',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word'
        }}
      >
        {thought || 'Thinking...'}
      </div>
    </div>
  );
});

