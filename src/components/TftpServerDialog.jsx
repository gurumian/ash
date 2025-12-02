import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import './TftpServerDialog.css';

export function TftpServerDialog({ isOpen, onClose }) {
  const { t } = useTranslation(['server', 'common']);
  const [status, setStatus] = useState({ running: false, port: null, outputDir: null });
  const [host, setHost] = useState('0.0.0.0');
  const [port, setPort] = useState(69);
  const [outputDir, setOutputDir] = useState(null); // null = use default, string = user selected
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [endpoints, setEndpoints] = useState([]);

  // Load current status when dialog opens
  useEffect(() => {
    if (isOpen) {
      loadStatus();
      loadEndpoints();
    }
  }, [isOpen, status.running, status.port, host]);

  const loadEndpointsForStatus = async (statusToUse = status) => {
    if (!statusToUse.running || !statusToUse.port) {
      setEndpoints([]);
      return;
    }

    try {
      // If host is 0.0.0.0, get all network interfaces
      if (host === '0.0.0.0') {
        const result = await window.electronAPI?.getNetworkInterfaces?.();
        if (result?.success && result.addresses) {
          const eps = result.addresses.map(addr => ({
            endpoint: `${addr.address}:${statusToUse.port}`,
            address: addr.address,
            internal: addr.internal,
            interface: addr.interface
          }));
          setEndpoints(eps);
        } else {
          // Fallback to localhost if network interfaces can't be retrieved
          setEndpoints([
            { endpoint: `localhost:${statusToUse.port}`, address: 'localhost', internal: true },
            { endpoint: `127.0.0.1:${statusToUse.port}`, address: '127.0.0.1', internal: true }
          ]);
        }
      } else {
        // If specific host, just show that one
        setEndpoints([
          { endpoint: `${host}:${statusToUse.port}`, address: host, internal: host === 'localhost' || host === '127.0.0.1' }
        ]);
      }
    } catch (err) {
      console.error('Failed to load TFTP endpoints:', err);
      // Fallback to localhost
      setEndpoints([
        { endpoint: `localhost:${statusToUse.port}`, address: 'localhost', internal: true }
      ]);
    }
  };

  const loadEndpoints = () => {
    loadEndpointsForStatus();
  };

  const loadStatus = async () => {
    try {
      const result = await window.electronAPI?.tftpStatus?.();
      if (result) {
        setStatus(result);
        if (result.running && result.port) {
          setPort(result.port);
        }
        // Always update outputDir from server state if available
        // This ensures the path is displayed correctly when dialog reopens
        if (result.outputDir !== undefined) {
          setOutputDir(result.outputDir);
        }
      }
    } catch (err) {
      console.error('Failed to load TFTP status:', err);
    }
  };

  const handleSelectDirectory = async () => {
    try {
      const result = await window.electronAPI?.showDirectoryPicker?.(outputDir || undefined);
      if (result?.success && result.path) {
        setOutputDir(result.path);
      }
    } catch (err) {
      console.error('Failed to select directory:', err);
    }
  };

  const handleStart = async () => {
    if (loading || !host || !port) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const params = { host, port };
      if (outputDir) {
        params.outputDir = outputDir;
      }
      const result = await window.electronAPI?.tftpStart?.(params);
      if (result?.success) {
        setStatus({
          running: true,
          port: result.port,
          outputDir: result.outputDir
        });
        // Load endpoints after server starts
        setTimeout(() => {
          loadEndpointsForStatus({
            running: true,
            port: result.port,
            outputDir: result.outputDir
          });
        }, 100);
      } else {
        setError(result?.error || 'Failed to start TFTP server');
      }
    } catch (err) {
      setError(err.message || 'Failed to start TFTP server');
    } finally {
      setLoading(false);
    }
  };

  const handleStop = async () => {
    if (loading) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const result = await window.electronAPI?.tftpStop?.();
      if (result?.success) {
        // Reload status to get the current outputDir from server
        // This preserves the selected directory even after stopping
        await loadStatus();
        setEndpoints([]);
      } else {
        setError(result?.error || 'Failed to stop TFTP server');
      }
    } catch (err) {
      setError(err.message || 'Failed to stop TFTP server');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenOutputDir = async () => {
    if (status.outputDir) {
      try {
        await window.electronAPI?.openPath?.(status.outputDir);
      } catch (err) {
        console.error('Failed to open output directory:', err);
      }
    }
  };


  const handlePathCopy = async (e, path) => {
    e.stopPropagation();
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(path);
      } else {
        // Fallback for older browsers
        const textArea = document.createElement('textarea');
        textArea.value = path;
        textArea.style.position = 'fixed';
        textArea.style.opacity = '0';
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
      }
    } catch (err) {
      console.error('Failed to copy path:', err);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="tftp-dialog-overlay" onClick={onClose}>
      <div className="tftp-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="tftp-dialog-header">
          <h2>{t('server:tftp.title')}</h2>
          <button className="tftp-dialog-close" onClick={onClose}>×</button>
        </div>
        
        <div className="tftp-dialog-content">
          <div className="tftp-status-section">
            <div 
              className={`tftp-status-card ${status.running ? 'running' : 'stopped'} ${loading ? 'loading' : ''}`}
            >
              <div className="tftp-status-item">
                <span className="tftp-status-label">{t('server:tftp.status')}</span>
                <div 
                  className="tftp-status-control"
                  onClick={status.running ? handleStop : handleStart}
                  style={{ cursor: loading ? 'not-allowed' : 'pointer' }}
                >
                  <span className={`tftp-status-badge ${status.running ? 'running' : 'stopped'}`}>
                    {loading ? (status.running ? t('server:tftp.stopping') : t('server:tftp.starting')) : (status.running ? t('server:tftp.running') : t('server:tftp.stopped'))}
                  </span>
                  <span className="tftp-status-icon">
                    {loading ? '⏳' : (status.running ? '⏹' : '▶')}
                  </span>
                </div>
              </div>
              
              {status.running && (
                <>
                  <div className="tftp-status-item">
                    <span className="tftp-status-label">{t('server:tftp.port')}</span>
                    <span className="tftp-status-value">UDP/{status.port}</span>
                  </div>
                  <div className="tftp-status-item">
                    <span className="tftp-status-label">{t('server:tftp.host')}</span>
                    <span className="tftp-status-value">{host}</span>
                  </div>
                  <div className="tftp-status-item">
                    <span className="tftp-status-label">{t('server:tftp.accessibleEndpoints')}</span>
                    <div className="tftp-endpoints-list">
                      {endpoints.length > 0 ? (
                        endpoints.map((item, index) => (
                          <div key={index} className="tftp-endpoint-item">
                            <span 
                              className="tftp-endpoint-value" 
                              title={item.endpoint}
                              onClick={(e) => {
                                e.stopPropagation();
                                handlePathCopy(e, item.endpoint);
                              }}
                            >
                              {item.endpoint}
                            </span>
                            <button 
                              className="tftp-copy-endpoint-btn"
                              onClick={(e) => {
                                e.stopPropagation();
                                handlePathCopy(e, item.endpoint);
                              }}
                              title={t('server:tftp.copyEndpoint')}
                            >
                              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M4 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z" stroke="currentColor" strokeWidth="1.5" fill="none"/>
                                <path d="M2 6h10a2 2 0 0 1 2 2v6" stroke="currentColor" strokeWidth="1.5" fill="none" strokeDasharray="2 2"/>
                              </svg>
                            </button>
                          </div>
                        ))
                      ) : (
                        <span className="tftp-endpoint-value">{t('server:tftp.loading')}</span>
                      )}
                    </div>
                  </div>
                  {status.outputDir && (
                    <div className="tftp-status-item">
                      <span className="tftp-status-label">{t('server:tftp.outputDirectory')}</span>
                      <div 
                        className="tftp-output-dir"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <span 
                          className="tftp-output-dir-path" 
                          title={status.outputDir}
                          onClick={(e) => e.stopPropagation()}
                        >
                          {status.outputDir}
                        </span>
                        <button 
                          className="tftp-copy-path-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            handlePathCopy(e, status.outputDir);
                          }}
                          title={t('server:tftp.copyPath')}
                        >
                          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M4 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z" stroke="currentColor" strokeWidth="1.5" fill="none"/>
                            <path d="M2 6h10a2 2 0 0 1 2 2v6" stroke="currentColor" strokeWidth="1.5" fill="none" strokeDasharray="2 2"/>
                          </svg>
                        </button>
                        <button 
                          className="tftp-open-dir-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenOutputDir();
                          }}
                          title={t('server:tftp.openDirectory')}
                        >
                          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M2 3h5l1 2h6v8H2V3z" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          {!status.running && (
            <div className="tftp-config-section">
              <div className="tftp-config-item">
                <label htmlFor="tftp-host">{t('server:tftp.host')}:</label>
                <input
                  id="tftp-host"
                  type="text"
                  value={host}
                  onChange={(e) => setHost(e.target.value)}
                  placeholder="0.0.0.0"
                  disabled={loading}
                />
              </div>
              <div className="tftp-config-item">
                <label htmlFor="tftp-port">{t('server:tftp.port')}:</label>
                <input
                  id="tftp-port"
                  type="number"
                  value={port}
                  onChange={(e) => setPort(parseInt(e.target.value) || 69)}
                  placeholder="69"
                  min="1"
                  max="65535"
                  disabled={loading}
                />
              </div>
              <div className="tftp-config-item">
                <label htmlFor="tftp-output-dir">{t('server:tftp.outputDirectory')}:</label>
                <div className="tftp-dir-selector">
                  <input
                    id="tftp-output-dir"
                    type="text"
                    value={outputDir || '(Default: ~/Documents/ash/tftp/)'}
                    readOnly
                    disabled={loading}
                    className="tftp-dir-input"
                    title={outputDir || '~/Documents/ash/tftp/'}
                  />
                  {outputDir && (
                    <button
                      className="tftp-copy-path-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        handlePathCopy(e, outputDir);
                      }}
                      disabled={loading}
                      title={t('server:tftp.copyPath')}
                    >
                      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M4 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z" stroke="currentColor" strokeWidth="1.5" fill="none"/>
                        <path d="M2 6h10a2 2 0 0 1 2 2v6" stroke="currentColor" strokeWidth="1.5" fill="none" strokeDasharray="2 2"/>
                      </svg>
                    </button>
                  )}
                  <button
                    className="tftp-select-dir-btn"
                    onClick={handleSelectDirectory}
                    disabled={loading}
                    title={t('server:tftp.selectDirectory')}
                  >
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M2 3h5l1 2h6v8H2V3z" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </button>
                  {outputDir && (
                    <button
                      className="tftp-clear-dir-btn"
                      onClick={() => setOutputDir(null)}
                      disabled={loading}
                      title={t('server:tftp.useDefaultDirectory')}
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {error && (
            <div className="tftp-error">
              {error}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

