import React, { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import './TerminalContextMenu.css';

export function TerminalContextMenu({ visible, x, y, onCopy, onPaste, onSelectAll, onUpload, isSSHSession, canUpload, onClose }) {
  const { t } = useTranslation('common');
  const menuRef = useRef(null);

  useEffect(() => {
    if (!visible) return;

    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        onClose();
      }
    };

    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    // Close on outside click
    setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('contextmenu', handleClickOutside);
    }, 0);

    // Close on Escape key
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('contextmenu', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [visible, onClose]);

  if (!visible) return null;

  // Adjust position if menu would go off screen
  const menuStyle = {
    position: 'fixed',
    left: `${x}px`,
    top: `${y}px`,
    zIndex: 10000,
  };

  return (
    <div 
      ref={menuRef}
      className="terminal-context-menu"
      style={menuStyle}
      onClick={(e) => e.stopPropagation()}
      onContextMenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
    >
      <button 
        className="context-menu-item"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onCopy();
          onClose();
        }}
        disabled={!onCopy}
      >
        <span className="context-menu-label">{t('common:copy')}</span>
        <span className="context-menu-shortcut">Ctrl+Shift+C</span>
      </button>
      <button 
        className="context-menu-item"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onPaste();
          onClose();
        }}
      >
        <span className="context-menu-label">{t('common:paste')}</span>
        <span className="context-menu-shortcut">Ctrl+V</span>
      </button>
      <div className="context-menu-separator"></div>
      <button 
        className="context-menu-item"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onSelectAll();
          onClose();
        }}
      >
        <span className="context-menu-label">{t('common:selectAll')}</span>
        <span className="context-menu-shortcut">Ctrl+A</span>
      </button>
      {(isSSHSession || canUpload) && (
        <>
          <div className="context-menu-separator"></div>
          <button 
            className="context-menu-item"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onUpload();
              onClose();
            }}
          >
            <span className="context-menu-label">{t('common:upload')}</span>
          </button>
        </>
      )}
    </div>
  );
}

