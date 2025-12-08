import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import './IperfClientDialog.css';

export function IperfClientDialog({ isOpen, onClose, activeSession }) {
  const { t } = useTranslation(['client', 'common']);
  const [status, setStatus] = useState({ running: false });
  const [host, setHost] = useState('localhost');
  const [port, setPort] = useState(5201);
  const [protocol, setProtocol] = useState('tcp'); // 'tcp' | 'udp'
  const [streams, setStreams] = useState(1);
  const [bandwidth, setBandwidth] = useState(''); // e.g., 100M
  const [duration, setDuration] = useState(10); // seconds
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [output, setOutput] = useState('');
  const outputRef = useRef(null);

  // Load current status when dialog opens
  useEffect(() => {
    if (isOpen) {
      loadStatus();
      // Don't clear output when dialog opens - preserve previous run results
      // User can manually clear with the Clear button if needed
      
      // Auto-fill host from active SSH session if available
      if (activeSession && activeSession.connectionType === 'ssh' && activeSession.isConnected && activeSession.host) {
        setHost(activeSession.host);
      } else {
        // Reset to localhost if no active SSH session
        setHost('localhost');
      }
    }
  }, [isOpen, activeSession]);

  // Auto-scroll output to bottom
  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [output]);

  // Listen for client events - register once on mount to capture output in real-time
  // even if dialog is closed temporarily
  useEffect(() => {
    const handleError = (data) => {
      if (!isOpen) return; // Only show errors when dialog is open
      setError(data.detail || data.message || 'iperf3 client error');
      setLoading(false);
    };

    const handleOutput = (data) => {
      // Always update output state in real-time - this ensures output is captured
      // even if dialog was closed during execution
      if (data && data.output) {
        setOutput(prev => prev + data.output);
      }
    };

    const handleStopped = (data) => {
      setStatus({ running: false });
      setLoading(false);
      if (data && data.output) {
        setOutput(prev => prev + data.output);
      }
    };

    // Register listeners once when component mounts
    const errorHandler = window.electronAPI?.onIperfClientError?.(handleError);
    const outputHandler = window.electronAPI?.onIperfClientOutput?.(handleOutput);
    const stoppedHandler = window.electronAPI?.onIperfClientStopped?.(handleStopped);

    return () => {
      // Cleanup only when component unmounts
      if (errorHandler) window.electronAPI?.offIperfClientError?.(handleError);
      if (outputHandler) window.electronAPI?.offIperfClientOutput?.(handleOutput);
      if (stoppedHandler) window.electronAPI?.offIperfClientStopped?.(handleStopped);
    };
  }, []); // Register once on mount - don't re-register when isOpen changes

  const loadStatus = async () => {
    try {
      const result = await window.electronAPI?.iperfClientStatus?.();
      if (result) {
        setStatus(result);
        if (result.running) {
          setLoading(false);
        }
      }
    } catch (err) {
      console.error('Failed to load iperf3 client status:', err);
    }
  };

  const handleStart = async () => {
    if (loading || !host || !port) return;
    
    setLoading(true);
    setError(null);
    setOutput(''); // Clear output only when starting a new test
    
    try {
      const result = await window.electronAPI?.iperfClientStart?.({
        host,
        port,
        protocol,
        streams,
        bandwidth: bandwidth || null,
        duration
      });
      if (result?.success) {
        setStatus({ running: true });
      } else {
        setError(result?.error || 'Failed to start iperf3 client');
        setLoading(false);
      }
    } catch (err) {
      setError(err.message || 'Failed to start iperf3 client');
      setLoading(false);
    }
  };

  const handleStop = async () => {
    if (loading) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const result = await window.electronAPI?.iperfClientStop?.();
      if (result?.success) {
        await loadStatus();
      } else {
        setError(result?.error || 'Failed to stop iperf3 client');
        setLoading(false);
      }
    } catch (err) {
      setError(err.message || 'Failed to stop iperf3 client');
      setLoading(false);
    }
  };

  const handleClear = () => {
    setOutput('');
  };

  if (!isOpen) return null;

  return (
    <div className="iperf-client-dialog-overlay">
      <div className="iperf-client-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="iperf-client-dialog-header">
          <h2>{t('client:iperf.title')}</h2>
          <button className="iperf-client-dialog-close" onClick={onClose}>×</button>
        </div>
        
        <div className="iperf-client-dialog-content">
          <div className="iperf-client-status-section">
            <div 
              className={`iperf-client-status-card ${status.running ? 'running' : 'stopped'} ${loading ? 'loading' : ''}`}
            >
              <div className="iperf-client-status-item">
                <span className="iperf-client-status-label">{t('client:iperf.status')}</span>
                <div 
                  className="iperf-client-status-control"
                  onClick={status.running ? handleStop : handleStart}
                  style={{ cursor: loading ? 'not-allowed' : 'pointer' }}
                >
                  <span className={`iperf-client-status-badge ${status.running ? 'running' : 'stopped'}`}>
                    {loading ? (status.running ? t('client:iperf.stopping') : t('client:iperf.starting')) : (status.running ? t('client:iperf.running') : t('client:iperf.stopped'))}
                  </span>
                  <span className="iperf-client-status-icon">
                    {loading ? '⏳' : (status.running ? '⏹' : '▶')}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {!status.running && (
            <div className="iperf-client-config-section">
              <div className="iperf-client-config-item">
                <label htmlFor="iperf-client-host">{t('client:iperf.host')}:</label>
                <input
                  id="iperf-client-host"
                  type="text"
                  value={host}
                  onChange={(e) => setHost(e.target.value)}
                  placeholder="localhost"
                  disabled={loading}
                />
              </div>
              <div className="iperf-client-config-item">
                <label htmlFor="iperf-client-port">{t('client:iperf.port')}:</label>
                <input
                  id="iperf-client-port"
                  type="number"
                  value={port}
                  onChange={(e) => setPort(parseInt(e.target.value) || 5201)}
                  placeholder="5201"
                  min="1"
                  max="65535"
                  disabled={loading}
                />
              </div>
              <div className="iperf-client-config-item">
                <label htmlFor="iperf-client-protocol">{t('client:iperf.protocol')}:</label>
                <div className="iperf-client-protocol-toggle" id="iperf-client-protocol">
                  <button
                    type="button"
                    className={`iperf-client-protocol-btn ${protocol === 'tcp' ? 'active' : ''}`}
                    onClick={() => setProtocol('tcp')}
                    disabled={loading}
                  >
                    TCP
                  </button>
                  <button
                    type="button"
                    className={`iperf-client-protocol-btn ${protocol === 'udp' ? 'active' : ''}`}
                    onClick={() => setProtocol('udp')}
                    disabled={loading}
                  >
                    UDP
                  </button>
                </div>
              </div>
              <div className="iperf-client-config-item">
                <label htmlFor="iperf-client-streams">{t('client:iperf.parallelStreams')}:</label>
                <input
                  id="iperf-client-streams"
                  type="number"
                  value={streams}
                  onChange={(e) => setStreams(Math.max(1, parseInt(e.target.value, 10) || 1))}
                  placeholder="1"
                  min="1"
                  max="64"
                  disabled={loading}
                />
              </div>
              <div className="iperf-client-config-item">
                <label htmlFor="iperf-client-bandwidth">{t('client:iperf.bandwidthLabel')}:</label>
                <input
                  id="iperf-client-bandwidth"
                  type="text"
                  value={bandwidth}
                  onChange={(e) => setBandwidth(e.target.value)}
                  placeholder={t('client:iperf.bandwidthPlaceholder')}
                  disabled={loading || protocol !== 'udp'}
                />
              </div>
              <div className="iperf-client-config-item">
                <label htmlFor="iperf-client-duration">{t('client:iperf.duration')}:</label>
                <input
                  id="iperf-client-duration"
                  type="number"
                  value={duration}
                  onChange={(e) => setDuration(Math.max(1, parseInt(e.target.value, 10) || 10))}
                  placeholder="10"
                  min="1"
                  max="3600"
                  disabled={loading}
                />
                <span className="iperf-client-config-hint">{t('client:iperf.durationHint')}</span>
              </div>
            </div>
          )}

          {(status.running || output) && (
            <div className="iperf-client-output-section">
              <div className="iperf-client-output-header">
                <span className="iperf-client-output-title">{t('client:iperf.output')}</span>
                <button 
                  className="iperf-client-clear-btn"
                  onClick={handleClear}
                  disabled={loading}
                >
                  {t('client:iperf.clear')}
                </button>
              </div>
              <div 
                ref={outputRef}
                className="iperf-client-output"
              >
                {output || <span className="iperf-client-output-empty">{t('client:iperf.waitingForOutput')}</span>}
              </div>
            </div>
          )}

          {error && (
            <div className="iperf-client-error">
              {error}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

