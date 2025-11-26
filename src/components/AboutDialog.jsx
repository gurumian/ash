import React from 'react';
import './AboutDialog.css';

export const AboutDialog = ({ isOpen, onClose, appVersion, author }) => {
  if (!isOpen) return null;

  return (
    <div className="about-dialog-overlay" onClick={onClose}>
      <div className="about-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="about-dialog-header">
          <h2>ash</h2>
          <button className="about-dialog-close" onClick={onClose}>×</button>
        </div>
        
        <div className="about-dialog-content">
          <div className="about-app-info">
            <p className="about-version">Version {appVersion}</p>
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
            <p className="about-label">Developer</p>
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
        </div>
        
        <div className="about-dialog-actions">
          <button className="about-ok-button" onClick={onClose}>OK</button>
        </div>
      </div>
    </div>
  );
};

