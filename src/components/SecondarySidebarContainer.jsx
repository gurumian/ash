import React, { memo } from 'react';
import { useTranslation } from 'react-i18next';
import './SecondarySidebarContainer.css';

/**
 * Secondary Sidebar Container - Tabbed container for secondary sidebars
 * (AI Chat, iperf3 Client, etc.)
 */
export const SecondarySidebarContainer = memo(function SecondarySidebarContainer({
  width,
  showAIChat,
  showIperfClient,
  activeTab,
  onTabChange,
  onClose,
  onCloseAIChat,
  onCloseIperfClient,
  children
}) {
  const { t } = useTranslation(['common']);

  // Determine if we should show tabs (both sidebars visible)
  const showTabs = showAIChat && showIperfClient;
  
  // If only one sidebar is visible, don't show tabs
  if (!showAIChat && !showIperfClient) {
    return null;
  }

  return (
    <div
      className="secondary-sidebar-container"
      style={{
        width: `${width}px`,
        height: '100%',
        background: '#000000',
        borderLeft: '1px solid #1a1a1a',
        display: 'flex',
        flexDirection: 'column',
        flexShrink: 0,
        overflow: 'hidden'
      }}
    >
      {/* Tab Header - Only show when both sidebars are visible */}
      {showTabs && (
        <div className="secondary-sidebar-tabs">
          <button
            className={`secondary-sidebar-tab ${activeTab === 'ai-chat' ? 'active' : ''}`}
            onClick={() => onTabChange('ai-chat')}
          >
            {t('common:aiChat')}
          </button>
          <button
            className={`secondary-sidebar-tab ${activeTab === 'iperf-client' ? 'active' : ''}`}
            onClick={() => onTabChange('iperf-client')}
          >
            {t('common:iperfClient')}
          </button>
          <button
            className="secondary-sidebar-close"
            onClick={onClose}
            title={t('common:close')}
          >
            ×
          </button>
        </div>
      )}

      {/* Content - Show based on active tab or single sidebar */}
      <div className="secondary-sidebar-content">
        {children}
      </div>
    </div>
  );
});
