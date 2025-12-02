import React, { memo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { ConnectionStatusIcon } from './ConnectionStatusIcon';

/**
 * Tab item component - memoized for performance
 */
export const TabItem = memo(function TabItem({
  session,
  isActive,
  onSwitch,
  onDisconnect,
  onDetachTab,
  onDragOver,
  onDrop,
  index
}) {
  const handleDragStart = useCallback((e) => {
    e.dataTransfer.setData('text/plain', session.id);
    e.dataTransfer.effectAllowed = 'move';
    e.currentTarget.style.opacity = '0.5';
  }, [session.id]);

  const handleDragEnd = useCallback((e) => {
    e.currentTarget.style.opacity = '';
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX;
    const y = e.clientY;
    
    if (x < 0 || y < 0 || x > window.innerWidth || y > window.innerHeight) {
      onDetachTab(session.id);
    }
  }, [session.id, onDetachTab]);

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (onDragOver) {
      onDragOver(e, index);
    }
  }, [index, onDragOver]);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    const draggedSessionId = e.dataTransfer.getData('text/plain');
    if (draggedSessionId && draggedSessionId !== session.id && onDrop) {
      onDrop(draggedSessionId, index);
    }
  }, [session.id, index, onDrop]);

  const handleClick = useCallback(() => {
    onSwitch(session.id);
  }, [session.id, onSwitch]);

  const handleClose = useCallback((e) => {
    e.stopPropagation();
    onDisconnect(session.id);
  }, [session.id, onDisconnect]);

  const { t } = useTranslation('common');

  return (
    <div 
      className={`tab ${isActive ? 'active' : ''}`}
      draggable
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      onClick={handleClick}
    >
      <span className="tab-name">{session.name}</span>
      <ConnectionStatusIcon 
        isConnected={session.isConnected}
        className={`tab-status ${session.isConnected ? 'connected' : 'disconnected'}`}
      />
      <button 
        className="tab-close"
        onClick={handleClose}
        title={t('common:close')}
      >
        ×
      </button>
    </div>
  );
});

