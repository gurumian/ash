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
  showNetcat,
  activeTab,
  onTabChange,
  onClose,
  onCloseAIChat,
  onCloseIperfClient,
  onCloseNetcat,
  children
}) {
  const { t } = useTranslation(['common']);

  const visibleTabs = [];
  if (showAIChat) visibleTabs.push('ai-chat');
  if (showIperfClient) visibleTabs.push('iperf-client');
  if (showNetcat) visibleTabs.push('netcat');

  // Determine if we should show tabs (more than one sidebar visible)
  const showTabs = visibleTabs.length > 1;
  
  // If no sidebar is visible, don't render
  if (visibleTabs.length === 0) {
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
          {visibleTabs.map((tabKey) => {
            const isActive = activeTab === tabKey;
            const label =
              tabKey === 'ai-chat'
                ? t('common:aiChat')
                : tabKey === 'iperf-client'
                  ? t('common:iperfClient')
                  : t('common:netcat', 'Netcat');

            const handleClose = (e) => {
              e.stopPropagation();
              if (tabKey === 'ai-chat' && onCloseAIChat) onCloseAIChat();
              if (tabKey === 'iperf-client' && onCloseIperfClient) onCloseIperfClient();
              if (tabKey === 'netcat' && onCloseNetcat) onCloseNetcat();
            };

            return (
              <div
                key={tabKey}
                className={`secondary-sidebar-tab ${isActive ? 'active' : ''}`}
                onClick={() => onTabChange(tabKey)}
              >
                <span>{label}</span>
                <button
                  className="secondary-sidebar-tab-close"
                  onClick={handleClose}
                  title={t('common:close')}
                >
                  ×
                </button>
              </div>
            );
          })}
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
