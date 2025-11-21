import React, { useState, useEffect } from 'react';
import './TftpServerDialog.css';

export function TftpServerDialog({ isOpen, onClose }) {
  const [status, setStatus] = useState({ running: false, port: null, outputDir: null });
  const [host, setHost] = useState('0.0.0.0');
  const [port, setPort] = useState(69);
  const [outputDir, setOutputDir] = useState(null); // null = use default, string = user selected
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Load current status when dialog opens
  useEffect(() => {
    if (isOpen) {
      loadStatus();
    }
  }, [isOpen]);

  const loadStatus = async () => {
    try {
      const result = await window.electronAPI?.tftpStatus?.();
      if (result) {
        setStatus(result);
        if (result.running && result.port) {
          setPort(result.port);
        }
        if (result.outputDir) {
          setStatus(prev => ({ ...prev, outputDir: result.outputDir }));
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
        setStatus({ running: false, port: null, outputDir: null });
        // Reset outputDir to null when stopping (will use default on next start)
        setOutputDir(null);
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

  if (!isOpen) return null;

  return (
    <div className="tftp-dialog-overlay" onClick={onClose}>
      <div className="tftp-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="tftp-dialog-header">
          <h2>TFTP Server</h2>
          <button className="tftp-dialog-close" onClick={onClose}>×</button>
        </div>
        
        <div className="tftp-dialog-content">
          <div className="tftp-status-section">
            <div 
              className={`tftp-status-card ${status.running ? 'running' : 'stopped'} ${loading ? 'loading' : ''}`}
              onClick={status.running ? handleStop : handleStart}
              style={{ cursor: loading ? 'not-allowed' : 'pointer' }}
            >
              <div className="tftp-status-item">
                <span className="tftp-status-label">Status</span>
                <div className="tftp-status-control">
                  <span className={`tftp-status-badge ${status.running ? 'running' : 'stopped'}`}>
                    {loading ? (status.running ? 'Stopping...' : 'Starting...') : (status.running ? 'Running' : 'Stopped')}
                  </span>
                  <span className="tftp-status-icon">
                    {loading ? '⏳' : (status.running ? '⏹' : '▶')}
                  </span>
                </div>
              </div>
              
              {status.running && (
                <>
                  <div className="tftp-status-item">
                    <span className="tftp-status-label">Port</span>
                    <span className="tftp-status-value">UDP/{status.port}</span>
                  </div>
                  <div className="tftp-status-item">
                    <span className="tftp-status-label">Host</span>
                    <span className="tftp-status-value">{host}</span>
                  </div>
                  {status.outputDir && (
                    <div className="tftp-status-item">
                      <span className="tftp-status-label">Output Directory</span>
                      <div className="tftp-output-dir">
                        <span className="tftp-output-dir-path" title={status.outputDir}>
                          {status.outputDir}
                        </span>
                        <button 
                          className="tftp-open-dir-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenOutputDir();
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
            <div className="tftp-config-section">
              <div className="tftp-config-item">
                <label htmlFor="tftp-host">Host:</label>
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
                <label htmlFor="tftp-port">Port:</label>
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
                <label htmlFor="tftp-output-dir">Output Directory:</label>
                <div className="tftp-dir-selector">
                  <input
                    id="tftp-output-dir"
                    type="text"
                    value={outputDir || '(Default: ~/Documents/ash/tftp/YYYYMMDD_HHMMSS/)'}
                    readOnly
                    disabled={loading}
                    className="tftp-dir-input"
                  />
                  <button
                    className="tftp-select-dir-btn"
                    onClick={handleSelectDirectory}
                    disabled={loading}
                    title="Select directory"
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
            <div className="tftp-error">
              {error}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

