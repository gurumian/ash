import React, { useState, useEffect } from 'react';
import './WebServerDialog.css';

export function WebServerDialog({ isOpen, onClose }) {
  const [status, setStatus] = useState({ running: false, port: null, rootDir: null });
  const [host, setHost] = useState('0.0.0.0');
  const [port, setPort] = useState(8080);
  const [rootDir, setRootDir] = useState(null); // null = use default, string = user selected
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [accessibleUrls, setAccessibleUrls] = useState([]);

  // Load current status when dialog opens
  useEffect(() => {
    if (isOpen) {
      loadStatus();
      loadAccessibleUrls();
    }
  }, [isOpen, status.running, status.port]);

  const loadAccessibleUrlsForStatus = async (statusToUse = status) => {
    if (!statusToUse.running || !statusToUse.port) {
      setAccessibleUrls([]);
      return;
    }

    try {
      // If host is 0.0.0.0, get all network interfaces
      if (host === '0.0.0.0') {
        const result = await window.electronAPI?.webGetNetworkInterfaces?.();
        if (result?.success && result.addresses) {
          const urls = result.addresses.map(addr => ({
            url: `http://${addr.address}:${statusToUse.port}`,
            address: addr.address,
            internal: addr.internal,
            interface: addr.interface
          }));
          setAccessibleUrls(urls);
        } else {
          // Fallback to localhost if network interfaces can't be retrieved
          setAccessibleUrls([
            { url: `http://localhost:${statusToUse.port}`, address: 'localhost', internal: true },
            { url: `http://127.0.0.1:${statusToUse.port}`, address: '127.0.0.1', internal: true }
          ]);
        }
      } else {
        // If specific host, just show that one
        setAccessibleUrls([
          { url: `http://${host}:${statusToUse.port}`, address: host, internal: host === 'localhost' || host === '127.0.0.1' }
        ]);
      }
    } catch (err) {
      console.error('Failed to load accessible URLs:', err);
      // Fallback to localhost
      setAccessibleUrls([
        { url: `http://localhost:${statusToUse.port}`, address: 'localhost', internal: true }
      ]);
    }
  };

  const loadAccessibleUrls = () => {
    loadAccessibleUrlsForStatus();
  };

  const loadStatus = async () => {
    try {
      const result = await window.electronAPI?.webStatus?.();
      if (result) {
        setStatus(result);
        if (result.running && result.port) {
          setPort(result.port);
        }
        // Always update rootDir from server state if available
        // This ensures the path is displayed correctly when dialog reopens
        if (result.rootDir !== undefined) {
          setRootDir(result.rootDir);
        }
      }
    } catch (err) {
      console.error('Failed to load Web Server status:', err);
    }
  };

  const handleSelectDirectory = async () => {
    try {
      const result = await window.electronAPI?.showDirectoryPicker?.(rootDir || undefined);
      if (result?.success && result.path) {
        setRootDir(result.path);
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
      if (rootDir) {
        params.rootDir = rootDir;
      }
      const result = await window.electronAPI?.webStart?.(params);
      if (result?.success) {
        const newStatus = {
          running: true,
          port: result.port,
          rootDir: result.rootDir
        };
        setStatus(newStatus);
        // Load accessible URLs after server starts
        setTimeout(() => {
          loadAccessibleUrlsForStatus(newStatus);
        }, 100);
      } else {
        setError(result?.error || 'Failed to start Web Server');
      }
    } catch (err) {
      setError(err.message || 'Failed to start Web Server');
    } finally {
      setLoading(false);
    }
  };

  const handleStop = async () => {
    if (loading) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const result = await window.electronAPI?.webStop?.();
      if (result?.success) {
        // Reload status to get the current rootDir from server
        // This preserves the selected directory even after stopping
        await loadStatus();
      } else {
        setError(result?.error || 'Failed to stop Web Server');
      }
    } catch (err) {
      setError(err.message || 'Failed to stop Web Server');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenRootDir = async () => {
    if (status.rootDir) {
      try {
        await window.electronAPI?.openPath?.(status.rootDir);
      } catch (err) {
        console.error('Failed to open root directory:', err);
      }
    }
  };

  const handleOpenURL = async (url = null) => {
    const urlToOpen = url || getPrimaryURL();
    if (!urlToOpen) return;
    
    // Use openExternal if available (in Electron context)
    if (window.electronAPI?.openExternal) {
      try {
        await window.electronAPI.openExternal(urlToOpen);
      } catch (err) {
        // Fallback: copy URL to clipboard
        await handlePathCopy(null, urlToOpen);
      }
    } else {
      // Fallback: copy URL to clipboard
      await handlePathCopy(null, urlToOpen);
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

  const getPrimaryURL = () => {
    if (!status.running || !status.port) return null;
    // Return the first accessible URL (usually localhost)
    return accessibleUrls.length > 0 ? accessibleUrls[0].url : `http://localhost:${status.port}`;
  };

  if (!isOpen) return null;

  return (
    <div className="web-dialog-overlay" onClick={onClose}>
      <div className="web-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="web-dialog-header">
          <h2>Web Server</h2>
          <button className="web-dialog-close" onClick={onClose}>×</button>
        </div>
        
        <div className="web-dialog-content">
          <div className="web-status-section">
            <div 
              className={`web-status-card ${status.running ? 'running' : 'stopped'} ${loading ? 'loading' : ''}`}
            >
              <div className="web-status-item">
                <span className="web-status-label">Status</span>
                <div 
                  className="web-status-control"
                  onClick={status.running ? handleStop : handleStart}
                  style={{ cursor: loading ? 'not-allowed' : 'pointer' }}
                >
                  <span className={`web-status-badge ${status.running ? 'running' : 'stopped'}`}>
                    {loading ? (status.running ? 'Stopping...' : 'Starting...') : (status.running ? 'Running' : 'Stopped')}
                  </span>
                  <span className="web-status-icon">
                    {loading ? '⏳' : (status.running ? '⏹' : '▶')}
                  </span>
                </div>
              </div>
              
              {status.running && (
                <>
                  <div className="web-status-item">
                    <span className="web-status-label">Accessible URLs</span>
                    <div className="web-urls-list">
                      {accessibleUrls.length > 0 ? (
                        accessibleUrls.map((item, index) => (
                          <div key={index} className="web-url-item">
                            <span 
                              className="web-url-value" 
                              title={item.url}
                              onClick={(e) => {
                                e.stopPropagation();
                                handlePathCopy(e, item.url);
                              }}
                            >
                              {item.url}
                            </span>
                            <button 
                              className="web-copy-url-btn"
                              onClick={(e) => {
                                e.stopPropagation();
                                handlePathCopy(e, item.url);
                              }}
                              title="Copy URL"
                            >
                              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M4 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z" stroke="currentColor" strokeWidth="1.5" fill="none"/>
                                <path d="M2 6h10a2 2 0 0 1 2 2v6" stroke="currentColor" strokeWidth="1.5" fill="none" strokeDasharray="2 2"/>
                              </svg>
                            </button>
                            <button 
                              className="web-open-url-btn"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenURL(item.url);
                              }}
                              title="Open in browser"
                            >
                              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M6 2h8v8M14 2l-8 8M10 2h4v4" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
                              </svg>
                            </button>
                          </div>
                        ))
                      ) : (
                        <span className="web-url-value">Loading...</span>
                      )}
                    </div>
                  </div>
                  <div className="web-status-item">
                    <span className="web-status-label">Port</span>
                    <span className="web-status-value">HTTP/{status.port}</span>
                  </div>
                  <div className="web-status-item">
                    <span className="web-status-label">Host</span>
                    <span className="web-status-value">{host}</span>
                  </div>
                  {status.rootDir && (
                    <div className="web-status-item">
                      <span className="web-status-label">Root Directory</span>
                      <div 
                        className="web-root-dir"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <span 
                          className="web-root-dir-path" 
                          title={status.rootDir}
                          onClick={(e) => e.stopPropagation()}
                        >
                          {status.rootDir}
                        </span>
                        <button 
                          className="web-copy-path-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            handlePathCopy(e, status.rootDir);
                          }}
                          title="Copy path"
                        >
                          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M4 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z" stroke="currentColor" strokeWidth="1.5" fill="none"/>
                            <path d="M2 6h10a2 2 0 0 1 2 2v6" stroke="currentColor" strokeWidth="1.5" fill="none" strokeDasharray="2 2"/>
                          </svg>
                        </button>
                        <button 
                          className="web-open-dir-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenRootDir();
                          }}
                          title="Open directory"
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
            <div className="web-config-section">
              <div className="web-config-item">
                <label htmlFor="web-host">Host:</label>
                <input
                  id="web-host"
                  type="text"
                  value={host}
                  onChange={(e) => setHost(e.target.value)}
                  placeholder="0.0.0.0"
                  disabled={loading}
                />
              </div>
              <div className="web-config-item">
                <label htmlFor="web-port">Port:</label>
                <input
                  id="web-port"
                  type="number"
                  value={port}
                  onChange={(e) => setPort(parseInt(e.target.value) || 8080)}
                  placeholder="8080"
                  min="1"
                  max="65535"
                  disabled={loading}
                />
              </div>
              <div className="web-config-item">
                <label htmlFor="web-root-dir">Root Directory:</label>
                <div className="web-dir-selector">
                  <input
                    id="web-root-dir"
                    type="text"
                    value={rootDir || '(Default: ~/Documents/ash/web/)'}
                    readOnly
                    disabled={loading}
                    className="web-dir-input"
                    title={rootDir || '~/Documents/ash/web/'}
                  />
                  {rootDir && (
                    <button
                      className="web-copy-path-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        handlePathCopy(e, rootDir);
                      }}
                      disabled={loading}
                      title="Copy path"
                    >
                      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M4 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z" stroke="currentColor" strokeWidth="1.5" fill="none"/>
                        <path d="M2 6h10a2 2 0 0 1 2 2v6" stroke="currentColor" strokeWidth="1.5" fill="none" strokeDasharray="2 2"/>
                      </svg>
                    </button>
                  )}
                  <button
                    className="web-select-dir-btn"
                    onClick={handleSelectDirectory}
                    disabled={loading}
                    title="Select directory"
                  >
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M2 3h5l1 2h6v8H2V3z" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </button>
                  {rootDir && (
                    <button
                      className="web-clear-dir-btn"
                      onClick={() => setRootDir(null)}
                      disabled={loading}
                      title="Use default directory"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {error && (
            <div className="web-error">
              {error}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

