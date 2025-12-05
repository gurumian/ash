import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';

/**
 * ThinkingSection Component - Displays AI thinking/reasoning in a collapsible, fixed-height section
 * 
 * Features:
 * - Fixed height (collapsed: 40px, expanded: 150px)
 * - Collapsible with expand/collapse button
 * - Scrollable content when expanded
 * - Shows thinking, plan, and todos
 */
export function ThinkingSection({ thinking, plan, todos, messageId }) {
  const [isExpanded, setIsExpanded] = useState(false);
  
  const hasContent = thinking || plan || (todos && todos.length > 0);
  
  if (!hasContent) {
    return null;
  }
  
  const fixedHeight = isExpanded ? '150px' : '40px';
  
  return (
    <div
      style={{
        marginTop: '8px',
        border: '1px solid rgba(0, 255, 65, 0.2)',
        borderRadius: '4px',
        background: 'rgba(0, 255, 65, 0.02)',
        overflow: 'hidden',
        transition: 'height 0.2s ease'
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
          background: 'rgba(0, 255, 65, 0.05)',
          borderBottom: isExpanded ? '1px solid rgba(0, 255, 65, 0.1)' : 'none'
        }}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '11px', fontWeight: '600', color: '#00ff41' }}>
            💭 AI Thinking
          </span>
          {(thinking || plan || (todos && todos.length > 0)) && (
            <span style={{ fontSize: '9px', color: '#888' }}>
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
            color: '#00ff41',
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
          style={{
            height: '110px', // 150px total - 40px header
            overflowY: 'auto',
            padding: '12px',
            fontSize: '11px',
            lineHeight: '1.5',
            color: '#888'
          }}
        >
          {/* Thinking */}
          {thinking && (
            <div style={{ marginBottom: '12px' }}>
              <div style={{ fontSize: '10px', fontWeight: '600', color: '#00ff41', marginBottom: '4px' }}>
                Thinking:
              </div>
              <div style={{ color: '#888', fontFamily: 'monospace', whiteSpace: 'pre-wrap' }}>
                <ReactMarkdown
                  components={{
                    p: ({ children }) => <p style={{ margin: '0 0 4px 0' }}>{children}</p>,
                    code: ({ inline, children }) => (
                      <code style={{
                        background: 'rgba(0, 255, 65, 0.1)',
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
              <div style={{ fontSize: '10px', fontWeight: '600', color: '#00ff41', marginBottom: '4px' }}>
                Plan:
              </div>
              <div style={{ color: '#888', fontFamily: 'monospace', whiteSpace: 'pre-wrap' }}>
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
              <div style={{ fontSize: '10px', fontWeight: '600', color: '#00ff41', marginBottom: '4px' }}>
                TODOs:
              </div>
              <ul style={{ margin: '4px 0', paddingLeft: '16px', color: '#888' }}>
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

