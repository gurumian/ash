import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import './IperfServerDialog.css';

export function IperfServerDialog({ isOpen, onClose }) {
  const { t } = useTranslation(['server', 'common']);
  const [status, setStatus] = useState({ running: false, port: null, host: null, protocol: 'tcp', streams: 1, bandwidth: null });
  const [host, setHost] = useState('0.0.0.0');
  const [port, setPort] = useState(5201);
  const [protocol, setProtocol] = useState('tcp'); // 'tcp' | 'udp'
  const [streams, setStreams] = useState(1);
  const [bandwidth, setBandwidth] = useState(''); // e.g., 100M
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [endpoints, setEndpoints] = useState([]);

  // Load current status when dialog opens
  useEffect(() => {
    if (isOpen) {
      loadStatus();
      loadEndpoints();
    }
  }, [isOpen, status.running, status.port, host, protocol, streams, bandwidth]);

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
          const eps = result.addresses.map(addr => {
            // Build client command per address
            const parts = [
              'iperf3',
              '-c',
              addr.address,
              '-p',
              statusToUse.port.toString(),
            ];
            const isUdp = (statusToUse.protocol || protocol || 'tcp').toLowerCase() === 'udp';
            const streamsVal = statusToUse.streams || streams || 1;
            const bwVal =
              statusToUse.bandwidth !== undefined && statusToUse.bandwidth !== null
                ? statusToUse.bandwidth
                : (bandwidth || '');
            if (isUdp) {
              parts.push('-u');
              if (bwVal) parts.push('-b', bwVal);
            }
            if (streamsVal && streamsVal > 1) {
              parts.push('-P', streamsVal.toString());
            }
            return {
              command: parts.join(' '),
              address: addr.address,
              internal: addr.internal,
              interface: addr.interface,
            };
          });
          setEndpoints(eps);
        } else {
          // Fallback to localhost if network interfaces can't be retrieved
          const parts = [
            'iperf3',
            '-c',
            'localhost',
            '-p',
            statusToUse.port.toString(),
          ];
          const isUdp = (statusToUse.protocol || protocol || 'tcp').toLowerCase() === 'udp';
          const streamsVal = statusToUse.streams || streams || 1;
          const bwVal =
            statusToUse.bandwidth !== undefined && statusToUse.bandwidth !== null
              ? statusToUse.bandwidth
              : (bandwidth || '');
          if (isUdp) {
            parts.push('-u');
            if (bwVal) parts.push('-b', bwVal);
          }
          if (streamsVal && streamsVal > 1) {
            parts.push('-P', streamsVal.toString());
          }
          setEndpoints([
            { command: parts.join(' '), address: 'localhost', internal: true },
          ]);
        }
      } else {
        // Specific host: single command
        const parts = [
          'iperf3',
          '-c',
          statusToUse.host || host,
          '-p',
          statusToUse.port.toString(),
        ];
        const isUdp = (statusToUse.protocol || protocol || 'tcp').toLowerCase() === 'udp';
        const streamsVal = statusToUse.streams || streams || 1;
        const bwVal =
          statusToUse.bandwidth !== undefined && statusToUse.bandwidth !== null
            ? statusToUse.bandwidth
            : (bandwidth || '');
        if (isUdp) {
          parts.push('-u');
          if (bwVal) parts.push('-b', bwVal);
        }
        if (streamsVal && streamsVal > 1) {
          parts.push('-P', streamsVal.toString());
        }
        setEndpoints([
          {
            command: parts.join(' '),
            address: statusToUse.host || host,
            internal: (statusToUse.host || host) === 'localhost' || (statusToUse.host || host) === '127.0.0.1',
          },
        ]);
      }
    } catch (err) {
      console.error('Failed to load iperf3 endpoints:', err);
      // Fallback to localhost
      const parts = [
        'iperf3',
        '-c',
        'localhost',
        '-p',
        (statusToUse.port || port).toString(),
      ];
      setEndpoints([
        { command: parts.join(' '), address: 'localhost', internal: true },
      ]);
    }
  };

  const loadEndpoints = () => {
    loadEndpointsForStatus();
  };

  // Listen for server errors
  useEffect(() => {
    if (!isOpen) return;

    const handleError = (data) => {
      setError(data.detail || data.message || 'iperf3 server error');
    };

    const handleStopped = () => {
      loadStatus();
    };

    window.electronAPI?.onIperfServerError?.(handleError);
    window.electronAPI?.onIperfServerStopped?.(handleStopped);

    return () => {
      window.electronAPI?.offIperfServerError?.(handleError);
      window.electronAPI?.offIperfServerStopped?.(handleStopped);
    };
  }, [isOpen]);

  const loadStatus = async () => {
    try {
      const result = await window.electronAPI?.iperfStatus?.();
      if (result) {
        setStatus(result);
        if (result.running && result.port) {
          setPort(result.port);
        }
        if (result.host) {
          setHost(result.host);
        }
        if (result.protocol) {
          setProtocol(result.protocol);
        }
        if (typeof result.streams === 'number' && result.streams > 0) {
          setStreams(result.streams);
        }
        if (result.bandwidth !== undefined && result.bandwidth !== null) {
          setBandwidth(String(result.bandwidth));
        }
      }
    } catch (err) {
      console.error('Failed to load iperf3 status:', err);
    }
  };

  const handleStart = async () => {
    if (loading || !host || !port) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const result = await window.electronAPI?.iperfStart?.({
        host,
        port,
        protocol,
        streams,
        bandwidth: bandwidth || null
      });
      if (result?.success) {
        const newStatus = {
          running: true,
          port: result.port,
          host: result.host,
          protocol: result.protocol || protocol,
          streams: result.streams || streams,
          // Prefer value from backend; fall back to current bandwidth, else null
          bandwidth: result.bandwidth !== undefined && result.bandwidth !== null
            ? result.bandwidth
            : (bandwidth || null)
        };
        setStatus(newStatus);
        // Load endpoints after server starts
        setTimeout(() => {
          loadEndpointsForStatus(newStatus);
        }, 100);
      } else {
        setError(result?.error || 'Failed to start iperf3 server');
      }
    } catch (err) {
      setError(err.message || 'Failed to start iperf3 server');
    } finally {
      setLoading(false);
    }
  };

  const handleStop = async () => {
    if (loading) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const result = await window.electronAPI?.iperfStop?.();
      if (result?.success) {
        await loadStatus();
        setEndpoints([]);
      } else {
        setError(result?.error || 'Failed to stop iperf3 server');
      }
    } catch (err) {
      setError(err.message || 'Failed to stop iperf3 server');
    } finally {
      setLoading(false);
    }
  };

  const handlePathCopy = async (e, text) => {
    if (e) e.stopPropagation();
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        // Fallback for older browsers
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.position = 'fixed';
        textArea.style.opacity = '0';
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
      }
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  if (!isOpen) return null;

  const effectiveProtocol = (status.protocol || protocol || 'tcp').toLowerCase();
  const effectiveStreams = status.streams || streams || 1;
  const effectiveBandwidth =
    status.bandwidth !== undefined && status.bandwidth !== null
      ? status.bandwidth
      : (bandwidth || '');
  // For client command, avoid suggesting 0.0.0.0 as destination
  let clientHost = status.host || host;
  if (clientHost === '0.0.0.0') {
    clientHost = 'localhost';
  }

  const commandParts = [
    'iperf3',
    '-c',
    clientHost,
    '-p',
    (status.port || port).toString(),
  ];
  if (effectiveProtocol === 'udp') {
    commandParts.push('-u');
    if (effectiveBandwidth) {
      commandParts.push('-b', effectiveBandwidth);
    }
  }
  if (effectiveStreams && effectiveStreams > 1) {
    commandParts.push('-P', effectiveStreams.toString());
  }
  const clientCommand = commandParts.join(' ');

  return (
    <div className="iperf-dialog-overlay" onClick={onClose}>
      <div className="iperf-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="iperf-dialog-header">
          <h2>{t('server:iperf.title')}</h2>
          <button className="iperf-dialog-close" onClick={onClose}>×</button>
        </div>
        
        <div className="iperf-dialog-content">
          <div className="iperf-status-section">
            <div 
              className={`iperf-status-card ${status.running ? 'running' : 'stopped'} ${loading ? 'loading' : ''}`}
            >
              <div className="iperf-status-item">
                <span className="iperf-status-label">{t('server:iperf.status')}</span>
                <div 
                  className="iperf-status-control"
                  onClick={status.running ? handleStop : handleStart}
                  style={{ cursor: loading ? 'not-allowed' : 'pointer' }}
                >
                  <span className={`iperf-status-badge ${status.running ? 'running' : 'stopped'}`}>
                    {loading ? (status.running ? t('server:iperf.stopping') : t('server:iperf.starting')) : (status.running ? t('server:iperf.running') : t('server:iperf.stopped'))}
                  </span>
                  <span className="iperf-status-icon">
                    {loading ? '⏳' : (status.running ? '⏹' : '▶')}
                  </span>
                </div>
              </div>
              
              {status.running && (
                <>
                  <div className="iperf-status-item">
                    <span className="iperf-status-label">{t('server:iperf.host')}</span>
                    <span className="iperf-status-value">{status.host || host}</span>
                  </div>
                  <div className="iperf-status-item">
                    <span className="iperf-status-label">{t('server:iperf.port')}</span>
                    <span className="iperf-status-value">
                      {(effectiveProtocol === 'udp' ? 'UDP' : 'TCP')}/{status.port || port}
                    </span>
                  </div>
                  <div className="iperf-status-item">
                    <span className="iperf-status-label">{t('server:iperf.streams')}</span>
                    <span className="iperf-status-value">
                      {effectiveStreams || 1}
                    </span>
                  </div>
                  {effectiveProtocol === 'udp' && (
                    <div className="iperf-status-item">
                      <span className="iperf-status-label">{t('server:iperf.bandwidth')}</span>
                      <span className="iperf-status-value">
                        {effectiveBandwidth || t('server:iperf.default')}
                      </span>
                    </div>
                  )}
                  <div className="iperf-status-item">
                    <span className="iperf-status-label">{t('server:iperf.accessibleEndpoints')}</span>
                    <div className="iperf-endpoints-list">
                      {endpoints.length > 0 ? (
                        endpoints.map((item, index) => (
                          <div key={index} className="iperf-endpoint-item">
                            <span 
                              className="iperf-endpoint-value" 
                              title={item.command}
                              onClick={(e) => {
                                e.stopPropagation();
                                handlePathCopy(e, item.command);
                              }}
                            >
                              {item.command}
                            </span>
                            <button 
                              className="iperf-copy-endpoint-btn"
                              onClick={(e) => {
                                e.stopPropagation();
                                handlePathCopy(e, item.command);
                              }}
                              title={t('server:iperf.copyEndpoint')}
                            >
                              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M4 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z" stroke="currentColor" strokeWidth="1.5" fill="none"/>
                                <path d="M2 6h10a2 2 0 0 1 2 2v6" stroke="currentColor" strokeWidth="1.5" fill="none" strokeDasharray="2 2"/>
                              </svg>
                            </button>
                          </div>
                        ))
                      ) : (
                        <span className="iperf-endpoint-value">{t('server:iperf.loading')}</span>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>

          {!status.running && (
            <div className="iperf-config-section">
              <div className="iperf-config-item">
                <label htmlFor="iperf-host">{t('server:iperf.host')}:</label>
                <input
                  id="iperf-host"
                  type="text"
                  value={host}
                  onChange={(e) => setHost(e.target.value)}
                  placeholder="0.0.0.0"
                  disabled={loading}
                />
              </div>
              <div className="iperf-config-item">
                <label htmlFor="iperf-port">{t('server:iperf.port')}:</label>
                <input
                  id="iperf-port"
                  type="number"
                  value={port}
                  onChange={(e) => setPort(parseInt(e.target.value) || 5201)}
                  placeholder="5201"
                  min="1"
                  max="65535"
                  disabled={loading}
                />
              </div>
              <div className="iperf-config-item">
                <label htmlFor="iperf-protocol">{t('server:iperf.protocol')}:</label>
                <div className="iperf-protocol-toggle" id="iperf-protocol">
                  <button
                    type="button"
                    className={`iperf-protocol-btn ${protocol === 'tcp' ? 'active' : ''}`}
                    onClick={() => setProtocol('tcp')}
                    disabled={loading}
                  >
                    TCP
                  </button>
                  <button
                    type="button"
                    className={`iperf-protocol-btn ${protocol === 'udp' ? 'active' : ''}`}
                    onClick={() => setProtocol('udp')}
                    disabled={loading}
                  >
                    UDP
                  </button>
                </div>
              </div>
              <div className="iperf-config-item">
                <label htmlFor="iperf-streams">{t('server:iperf.parallelStreams')}:</label>
                <input
                  id="iperf-streams"
                  type="number"
                  value={streams}
                  onChange={(e) => setStreams(Math.max(1, parseInt(e.target.value, 10) || 1))}
                  placeholder="1"
                  min="1"
                  max="64"
                  disabled={loading}
                />
              </div>
              <div className="iperf-config-item">
                <label htmlFor="iperf-bandwidth">{t('server:iperf.bandwidthLabel')}:</label>
                <input
                  id="iperf-bandwidth"
                  type="text"
                  value={bandwidth}
                  onChange={(e) => setBandwidth(e.target.value)}
                  placeholder={t('server:iperf.bandwidthPlaceholder')}
                  disabled={loading || protocol !== 'udp'}
                />
              </div>
            </div>
          )}

          {error && (
            <div className="iperf-error">
              {error}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
