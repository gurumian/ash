import React, { useState } from 'react';
import './ErrorDialog.css';

export const ErrorDialog = ({ isOpen, onClose, title, message, detail, error }) => {
  const [showDetails, setShowDetails] = useState(false);
  
  if (!isOpen) return null;

  // Extract error information
  const errorCode = error?.code || '';
  const errorAddress = error?.address || '';
  const errorPort = error?.port || '';
  const errorSyscall = error?.syscall || '';
  const errorStack = error?.stack || '';
  const originalMessage = error?.message || message;

  // Build system information string
  const systemInfo = [];
  if (errorCode) systemInfo.push(`Code: ${errorCode}`);
  if (errorAddress && errorPort) systemInfo.push(`Address: ${errorAddress}:${errorPort}`);
  else if (errorAddress) systemInfo.push(`Address: ${errorAddress}`);
  else if (errorPort) systemInfo.push(`Port: ${errorPort}`);
  if (errorSyscall) systemInfo.push(`Syscall: ${errorSyscall}`);
  const systemInfoStr = systemInfo.length > 0 ? systemInfo.join(' | ') : null;

  return (
    <div className="error-dialog-overlay" onClick={onClose}>
      <div className="error-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="error-dialog-header">
          <h2>{title || 'Error'}</h2>
          <button className="error-dialog-close" onClick={onClose}>×</button>
        </div>
        
        <div className="error-dialog-content">
          <div className="error-message">
            <p>{message}</p>
            {detail && (
              <p className="error-detail">{detail}</p>
            )}
            
            {/* System Information */}
            {systemInfoStr && (
              <div className="error-system-info">
                <strong>System Info:</strong> {systemInfoStr}
              </div>
            )}
            
            {/* Original Error Message */}
            {error && originalMessage !== message && (
              <div className="error-original-message">
                <strong>Original Error:</strong> {originalMessage}
              </div>
            )}
            
            {/* Stack Trace (collapsible) */}
            {errorStack && (
              <div className="error-stack-section">
                <button 
                  className="error-details-toggle"
                  onClick={() => setShowDetails(!showDetails)}
                >
                  {showDetails ? '▼' : '▶'} {showDetails ? 'Hide' : 'Show'} Stack Trace
                </button>
                {showDetails && (
                  <pre className="error-stack-trace">{errorStack}</pre>
                )}
              </div>
            )}
          </div>
        </div>
        
        <div className="error-dialog-actions">
          <button className="error-ok-button" onClick={onClose}>OK</button>
        </div>
      </div>
    </div>
  );
};

