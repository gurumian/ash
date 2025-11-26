import React, { useState, useEffect } from 'react';

/**
 * Library Import Dialog component - Modal for importing library from various sources
 */
export function LibraryImportDialog({
  showDialog,
  terminalFontFamily,
  onClose,
  onImport
}) {
  const [jsonText, setJsonText] = useState('');
  const [error, setError] = useState(null);
  const [importSource, setImportSource] = useState('clipboard'); // 'clipboard', 'file', 'manual'

  useEffect(() => {
    if (showDialog) {
      setJsonText('');
      setError(null);
      setImportSource('clipboard');
      // Try to load from clipboard automatically
      loadFromClipboard();
    }
  }, [showDialog]);

  const loadFromClipboard = async () => {
    try {
      if (navigator.clipboard && navigator.clipboard.readText) {
        const clipboardText = await navigator.clipboard.readText();
        try {
          const parsed = JSON.parse(clipboardText);
          if (parsed && (parsed.name || parsed.commands)) {
            setJsonText(clipboardText);
            setImportSource('clipboard');
            setError(null);
          }
        } catch (e) {
          // Not valid JSON, leave empty
        }
      }
    } catch (e) {
      // Clipboard read failed, leave empty
    }
  };

  const handleLoadFromClipboard = async () => {
    await loadFromClipboard();
    setImportSource('clipboard');
  };

  const handleLoadFromFile = async () => {
    try {
      const result = await window.electronAPI.importLibrary();
      if (result.success && result.library) {
        setJsonText(JSON.stringify(result.library, null, 2));
        setImportSource('file');
        setError(null);
      } else if (!result.canceled) {
        setError('Failed to import library: ' + (result.error || 'Invalid library file'));
      }
    } catch (error) {
      setError('Failed to import library: ' + error.message);
    }
  };

  const handleImport = () => {
    try {
      if (!jsonText.trim()) {
        setError('Please provide library JSON');
        return;
      }

      const libraryData = JSON.parse(jsonText);
      
      // Validate it's a library object
      if (!libraryData || (!libraryData.name && !libraryData.commands)) {
        setError('Invalid library format. Library must have name or commands.');
        return;
      }

      onImport(libraryData);
      onClose();
    } catch (error) {
      setError('Invalid JSON: ' + error.message);
    }
  };

  if (!showDialog) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="connection-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Import Library</h3>
          <button 
            className="modal-close"
            onClick={onClose}
          >
            ×
          </button>
        </div>
        
        <div style={{ padding: '20px' }}>
          {/* Import Source Buttons */}
          <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
            <button
              type="button"
              onClick={handleLoadFromClipboard}
              style={{
                padding: '8px 16px',
                fontSize: '12px',
                backgroundColor: importSource === 'clipboard' ? 'rgba(0, 255, 65, 0.2)' : 'rgba(0, 255, 65, 0.1)',
                border: '1px solid rgba(0, 255, 65, 0.3)',
                color: '#00ff41',
                cursor: 'pointer',
                borderRadius: '4px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#00ff41" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
              </svg>
              From Clipboard
            </button>
            <button
              type="button"
              onClick={handleLoadFromFile}
              style={{
                padding: '8px 16px',
                fontSize: '12px',
                backgroundColor: importSource === 'file' ? 'rgba(0, 255, 65, 0.2)' : 'rgba(0, 255, 65, 0.1)',
                border: '1px solid rgba(0, 255, 65, 0.3)',
                color: '#00ff41',
                cursor: 'pointer',
                borderRadius: '4px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#00ff41" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                <polyline points="7 10 12 15 17 10"></polyline>
                <line x1="12" y1="15" x2="12" y2="3"></line>
              </svg>
              From File
            </button>
            <button
              type="button"
              onClick={() => setImportSource('manual')}
              style={{
                padding: '8px 16px',
                fontSize: '12px',
                backgroundColor: importSource === 'manual' ? 'rgba(0, 255, 65, 0.2)' : 'rgba(0, 255, 65, 0.1)',
                border: '1px solid rgba(0, 255, 65, 0.3)',
                color: '#00ff41',
                cursor: 'pointer',
                borderRadius: '4px'
              }}
            >
              Manual Input
            </button>
          </div>

          {/* JSON Text Area */}
          <div className="form-group" style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', marginBottom: '8px', color: '#00ff41' }}>
              Library JSON
            </label>
            <textarea
              value={jsonText}
              onChange={(e) => {
                setJsonText(e.target.value);
                setError(null);
                if (e.target.value.trim()) {
                  setImportSource('manual');
                }
              }}
              onKeyDown={(e) => {
                // Allow standard text editing shortcuts (Ctrl+Z, Ctrl+Y, Ctrl+A, etc.)
                // Stop all propagation to prevent global handlers from interfering
                if ((e.ctrlKey || e.metaKey) && (e.key === 'z' || e.key === 'Z' || e.key === 'y' || e.key === 'Y' || e.key === 'a' || e.key === 'A' || e.key === 'x' || e.key === 'X' || e.key === 'c' || e.key === 'C' || e.key === 'v' || e.key === 'V')) {
                  // Let browser handle these shortcuts natively
                  e.stopPropagation(); // Stop bubbling
                  // Access native event for stopImmediatePropagation
                  if (e.nativeEvent && typeof e.nativeEvent.stopImmediatePropagation === 'function') {
                    e.nativeEvent.stopImmediatePropagation();
                  }
                  // Don't prevent default - let browser handle undo/redo natively
                  return;
                }
              }}
              placeholder="Paste or type library JSON here..."
              rows={12}
              style={{
                width: '100%',
                padding: '12px',
                backgroundColor: '#000000',
                border: error ? '1px solid #ff4444' : '1px solid #1a1a1a',
                borderRadius: '4px',
                color: '#00ff41',
                fontSize: '13px',
                fontFamily: terminalFontFamily || "'Monaco', 'Menlo', 'Ubuntu Mono', 'Courier New', 'Consolas', 'Liberation Mono', monospace",
                resize: 'vertical',
                whiteSpace: 'pre',
                overflowWrap: 'normal',
                overflowX: 'auto'
              }}
            />
          </div>

          {/* Error Message */}
          {error && (
            <div style={{
              padding: '8px 12px',
              marginBottom: '16px',
              backgroundColor: 'rgba(255, 68, 68, 0.1)',
              border: '1px solid rgba(255, 68, 68, 0.3)',
              borderRadius: '4px',
              color: '#ff4444',
              fontSize: '12px'
            }}>
              {error}
            </div>
          )}

          {/* Info Message */}
          <div style={{
            padding: '8px 12px',
            marginBottom: '16px',
            backgroundColor: 'rgba(0, 255, 65, 0.05)',
            border: '1px solid rgba(0, 255, 65, 0.1)',
            borderRadius: '4px',
            color: '#00ff41',
            fontSize: '11px',
            opacity: 0.7
          }}>
            Library JSON should contain: name, description (optional), and commands array
          </div>
        </div>

        <div className="modal-footer" style={{ 
          display: 'flex', 
          justifyContent: 'flex-end', 
          gap: '8px', 
          padding: '16px 20px',
          borderTop: '1px solid var(--theme-border)'
        }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '8px 16px',
              backgroundColor: 'var(--theme-surface)',
              border: '1px solid var(--theme-border)',
              borderRadius: '4px',
              color: 'var(--theme-text)',
              cursor: 'pointer'
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleImport}
            disabled={!jsonText.trim()}
            style={{
              padding: '8px 16px',
              backgroundColor: jsonText.trim() ? 'var(--theme-surface)' : '#1a1a1a',
              border: '1px solid var(--theme-border)',
              borderRadius: '4px',
              color: jsonText.trim() ? 'var(--theme-text)' : '#666',
              cursor: jsonText.trim() ? 'pointer' : 'not-allowed',
              opacity: jsonText.trim() ? 1 : 0.5
            }}
          >
            Import
          </button>
        </div>
      </div>
    </div>
  );
}

