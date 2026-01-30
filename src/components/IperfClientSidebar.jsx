import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import './IperfClientSidebar.css';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { parseIperfOutput } from '../utils/iperfParser';

export function IperfClientSidebar({ isVisible, width, onClose, activeSession, output = '', onClearOutput, onStartTest, showHeader = true, longTermData = [] }) {
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
  const [configExpanded, setConfigExpanded] = useState(true);
  const outputRef = useRef(null);
  const sidebarRef = useRef(null);
  const [showGraph, setShowGraph] = useState(true);
  const [graphView, setGraphView] = useState('realtime'); // 'realtime' | 'history'

  // Parse output for graph
  const graphData = React.useMemo(() => {
    return parseIperfOutput(output);
  }, [output]);

  // Use longTermData for history view (30m window average)
  const historyData = React.useMemo(() => {
    return longTermData || [];
  }, [longTermData]);

  // Load current status when sidebar becomes visible

  // Load current status when sidebar becomes visible
  useEffect(() => {
    if (isVisible) {
      loadStatus();

      // Auto-fill host from active SSH session if available
      if (activeSession && activeSession.connectionType === 'ssh' && activeSession.isConnected && activeSession.host) {
        setHost(activeSession.host);
      } else {
        // Reset to localhost if no active SSH session
        setHost('localhost');
      }
    }
  }, [isVisible, activeSession]);

  // Auto-collapse config when test starts
  useEffect(() => {
    if (status.running && configExpanded) {
      setConfigExpanded(false);
    }
  }, [status.running]);

  // Auto-scroll output to bottom
  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [output]);

  // Listen for client events - only for errors and status updates
  useEffect(() => {
    const handleError = (data) => {
      if (!isVisible) return; // Only show errors when sidebar is visible
      setError(data.detail || data.message || 'iperf3 client error');
      setLoading(false);
    };

    const handleStopped = (data) => {
      setStatus({ running: false });
      setLoading(false);
      // Output is now managed in App.jsx, no need to handle it here
    };

    // Register listeners once when component mounts
    const errorHandler = window.electronAPI?.onIperfClientError?.(handleError);
    const stoppedHandler = window.electronAPI?.onIperfClientStopped?.(handleStopped);

    return () => {
      // Cleanup only when component unmounts
      if (errorHandler) window.electronAPI?.offIperfClientError?.(handleError);
      if (stoppedHandler) window.electronAPI?.offIperfClientStopped?.(handleStopped);
    };
  }, [isVisible]); // Re-register if visibility changes

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
    // Clear output via parent callback when starting a new test
    if (onStartTest) {
      onStartTest();
    }

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
    if (onClearOutput) {
      onClearOutput();
    }
  };

  if (!isVisible) return null;

  return (
    <div
      ref={sidebarRef}
      className="iperf-client-sidebar"
      style={{
        width: '100%',
        height: '100%',
        background: 'var(--theme-bg, #000000)',
        display: 'flex',
        flexDirection: 'column',
        flexShrink: 0,
        overflow: 'hidden'
      }}
    >
      {/* Header */}
      {showHeader && (
        <div
          style={{
            padding: '12px 16px',
            borderBottom: '1px solid var(--theme-border, #1a1a1a)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            background: 'var(--theme-bg, #000000)',
            flexShrink: 0
          }}
        >
          <h3 style={{ margin: 0, fontSize: '13px', fontWeight: '600', color: 'var(--theme-text, #00ff41)' }}>
            {t('client:iperf.title')}
          </h3>
          {onClose && (
            <button
              onClick={onClose}
              className="iperf-client-close-btn"
            >
              ×
            </button>
          )}
        </div>
      )}

      {/* Content */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px'
        }}
      >
        {/* Status Section */}
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
                  {loading ? (
                    <span className="iperf-client-spinner"></span>
                  ) : (status.running ? '⏹' : '▶')}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Config Section - Collapsible */}
        <div className="iperf-client-config-section">
          <div
            className="iperf-client-config-header"
            onClick={() => setConfigExpanded(!configExpanded)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              cursor: 'pointer',
              padding: '8px 0',
              marginBottom: configExpanded ? '12px' : '0',
              borderBottom: configExpanded ? '1px solid var(--theme-border, #1a1a1a)' : 'none'
            }}
          >
            <span style={{
              color: 'var(--theme-text, #00ff41)',
              fontSize: '10px',
              transform: configExpanded ? 'rotate(0deg)' : 'rotate(-90deg)',
              transition: 'transform 0.2s',
              display: 'inline-block',
              lineHeight: '1'
            }}>
              ▶
            </span>
            <span style={{
              fontWeight: 600,
              color: 'var(--theme-text, #00ff41)',
              fontSize: '13px'
            }}>
              {t('client:iperf.config')}
            </span>
          </div>
          {configExpanded && (
            <div className="iperf-client-config-content">
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
                  onChange={(e) => setDuration(Math.max(0, parseInt(e.target.value, 10) || 0))}
                  placeholder="10"
                  min="0"
                  disabled={loading}
                />
                <span className="iperf-client-config-hint">{t('client:iperf.durationHint')} (0 = infinite)</span>
              </div>
            </div>
          )}
        </div>

        {/* Output Section - Show when running or has output */}
        {(status.running || output) && (
          <div className="iperf-client-output-section">
            <div className="iperf-client-output-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1 }}>
                <span className="iperf-client-output-title">{t('client:iperf.output')}</span>
                {(graphData.length > 0 || historyData.length > 0) && (
                  <div className="iperf-graph-controls">
                    <button
                      onClick={() => setShowGraph(!showGraph)}
                      className={`iperf-graph-toggle-btn ${showGraph ? 'active' : ''}`}
                      title={showGraph ? "Hide Graph" : "Show Graph"}
                    >
                      {showGraph ? "Graph On" : "Graph Off"}
                    </button>
                    {showGraph && (
                      <div className="iperf-graph-view-toggle">
                        <button
                          className={graphView === 'realtime' ? 'active' : ''}
                          onClick={() => setGraphView('realtime')}
                          disabled={graphData.length === 0}
                          title={t('client:iperf.graphRealtime')}
                        >
                          {t('client:iperf.graphRealtime')}
                        </button>
                        <button
                          className={graphView === 'history' ? 'active' : ''}
                          onClick={() => setGraphView('history')}
                          title={historyData.length === 0 ? t('client:iperf.graphHistoryEmpty') : t('client:iperf.graphHistoryTooltip')}
                        >
                          {t('client:iperf.graphHistory')}
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
              <button
                className="iperf-client-clear-btn"
                onClick={handleClear}
                disabled={loading}
              >
                {t('client:iperf.clear')}
              </button>
            </div>

            {/* Graph Visualization */}
            {showGraph && (
              <div style={{ height: '150px', marginBottom: '12px', width: '100%' }}>
                {graphView === 'history' && historyData.length === 0 ? (
                  <div
                    className="iperf-client-history-empty"
                    style={{
                      height: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: '16px',
                      textAlign: 'center',
                      color: 'var(--theme-text-muted, #666)',
                      fontSize: '12px',
                      lineHeight: 1.4
                    }}
                  >
                    {t('client:iperf.graphHistoryEmpty')}
                  </div>
                ) : (
                <ResponsiveContainer width="100%" height="100%">
                  {graphView === 'realtime' ? (
                    <AreaChart data={graphData}>
                      <defs>
                        <linearGradient id="colorBw" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="var(--theme-accent, #00ff41)" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="var(--theme-accent, #00ff41)" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" vertical={false} />
                      <XAxis
                        dataKey="time"
                        stroke="#666"
                        fontSize={10}
                        tickFormatter={(val) => `${val}s`}
                        minTickGap={30}
                      />
                      <YAxis
                        stroke="#666"
                        fontSize={10}
                        tickFormatter={(val) => val >= 1000 ? `${val / 1000} G` : `${val} M`}
                        width={40}
                        domain={[0, 5000]}
                        allowDataOverflow={true}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'var(--theme-surface, #1a1a1a)',
                          borderColor: 'var(--theme-border, #2a2a2a)',
                          color: 'var(--theme-text, #00ff41)'
                        }}
                        itemStyle={{ color: 'var(--theme-text, #00ff41)' }}
                        labelStyle={{ color: '#888' }}
                        formatter={(value) => [`${(value != null ? value : 0).toFixed(2)} Mbps`, 'Bandwidth']}
                        labelFormatter={(label) => `Time: ${label}s`}
                      />
                      <Area
                        type="monotone"
                        dataKey="bandwidth"
                        stroke="var(--theme-accent, #00ff41)"
                        fillOpacity={1}
                        fill="url(#colorBw)"
                        isAnimationActive={false}
                      />
                    </AreaChart>
                  ) : (
                    <AreaChart data={historyData}>
                      <defs>
                        <linearGradient id="colorHistory" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#00d4ff" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#00d4ff" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" vertical={false} />
                      <XAxis
                        dataKey="time"
                        stroke="#666"
                        fontSize={10}
                        tickFormatter={(val) => new Date(val).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        minTickGap={30}
                      />
                      <YAxis
                        stroke="#666"
                        fontSize={10}
                        tickFormatter={(val) => val >= 1000 ? `${val / 1000} G` : `${val} M`}
                        width={40}
                        domain={[0, 5000]}
                        allowDataOverflow={true}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'var(--theme-surface, #1a1a1a)',
                          borderColor: 'var(--theme-border, #2a2a2a)',
                          color: '#00d4ff'
                        }}
                        content={({ active, payload }) => {
                          if (!active || !payload?.length) return null;
                          const p = payload[0].payload;
                          const avg = (p.bandwidth != null ? p.bandwidth : 0).toFixed(2);
                          const min = p.min != null ? (p.min).toFixed(2) : null;
                          const max = p.max != null ? (p.max).toFixed(2) : null;
                          return (
                            <div style={{ padding: '4px 8px', fontSize: '11px' }}>
                              <div style={{ color: '#888', marginBottom: '4px' }}>
                                {new Date(p.time).toLocaleString()}
                              </div>
                              <div>Avg: {avg} Mbps</div>
                              {min != null && <div>Min: {min} Mbps</div>}
                              {max != null && <div>Max: {max} Mbps</div>}
                            </div>
                          );
                        }}
                      />
                      <Area
                        type="monotone"
                        dataKey="bandwidth"
                        stroke="#00d4ff"
                        fillOpacity={1}
                        fill="url(#colorHistory)"
                        isAnimationActive={true}
                      />
                    </AreaChart>
                  )}
                </ResponsiveContainer>
                )}
              </div>
            )}

            <div
              ref={outputRef}
              className="iperf-client-output"
            >
              {output || <span className="iperf-client-output-empty">{t('client:iperf.waitingForOutput')}</span>}
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="iperf-client-error">
            {error}
          </div>
        )}
      </div>
    </div>
  );
}
