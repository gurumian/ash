import React, { memo } from 'react';
import { useTranslation } from 'react-i18next';

/**
 * Status Bar component - Bottom status bar showing connection info, servers, and session count
 */
export const StatusBar = memo(function StatusBar({ 
  activeSession, 
  sessionsCount, 
  tftpStatus, 
  webStatus,
  iperfStatus,
  iperfClientStatus,
  onTftpClick,
  onWebClick,
  onIperfClick,
  onIperfClientClick,
  iperfAvailable = true,
}) {
  const { t } = useTranslation(['status', 'common']);

  const getConnectionText = () => {
    if (!activeSession) {
      return t('status:ready');
    }
    
    if (activeSession.connectionType === 'serial') {
      return `${t('status:connectedToSerial')}: ${activeSession.serialPort}`;
    } else {
      return `${t('status:connectedTo')} ${activeSession.user}@${activeSession.host}:${activeSession.port}`;
    }
  };

  return (
    <div className="status-bar">
      <div className="status-left">
        <span>{getConnectionText()}</span>
        {tftpStatus?.running && (
          <button 
            type="button"
            className="status-indicator status-tftp-indicator" 
            title={t('status:tftpServerTooltip', { port: tftpStatus.port })}
            onClick={onTftpClick}
          >
            • {t('status:tftpServer')}: UDP/{tftpStatus.port}
          </button>
        )}
        {webStatus?.running && (
          <button 
            type="button"
            className="status-indicator status-web-indicator" 
            title={t('status:webServerTooltip', { port: webStatus.port })}
            onClick={onWebClick}
          >
            • {t('status:webServer')}: HTTP/{webStatus.port}
          </button>
        )}
        {iperfAvailable && (
          <>
            {iperfStatus?.running && (
              <button 
                type="button"
                className="status-indicator status-iperf-indicator" 
                title={t('status:iperf3ServerTooltip', { port: iperfStatus.port })}
                onClick={onIperfClick}
              >
                • {t('status:iperf3Server')}: TCP/{iperfStatus.port}
              </button>
            )}
            {iperfClientStatus?.running && (
              <button 
                type="button"
                className="status-indicator status-iperf-client-indicator" 
                title={t('status:iperf3ClientTooltip')}
                onClick={onIperfClientClick}
              >
                • {t('status:iperf3Client')}
              </button>
            )}
          </>
        )}
      </div>
      <div className="status-right">
        <span>{t('status:sessions')}: {sessionsCount}</span>
      </div>
    </div>
  );
});

