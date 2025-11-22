import React from 'react';
import './ErrorDialog.css';

export const ErrorDialog = ({ isOpen, onClose, title, message, detail }) => {
  if (!isOpen) return null;

  return (
    <div className="error-dialog-overlay" onClick={onClose}>
      <div className="error-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="error-dialog-header">
          <h2>{title || 'Error'}</h2>
          <button className="error-dialog-close" onClick={onClose}>×</button>
        </div>
        
        <div className="error-dialog-content">
          <div className="error-message">
            <p>{message}</p>
            {detail && (
              <p className="error-detail">{detail}</p>
            )}
          </div>
        </div>
        
        <div className="error-dialog-actions">
          <button className="error-ok-button" onClick={onClose}>OK</button>
        </div>
      </div>
    </div>
  );
};

