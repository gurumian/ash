import React from 'react';
import { FunctionResult } from './FunctionResult';

function isBareToolId(item) {
  const name = item?.name || '';
  return /^ash_[a-z0-9_]+$/i.test(name) && !item.command;
}

function isInterruptedStream(item) {
  const stdout = String(item?.stdout || '').trim();
  const stderr = String(item?.stderr || '');
  return !stdout && stderr.includes('Output data stream was missing or interrupted');
}

export function FunctionResultsSection({ toolResults, messageId, isStreaming = false }) {
  if (!toolResults || toolResults.length === 0) return null;

  const hasNamedCommand = toolResults.some((item) => item.command);
  const visible = toolResults.filter((item) => {
    if (isInterruptedStream(item)) return false;
    if (isBareToolId(item) && (hasNamedCommand || !(item.stdout || item.stderr || item.content))) {
      return false;
    }
    return item.source !== 'thinking' || item.stdout || item.stderr || item.content || item.command;
  });
  if (visible.length === 0) return null;

  return (
    <div className="ai-cmd-list">
      <div className="ai-cmd-list-label">
        {visible.length} command{visible.length === 1 ? '' : 's'}
      </div>
      {visible.map((item, idx) => (
        <FunctionResult
          key={`cmd-${messageId}-${idx}`}
          name={item.name || 'Command'}
          command={item.command || null}
          success={item.success !== undefined ? item.success : true}
          exitCode={item.exitCode ?? item.exitCode}
          stdout={item.stdout}
          stderr={item.stderr}
          content={item.content}
          defaultOpen={idx === visible.length - 1}
        />
      ))}
    </div>
  );
}
