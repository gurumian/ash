import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import './LibraryImportDialog.css';

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
  const textareaRef = useRef(null);
  const historyRef = useRef([]);
  const historyIndexRef = useRef(-1);
  const { t } = useTranslation(['library', 'common']);

  useEffect(() => {
    if (showDialog) {
      setJsonText('');
      setError(null);
      setImportSource('clipboard');
      // Reset history
      historyRef.current = [''];
      historyIndexRef.current = 0;
      // Try to load from clipboard automatically
      loadFromClipboard();
    }
  }, [showDialog]);

  // Save to history when text changes (debounced)
  useEffect(() => {
    if (!showDialog) return;
    
    const timeoutId = setTimeout(() => {
      const history = historyRef.current;
      const currentIndex = historyIndexRef.current;
      const currentText = jsonText;
      
      // Don't save if it's the same as current history entry
      if (history[currentIndex] === currentText) {
        return;
      }
      
      // Remove any future history if we're not at the end
      if (currentIndex < history.length - 1) {
        history.splice(currentIndex + 1);
      }
      
      // Add new state to history (limit to 50 entries)
      if (history.length >= 50) {
        history.shift();
        historyIndexRef.current = history.length - 1;
      } else {
        historyIndexRef.current = history.length;
      }
      history.push(currentText);
    }, 300);
    
    return () => clearTimeout(timeoutId);
  }, [jsonText, showDialog]);

  // Handle undo/redo manually since controlled component doesn't support browser undo
  useEffect(() => {
    if (!showDialog) return;
    
    const textarea = textareaRef.current;
    if (!textarea) return;

    const handleKeyDown = (event) => {
      // Handle Ctrl+Z (undo) or Cmd+Z
      if ((event.ctrlKey || event.metaKey) && !event.shiftKey && (event.key === 'z' || event.key === 'Z')) {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        
        const history = historyRef.current;
        const currentIndex = historyIndexRef.current;
        
        if (currentIndex > 0) {
          historyIndexRef.current = currentIndex - 1;
          setJsonText(history[currentIndex - 1]);
          setError(null);
        }
        return;
      }
      
      // Handle Ctrl+Y or Ctrl+Shift+Z (redo) or Cmd+Shift+Z
      if ((event.ctrlKey || event.metaKey) && 
          ((event.key === 'y' || event.key === 'Y') || 
           (event.shiftKey && (event.key === 'z' || event.key === 'Z')))) {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        
        const history = historyRef.current;
        const currentIndex = historyIndexRef.current;
        
        if (currentIndex < history.length - 1) {
          historyIndexRef.current = currentIndex + 1;
          setJsonText(history[currentIndex + 1]);
          setError(null);
        }
        return;
      }
      
      // For other standard shortcuts, just stop propagation
      if ((event.ctrlKey || event.metaKey) && 
          (event.key === 'a' || event.key === 'A' || event.key === 'x' || event.key === 'X' || 
           event.key === 'c' || event.key === 'C' || event.key === 'v' || event.key === 'V')) {
        event.stopPropagation();
        event.stopImmediatePropagation();
      }
    };

    // Add listener in capture phase (before other handlers)
    textarea.addEventListener('keydown', handleKeyDown, true);

    return () => {
      textarea.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [showDialog, jsonText]);

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
        setError(t('library:failedToImport') + ': ' + (result.error || t('library:invalidFormat')));
      }
    } catch (error) {
      setError(t('library:failedToImport') + ': ' + error.message);
    }
  };

  const handleImport = () => {
    try {
      if (!jsonText.trim()) {
        setError(t('library:pleaseProvideJSON'));
        return;
      }

      const libraryData = JSON.parse(jsonText);
      
      // Validate it's a library object
      if (!libraryData || (!libraryData.name && !libraryData.commands)) {
        setError(t('library:invalidFormat'));
        return;
      }

      onImport(libraryData);
      onClose();
    } catch (error) {
      setError(t('library:invalidJSON') + ': ' + error.message);
    }
  };

  if (!showDialog) return null;

  return (
    <div className="library-import-dialog-overlay" onClick={onClose}>
      <div className="library-import-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="library-import-dialog-header">
          <h3>{t('library:importTitle')}</h3>
          <button 
            className="library-import-dialog-close"
            onClick={onClose}
          >
            ×
          </button>
        </div>
        
        <div className="library-import-dialog-content">
          {/* Import Source Buttons */}
          <div className="library-import-source-buttons">
            <button
              type="button"
              onClick={handleLoadFromClipboard}
              className={`library-import-source-btn ${importSource === 'clipboard' ? 'active' : ''}`}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
              </svg>
              {t('library:fromClipboard')}
            </button>
            <button
              type="button"
              onClick={handleLoadFromFile}
              className={`library-import-source-btn ${importSource === 'file' ? 'active' : ''}`}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                <polyline points="7 10 12 15 17 10"></polyline>
                <line x1="12" y1="15" x2="12" y2="3"></line>
              </svg>
              {t('library:fromFile')}
            </button>
            <button
              type="button"
              onClick={() => setImportSource('manual')}
              className={`library-import-source-btn ${importSource === 'manual' ? 'active' : ''}`}
            >
              {t('library:manualInput')}
            </button>
          </div>

          {/* JSON Text Area */}
          <div className="library-import-form-group">
            <label className="library-import-label">
              {t('library:importJSON')}
            </label>
            <textarea
              ref={textareaRef}
              value={jsonText}
              onChange={(e) => {
                const newValue = e.target.value;
                setJsonText(newValue);
                setError(null);
                if (newValue.trim()) {
                  setImportSource('manual');
                }
              }}
              placeholder={t('library:importJSONPlaceholder')}
              rows={12}
              className={`library-import-textarea ${error ? 'error' : ''}`}
              style={{
                fontFamily: terminalFontFamily || "'Monaco', 'Menlo', 'Ubuntu Mono', 'Courier New', 'Consolas', 'Liberation Mono', monospace"
              }}
            />
          </div>

          {/* Error Message */}
          {error && (
            <div className="library-import-error">
              {error}
            </div>
          )}

          {/* Info Message */}
          <div className="library-import-info">
            {t('library:importJSONDescription')}
          </div>
        </div>

        <div className="library-import-dialog-footer">
          <button
            type="button"
            onClick={onClose}
            className="library-import-dialog-btn library-import-dialog-btn-cancel"
          >
            {t('common:cancel')}
          </button>
          <button
            type="button"
            onClick={handleImport}
            disabled={!jsonText.trim()}
            className="library-import-dialog-btn library-import-dialog-btn-import"
          >
            {t('library:import')}
          </button>
        </div>
      </div>
    </div>
  );
}

