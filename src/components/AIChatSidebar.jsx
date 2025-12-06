import React, { memo, useState, useEffect, useRef, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import { visit } from 'unist-util-visit';
import { ThinkingSection } from './ThinkingSection';
import { FunctionResultsSection } from './FunctionResultsSection';
import { parseAndCleanContent } from '../utils/parseFunctionResult';

// Copy icon SVG component - Modern clipboard style (two overlapping rectangles)
const CopyIcon = ({ size = 14, color = '#00ff41' }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 16 16"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    style={{ display: 'inline-block', verticalAlign: 'middle' }}
  >
    {/* Background rectangle (bottom, slightly larger) */}
    <rect
      x="5"
      y="5"
      width="9"
      height="9"
      rx="1"
      stroke={color}
      strokeWidth="1.2"
      fill="none"
      opacity="0.4"
    />
    {/* Foreground rectangle (top, the actual clipboard) */}
    <rect
      x="2"
      y="2"
      width="9"
      height="9"
      rx="1"
      stroke={color}
      strokeWidth="1.2"
      fill="none"
    />
    {/* Small handle/tab on top rectangle */}
    <path
      d="M 4 2 L 4 1 L 6 1 L 6 2"
      stroke={color}
      strokeWidth="1.2"
      fill="none"
      strokeLinecap="round"
    />
  </svg>
);

/**
 * AI Chat Sidebar - Displays AI conversation history and input
 */
export const AIChatSidebar = memo(function AIChatSidebar({
  isVisible,
  width,
  messages,
  isProcessing,
  streamingToolResult, // Current executing tool result (stdout/stderr)
  backendStatus = 'not-ready', // Backend status: 'ready' | 'starting' | 'not-ready'
  onClose,
  onExecuteAICommand,
  terminal,
  conversations = [], // List of conversations for current connection
  activeConversationId = null, // Current active conversation ID
  onSwitchConversation = null, // Function to switch conversation
  onCreateNewConversation = null, // Function to create new conversation
  onDeleteConversation = null, // Function to delete a conversation
  onUpdateConversationTitle = null, // Function to update conversation title
  processingConversations = new Set() // Set of conversation IDs currently being processed
}) {
  const messagesEndRef = useRef(null);
  const sidebarRef = useRef(null);
  const inputRef = useRef(null);
  const modeDropdownRef = useRef(null);
  const titleEditInputRef = useRef(null);
  
  const [input, setInput] = useState('');
  const [mode, setMode] = useState('ask');
  const [showModeDropdown, setShowModeDropdown] = useState(false);
  const [editingConversationId, setEditingConversationId] = useState(null); // ID of conversation being edited
  const [editingTitle, setEditingTitle] = useState(''); // Temporary title during editing

  // Focus input when editing starts
  useEffect(() => {
    if (editingConversationId && titleEditInputRef.current) {
      titleEditInputRef.current.focus();
      titleEditInputRef.current.select();
    }
  }, [editingConversationId]);

  // Check if the active conversation is processing
  const isActiveProcessing = activeConversationId && processingConversations.has(activeConversationId);

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
      if (input.trim() && !isActiveProcessing) {
        handleExecute();
      }
    }
    // Shift+Enter: new line (default behavior for textarea)
  };

  const handleExecute = useCallback(() => {
    if (input.trim() && !isActiveProcessing) {
      const command = input.trim();
      const selectedMode = mode;
      setInput(''); // Clear input after execution
      onExecuteAICommand(command, selectedMode);
    }
  }, [input, mode, isActiveProcessing, onExecuteAICommand]);

  const handleCopy = useCallback(async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      // Optional: Show toast notification (can be enhanced later)
      console.log('Copied to clipboard');
    } catch (err) {
      console.error('Failed to copy:', err);
      // Fallback: use execCommand
      const textArea = document.createElement('textarea');
      textArea.value = text;
      textArea.style.position = 'fixed';
      textArea.style.left = '-999999px';
      document.body.appendChild(textArea);
      textArea.select();
      try {
        document.execCommand('copy');
        console.log('Copied to clipboard (fallback)');
      } catch (e) {
        console.error('Fallback copy failed:', e);
      }
      document.body.removeChild(textArea);
    }
  }, []);

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
          flexDirection: 'column',
          gap: '8px',
          background: '#000000'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <h3 style={{ margin: 0, fontSize: '13px', fontWeight: '600', color: '#00ff41' }}>
              AI Chat
            </h3>
            {/* Backend Status Indicator - Circular Lamp */}
            <div
              style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                backgroundColor: 
                  backendStatus === 'ready' ? '#00ff41' :
                  backendStatus === 'starting' ? '#ffaa00' : '#666',
                boxShadow: 
                  backendStatus === 'ready' ? '0 0 4px rgba(0, 255, 65, 0.5)' :
                  backendStatus === 'starting' ? '0 0 4px rgba(255, 170, 0, 0.5)' : 'none',
                transition: 'background-color 0.3s, box-shadow 0.3s',
                flexShrink: 0
              }}
              title={
                backendStatus === 'ready' ? 'Backend Ready' :
                backendStatus === 'starting' ? 'Backend Starting' : 'Backend Not Ready'
              }
            />
          </div>
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
        
        {/* Conversation Tabs */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 12px',
            borderTop: '1px solid #1a1a1a'
          }}
        >
          {/* Scrollable tabs container */}
          <div
            className="ai-chat-tabs-scroll"
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              overflowX: 'auto',
              overflowY: 'hidden',
              minWidth: 0
            }}
          >
            {conversations.map((conv) => {
                const isActive = conv.id === activeConversationId;
                const isProcessing = processingConversations.has(conv.id);
                const isEditing = editingConversationId === conv.id;
                const displayTitle = conv.title && conv.title.length > 15 
                  ? conv.title.substring(0, 15) + '...' 
                  : conv.title || 'New Chat';
                
                const handleStartEdit = (e) => {
                  e.stopPropagation();
                  setEditingConversationId(conv.id);
                  setEditingTitle(conv.title || '');
                };

                const handleSaveEdit = async () => {
                  if (editingTitle.trim() && onUpdateConversationTitle) {
                    await onUpdateConversationTitle(conv.id, editingTitle.trim());
                  }
                  setEditingConversationId(null);
                  setEditingTitle('');
                };

                const handleCancelEdit = () => {
                  setEditingConversationId(null);
                  setEditingTitle('');
                };

                const handleKeyDown = (e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleSaveEdit();
                  } else if (e.key === 'Escape') {
                    e.preventDefault();
                    handleCancelEdit();
                  }
                };

                return (
                  <div
                    key={conv.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      background: isActive ? 'rgba(0, 255, 65, 0.15)' : 'transparent',
                      border: `1px solid ${isActive ? 'rgba(0, 255, 65, 0.5)' : 'rgba(0, 255, 65, 0.2)'}`,
                      borderRadius: '4px',
                      padding: '0 4px 0 12px',
                      height: '32px',
                      opacity: isActive ? 1 : 0.7,
                      transition: 'all 0.2s',
                      flexShrink: 0,
                      maxWidth: isEditing ? '200px' : '150px',
                      position: 'relative'
                    }}
                    onMouseEnter={(e) => {
                      if (!isActive && !isEditing) {
                        e.currentTarget.style.opacity = '1';
                        e.currentTarget.style.borderColor = 'rgba(0, 255, 65, 0.4)';
                        e.currentTarget.style.background = 'rgba(0, 255, 65, 0.05)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isActive && !isEditing) {
                        e.currentTarget.style.opacity = '0.7';
                        e.currentTarget.style.borderColor = 'rgba(0, 255, 65, 0.2)';
                        e.currentTarget.style.background = 'transparent';
                      }
                    }}
                  >
                    {isEditing ? (
                      <input
                        ref={titleEditInputRef}
                        type="text"
                        value={editingTitle}
                        onChange={(e) => setEditingTitle(e.target.value)}
                        onBlur={handleSaveEdit}
                        onKeyDown={handleKeyDown}
                        style={{
                          background: 'rgba(0, 0, 0, 0.5)',
                          border: '1px solid rgba(0, 255, 65, 0.5)',
                          borderRadius: '3px',
                          color: '#00ff41',
                          fontSize: '11px',
                          padding: '4px 6px',
                          flex: 1,
                          minWidth: 0,
                          outline: 'none',
                          fontFamily: 'inherit'
                        }}
                        autoFocus
                      />
                    ) : (
                      <>
                        <button
                          onClick={() => onSwitchConversation && onSwitchConversation(conv.id)}
                          onDoubleClick={handleStartEdit}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            color: '#00ff41',
                            cursor: 'pointer',
                            fontSize: '11px',
                            padding: '6px 0',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            flex: 1,
                            textAlign: 'left',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}
                          title={`${conv.title || 'New Chat'} (더블클릭하여 편집)`}
                        >
                          {isProcessing && (
                            <span
                              style={{
                                display: 'inline-block',
                                width: '8px',
                                height: '8px',
                                border: '2px solid #00ff41',
                                borderTopColor: 'transparent',
                                borderRadius: '50%',
                                animation: 'spin 1s linear infinite',
                                flexShrink: 0
                              }}
                            />
                          )}
                          {displayTitle}
                        </button>
                        <button
                          onClick={handleStartEdit}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            color: '#00ff41',
                            cursor: 'pointer',
                            fontSize: '12px',
                            lineHeight: '1',
                            padding: '4px 4px',
                            opacity: 0.5,
                            transition: 'opacity 0.2s',
                            flexShrink: 0,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: '16px',
                            height: '16px'
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.opacity = '1';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.opacity = '0.5';
                          }}
                          title="Edit title"
                        >
                          ✎
                        </button>
                      </>
                    )}
                    {!isEditing && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (onDeleteConversation) {
                            onDeleteConversation(conv.id);
                          }
                        }}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: '#00ff41',
                          cursor: 'pointer',
                          fontSize: '16px',
                          lineHeight: '1',
                          padding: '4px 6px',
                          opacity: 0.7,
                          transition: 'opacity 0.2s',
                          flexShrink: 0,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          width: '20px',
                          height: '20px'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.opacity = '1';
                          e.currentTarget.style.color = '#ff4141';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.opacity = '0.7';
                          e.currentTarget.style.color = '#00ff41';
                        }}
                        title="Delete conversation"
                      >
                        ×
                      </button>
                    )}
                  </div>
                );
            })}
          </div>
          
          {/* New Chat button - Fixed on the right */}
          {onCreateNewConversation && (
            <button
              onClick={onCreateNewConversation}
              style={{
                background: 'transparent',
                border: '1px solid rgba(0, 255, 65, 0.3)',
                borderRadius: '4px',
                color: '#00ff41',
                cursor: 'pointer',
                fontSize: '18px',
                lineHeight: '1',
                padding: '6px 10px',
                minWidth: '32px',
                height: '32px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                opacity: 0.8,
                transition: 'all 0.2s',
                flexShrink: 0
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.opacity = '1';
                e.currentTarget.style.borderColor = 'rgba(0, 255, 65, 0.5)';
                e.currentTarget.style.background = 'rgba(0, 255, 65, 0.05)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.opacity = '0.8';
                e.currentTarget.style.borderColor = 'rgba(0, 255, 65, 0.3)';
                e.currentTarget.style.background = 'transparent';
              }}
              title="New Chat"
            >
              +
            </button>
          )}
        </div>
      </div>

      {/* Messages */}
      <div
        className="ai-chat-messages-scroll"
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
            // Note: We keep raw tool data in content for display (styled differently)
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
            
            // Check if this is a completed assistant message (not currently processing)
            const isCompleted = msg.role === 'assistant' && !isActiveProcessing;
            const isLastAssistantMessage = msg.role === 'assistant' && 
              (index === messages.length - 1 || 
               messages.slice(index + 1).every(m => m.role !== 'assistant'));
            const showCopyButton = isCompleted && isLastAssistantMessage && msg.content;
            
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
                      // Helper to recursively process children and style tool result JSON
                      const processChildren = (children) => {
                        if (typeof children === 'string') {
                          // Check if this string contains tool result pattern
                          if (/\[function\]:\s*\{[^}]*"success"/.test(children) || 
                              /\{"success":\s*(?:true|false)[^}]+\}/.test(children)) {
                            // Split by tool result pattern and wrap matches
                            const parts = children.split(/(\[function\]:\s*\{[^}]*"success"[^}]*\}|\{"success":\s*(?:true|false)[^}]+\})/);
                            return parts.map((part, idx) => {
                              if (part && (/\[function\]:\s*\{[^}]*"success"/.test(part) || 
                                  /\{"success":\s*(?:true|false)[^}]+\}/.test(part))) {
                                return (
                                  <span
                                    key={idx}
                                    style={{
                                      color: '#666',
                                      fontStyle: 'italic',
                                      opacity: 0.7,
                                      fontFamily: 'monospace',
                                      fontSize: '11px'
                                    }}
                                  >
                                    {part}
                                  </span>
                                );
                              }
                              return part;
                            }).filter(Boolean);
                          }
                          return children;
                        }
                        if (Array.isArray(children)) {
                          return children.flatMap((child, idx) => {
                            const processed = processChildren(child);
                            return Array.isArray(processed) ? processed : [processed];
                          });
                        }
                        if (children && typeof children === 'object' && 'props' in children) {
                          // React element - process its children if it has any
                          return React.cloneElement(children, {
                            ...children.props,
                            children: processChildren(children.props.children)
                          });
                        }
                        return children;
                      };
                      
                      try {
                        const processedChildren = processChildren(children);
                        return (
                          <p style={{ margin: '0 0 8px 0' }} {...props}>
                            {processedChildren}
                          </p>
                        );
                      } catch (e) {
                        // Fallback to simple rendering if processing fails
                        return (
                          <p style={{ margin: '0 0 8px 0' }} {...props}>
                            {children}
                          </p>
                        );
                      }
                    },
                    h1: ({ children }) => <h1 style={{ fontSize: '18px', margin: '12px 0 8px 0', fontWeight: '600' }}>{children}</h1>,
                    h2: ({ children }) => <h2 style={{ fontSize: '16px', margin: '10px 0 6px 0', fontWeight: '600' }}>{children}</h2>,
                    h3: ({ children }) => <h3 style={{ fontSize: '14px', margin: '8px 0 4px 0', fontWeight: '600' }}>{children}</h3>,
                    code: ({ inline, className, children, ...props }) => {
                      // Check if this is a tool result raw data
                      const isToolResult = props['data-tool-result'] === 'true' || 
                                         className?.includes('tool-result-raw') ||
                                         (typeof children === 'string' && 
                                          (/\[function\]:\s*\{[^}]*"success"/.test(children) || 
                                           /\{"success":\s*(?:true|false)[^}]+\}/.test(children)));
                      
                      // Check if this is a fenced code block (has language class)
                      const match = /language-(\w+)/.exec(className || '');
                      
                      // Tool result raw data - style with gray/italic
                      if (isToolResult) {
                        if (inline || !match) {
                          return (
                            <code 
                              {...props} 
                              className={className}
                              style={{
                                background: 'transparent',
                                padding: '2px 4px',
                                borderRadius: '3px',
                                fontFamily: 'monospace',
                                fontSize: '11px',
                                color: '#666',
                                fontStyle: 'italic',
                                opacity: 0.7
                              }}
                            >
                              {children}
                            </code>
                          );
                        }
                        
                        // Fenced code block for tool result
                        return (
                          <pre
                            style={{
                              background: 'transparent',
                              border: 'none',
                              borderRadius: '4px',
                              padding: '4px 8px',
                              overflow: 'auto',
                              margin: '4px 0',
                              fontSize: '11px'
                            }}
                            {...props}
                          >
                            <code 
                              className={className}
                              style={{
                                fontFamily: 'monospace',
                                fontSize: '11px',
                                color: '#666',
                                fontStyle: 'italic',
                                opacity: 0.7
                              }}
                            >
                              {children}
                            </code>
                          </pre>
                        );
                      }
                      
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
                    // Style tool result raw data spans
                    span: ({ className, children, ...props }) => {
                      if (className?.includes('tool-result-raw') || props['data-tool-result'] === 'true') {
                        return (
                          <span
                            {...props}
                            style={{
                              color: '#666',
                              fontStyle: 'italic',
                              opacity: 0.7,
                              fontFamily: 'monospace',
                              fontSize: '11px'
                            }}
                          >
                            {children}
                          </span>
                        );
                      }
                      return <span {...props}>{children}</span>;
                    },
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
              
              {/* Done indicator and Copy button - Bottom of message */}
              {showCopyButton && (
                <div
                  style={{
                    marginTop: '12px',
                    paddingTop: '8px',
                    borderTop: '1px solid rgba(0, 255, 65, 0.1)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '8px'
                  }}
                >
                  <span style={{ color: '#00ff41', fontSize: '10px', opacity: 0.8 }}>
                    ✓ Done
                  </span>
                  <button
                    onClick={() => handleCopy(msg.content)}
                    style={{
                      background: 'transparent',
                      border: '1px solid rgba(0, 255, 65, 0.3)',
                      borderRadius: '4px',
                      padding: '6px',
                      color: '#00ff41',
                      cursor: 'pointer',
                      opacity: 0.8,
                      transition: 'all 0.2s',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: '28px',
                      height: '28px'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.opacity = '1';
                      e.currentTarget.style.borderColor = 'rgba(0, 255, 65, 0.5)';
                      e.currentTarget.style.background = 'rgba(0, 255, 65, 0.05)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.opacity = '0.8';
                      e.currentTarget.style.borderColor = 'rgba(0, 255, 65, 0.3)';
                      e.currentTarget.style.background = 'transparent';
                    }}
                    title="Copy message"
                  >
                    <CopyIcon size={18} color="#00ff41" />
                  </button>
                </div>
              )}
            </div>
            );
          })
        )}
        {/* Show "AI is thinking..." if current active conversation is processing */}
        {isActiveProcessing && (
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
              opacity: isActiveProcessing ? 0.6 : 1,
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
                  cursor: isActiveProcessing ? 'not-allowed' : 'pointer',
                  fontFamily: 'var(--ui-font-family)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  opacity: isActiveProcessing ? 0.6 : 1,
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
              disabled={!input.trim() || isActiveProcessing}
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

