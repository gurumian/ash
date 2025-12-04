import React from 'react';
import { useTranslation } from 'react-i18next';

/**
 * Group Name Dialog component - Modal for creating a new group with a name
 */
export function GroupNameDialog({
  showGroupNameDialog,
  newGroupName,
  groups,
  onClose,
  onCreate,
  onNameChange,
  onKeyDown
}) {
  const { t } = useTranslation(['common']);
  if (!showGroupNameDialog) return null;

  return (
    <div className="modal-overlay">
      <div className="connection-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{t('common:createGroup')}</h3>
          <button 
            className="modal-close"
            onClick={onClose}
          >
            ×
          </button>
        </div>
        <div className="modal-body">
          <div className="form-group">
            <label>{t('common:groupName')}</label>
            <input
              type="text"
              value={newGroupName}
              onChange={onNameChange}
              onKeyDown={onKeyDown}
              placeholder={`${t('common:groups')} ${groups.length + 1}`}
              autoFocus
            />
          </div>
        </div>
        <div className="modal-actions">
          <button 
            className="cancel-btn"
            onClick={onClose}
          >
            {t('common:cancel')}
          </button>
          <button 
            className="connect-btn"
            onClick={onCreate}
          >
            {t('common:createGroup')}
          </button>
        </div>
      </div>
    </div>
  );
}

