import React, { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import { removeThinkingTags } from '../utils/parseFunctionResult';

function lastLine(text) {
  if (!text) return '';
  const lines = String(text)
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
  return lines[lines.length - 1] || '';
}

export function ThinkingSection({ thinking, plan, todos, messageId, isStreaming = false }) {
  const [isOpen, setIsOpen] = useState(isStreaming);
  const bodyRef = useRef(null);
  const hasContent = thinking || plan || (todos && todos.length > 0);

  useEffect(() => {
    if (isStreaming) setIsOpen(true);
  }, [isStreaming]);

  useEffect(() => {
    if (isStreaming && isOpen && bodyRef.current) {
      bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
    }
  }, [thinking, plan, todos, isStreaming, isOpen]);

  if (!hasContent) return null;

  const preview = lastLine(thinking) || lastLine(plan) || (todos && todos[0]) || '';

  return (
    <div className={`ai-think${isOpen ? ' open' : ''}`}>
      <div className="ai-think-head" onClick={() => setIsOpen((v) => !v)}>
        <span className={`ai-think-dot${isStreaming ? ' live' : ''}`} />
        <span className="ai-think-label">{isStreaming ? 'Thinking' : 'Thought'}</span>
        {!isOpen && preview ? <span className="ai-think-preview">{preview}</span> : <span className="ai-think-preview" />}
        <span className="ai-think-chevron">▾</span>
      </div>
      {isOpen && (
        <div ref={bodyRef} className="ai-think-body">
          {thinking ? (
            <ReactMarkdown
              components={{
                think: () => null,
                thinking: () => null,
                reasoning: () => null,
                p: ({ children }) => <p style={{ margin: '0 0 6px 0' }}>{children}</p>,
                code: ({ children }) => <code>{children}</code>
              }}
            >
              {removeThinkingTags(thinking, { swallowUnclosed: false })}
            </ReactMarkdown>
          ) : null}
          {plan ? (
            <>
              <div className="ai-think-section-label">Plan</div>
              <ReactMarkdown
                components={{
                  p: ({ children }) => <p style={{ margin: '0 0 4px 0' }}>{children}</p>,
                  ul: ({ children }) => <ul style={{ margin: '4px 0', paddingLeft: 16 }}>{children}</ul>,
                  li: ({ children }) => <li style={{ margin: '2px 0' }}>{children}</li>
                }}
              >
                {plan}
              </ReactMarkdown>
            </>
          ) : null}
          {todos && todos.length > 0 ? (
            <>
              <div className="ai-think-section-label">Next</div>
              <ul style={{ margin: '4px 0', paddingLeft: 16 }}>
                {todos.map((todo, idx) => (
                  <li key={`todo-${messageId}-${idx}`}>{todo}</li>
                ))}
              </ul>
            </>
          ) : null}
        </div>
      )}
    </div>
  );
}
