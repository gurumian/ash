import React, { useState } from 'react';
import { FunctionResult } from './FunctionResult';

/**
 * FunctionResultsSection Component - Displays function/tool execution results in a collapsible, fixed-height section
 * 
 * Features:
 * - Fixed height (collapsed: 40px, expanded: 200px)
 * - Collapsible with expand/collapse button
 * - Scrollable content when expanded
 * - Shows all function execution results
 */
export function FunctionResultsSection({ toolResults, messageId }) {
  const [isExpanded, setIsExpanded] = useState(false);
  
  if (!toolResults || toolResults.length === 0) {
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
          background: 'color-mix(in srgb, var(--theme-accent) 5%, transparent)',
          borderBottom: isExpanded ? '1px solid color-mix(in srgb, var(--theme-accent) 10%, transparent)' : 'none'
        }}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '11px', fontWeight: '600', color: 'var(--theme-text)' }}>
            ⚙️ Function Results
          </span>
          <span style={{ fontSize: '9px', color: 'color-mix(in srgb, var(--theme-text) 60%, transparent)' }}>
            {toolResults.length} {toolResults.length === 1 ? 'result' : 'results'}
          </span>
        </div>
        <span
          style={{
            fontSize: '12px',
            color: 'var(--theme-text)',
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
          className="function-results-scroll"
          style={{
            height: '160px', // 200px total - 40px header
            overflowY: 'auto',
            padding: '8px',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px'
          }}
        >
          {toolResults.map((toolResult, idx) => (
            <FunctionResult
              key={`func-${messageId}-${idx}`}
              name={toolResult.name || 'Command'}
              command={toolResult.command || null}
              success={toolResult.success !== undefined ? toolResult.success : true}
              exitCode={toolResult.exitCode}
              stdout={toolResult.stdout}
              stderr={toolResult.stderr}
              content={toolResult.content}
            />
          ))}
        </div>
      )}
    </div>
  );
}

