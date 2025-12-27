import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import './CustomTitleBar.css';

/**
 * Custom title bar for Windows/Linux with integrated menu bar
 */
export function CustomTitleBar({ 
  isMaximized, 
  onMinimize, 
  onMaximize, 
  onClose,
  onNewSession,
  onCloseSession,
  onSettings,
  onAbout,
  onCheckForUpdates,
  onToggleDevTools,
  onAICommand,
  onTftpServer,
  onWebServer,
  onIperfServer,
  onIperfClient,
  onNetcat,
  onThirdPartyLicenses,
  showSessionManager,
  onToggleSessionManager,
  iperfAvailable = true,
  themes = {},
  currentTheme = 'terminus',
  onChangeTheme,
}) {
  // Get current theme data to apply CSS variables
  const themeData = themes[currentTheme] || themes['terminus'] || {};
  const { t } = useTranslation(['menu', 'common']);
  const [activeMenu, setActiveMenu] = useState(null);
  const [activeSubmenu, setActiveSubmenu] = useState(null);
  const menuRef = useRef(null);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setActiveMenu(null);
      }
    };

    if (activeMenu) {
      // Use a slight delay to allow click events to fire first
      setTimeout(() => {
        document.addEventListener('mousedown', handleClickOutside);
      }, 0);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [activeMenu]);

  const handleMenuClick = (menuName) => {
    setActiveMenu(activeMenu === menuName ? null : menuName);
  };

  const handleMenuItemClick = (callback) => {
    if (callback) {
      callback();
    }
    setActiveMenu(null);
  };

  const menus = [
    {
      name: t('menu:file'),
      items: [
        { label: t('menu:newSession'), shortcut: 'Ctrl+N', onClick: onNewSession },
        { label: t('menu:closeSession'), shortcut: 'Ctrl+W', onClick: onCloseSession },
        { type: 'separator' },
        { label: t('menu:quit'), shortcut: 'Ctrl+Q', onClick: onClose },
      ],
    },
    {
      name: t('menu:view'),
      items: [
        { label: t('menu:toggleDevTools'), shortcut: 'Ctrl+Shift+I', onClick: onToggleDevTools },
        { type: 'separator' },
        {
          label: t('menu:appearance'),
          submenu: [
            {
              label: t('menu:primarySidebar'),
              type: 'checkbox',
              checked: showSessionManager !== false,
              onClick: () => {
                if (onToggleSessionManager) {
                  onToggleSessionManager(!showSessionManager);
                }
              }
            },
            { type: 'separator' },
            ...Object.entries(themes).map(([key, themeData]) => ({
              label: themeData.name,
              type: 'radio',
              checked: currentTheme === key,
              onClick: () => {
                if (onChangeTheme) {
                  onChangeTheme(key);
                }
              }
            }))
          ]
        },
        { type: 'separator' },
        { label: t('menu:settings'), shortcut: 'Ctrl+,', onClick: onSettings },
      ],
    },
    {
      name: t('menu:tools'),
      items: [
        { label: t('menu:aiCommand'), shortcut: 'Ctrl+Shift+A', onClick: onAICommand },
        { type: 'separator' },
        { label: t('menu:tftpServer'), shortcut: 'Ctrl+Shift+T', onClick: onTftpServer },
        { label: t('menu:webServer'), shortcut: 'Ctrl+Shift+W', onClick: onWebServer },
        { 
          label: t('menu:iperf3Server'), 
          shortcut: 'Ctrl+Shift+I', 
          onClick: iperfAvailable ? onIperfServer : null,
          disabled: !iperfAvailable,
          sublabel: iperfAvailable ? '' : t('menu:iperf3NotAvailable')
        },
        { 
          label: t('menu:iperf3Client'), 
          shortcut: 'Ctrl+Shift+K', 
          onClick: iperfAvailable ? onIperfClient : null,
          disabled: !iperfAvailable,
          sublabel: iperfAvailable ? '' : t('menu:iperf3NotAvailable')
        },
        { label: t('menu:netcat'), shortcut: 'Ctrl+Shift+N', onClick: onNetcat },
      ],
    },
    {
      name: t('menu:help'),
      items: [
        { label: t('menu:checkForUpdates'), onClick: onCheckForUpdates },
        { type: 'separator' },
        { label: t('menu:aboutAsh'), onClick: onAbout },
        ...(onThirdPartyLicenses ? [{ label: t('menu:thirdPartyLicenses'), onClick: onThirdPartyLicenses }] : []),
      ],
    },
  ];

  // Apply theme CSS variables
  const titleBarStyle = {
    '--theme-bg': themeData.background || '#000000',
    '--theme-surface': themeData.surface || '#1a1a1a',
    '--theme-text': themeData.text || '#00ff41',
    '--theme-border': themeData.border || '#1a1a1a',
    '--theme-accent': themeData.accent || '#00ff41',
  };

  return (
    <div className="custom-titlebar" ref={menuRef} style={titleBarStyle}>
      <div className="titlebar-left">
        <div className="titlebar-title">ash</div>
        <div className="titlebar-menus">
          {menus.map((menu) => (
            <div key={menu.name} className="menubar-item">
              <button
                className={`menubar-button ${activeMenu === menu.name ? 'active' : ''}`}
                onClick={() => handleMenuClick(menu.name)}
              >
                {menu.name}
              </button>
              {activeMenu === menu.name && (
                <div 
                  className="menubar-dropdown"
                  onClick={(e) => e.stopPropagation()}
                  onMouseDown={(e) => e.stopPropagation()}
                >
                  {menu.items.map((item, index) => (
                    item.type === 'separator' ? (
                      <div key={`sep-${index}`} className="menubar-separator" />
                    ) : item.submenu ? (
                      <div
                        key={item.label}
                        className="menubar-item-with-submenu"
                        onMouseEnter={() => setActiveSubmenu(item.label)}
                        onMouseLeave={() => setActiveSubmenu(null)}
                      >
                        <button
                          className="menubar-item-button"
                          onMouseDown={(e) => e.stopPropagation()}
                        >
                          <span className="menubar-item-label">{item.label}</span>
                          <span className="menubar-item-arrow">▶</span>
                        </button>
                        {activeSubmenu === item.label && (
                          <div className="menubar-submenu">
                            {item.submenu.map((subItem, subIndex) => (
                              subItem.type === 'separator' ? (
                                <div key={`sub-sep-${subIndex}`} className="menubar-separator" />
                              ) : (
                                <button
                                  key={subItem.label}
                                  className={`menubar-item-button ${(subItem.type === 'checkbox' || subItem.type === 'radio') && subItem.checked ? 'checked' : ''}`}
                                  onMouseDown={(e) => e.stopPropagation()}
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    if (subItem.onClick) {
                                      subItem.onClick();
                                    }
                                    setActiveMenu(null);
                                    setActiveSubmenu(null);
                                  }}
                                >
                                  <span className="menubar-item-label">
                                    {(subItem.type === 'checkbox' || subItem.type === 'radio') && (
                                      <span className="menubar-checkbox">
                                        {subItem.checked ? '✓' : ''}
                                      </span>
                                    )}
                                    {subItem.label}
                                  </span>
                                  {subItem.shortcut && (
                                    <span className="menubar-item-shortcut">{subItem.shortcut}</span>
                                  )}
                                </button>
                              )
                            ))}
                          </div>
                        )}
                      </div>
                    ) : (
                      <button
                        key={item.label}
                        className={`menubar-item-button ${item.disabled ? 'disabled' : ''}`}
                        disabled={item.disabled}
                        onMouseDown={(e) => e.stopPropagation()}
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          if (!item.disabled) {
                            handleMenuItemClick(item.onClick);
                          }
                        }}
                        title={item.disabled && item.sublabel ? item.sublabel : undefined}
                      >
                        <span className="menubar-item-label">{item.label}</span>
                        {item.shortcut && (
                          <span className="menubar-item-shortcut">{item.shortcut}</span>
                        )}
                        {item.sublabel && !item.disabled && (
                          <span className="menubar-item-sublabel">{item.sublabel}</span>
                        )}
                      </button>
                    )
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
      <div className="titlebar-controls">
        <button 
          className="titlebar-button minimize-button"
          onClick={onMinimize}
          title={t('menu:minimize')}
        >
          <span>−</span>
        </button>
        <button 
          className="titlebar-button maximize-button"
          onClick={onMaximize}
          title={isMaximized ? t('menu:restore') : t('menu:maximize')}
        >
          <span>{isMaximized ? '❐' : '□'}</span>
        </button>
        <button 
          className="titlebar-button close-button"
          onClick={onClose}
          title={t('common:close')}
        >
          <span>×</span>
        </button>
      </div>
    </div>
  );
}

