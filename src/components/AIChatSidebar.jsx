import React, { memo, useState, useEffect, useRef, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import { visit } from 'unist-util-visit';
import { ThinkingSection } from './ThinkingSection';
import { FunctionResultsSection } from './FunctionResultsSection';
import { parseAndCleanContent } from '../utils/parseFunctionResult';

/**
 * AI Chat Sidebar - Displays AI conversation history and input
 */
export const AIChatSidebar = memo(function AIChatSidebar({
  isVisible,
  width,
  messages,
  isProcessing,
  streamingToolResult, // Current executing tool result (stdout/stderr)
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
          messages.map((msg, index) => {
            // Separate thinking/reasoning from tool execution results
            // Parse function results, thinking, plan, and todos from content
            const { functionResults, cleanedContent, thinking, plan, todos } = parseAndCleanContent(msg.content || '');
            
            // Tool results from array (these are actual executed commands)
            // Show toolResults array first (actual execution), then functionResults from content (thinking)
            const allToolResults = [];
            
            // First priority: toolResults array (actual executed commands)
            if (msg.toolResults && msg.toolResults.length > 0) {
              msg.toolResults.forEach(toolResult => {
                allToolResults.push({
                  ...toolResult,
                  source: 'execution' // Mark as actual execution
                });
              });
            }
            
            // Second: functionResults from content (thinking/reasoning, may include planned executions)
            // Only add if not already in toolResults to avoid duplication
            functionResults.forEach(funcResult => {
              // Check if this result is already in toolResults
              const alreadyExists = msg.toolResults && msg.toolResults.some(tr => 
                tr.name === funcResult.name && 
                tr.stdout === funcResult.stdout && 
                tr.stderr === funcResult.stderr
              );
              
              if (!alreadyExists) {
                allToolResults.push({
                  name: funcResult.name,
                  success: funcResult.success,
                  exitCode: funcResult.exitCode,
                  stdout: funcResult.stdout,
                  stderr: funcResult.stderr,
                  source: 'thinking' // Mark as from thinking/reasoning
                });
              }
            });
            
            // Legacy: single toolResult (for backward compatibility)
            if (msg.toolResult && !msg.toolResults) {
              allToolResults.push({
                ...msg.toolResult,
                source: 'legacy'
              });
            }
            
            return (
            <div
              key={msg.id || `msg-${msg.role}-${index}`}
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
              
              {/* Thinking Section - Fixed height, collapsible */}
              {msg.role === 'assistant' && (thinking || plan || (todos && todos.length > 0)) && (
                <ThinkingSection
                  thinking={thinking}
                  plan={plan}
                  todos={todos}
                  messageId={msg.id || `msg-${index}`}
                />
              )}
              
              <div
                style={{
                  color: '#00ff41',
                  fontSize: '13px',
                  lineHeight: '1.6',
                  fontFamily: 'var(--ui-font-family)'
                }}
              >
                <ReactMarkdown
                  remarkPlugins={[
                    // Custom plugin to unwrap code blocks from paragraphs at Markdown AST level
                    // This prevents <p><pre> hydration errors by removing paragraphs that contain code blocks
                    () => {
                      return (tree) => {
                        visit(tree, 'paragraph', (node, index, parent) => {
                          if (!parent || typeof index !== 'number' || !parent.children) return;
                          
                          // Check if paragraph contains block-like content that shouldn't be in <p>
                          const hasBlockLike = node.children?.some((child) => {
                            // Fenced code block (```language)
                            if (child.type === 'code') return true;
                            
                            // HTML content with <pre>, <div>, or <code> tags (defensive check)
                            if (
                              child.type === 'html' &&
                              /<(pre|div|code)[\s>]/i.test(child.value || '')
                            ) {
                              return true;
                            }
                            
                            return false;
                          });
                          
                          if (!hasBlockLike) return;
                          
                          // Unwrap: remove paragraph and promote its children to parent level
                          parent.children.splice(index, 1, ...(node.children || []));
                        });
                      };
                    }
                  ]}
                  components={{
                    // Customize markdown components to match terminal theme
                    p: ({ children, ...props }) => {
                      return (
                        <p style={{ margin: '0 0 8px 0' }} {...props}>
                          {children}
                        </p>
                      );
                    },
                    h1: ({ children }) => <h1 style={{ fontSize: '18px', margin: '12px 0 8px 0', fontWeight: '600' }}>{children}</h1>,
                    h2: ({ children }) => <h2 style={{ fontSize: '16px', margin: '10px 0 6px 0', fontWeight: '600' }}>{children}</h2>,
                    h3: ({ children }) => <h3 style={{ fontSize: '14px', margin: '8px 0 4px 0', fontWeight: '600' }}>{children}</h3>,
                    code: ({ inline, className, children, ...props }) => {
                      // Check if this is a fenced code block (has language class)
                      const match = /language-(\w+)/.exec(className || '');
                      
                      // Inline code (``name``)
                      if (inline || !match) {
                        return (
                          <code 
                            {...props} 
                            className={className}
                            style={{
                              background: 'rgba(0, 255, 65, 0.1)',
                              padding: '2px 4px',
                              borderRadius: '3px',
                              fontFamily: 'monospace',
                              fontSize: '12px'
                            }}
                          >
                            {children}
                          </code>
                        );
                      }
                      
                      // Fenced code block (```language)
                      return (
                        <pre
                          style={{
                            background: 'rgba(0, 255, 65, 0.05)',
                            border: '1px solid rgba(0, 255, 65, 0.2)',
                            borderRadius: '4px',
                            padding: '8px',
                            overflow: 'auto',
                            margin: '8px 0',
                            fontSize: '12px'
                          }}
                          {...props}
                        >
                          <code 
                            className={className}
                            style={{
                              fontFamily: 'monospace',
                              fontSize: '12px',
                              color: '#00ff41'
                            }}
                          >
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
                  {cleanedContent}
                </ReactMarkdown>
              </div>
              
              {/* Function Results Section - Fixed height, collapsible */}
              {allToolResults.length > 0 && (
                <FunctionResultsSection
                  toolResults={allToolResults.filter(tr => tr.source === 'execution' || tr.source === 'legacy')}
                  messageId={msg.id || `msg-${index}`}
                />
              )}
            </div>
            );
          })
        )}
        {isProcessing && (
          <div
            style={{
              padding: '12px',
              background: 'rgba(0, 255, 65, 0.02)',
              border: '1px solid rgba(0, 255, 65, 0.1)',
              borderRadius: '6px',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#888', fontSize: '12px' }}>
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
            
            {/* Show streaming tool result stdout/stderr in real-time */}
            {streamingToolResult && (
              <div
                style={{
                  marginTop: '8px',
                  padding: '8px',
                  background: 'rgba(0, 0, 0, 0.3)',
                  border: '1px solid rgba(0, 255, 65, 0.2)',
                  borderRadius: '4px',
                  fontSize: '11px',
                  fontFamily: 'monospace'
                }}
              >
                {streamingToolResult.name && (
                  <div
                    style={{
                      fontSize: '10px',
                      color: '#888',
                      marginBottom: '4px',
                      fontWeight: '600'
                    }}
                  >
                    Executing: {streamingToolResult.name}
                  </div>
                )}
                {streamingToolResult.stdout && (
                  <pre
                    style={{
                      margin: 0,
                      padding: 0,
                      color: '#00ff41',
                      fontSize: '11px',
                      lineHeight: '1.5',
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word',
                      fontFamily: 'monospace',
                      overflow: 'auto',
                      maxHeight: '200px'
                    }}
                  >
                    {streamingToolResult.stdout}
                  </pre>
                )}
                {streamingToolResult.stderr && (
                  <pre
                    style={{
                      margin: streamingToolResult.stdout ? '4px 0 0 0' : 0,
                      padding: 0,
                      color: '#ff4141',
                      fontSize: '11px',
                      lineHeight: '1.5',
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word',
                      fontFamily: 'monospace',
                      overflow: 'auto',
                      maxHeight: '200px'
                    }}
                  >
                    {streamingToolResult.stderr}
                  </pre>
                )}
              </div>
            )}
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* AI Input at bottom */}
      <div
        style={{
          borderTop: '1px solid #1a1a1a',
          padding: '12px',
          background: '#000000',
          flexShrink: 0
        }}
      >
        <div style={{ position: 'relative' }}>
          <textarea
            ref={inputRef}
            placeholder="Describe what you want to do..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isProcessing}
            rows={3}
            style={{
              width: '100%',
              padding: '8px 12px 32px 12px',
              background: 'transparent',
              border: '1px solid rgba(0, 255, 65, 0.3)',
              borderRadius: '4px',
              color: '#00ff41',
              fontSize: '13px',
              fontFamily: 'var(--ui-font-family)',
              opacity: isProcessing ? 0.6 : 1,
              resize: 'none',
              overflowY: 'auto',
              lineHeight: '1.5',
              outline: 'none',
              transition: 'border-color 0.2s'
            }}
            onFocus={(e) => {
              e.target.style.borderColor = '#00ff41';
            }}
            onBlur={(e) => {
              e.target.style.borderColor = 'rgba(0, 255, 65, 0.3)';
            }}
          />
          
          {/* Controls at bottom right of textarea */}
          <div style={{
            position: 'absolute',
            bottom: '4px',
            right: '4px',
            display: 'flex',
            gap: '4px',
            alignItems: 'center'
          }}>
            {/* Mode selector */}
            <div style={{ position: 'relative', display: 'inline-block' }}>
              <button
                type="button"
                onClick={() => setShowModeDropdown(!showModeDropdown)}
                disabled={isProcessing}
                style={{
                  padding: '4px 20px 4px 8px',
                  background: 'rgba(26, 26, 26, 0.8)',
                  border: '1px solid rgba(0, 255, 65, 0.3)',
                  borderRadius: '3px',
                  color: '#00ff41',
                  fontSize: '11px',
                  fontWeight: '600',
                  cursor: isProcessing ? 'not-allowed' : 'pointer',
                  fontFamily: 'var(--ui-font-family)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  opacity: isProcessing ? 0.6 : 1,
                  position: 'relative',
                  minWidth: '60px'
                }}
                title="Select AI mode: ask (simple) or agent (multi-step)"
              >
                <span>{mode === 'ask' ? 'ask' : 'agent'}</span>
                <span style={{
                  fontSize: '8px',
                  position: 'absolute',
                  right: '4px',
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
                      padding: '6px 10px',
                      background: mode === 'ask' ? 'rgba(0, 255, 65, 0.15)' : 'transparent',
                      border: 'none',
                      color: '#00ff41',
                      fontSize: '11px',
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
                      padding: '6px 10px',
                      background: mode === 'agent' ? 'rgba(0, 255, 65, 0.15)' : 'transparent',
                      border: 'none',
                      color: '#00ff41',
                      fontSize: '11px',
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
            
            {/* Execute button */}
            <button
              onClick={handleExecute}
              disabled={!input.trim() || isProcessing}
              style={{
                padding: '4px 8px',
                background: input.trim() && !isProcessing ? 'rgba(0, 255, 65, 0.2)' : 'rgba(26, 26, 26, 0.3)',
                border: `1px solid ${input.trim() && !isProcessing ? '#00ff41' : 'rgba(0, 255, 65, 0.3)'}`,
                borderRadius: '3px',
                color: '#00ff41',
                cursor: input.trim() && !isProcessing ? 'pointer' : 'not-allowed',
                fontSize: '14px',
                lineHeight: '1',
                width: '24px',
                height: '24px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.2s',
                fontFamily: 'var(--ui-font-family)'
              }}
              title="Execute (Enter)"
            >
              ▲
            </button>
          </div>
        </div>
      </div>
    </div>
  );
});

