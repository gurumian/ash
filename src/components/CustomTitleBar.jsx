import React, { useState, useRef, useEffect } from 'react';
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
  onTftpServer,
  showSessionManager,
  onToggleSessionManager,
}) {
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
      name: 'File',
      items: [
        { label: 'New Session', shortcut: 'Ctrl+N', onClick: onNewSession },
        { label: 'Close Session', shortcut: 'Ctrl+W', onClick: onCloseSession },
        { type: 'separator' },
        { label: 'Quit', shortcut: 'Ctrl+Q', onClick: onClose },
      ],
    },
    {
      name: 'View',
      items: [
        { label: 'Toggle Developer Tools', shortcut: 'Ctrl+Shift+I', onClick: onToggleDevTools },
        { type: 'separator' },
        {
          label: 'Appearance',
          submenu: [
            {
              label: 'Primary Side Bar',
              type: 'checkbox',
              checked: showSessionManager !== false,
              onClick: () => {
                if (onToggleSessionManager) {
                  onToggleSessionManager(!showSessionManager);
                }
              }
            }
          ]
        },
        { type: 'separator' },
        { label: 'Settings', shortcut: 'Ctrl+,', onClick: onSettings },
      ],
    },
    {
      name: 'Tools',
      items: [
        { label: 'TFTP Server', onClick: onTftpServer },
      ],
    },
    {
      name: 'Help',
      items: [
        { label: 'Check for Updates', onClick: onCheckForUpdates },
        { type: 'separator' },
        { label: 'About ash', onClick: onAbout },
      ],
    },
  ];

  return (
    <div className="custom-titlebar" ref={menuRef}>
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
                                  className={`menubar-item-button ${subItem.type === 'checkbox' && subItem.checked ? 'checked' : ''}`}
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
                                    {subItem.type === 'checkbox' && (
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
                        className="menubar-item-button"
                        onMouseDown={(e) => e.stopPropagation()}
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          handleMenuItemClick(item.onClick);
                        }}
                      >
                        <span className="menubar-item-label">{item.label}</span>
                        {item.shortcut && (
                          <span className="menubar-item-shortcut">{item.shortcut}</span>
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
          title="Minimize"
        >
          <span>−</span>
        </button>
        <button 
          className="titlebar-button maximize-button"
          onClick={onMaximize}
          title={isMaximized ? "Restore" : "Maximize"}
        >
          <span>{isMaximized ? '❐' : '□'}</span>
        </button>
        <button 
          className="titlebar-button close-button"
          onClick={onClose}
          title="Close"
        >
          <span>×</span>
        </button>
      </div>
    </div>
  );
}

