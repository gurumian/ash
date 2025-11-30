import React, { memo, useState, useEffect, useRef, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';

/**
 * AI Chat Sidebar - Displays AI conversation history and input
 */
export const AIChatSidebar = memo(function AIChatSidebar({
  isVisible,
  width,
  messages,
  isProcessing,
  onClose,
  onExecuteAICommand,
  terminal
}) {
  const messagesEndRef = useRef(null);
  const sidebarRef = useRef(null);
  const inputRef = useRef(null);
  const modeDropdownRef = useRef(null);
  
  const [input, setInput] = useState('');
  const [mode, setMode] = useState('ask');
  const [showModeDropdown, setShowModeDropdown] = useState(false);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  // Focus input when sidebar becomes visible
  useEffect(() => {
    if (isVisible && inputRef.current) {
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
      }
    } else if (e.key === 'Enter' && !e.shiftKey) {
      // Enter without Shift: execute command
      e.preventDefault();
      if (input.trim() && !isProcessing) {
        handleExecute();
      }
    }
    // Shift+Enter: new line (default behavior for textarea)
  };

  const handleExecute = useCallback(() => {
    if (input.trim() && !isProcessing) {
      const command = input.trim();
      const selectedMode = mode;
      setInput(''); // Clear input after execution
      onExecuteAICommand(command, selectedMode);
    }
  }, [input, mode, isProcessing, onExecuteAICommand]);

  if (!isVisible) return null;

  return (
    <div
      ref={sidebarRef}
      className="ai-chat-sidebar"
      style={{
        width: `${width}px`,
        height: '100%',
        background: '#000000',
        borderLeft: '1px solid #1a1a1a',
        display: 'flex',
        flexDirection: 'column',
        flexShrink: 0,
        overflow: 'hidden'
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '12px 16px',
          borderBottom: '1px solid #1a1a1a',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: '#000000'
        }}
      >
        <h3 style={{ margin: 0, fontSize: '13px', fontWeight: '600', color: '#00ff41' }}>
          AI Chat
        </h3>
        <button
          onClick={onClose}
          style={{
            background: 'none',
            border: 'none',
            color: '#00ff41',
            cursor: 'pointer',
            fontSize: '18px',
            lineHeight: '1',
            padding: '4px 8px',
            opacity: 0.7,
            transition: 'opacity 0.2s'
          }}
          onMouseEnter={(e) => e.currentTarget.style.opacity = '1'}
          onMouseLeave={(e) => e.currentTarget.style.opacity = '0.7'}
          title="Close"
        >
          ×
        </button>
      </div>

      {/* Messages */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
          minHeight: 0 // Allow flex shrinking
        }}
      >
        {messages.length === 0 ? (
          <div style={{ color: '#888', fontSize: '12px', textAlign: 'center', marginTop: '40px' }}>
            No messages yet. Start a conversation with AI.
          </div>
        ) : (
          messages.map((msg, index) => (
            <div
              key={msg.id || `${msg.role}-${index}`}
              style={{
                padding: '12px',
                background: msg.role === 'user' ? 'rgba(0, 255, 65, 0.05)' : 'rgba(0, 255, 65, 0.02)',
                border: `1px solid ${msg.role === 'user' ? 'rgba(0, 255, 65, 0.2)' : 'rgba(0, 255, 65, 0.1)'}`,
                borderRadius: '6px',
                wordBreak: 'break-word'
              }}
            >
              <div
                style={{
                  fontSize: '11px',
                  color: '#888',
                  marginBottom: '6px',
                  fontWeight: '600',
                  textTransform: 'uppercase'
                }}
              >
                {msg.role === 'user' ? 'You' : msg.role === 'assistant' ? 'AI' : msg.role}
              </div>
              <div
                style={{
                  color: '#00ff41',
                  fontSize: '13px',
                  lineHeight: '1.6',
                  fontFamily: 'var(--ui-font-family)'
                }}
              >
                <ReactMarkdown
                  components={{
                    // Customize markdown components to match terminal theme
                    p: ({ children, ...props }) => {
                      // ReactMarkdown should not put code blocks inside p, but if it does, handle it
                      const childrenArray = React.Children.toArray(children);
                      const hasBlockElement = childrenArray.some(
                        child => React.isValidElement(child) && 
                        (child.type === 'pre' || child.type === 'div' || child.type === 'ul' || child.type === 'ol')
                      );
                      
                      if (hasBlockElement) {
                        // If contains block elements, render as div instead of p
                        return <div style={{ margin: '0 0 8px 0' }}>{children}</div>;
                      }
                      return <p style={{ margin: '0 0 8px 0' }}>{children}</p>;
                    },
                    h1: ({ children }) => <h1 style={{ fontSize: '18px', margin: '12px 0 8px 0', fontWeight: '600' }}>{children}</h1>,
                    h2: ({ children }) => <h2 style={{ fontSize: '16px', margin: '10px 0 6px 0', fontWeight: '600' }}>{children}</h2>,
                    h3: ({ children }) => <h3 style={{ fontSize: '14px', margin: '8px 0 4px 0', fontWeight: '600' }}>{children}</h3>,
                    code: ({ inline, className, children, ...props }) => {
                      // Check if this is a code block (not inline)
                      const isCodeBlock = !inline && className?.startsWith('language-');
                      
                      if (inline) {
                        return (
                          <code style={{
                            background: 'rgba(0, 255, 65, 0.1)',
                            padding: '2px 4px',
                            borderRadius: '3px',
                            fontFamily: 'monospace',
                            fontSize: '12px'
                          }}>
                            {children}
                          </code>
                        );
                      }
                      // Code block - return pre directly (ReactMarkdown should not wrap this in p)
                      return (
                        <pre style={{
                          background: 'rgba(0, 255, 65, 0.05)',
                          border: '1px solid rgba(0, 255, 65, 0.2)',
                          borderRadius: '4px',
                          padding: '8px',
                          overflow: 'auto',
                          margin: '8px 0'
                        }}>
                          <code style={{
                            fontFamily: 'monospace',
                            fontSize: '12px',
                            color: '#00ff41'
                          }}>
                            {children}
                          </code>
                        </pre>
                      );
                    },
                    ul: ({ children }) => <ul style={{ margin: '4px 0', paddingLeft: '20px' }}>{children}</ul>,
                    ol: ({ children }) => <ol style={{ margin: '4px 0', paddingLeft: '20px' }}>{children}</ol>,
                    li: ({ children }) => <li style={{ margin: '2px 0' }}>{children}</li>,
                    blockquote: ({ children }) => (
                      <blockquote style={{
                        borderLeft: '3px solid rgba(0, 255, 65, 0.3)',
                        paddingLeft: '12px',
                        margin: '8px 0',
                        color: '#888'
                      }}>
                        {children}
                      </blockquote>
                    ),
                    a: ({ href, children }) => (
                      <a
                        href={href}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          color: '#00ff41',
                          textDecoration: 'underline',
                          textDecorationColor: 'rgba(0, 255, 65, 0.5)'
                        }}
                      >
                        {children}
                      </a>
                    ),
                    strong: ({ children }) => <strong style={{ fontWeight: '600' }}>{children}</strong>,
                    em: ({ children }) => <em style={{ fontStyle: 'italic' }}>{children}</em>,
                    hr: () => <hr style={{ border: 'none', borderTop: '1px solid rgba(0, 255, 65, 0.2)', margin: '12px 0' }} />,
                    table: ({ children }) => (
                      <table style={{
                        borderCollapse: 'collapse',
                        width: '100%',
                        margin: '8px 0',
                        border: '1px solid rgba(0, 255, 65, 0.2)'
                      }}>
                        {children}
                      </table>
                    ),
                    th: ({ children }) => (
                      <th style={{
                        border: '1px solid rgba(0, 255, 65, 0.2)',
                        padding: '6px',
                        background: 'rgba(0, 255, 65, 0.1)',
                        textAlign: 'left'
                      }}>
                        {children}
                      </th>
                    ),
                    td: ({ children }) => (
                      <td style={{
                        border: '1px solid rgba(0, 255, 65, 0.2)',
                        padding: '6px'
                      }}>
                        {children}
                      </td>
                    )
                  }}
                >
                  {msg.content}
                </ReactMarkdown>
              </div>
              {msg.toolResult && (
                <div
                  style={{
                    marginTop: '8px',
                    padding: '8px',
                    background: 'rgba(0, 255, 65, 0.05)',
                    border: '1px solid rgba(0, 255, 65, 0.1)',
                    borderRadius: '4px',
                    fontSize: '11px',
                    color: '#888',
                    fontFamily: 'monospace'
                  }}
                >
                  <div style={{ color: '#00ff41', marginBottom: '4px' }}>Tool: {msg.toolResult.name}</div>
                  <div style={{ color: '#666', whiteSpace: 'pre-wrap' }}>{msg.toolResult.content}</div>
                </div>
              )}
            </div>
          ))
        )}
        {isProcessing && (
          <div
            style={{
              padding: '12px',
              background: 'rgba(0, 255, 65, 0.02)',
              border: '1px solid rgba(0, 255, 65, 0.1)',
              borderRadius: '6px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              color: '#888',
              fontSize: '12px'
            }}
          >
            <span
              style={{
                display: 'inline-block',
                width: '12px',
                height: '12px',
                border: '2px solid #00ff41',
                borderTopColor: 'transparent',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite'
              }}
            />
            AI is thinking...
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* AI Input at bottom - always visible */}
      <div
        style={{
          borderTop: '1px solid #1a1a1a',
          padding: '12px',
          background: '#000000',
          flexShrink: 0
        }}
      >
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {/* Mode selector */}
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
          
          {/* Input field - multiline textarea */}
          <textarea
            ref={inputRef}
            placeholder="Describe what you want to do..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isProcessing}
            rows={1}
            style={{
              flex: 1,
              padding: '8px 12px',
              background: 'transparent',
              border: '1px solid rgba(0, 255, 65, 0.3)',
              borderRadius: '4px',
              color: '#00ff41',
              fontSize: '13px',
              fontFamily: 'var(--ui-font-family)',
              opacity: isProcessing ? 0.6 : 1,
              resize: 'none',
              minHeight: '36px',
              maxHeight: '120px',
              overflowY: 'auto',
              lineHeight: '1.5'
            }}
            onInput={(e) => {
              // Auto-resize textarea based on content
              const textarea = e.target;
              textarea.style.height = 'auto';
              textarea.style.height = `${Math.min(textarea.scrollHeight, 120)}px`;
            }}
          />
          
          {/* Execute button */}
          <button
            onClick={handleExecute}
            disabled={!input.trim() || isProcessing}
            style={{
              padding: '8px 16px',
              background: input.trim() && !isProcessing ? 'rgba(0, 255, 65, 0.8)' : 'rgba(26, 26, 26, 0.3)',
              border: `1px solid ${input.trim() && !isProcessing ? '#00ff41' : 'rgba(0, 255, 65, 0.3)'}`,
              borderRadius: '4px',
              color: input.trim() && !isProcessing ? '#000' : '#00ff41',
              cursor: input.trim() && !isProcessing ? 'pointer' : 'not-allowed',
              fontSize: '12px',
              fontWeight: '600',
              transition: 'all 0.2s',
              fontFamily: 'var(--ui-font-family)'
            }}
            title="Execute (Enter)"
          >
            Execute
          </button>
        </div>
      </div>
    </div>
  );
});

