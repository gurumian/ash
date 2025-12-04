import React from 'react';
import { useTranslation } from 'react-i18next';
import './AboutDialog.css';

export const AboutDialog = ({ isOpen, onClose, appVersion, author, onShowLicenses }) => {
  const { t } = useTranslation(['dialog', 'common']);
  if (!isOpen) return null;

  return (
    <div className="about-dialog-overlay">
      <div className="about-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="about-dialog-header">
          <h2>{t('common:appName')}</h2>
          <button className="about-dialog-close" onClick={onClose}>×</button>
        </div>
        
        <div className="about-dialog-content">
          <div className="about-app-info">
            <p className="about-version">{t('dialog:about.version')} {appVersion}</p>
            <p className="about-description">
              A modern SSH and Serial terminal client
            </p>
            <p className="about-website">
              <a 
                href="https://ash.toktoktalk.com" 
                target="_blank" 
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
              >
                https://ash.toktoktalk.com
              </a>
            </p>
          </div>
          
          <div className="about-separator"></div>
          
          <div className="about-developer">
            <p className="about-label">{t('dialog:about.author')}</p>
            <p className="about-value">{author?.name || 'Bryce Ghim'}</p>
            {author?.email && (
              <p className="about-email">{author.email}</p>
            )}
          </div>
          
          <div className="about-separator"></div>
          
          <div className="about-copyright">
            <p>© {new Date().getFullYear()} {author?.name || 'Bryce Ghim'}</p>
            <p className="about-license">Proprietary Software - All Rights Reserved</p>
          </div>
          
          <div className="about-separator"></div>
          
          <div className="about-third-party">
            <button 
              className="about-licenses-link" 
              onClick={(e) => {
                e.stopPropagation();
                if (onShowLicenses) {
                  onShowLicenses();
                }
              }}
            >
              {t('dialog:about.licenses')}
            </button>
          </div>
        </div>
        
        <div className="about-dialog-actions">
          <button className="about-ok-button" onClick={onClose}>OK</button>
        </div>
      </div>
    </div>
  );
};

