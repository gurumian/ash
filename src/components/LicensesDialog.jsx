import React, { useState, useEffect } from 'react';
import './LicensesDialog.css';

export const LicensesDialog = ({ isOpen, onClose }) => {
  const [licensesContent, setLicensesContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (isOpen) {
      loadLicenses();
    }
  }, [isOpen]);

  const loadLicenses = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await window.electronAPI.readThirdPartyLicenses();
      if (result.success) {
        setLicensesContent(result.content);
      } else {
        setError(result.error || 'Failed to load licenses');
        setLicensesContent(result.content || 'Failed to load third-party licenses.');
      }
    } catch (err) {
      console.error('Failed to load licenses:', err);
      setError(err.message);
      setLicensesContent('Failed to load third-party licenses.');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="licenses-dialog-overlay" onClick={onClose}>
      <div className="licenses-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="licenses-dialog-header">
          <h2>Third-Party Licenses</h2>
          <button className="licenses-dialog-close" onClick={onClose}>×</button>
        </div>
        
        <div className="licenses-dialog-content">
          {loading ? (
            <div className="licenses-loading">Loading licenses...</div>
          ) : error ? (
            <div className="licenses-error">Error: {error}</div>
          ) : (
            <pre className="licenses-text">{licensesContent}</pre>
          )}
        </div>
        
        <div className="licenses-dialog-actions">
          <button className="licenses-ok-button" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
};


