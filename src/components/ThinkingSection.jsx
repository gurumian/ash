import React, { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';

/**
 * ThinkingSection Component - Displays AI thinking/reasoning in a collapsible, fixed-height section
 * 
 * Features:
 * - Fixed height (collapsed: 40px, expanded: 150px)
 * - Collapsible with expand/collapse button
 * - Scrollable content when expanded
 * - Shows thinking, plan, and todos
 * - Auto-scrolls when streaming
 */
export function ThinkingSection({ thinking, plan, todos, messageId, isStreaming = false }) {
  const [isExpanded, setIsExpanded] = useState(isStreaming);
  const contentRef = useRef(null);

  const hasContent = thinking || plan || (todos && todos.length > 0);

  // Auto-expand when streaming starts, auto-collapse when it ends
  useEffect(() => {
    if (isStreaming) {
      setIsExpanded(true);
    } else {
      setIsExpanded(false);
    }
  }, [isStreaming]);

  // Auto-scroll to bottom when content updates and is streaming
  useEffect(() => {
    if (isStreaming && isExpanded && contentRef.current) {
      contentRef.current.scrollTop = contentRef.current.scrollHeight;
    }
  }, [thinking, plan, todos, isStreaming, isExpanded]);

  if (!hasContent) {
    return null;
  }

  return (
    <div
      style={{
        marginTop: '8px',
        border: '1px solid color-mix(in srgb, var(--theme-accent) 20%, transparent)',
        borderRadius: '4px',
        background: 'color-mix(in srgb, var(--theme-accent) 2%, transparent)',
        overflow: 'hidden',
        transition: 'height 0.2s ease',
        display: 'flex',
        flexDirection: 'column'
      }}
    >
      {/* Header - always visible */}
      <div
        style={{
          height: '40px',
          padding: '8px 12px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          cursor: 'pointer',
          background: 'color-mix(in srgb, var(--theme-accent) 5%, transparent)',
          borderBottom: isExpanded ? '1px solid color-mix(in srgb, var(--theme-accent) 10%, transparent)' : 'none',
          flexShrink: 0
        }}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '11px', fontWeight: '600', color: 'var(--theme-accent)' }}>
            {isStreaming ? '🧠 AI Thinking...' : '💭 AI Thinking'}
          </span>
          {(thinking || plan || (todos && todos.length > 0)) && (
            <span style={{ fontSize: '9px', color: 'color-mix(in srgb, var(--theme-text) 60%, transparent)' }}>
              {[
                thinking ? 'thinking' : '',
                plan ? 'plan' : '',
                todos && todos.length > 0 ? `${todos.length} todos` : ''
              ].filter(Boolean).join(', ')}
            </span>
          )}
        </div>
        <span
          style={{
            fontSize: '12px',
            color: 'var(--theme-accent)',
            transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 0.2s'
          }}
        >
          ▼
        </span>
      </div>

      {/* Content - scrollable when expanded */}
      {isExpanded && (
        <div
          ref={contentRef}
          style={{
            height: '150px',
            overflowY: 'auto',
            padding: '12px',
            fontSize: '11px',
            lineHeight: '1.5',
            color: 'color-mix(in srgb, var(--theme-text) 70%, transparent)'
          }}
        >
          {/* Thinking */}
          {thinking && (
            <div style={{ marginBottom: '12px' }}>
              <div style={{ fontSize: '10px', fontWeight: '600', color: 'var(--theme-accent)', marginBottom: '4px' }}>
                Thinking:
              </div>
              <div style={{ color: 'color-mix(in srgb, var(--theme-text) 70%, transparent)', fontFamily: 'monospace', whiteSpace: 'pre-wrap' }}>
                <ReactMarkdown
                  components={{
                    p: ({ children }) => <p style={{ margin: '0 0 4px 0' }}>{children}</p>,
                    code: ({ inline, children }) => (
                      <code style={{
                        background: 'color-mix(in srgb, var(--theme-accent) 10%, transparent)',
                        padding: '1px 3px',
                        borderRadius: '2px',
                        fontSize: '10px'
                      }}>
                        {children}
                      </code>
                    )
                  }}
                >
                  {thinking}
                </ReactMarkdown>
              </div>
            </div>
          )}

          {/* Plan */}
          {plan && (
            <div style={{ marginBottom: '12px' }}>
              <div style={{ fontSize: '10px', fontWeight: '600', color: 'var(--theme-accent)', marginBottom: '4px' }}>
                Plan:
              </div>
              <div style={{ color: 'color-mix(in srgb, var(--theme-text) 70%, transparent)', fontFamily: 'monospace', whiteSpace: 'pre-wrap' }}>
                <ReactMarkdown
                  components={{
                    p: ({ children }) => <p style={{ margin: '0 0 4px 0' }}>{children}</p>,
                    ul: ({ children }) => <ul style={{ margin: '4px 0', paddingLeft: '16px' }}>{children}</ul>,
                    li: ({ children }) => <li style={{ margin: '2px 0' }}>{children}</li>
                  }}
                >
                  {plan}
                </ReactMarkdown>
              </div>
            </div>
          )}

          {/* Todos */}
          {todos && todos.length > 0 && (
            <div>
              <div style={{ fontSize: '10px', fontWeight: '600', color: 'var(--theme-accent)', marginBottom: '4px' }}>
                TODOs:
              </div>
              <ul style={{ margin: '4px 0', paddingLeft: '16px', color: 'color-mix(in srgb, var(--theme-text) 70%, transparent)' }}>
                {todos.map((todo, idx) => (
                  <li key={`todo-${messageId}-${idx}`} style={{ margin: '2px 0', fontSize: '10px' }}>
                    {todo}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

