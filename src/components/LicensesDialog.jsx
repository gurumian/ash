import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import './LicensesDialog.css';

export const LicensesDialog = ({ isOpen, onClose, themes = {}, currentTheme = 'terminus' }) => {
  const { t } = useTranslation(['dialog', 'common']);
  const [licensesContent, setLicensesContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Get current theme data to apply CSS variables
  const themeData = themes[currentTheme] || themes['terminus'] || {};

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

  // Apply theme CSS variables
  const dialogStyle = {
    '--theme-bg': themeData.background || '#000000',
    '--theme-surface': themeData.surface || '#1a1a1a',
    '--theme-text': themeData.text || '#fff',
    '--theme-border': themeData.border || '#333',
    '--theme-accent': themeData.accent || '#00ff41',
  };

  return (
    <div className="licenses-dialog-overlay" style={dialogStyle}>
      <div className="licenses-dialog" onClick={(e) => e.stopPropagation()} style={dialogStyle}>
        <div className="licenses-dialog-header">
          <h2>{t('dialog:about.licenses')}</h2>
          <button className="licenses-dialog-close" onClick={onClose}>×</button>
        </div>
        
        <div className="licenses-dialog-content">
          {loading ? (
            <div className="licenses-loading">{t('common:loading')}</div>
          ) : error ? (
            <div className="licenses-error">{t('common:error')}: {error}</div>
          ) : (
            <pre className="licenses-text">{licensesContent}</pre>
          )}
        </div>
        
        <div className="licenses-dialog-actions">
          <button className="licenses-ok-button" onClick={onClose}>{t('common:close')}</button>
        </div>
      </div>
    </div>
  );
};

