import React from 'react';

/**
 * Custom title bar for Windows/Linux
 */
export function CustomTitleBar({ isMaximized, onMinimize, onMaximize, onClose }) {
  return (
    <div className="custom-titlebar">
      <div className="titlebar-title">ash</div>
      <div className="titlebar-controls">
        <button 
          className="titlebar-button minimize-button"
          onClick={onMinimize}
          title="Minimize"
        >
          <span>−</span>
        </button>
        <button 
          className="titlebar-button maximize-button"
          onClick={onMaximize}
          title={isMaximized ? "Restore" : "Maximize"}
        >
          <span>{isMaximized ? '❐' : '□'}</span>
        </button>
        <button 
          className="titlebar-button close-button"
          onClick={onClose}
          title="Close"
        >
          <span>×</span>
        </button>
      </div>
    </div>
  );
}

