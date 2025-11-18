import React, { useState, useRef, useEffect } from 'react';
import './CustomMenuBar.css';

export function CustomMenuBar({
  onNewSession,
  onCloseSession,
  onSettings,
  onAbout,
}) {
  const [activeMenu, setActiveMenu] = useState(null);
  const menuRef = useRef(null);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setActiveMenu(null);
      }
    };

    if (activeMenu) {
      document.addEventListener('mousedown', handleClickOutside);
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
        { label: 'Quit', shortcut: 'Ctrl+Q', onClick: () => window.electronAPI?.windowClose?.() },
      ],
    },
    {
      name: 'View',
      items: [
        { label: 'Settings', shortcut: 'Ctrl+,', onClick: onSettings },
      ],
    },
    {
      name: 'Help',
      items: [
        { label: 'About ash', onClick: onAbout },
      ],
    },
  ];

  return (
    <div className="custom-menubar" ref={menuRef}>
      {menus.map((menu) => (
        <div key={menu.name} className="menubar-item">
          <button
            className={`menubar-button ${activeMenu === menu.name ? 'active' : ''}`}
            onClick={() => handleMenuClick(menu.name)}
          >
            {menu.name}
          </button>
          {activeMenu === menu.name && (
            <div className="menubar-dropdown">
              {menu.items.map((item, index) => (
                item.type === 'separator' ? (
                  <div key={`sep-${index}`} className="menubar-separator" />
                ) : (
                  <button
                    key={item.label}
                    className="menubar-item-button"
                    onClick={() => handleMenuItemClick(item.onClick)}
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
  );
}

