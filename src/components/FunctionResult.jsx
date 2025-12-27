import React from 'react';

/**
 * FunctionResult Component - Renders structured tool/function execution results
 * 
 * Displays command execution results with:
 * - Success/failure status indicator
 * - Exit code badge
 * - Syntax-highlighted stdout/stderr output
 * - Terminal-style formatting
 */
export function FunctionResult({ 
  name, 
  command, // 실제 실행된 명령어 (있으면 이것을 표시)
  success, 
  exitCode, 
  stdout, 
  stderr,
  content // Fallback for unstructured content
}) {
  // Use content as fallback if structured fields are not available
  const hasStructuredData = name && (stdout !== undefined || stderr !== undefined);
  const displayContent = hasStructuredData ? (stdout || stderr || '') : (content || '');

  return (
    <div
      style={{
        marginTop: '8px',
        padding: '10px',
        background: success 
          ? 'color-mix(in srgb, var(--theme-accent) 5%, transparent)' 
          : 'rgba(255, 65, 65, 0.05)',
        border: `1px solid ${
          success 
            ? 'color-mix(in srgb, var(--theme-accent) 30%, transparent)' 
            : 'rgba(255, 65, 65, 0.3)'
        }`,
        borderRadius: '6px',
        fontSize: '11px',
        fontFamily: 'monospace'
      }}
    >
      {/* Header with status and exit code */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '6px',
          flexWrap: 'wrap',
          gap: '4px'
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}
        >
          <span
            style={{
              fontSize: '12px',
              fontWeight: '600',
              color: success ? 'var(--theme-text)' : '#ff4141'
            }}
          >
            {success ? '✓' : '✗'} {command || name || 'Command'}
          </span>
        </div>
        {exitCode !== undefined && exitCode !== null && (
          <span
            style={{
              padding: '2px 6px',
              borderRadius: '3px',
              background: success 
                ? 'color-mix(in srgb, var(--theme-accent) 20%, transparent)' 
                : 'rgba(255, 65, 65, 0.2)',
              color: success ? 'var(--theme-text)' : '#ff4141',
              fontSize: '10px',
              fontWeight: '600'
            }}
          >
            Exit {exitCode}
          </span>
        )}
      </div>

      {/* Output section */}
      {displayContent && (
        <div
          style={{
            background: 'color-mix(in srgb, var(--theme-bg) 70%, transparent)',
            border: '1px solid color-mix(in srgb, var(--theme-accent) 10%, transparent)',
            borderRadius: '4px',
            padding: '8px',
            marginTop: '6px'
          }}
        >
          {/* stdout */}
          {stdout && stdout.trim() && (
            <div>
              <div
                style={{
                  fontSize: '9px',
                  color: '#888',
                  marginBottom: '4px',
                  textTransform: 'uppercase',
                  fontWeight: '600'
                }}
              >
                stdout:
              </div>
              <pre
                style={{
                  margin: 0,
                  padding: 0,
                  color: 'var(--theme-text)',
                  fontSize: '11px',
                  lineHeight: '1.5',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                  fontFamily: 'monospace',
                  overflow: 'auto',
                  maxHeight: '300px'
                }}
              >
                {stdout}
              </pre>
            </div>
          )}

          {/* stderr */}
          {stderr && stderr.trim() && (
            <div style={{ marginTop: stdout && stdout.trim() ? '8px' : '0' }}>
              <div
                style={{
                  fontSize: '9px',
                  color: '#ff4141',
                  marginBottom: '4px',
                  textTransform: 'uppercase',
                  fontWeight: '600'
                }}
              >
                stderr:
              </div>
              <pre
                style={{
                  margin: 0,
                  padding: 0,
                  color: '#ff4141',
                  fontSize: '11px',
                  lineHeight: '1.5',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                  fontFamily: 'monospace',
                  overflow: 'auto',
                  maxHeight: '300px'
                }}
              >
                {stderr}
              </pre>
            </div>
          )}

          {/* Fallback: unstructured content */}
          {!hasStructuredData && displayContent && (
            <pre
              style={{
                margin: 0,
                padding: 0,
                color: 'var(--theme-text)',
                fontSize: '11px',
                lineHeight: '1.5',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                fontFamily: 'monospace',
                overflow: 'auto',
                maxHeight: '300px'
              }}
            >
              {displayContent}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}
