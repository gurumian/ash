import React, { memo, useState, useEffect, useRef } from 'react';
import './NetcatSidebar.css';

/**
 * Netcat Sidebar - Provides Netcat functionality (Client & Server modes)
 */
export const NetcatSidebar = memo(function NetcatSidebar({
    isVisible,
    width,
    activeSession,
    onClose,
    showHeader = true
}) {
    const [mode, setMode] = useState('client'); // 'client' | 'server'
    const [host, setHost] = useState('localhost');
    const [port, setPort] = useState(8080);
    const [protocol, setProtocol] = useState('tcp'); // 'tcp' | 'udp'
    const [status, setStatus] = useState('stopped'); // 'stopped', 'connecting', 'connected', 'listening'
    const [error, setError] = useState(null);
    const [output, setOutput] = useState('');
    const [dataToSend, setDataToSend] = useState('');
    const [isConfigCollapsed, setIsConfigCollapsed] = useState(false);

    const outputEndRef = useRef(null);

    // Auto-scroll output
    useEffect(() => {
        if (outputEndRef.current) {
            outputEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [output]);

    // Sync hostname from SSH session if available
    useEffect(() => {
        if (activeSession && activeSession.connectionType === 'ssh' && activeSession.host && mode === 'client') {
            // Only set if we haven't manually changed it yet? Or good default.
            // Let's set it as default if host is currently localhost
            if (host === 'localhost') {
                setHost(activeSession.host);
            }
        }
    }, [activeSession, mode]);

    // IPC Event Listeners
    useEffect(() => {
        const handleConnected = (_event, data) => {
            setStatus(mode === 'client' ? 'connected' : 'listening');
            setError(null);
            if (data && data.message) {
                setOutput(prev => prev + `[System]: ${data.message}\n`);
            } else {
                setOutput(prev => prev + (mode === 'client' ? `[System]: Connected to ${host}:${port}\n` : `[System]: Listening on port ${port}\n`));
            }
        };

        const handleData = (_event, data) => {
            setOutput(prev => prev + data);
        };

        const handleError = (_event, message) => {
            setError(message);
            setStatus('class_error'); // Use custom state or just keep current? 
            // Usually error implies stop or retry.
            setOutput(prev => prev + `[Error]: ${message}\n`);
            // check status?
            statusCheck();
        };

        const handleClosed = () => {
            setStatus('stopped');
            setOutput(prev => prev + `[System]: Connection closed.\n`);
        };

        const removeConnected = window.electronAPI.onNetcatConnected(handleConnected);
        const removeData = window.electronAPI.onNetcatData(handleData);
        const removeError = window.electronAPI.onNetcatError(handleError);
        const removeClosed = window.electronAPI.onNetcatClosed(handleClosed);

        return () => {
            removeConnected();
            removeData();
            removeError();
            removeClosed();
        };
    }, [host, port, mode]);

    const statusCheck = async () => {
        const s = await window.electronAPI.netcatStatus();
        if (s) setStatus(s);
    };

    const handleStart = async () => {
        try {
            setStatus('connecting');
            setError(null);

            // Clear output on new start (optional)
            setOutput('');

            const result = await window.electronAPI.netcatStart({
                mode,
                host,
                port,
                protocol
            });

            if (!result.success) {
                setError(result.error);
                setStatus('stopped');
            }
        } catch (err) {
            console.error('Failed to start netcat:', err);
            setError(err.message);
            setStatus('stopped');
        }
    };

    const handleStop = async () => {
        try {
            await window.electronAPI.netcatStop();
            // Status update will come via event
        } catch (err) {
            console.error('Failed to stop netcat:', err);
        }
    };

    const handleSend = async () => {
        if (!dataToSend) return;

        try {
            const data = dataToSend + '\n'; // Add newline
            const result = await window.electronAPI.netcatSend(data);
            if (result.success) {
                setDataToSend('');
                // Echo handled by backend or logic? 
                // Our handler echoes server send, client send usually echoes if backend does not.
                // Let's rely on backend echo or 'data' event. 
                // Actually, for client, usually we don't see what we sent unless echoed back by server.
                // But for UI feedback, we might want to see it.
                // Handler does not echo client send currently.
                setOutput(prev => prev + `[You]: ${data}`);
            } else {
                setError(result.error);
            }
        } catch (err) {
            setError(err.message);
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    if (!isVisible) return null;

    const isRunning = status === 'connected' || status === 'listening';
    const isConnecting = status === 'connecting';
    const statusClass = isRunning ? 'running' : isConnecting ? 'loading' : 'stopped';
    const statusLabel = isConnecting
        ? 'Connecting'
        : status === 'listening'
            ? 'Listening'
            : status === 'connected'
                ? 'Connected'
                : 'Stopped';

    return (
        <div
            className="netcat-sidebar"
            style={{
                width: `${width}px`,
                background: 'var(--theme-bg)',
                borderLeft: '1px solid var(--theme-border)'
            }}
        >
            {/* Header */}
            {showHeader && (
                <div style={{
                    padding: '12px 16px',
                    borderBottom: '1px solid var(--theme-border)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexShrink: 0
                }}>
                    <h3 style={{ margin: 0, fontSize: '13px', fontWeight: '600', color: 'var(--theme-text)' }}>
                        Netcat {mode === 'client' ? 'Client' : 'Listener'}
                    </h3>
                    {onClose && (
                        <button
                            onClick={onClose}
                            style={{
                                background: 'none',
                                border: 'none',
                                color: 'var(--theme-text)',
                                cursor: 'pointer',
                                fontSize: '18px',
                                lineHeight: '1',
                                padding: '4px 8px',
                                opacity: 0.7
                            }}
                            title="Close"
                        >
                            ×
                        </button>
                    )}
                </div>
            )}

            {/* Content Container */}
            <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>

                {/* Status Card */}
                <div className={`netcat-status-card ${statusClass} netcat-status-section`}>
                    <div className="netcat-status-item">
                        <span className="netcat-status-label">Status</span>
                        <div
                            className="netcat-status-control"
                            onClick={isConnecting ? undefined : (isRunning ? handleStop : handleStart)}
                            style={{ cursor: isConnecting ? 'not-allowed' : 'pointer' }}
                        >
                            <span className={`netcat-status-badge ${isRunning ? 'running' : 'stopped'}`}>
                                {statusLabel}
                            </span>
                            <span className="netcat-status-icon">
                                {isConnecting ? <div className="netcat-spinner" /> : (isRunning ? '⏹' : '▶')}
                            </span>
                        </div>
                    </div>
                </div>

                {/* Configuration Section */}
                <div className="netcat-config-section" style={{ marginTop: '16px' }}>
                    <div
                        className="netcat-config-header"
                        onClick={() => setIsConfigCollapsed(!isConfigCollapsed)}
                    >
                        <span className="netcat-config-header-collapse-icon">
                            {isConfigCollapsed ? '▶' : '▼'}
                        </span>
                        <span className="netcat-config-header-title">CONFIGURATION</span>
                    </div>

                    {!isConfigCollapsed && (
                        <div className="netcat-config-content">
                            {/* Mode Toggle */}
                            <div className="netcat-config-item">
                                <label>Mode</label>
                                <div className="netcat-protocol-toggle">
                                    <button
                                        className={`netcat-protocol-btn ${mode === 'client' ? 'active' : ''}`}
                                        onClick={() => setMode('client')}
                                        disabled={status !== 'stopped'}
                                    >
                                        Client
                                    </button>
                                    <button
                                        className={`netcat-protocol-btn ${mode === 'server' ? 'active' : ''}`}
                                        onClick={() => setMode('server')}
                                        disabled={status !== 'stopped'}
                                    >
                                        Server
                                    </button>
                                </div>
                            </div>

                            {/* Host (Client only) */}
                            {mode === 'client' && (
                                <div className="netcat-config-item">
                                    <label>Host</label>
                                    <input
                                        type="text"
                                        value={host}
                                        onChange={(e) => setHost(e.target.value)}
                                        disabled={status !== 'stopped'}
                                        placeholder="e.g. localhost, 127.0.0.1"
                                    />
                                </div>
                            )}

                            {/* Port */}
                            <div className="netcat-config-item">
                                <label>Port</label>
                                <input
                                    type="number"
                                    value={port}
                                    onChange={(e) => setPort(e.target.value)}
                                    disabled={status !== 'stopped'}
                                    placeholder="e.g. 8080"
                                />
                            </div>

                            {/* Protocol */}
                            <div className="netcat-config-item">
                                <label>Protocol</label>
                                <div className="netcat-protocol-toggle">
                                    <button
                                        className={`netcat-protocol-btn ${protocol === 'tcp' ? 'active' : ''}`}
                                        onClick={() => setProtocol('tcp')}
                                        disabled={status !== 'stopped'}
                                    >
                                        TCP
                                    </button>
                                    <button
                                        className={`netcat-protocol-btn ${protocol === 'udp' ? 'active' : ''}`}
                                        onClick={() => setProtocol('udp')}
                                        disabled={status !== 'stopped'}
                                    >
                                        UDP
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Error Message */}
                {error && (
                    <div className="netcat-error">
                        {error}
                    </div>
                )}

                {/* Input Area */}
                <div className="netcat-input-section">
                    <div className="netcat-input-area">
                        <input
                            type="text"
                            value={dataToSend}
                            onChange={(e) => setDataToSend(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder={mode === 'client' ? "Send data to server..." : "Broadcast to clients..."}
                            disabled={status === 'stopped' || status === 'connecting'}
                        />
                        <button
                            className="netcat-send-btn"
                            onClick={handleSend}
                            disabled={status === 'stopped' || status === 'connecting' || !dataToSend}
                        >
                            Send
                        </button>
                    </div>
                </div>

                {/* Output Log */}
                <div className="netcat-output-section">
                    <div className="netcat-output-header">
                        <span className="netcat-output-title">OUTPUT LOG</span>
                        <button
                            className="netcat-clear-btn"
                            onClick={() => setOutput('')}
                            disabled={!output}
                        >
                            Clear
                        </button>
                    </div>
                    <div className="netcat-output">
                        {output || <span className="netcat-output-empty">Waiting for activity...</span>}
                        <div ref={outputEndRef} />
                    </div>
                </div>

            </div>
        </div>
    );
});
