import React, { useEffect, useState } from 'react';
import { removeThinkingTags } from '../utils/parseFunctionResult';

function previewText(text, lines = 8) {
  if (!text) return '';
  const parts = String(text).replace(/\s+$/, '').split('\n');
  if (parts.length <= lines) return parts.join('\n');
  return `${parts.slice(0, lines).join('\n')}\n…`;
}

function statusOf({ success, exitCode, hasOutput }) {
  const failed = success === false || (exitCode !== undefined && exitCode !== null && exitCode !== 0);
  if (!failed) return 'ok';
  return hasOutput ? 'warn' : 'fail';
}

export function FunctionResult({
  name,
  command,
  success,
  exitCode,
  stdout,
  stderr,
  content,
  defaultOpen = false
}) {
  const [open, setOpen] = useState(defaultOpen);
  const hasStructured = Boolean(name && (stdout !== undefined || stderr !== undefined));
  const label = command || (!/^ash_/.test(name || '') ? name : '') || 'command';
  const rawOut = stdout && stdout.trim() ? stdout : '';
  const rawErr = stderr && stderr.trim() ? stderr : '';
  const stdoutText = removeThinkingTags(rawOut, { swallowUnclosed: false }) || '';
  const stderrText = removeThinkingTags(rawErr, { swallowUnclosed: false }) || '';
  const fallback = removeThinkingTags(!hasStructured && content ? content : '', { swallowUnclosed: false }) || '';
  const hasOut = Boolean(stdoutText || stderrText || fallback);
  const hadRawOut = Boolean(rawOut || rawErr || fallback);
  const status = statusOf({ success, exitCode, hasOutput: hasOut || hadRawOut });

  useEffect(() => {
    if (defaultOpen) setOpen(true);
  }, [defaultOpen]);

  const collapsedPreview = previewText(stdoutText || stderrText || fallback);
  const mark = status === 'fail' ? '✕' : status === 'warn' ? '!' : '✓';

  return (
    <div className={`ai-cmd${status === 'fail' ? ' fail' : status === 'warn' ? ' warn' : ''}`}>
      <div className="ai-cmd-head" onClick={() => hasOut && setOpen((v) => !v)}>
        <span className="ai-cmd-status">{mark}</span>
        <span className="ai-cmd-name" title={label}>{label}</span>
        {exitCode !== undefined && exitCode !== null && exitCode !== 0 ? (
          <span className="ai-cmd-exit">{exitCode}</span>
        ) : null}
        {hasOut ? <span className="ai-think-chevron" style={{ transform: open ? 'rotate(180deg)' : 'none' }}>▾</span> : null}
      </div>
      {hasOut && !open && collapsedPreview ? (
        <div className="ai-cmd-body ai-cmd-preview">
          <pre>{collapsedPreview}</pre>
        </div>
      ) : null}
      {open && hasOut ? (
        <div className="ai-cmd-body">
          {stdoutText ? <pre>{stdoutText}</pre> : null}
          {stderrText ? (
            <div style={{ marginTop: stdoutText ? 8 : 0 }}>
              <div className="ai-cmd-err-label">stderr</div>
              <pre className="ai-cmd-err">{stderrText}</pre>
            </div>
          ) : null}
          {fallback ? <pre>{fallback}</pre> : null}
        </div>
      ) : null}
    </div>
  );
}
