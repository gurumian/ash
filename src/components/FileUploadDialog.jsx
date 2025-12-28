import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import './FileUploadDialog.css';

export function FileUploadDialog({ 
  isOpen, 
  onClose, 
  sessionId, 
  connectionId, 
  connectionType,
  libraries,
  onUploadComplete,
  initialFilePath
}) {
  const [selectedFile, setSelectedFile] = useState(null);
  const [remotePath, setRemotePath] = useState('/tmp/');
  const [autoExecute, setAutoExecute] = useState(false);
  const [selectedLibraryId, setSelectedLibraryId] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState(null);
  const [showLibraryDropdown, setShowLibraryDropdown] = useState(false);
  const { t } = useTranslation(['upload', 'common']);

  // Update selected file when initialFilePath changes (for drag and drop)
  useEffect(() => {
    if (initialFilePath) {
      setSelectedFile(initialFilePath);
      // Auto-set remote path based on filename
      const pathParts = initialFilePath.split(/[/\\]/);
      const fileName = pathParts[pathParts.length - 1];
      const newRemotePath = `/tmp/${fileName}`;
      setRemotePath(newRemotePath);
      // Cache the file path and remote path
      localStorage.setItem('ash-last-upload-file', initialFilePath);
      localStorage.setItem('ash-last-upload-remote-path', newRemotePath);
    }
  }, [initialFilePath]);

  useEffect(() => {
    if (isOpen) {
      // If initialFilePath is provided (from drag and drop), use it and ignore cache
      if (initialFilePath) {
        setSelectedFile(initialFilePath);
        // Auto-set remote path based on filename
        const pathParts = initialFilePath.split(/[/\\]/);
        const fileName = pathParts[pathParts.length - 1];
        const newRemotePath = `/tmp/${fileName}`;
        setRemotePath(newRemotePath);
        // Cache the file path and remote path
        localStorage.setItem('ash-last-upload-file', initialFilePath);
        localStorage.setItem('ash-last-upload-remote-path', newRemotePath);
      } else {
        // Use cached file path if no initialFilePath
        const cachedFilePath = localStorage.getItem('ash-last-upload-file');
        const cachedRemotePath = localStorage.getItem('ash-last-upload-remote-path') || '/tmp/';
        setSelectedFile(cachedFilePath || null);
        setRemotePath(cachedRemotePath);
      }
      
      // Load other cached settings
      const cachedAutoExecute = localStorage.getItem('ash-last-upload-auto-execute') === 'true';
      const cachedLibraryId = localStorage.getItem('ash-last-upload-library-id');
      setAutoExecute(cachedAutoExecute);
      setSelectedLibraryId(cachedLibraryId || null);
      
      setUploading(false);
      setProgress(0);
      setError(null);
      setShowLibraryDropdown(false);
    } else {
      // Reset when dialog closes
      setSelectedFile(null);
    }
  }, [isOpen]);

  const handleSelectFile = async () => {
    try {
      // Get cached file path for default path in file picker
      const cachedFilePath = localStorage.getItem('ash-last-upload-file');
      
      const result = await window.electronAPI?.showFilePicker?.(cachedFilePath);
      if (result?.success && result.filePath) {
        setSelectedFile(result.filePath);
        setError(null);
        
        // Cache the selected file path
        localStorage.setItem('ash-last-upload-file', result.filePath);
        
        // Auto-set remote path based on filename if remote path is default
        if (remotePath === '/tmp/' || (remotePath.startsWith('/tmp/') && remotePath.split('/').length === 3)) {
          const pathParts = result.filePath.split(/[/\\]/);
          const fileName = pathParts[pathParts.length - 1];
          const newRemotePath = `/tmp/${fileName}`;
          setRemotePath(newRemotePath);
          localStorage.setItem('ash-last-upload-remote-path', newRemotePath);
        }
      }
    } catch (err) {
      setError(`${t('upload:failedToSelectFile')}: ${err.message}`);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile || !connectionId) {
      setError(t('upload:pleaseSelectFile'));
      return;
    }

    setUploading(true);
    setError(null);
    setProgress(0);

    try {
      // Determine if this is a Telnet connection
      const isTelnet = connectionType === 'telnet';
      
      // Set up progress listener
      const progressHandler = (data) => {
        if (data.connectionId === connectionId) {
          setProgress(data.progress);
        }
      };
      
      if (isTelnet) {
        window.electronAPI?.onTelnetUploadProgress?.(progressHandler);
      } else {
        window.electronAPI?.onSSHUploadProgress?.(progressHandler);
      }

      // Upload file based on connection type
      let result;
      if (isTelnet) {
        result = await window.electronAPI?.telnetUploadFile?.({
          connectionId,
          localPath: selectedFile,
          remotePath: remotePath
        });
        window.electronAPI?.offTelnetUploadProgress?.(progressHandler);
      } else {
        result = await window.electronAPI?.sshUploadFile?.({
          connectionId,
          localPath: selectedFile,
          remotePath: remotePath
        });
        window.electronAPI?.offSSHUploadProgress?.(progressHandler);
      }

      if (result?.success) {
        // Extract filename from path
        const pathParts = selectedFile.split(/[/\\]/);
        const fileName = pathParts[pathParts.length - 1];
        
        // If auto-execute is enabled, execute all library commands
        if (autoExecute && selectedLibraryId) {
          const library = libraries.find(lib => lib.id === selectedLibraryId);
          if (library && library.commands && library.commands.length > 0) {
            // Execute all commands in the library sequentially
            for (const cmd of library.commands) {
              // Skip disabled commands
              if (cmd.enabled === false) continue;
              
              // Replace {filename} and {remotePath} variables if present
              const finalCommand = cmd.command
                .replace(/{filename}/g, fileName)
                .replace(/{remotePath}/g, remotePath);
              
              // Execute command via SSH/Telnet write
              if (isTelnet) {
                await window.electronAPI?.telnetWrite?.(connectionId, finalCommand + '\r\n');
              } else {
                await window.electronAPI?.sshWrite?.(connectionId, finalCommand + '\r\n');
              }
              
              // Add a small delay between commands to ensure proper execution
              await new Promise(resolve => setTimeout(resolve, 100));
            }
          }
        }

        if (onUploadComplete) {
          onUploadComplete({
            fileName,
            remotePath: result.remotePath,
            fileSize: result.fileSize
          });
        }

        onClose();
      } else {
        setError(result?.error || t('upload:uploadFailed'));
      }
    } catch (err) {
      setError(`${t('upload:uploadFailed')}: ${err.message}`);
    } finally {
      setUploading(false);
      setProgress(0);
    }
  };

  if (!isOpen) return null;

  const fileName = selectedFile ? selectedFile.split(/[/\\]/).pop() : '';

  return (
    <div 
      className="file-upload-dialog-overlay" 
      onClick={onClose}
    >
      <div 
        className="file-upload-dialog" 
        onClick={(e) => {
          e.stopPropagation();
          // Close library dropdown when clicking outside
          if (showLibraryDropdown) {
            setShowLibraryDropdown(false);
          }
        }}
      >
        <div className="file-upload-dialog-header">
          <h3>{t('upload:title')}</h3>
          <button 
            className="file-upload-dialog-close"
            onClick={onClose}
          >
            ×
          </button>
        </div>
        
        <div className="file-upload-dialog-content">
          {/* File Selection */}
          <div className="file-upload-field">
            <label className="file-upload-label">
              {t('upload:localFile')}
            </label>
            <div className="file-upload-input-group">
              <input
                type="text"
                value={fileName || t('upload:noFileSelected')}
                readOnly
                className="file-upload-file-input"
              />
              <button
                type="button"
                onClick={handleSelectFile}
                disabled={uploading}
                className="file-upload-browse-btn"
              >
                {t('upload:browse')}
              </button>
            </div>
          </div>

          {/* Remote Path */}
          <div className="file-upload-field">
            <label className="file-upload-label">
              {t('upload:remotePath')}
            </label>
            <input
              type="text"
              value={remotePath}
              onChange={(e) => {
                setRemotePath(e.target.value);
                localStorage.setItem('ash-last-upload-remote-path', e.target.value);
              }}
              disabled={uploading}
              className="file-upload-path-input"
            />
          </div>

          {/* Auto Execute Option */}
          <div className="file-upload-field">
            <label className="file-upload-checkbox-group">
              <input
                type="checkbox"
                checked={autoExecute}
                onChange={(e) => {
                  setAutoExecute(e.target.checked);
                  localStorage.setItem('ash-last-upload-auto-execute', e.target.checked.toString());
                  if (!e.target.checked) {
                    setSelectedLibraryId(null);
                    localStorage.removeItem('ash-last-upload-library-id');
                  }
                }}
                disabled={uploading || libraries.length === 0}
                className="file-upload-checkbox"
              />
              <span className="file-upload-checkbox-label">
                {t('upload:executeAfterUpload')}
              </span>
            </label>
            {autoExecute && libraries.length > 0 && (
              <div className="file-upload-library-dropdown">
                <button
                  type="button"
                  onClick={() => setShowLibraryDropdown(!showLibraryDropdown)}
                  disabled={uploading}
                  className="file-upload-library-select-btn"
                >
                  <span>
                    {selectedLibraryId ? (() => {
                      const selectedLib = libraries.find(lib => lib.id === selectedLibraryId);
                      return selectedLib ? selectedLib.name : t('upload:selectLibrary');
                    })() : t('upload:selectLibrary')}
                  </span>
                  <span className="file-upload-library-dropdown-arrow">
                    {showLibraryDropdown ? '▲' : '▼'}
                  </span>
                </button>
                
                {showLibraryDropdown && (
                  <div className="file-upload-library-menu">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedLibraryId(null);
                          localStorage.removeItem('ash-last-upload-library-id');
                          setShowLibraryDropdown(false);
                        }}
                        className={`file-upload-library-menu-item-none ${selectedLibraryId === null ? 'selected' : ''}`}
                      >
                        <span style={{ opacity: 0.5 }}>—</span>
                        <span>{t('upload:none')}</span>
                      </button>
                      {libraries.map(lib => {
                        const isSelected = selectedLibraryId === lib.id;
                        const commandCount = lib.commands?.length || 0;
                        return (
                          <button
                            key={lib.id}
                            type="button"
                            onClick={() => {
                              setSelectedLibraryId(lib.id);
                              localStorage.setItem('ash-last-upload-library-id', lib.id);
                              setShowLibraryDropdown(false);
                            }}
                            className={`file-upload-library-menu-item ${isSelected ? 'selected' : ''}`}
                          >
                            <div className="file-upload-library-name">
                              <span className={`file-upload-library-name-text ${isSelected ? 'selected' : ''}`}>
                                {lib.name}
                              </span>
                              <span className="file-upload-library-command-count">
                                ({commandCount})
                              </span>
                            </div>
                            {lib.description && (
                              <div className="file-upload-library-description">
                                {lib.description}
                              </div>
                            )}
                            {lib.commands && lib.commands.length > 0 && (
                              <div className="file-upload-library-command-preview">
                                {lib.commands[0].command}
                              </div>
                            )}
                          </button>
                        );
                      })}
                    </div>
                )}
              </div>
            )}
            {libraries.length === 0 && (
              <div className="file-upload-no-libraries">
                {t('upload:noLibrariesAvailable')}
              </div>
            )}
          </div>

          {/* Progress Bar */}
          {uploading && (
            <div className="file-upload-progress">
              <div className="file-upload-progress-header">
                <span>{t('upload:uploading')}</span>
                <span>{Math.round(progress)}%</span>
              </div>
              <div className="file-upload-progress-bar-container">
                <div 
                  className="file-upload-progress-bar"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="file-upload-error">
              {error}
            </div>
          )}
        </div>

        <div className="file-upload-dialog-footer">
          <button
            type="button"
            onClick={onClose}
            disabled={uploading}
            className="file-upload-cancel-btn"
          >
            {t('common:cancel')}
          </button>
          <button
            type="button"
            onClick={handleUpload}
            disabled={!selectedFile || uploading}
            className="file-upload-submit-btn"
          >
            {uploading ? t('upload:uploading') : t('upload:upload')}
          </button>
        </div>
      </div>
    </div>
  );
}

