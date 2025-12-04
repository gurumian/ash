import React from 'react';
import { useTranslation } from 'react-i18next';
import './ConfirmDialog.css';

export const ConfirmDialog = ({ isOpen, onClose, onConfirm, title, message }) => {
  const { t } = useTranslation(['dialog', 'common']);
  if (!isOpen) return null;

  const handleConfirm = () => {
    onConfirm();
    onClose();
  };

  return (
    <div className="confirm-dialog-overlay">
      <div className="confirm-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="confirm-dialog-header">
          <h3>{title || t('dialog:confirm.title')}</h3>
          <button className="confirm-dialog-close" onClick={onClose}>×</button>
        </div>
        
        <div className="confirm-dialog-content">
          <p>{message || t('dialog:confirm.defaultMessage')}</p>
        </div>

        <div className="confirm-dialog-footer">
          <button
            type="button"
            onClick={onClose}
            className="confirm-dialog-cancel"
          >
            {t('common:cancel')}
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            className="confirm-dialog-confirm"
          >
            {t('dialog:confirm.yes')}
          </button>
        </div>
      </div>
    </div>
  );
};

