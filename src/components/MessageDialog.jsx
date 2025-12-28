import React from 'react';
import { useTranslation } from 'react-i18next';
import './MessageDialog.css';

export const MessageDialog = ({ isOpen, onClose, type = 'info', title, message, detail }) => {
  const { t } = useTranslation(['dialog', 'common']);
  if (!isOpen) return null;

  const getIcon = () => {
    switch (type) {
      case 'success':
        return '✓';
      case 'error':
        return '✕';
      case 'warning':
        return '⚠';
      default:
        return 'ℹ';
    }
  };

  const getTitle = () => {
    if (title) return title;
    switch (type) {
      case 'success':
        return t('dialog:message.successTitle');
      case 'error':
        return t('dialog:message.errorTitle');
      case 'warning':
        return t('dialog:message.warningTitle');
      default:
        return t('dialog:message.infoTitle');
    }
  };

  return (
    <div className="message-dialog-overlay" onClick={onClose}>
      <div className="message-dialog" onClick={(e) => e.stopPropagation()}>
        <div className={`message-dialog-header message-dialog-header-${type}`}>
          <div className="message-dialog-title-container">
            <span className={`message-dialog-icon message-dialog-icon-${type}`}>
              {getIcon()}
            </span>
            <h3>{getTitle()}</h3>
          </div>
          <button className="message-dialog-close" onClick={onClose}>×</button>
        </div>
        
        <div className="message-dialog-content">
          <p>{message}</p>
          {detail && (
            <p className="message-dialog-detail">{detail}</p>
          )}
        </div>

        <div className="message-dialog-footer">
          <button
            type="button"
            onClick={onClose}
            className={`message-dialog-button message-dialog-button-${type}`}
          >
            {t('common:ok')}
          </button>
        </div>
      </div>
    </div>
  );
};

