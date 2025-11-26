import React from 'react';
import './ConfirmDialog.css';

export const ConfirmDialog = ({ isOpen, onClose, onConfirm, title, message }) => {
  if (!isOpen) return null;

  const handleConfirm = () => {
    onConfirm();
    onClose();
  };

  return (
    <div className="confirm-dialog-overlay" onClick={onClose}>
      <div className="confirm-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="confirm-dialog-header">
          <h3>{title || 'Confirm'}</h3>
          <button className="confirm-dialog-close" onClick={onClose}>×</button>
        </div>
        
        <div className="confirm-dialog-content">
          <p>{message}</p>
        </div>

        <div className="confirm-dialog-footer">
          <button
            type="button"
            onClick={onClose}
            className="confirm-dialog-cancel"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            className="confirm-dialog-confirm"
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
};

