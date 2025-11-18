import React from 'react';

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
  if (!showGroupNameDialog) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="connection-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Create New Group</h3>
          <button 
            className="modal-close"
            onClick={onClose}
          >
            ×
          </button>
        </div>
        <div className="modal-body">
          <div className="form-group">
            <label>Group Name</label>
            <input
              type="text"
              value={newGroupName}
              onChange={onNameChange}
              onKeyDown={onKeyDown}
              placeholder={`Group ${groups.length + 1}`}
              autoFocus
            />
          </div>
        </div>
        <div className="modal-actions">
          <button 
            className="cancel-btn"
            onClick={onClose}
          >
            Cancel
          </button>
          <button 
            className="connect-btn"
            onClick={onCreate}
          >
            Create Group
          </button>
        </div>
      </div>
    </div>
  );
}

