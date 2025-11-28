import React, { useState, useEffect, useCallback, memo } from 'react';
import './FilterSidebar.css';

/**
 * Filter Sidebar component - Right side panel for managing terminal output filters
 */
export const FilterSidebar = memo(function FilterSidebar({
  activeSessionId,
  sessions,
  sshConnections,
  showFilterSidebar,
  setShowFilterSidebar,
  filterSidebarWidth,
  setFilterSidebarWidth,
  llmSettings,
  onExecuteAIFilter
}) {
  const [filters, setFilters] = useState([]);
  const [selectedFilterId, setSelectedFilterId] = useState(null);
  const [showAIFilterInput, setShowAIFilterInput] = useState(false);
  const [showExpertMode, setShowExpertMode] = useState(false);
  const [isResizing, setIsResizing] = useState(false);

  // Get filters for active session
  useEffect(() => {
    if (activeSessionId && sshConnections.current[activeSessionId]) {
      const connection = sshConnections.current[activeSessionId];
      if (connection && typeof connection.getFilters === 'function') {
        const sessionFilters = connection.getFilters();
        setFilters(sessionFilters);
      } else {
        setFilters([]);
      }
    } else {
      setFilters([]);
    }
  }, [activeSessionId, sshConnections]);

  // Refresh filters periodically to get updated stats
  useEffect(() => {
    if (!activeSessionId || !showFilterSidebar) return;

    const interval = setInterval(() => {
      if (sshConnections.current[activeSessionId]) {
        const connection = sshConnections.current[activeSessionId];
        if (connection && typeof connection.getFilters === 'function') {
          const sessionFilters = connection.getFilters();
          setFilters(sessionFilters);
        }
      }
    }, 1000); // Update every second

    return () => clearInterval(interval);
  }, [activeSessionId, showFilterSidebar, sshConnections]);

  const handleAddFilter = useCallback((filterConfig) => {
    if (!activeSessionId || !sshConnections.current[activeSessionId]) {
      return;
    }

    const connection = sshConnections.current[activeSessionId];
    if (connection && typeof connection.addFilter === 'function') {
      const filterId = connection.addFilter(filterConfig);
      const sessionFilters = connection.getFilters();
      setFilters(sessionFilters);
      setSelectedFilterId(filterId);
      return filterId;
    }
  }, [activeSessionId, sshConnections]);

  const handleDeleteFilter = useCallback((filterId) => {
    if (!activeSessionId || !sshConnections.current[activeSessionId]) {
      return;
    }

    const connection = sshConnections.current[activeSessionId];
    if (connection && typeof connection.removeFilter === 'function') {
      connection.removeFilter(filterId);
      const sessionFilters = connection.getFilters();
      setFilters(sessionFilters);
      if (selectedFilterId === filterId) {
        setSelectedFilterId(null);
      }
    }
  }, [activeSessionId, sshConnections, selectedFilterId]);

  const handleToggleFilter = useCallback((filterId) => {
    if (!activeSessionId || !sshConnections.current[activeSessionId]) {
      return;
    }

    const connection = sshConnections.current[activeSessionId];
    if (connection && typeof connection.toggleFilter === 'function') {
      connection.toggleFilter(filterId);
      const sessionFilters = connection.getFilters();
      setFilters(sessionFilters);
    }
  }, [activeSessionId, sshConnections]);

  const handleResizeStart = useCallback((e) => {
    e.preventDefault();
    setIsResizing(true);
    const startX = e.clientX;
    const startWidth = filterSidebarWidth;

    const handleMouseMove = (e) => {
      const diff = startX - e.clientX; // Reverse because we're resizing from right
      const newWidth = Math.max(200, Math.min(600, startWidth + diff));
      setFilterSidebarWidth(newWidth);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [filterSidebarWidth, setFilterSidebarWidth]);

  const activeSession = sessions.find(s => s.id === activeSessionId);
  const activeFiltersCount = filters.filter(f => f.options?.enabled !== false).length;

  if (!showFilterSidebar) {
    return null;
  }

  return (
    <>
      <div 
        className="filter-sidebar"
        style={{ 
          width: `${filterSidebarWidth}px`,
          height: '100%'
        }}
      >
        <div className="filter-sidebar-header">
          <h3>Filters</h3>
          <div className="header-buttons">
            <button
              className="toggle-btn"
              onClick={() => setShowFilterSidebar(false)}
              title="Close Filter Sidebar"
            >
              ×
            </button>
          </div>
        </div>

        <div className="filter-sidebar-content">
          {activeSession ? (
            <>
              <div className="filter-session-info">
                <div className="session-name">{activeSession.name || activeSessionId}</div>
                <div className="filter-count">{activeFiltersCount} active</div>
              </div>

              <div className="filter-add-section">
                <button
                  className="add-filter-btn"
                  onClick={() => setShowAIFilterInput(true)}
                  title="Add Filter with AI"
                >
                  🤖 AI Filter
                </button>
                <button
                  className="add-filter-btn expert"
                  onClick={() => setShowExpertMode(true)}
                  title="Add Filter (Expert Mode)"
                >
                  ⚙️ Expert
                </button>
              </div>

              <div className="filter-list">
                {filters.length === 0 ? (
                  <div className="no-filters">
                    <div style={{ marginBottom: '12px', fontSize: '13px', color: '#888' }}>
                      No filters yet.
                    </div>
                    <div style={{ fontSize: '12px', color: '#666', lineHeight: '1.5' }}>
                      Click <strong style={{ color: '#00ff41' }}>"⚙️ Expert"</strong> button above to add a filter.
                    </div>
                    <div style={{ marginTop: '8px', fontSize: '11px', color: '#555', fontFamily: 'monospace', padding: '8px', background: '#1a1a1a', borderRadius: '4px' }}>
                      Example JSON will be shown in the editor.
                    </div>
                  </div>
                ) : (
                  filters.map(filter => (
                    <FilterItem
                      key={filter.id}
                      filter={filter}
                      connection={sshConnections.current[activeSessionId]}
                      isSelected={selectedFilterId === filter.id}
                      onSelect={() => setSelectedFilterId(filter.id)}
                      onToggle={() => handleToggleFilter(filter.id)}
                      onDelete={() => handleDeleteFilter(filter.id)}
                    />
                  ))
                )}
              </div>
            </>
          ) : (
            <div className="no-session">
              No active session
            </div>
          )}
        </div>
      </div>

      {/* Resize handle */}
      <div
        className="filter-resize-handle"
        onMouseDown={handleResizeStart}
      />

      {/* AI Filter Input */}
      {showAIFilterInput && (
        <AIFilterInput
          isVisible={showAIFilterInput}
          onClose={() => setShowAIFilterInput(false)}
          onExecute={async (naturalLanguage) => {
            if (onExecuteAIFilter) {
              await onExecuteAIFilter(naturalLanguage);
              const connection = sshConnections.current[activeSessionId];
              if (connection) {
                const sessionFilters = connection.getFilters();
                setFilters(sessionFilters);
              }
            }
            setShowAIFilterInput(false);
          }}
          llmSettings={llmSettings}
        />
      )}

      {/* Expert Mode */}
      {showExpertMode && (
        <ExpertFilterEditor
          isVisible={showExpertMode}
          onClose={() => setShowExpertMode(false)}
          onSave={(filterConfig) => {
            handleAddFilter(filterConfig);
            setShowExpertMode(false);
          }}
        />
      )}
    </>
  );
});

/**
 * Filter Item component
 */
const FilterItem = memo(function FilterItem({
  filter,
  connection,
  isSelected,
  onSelect,
  onToggle,
  onDelete
}) {
  const [stats, setStats] = useState({ matches: 0, firstMatch: null, lastMatch: null });

  useEffect(() => {
    if (connection && typeof connection.getFilterStats === 'function') {
      const filterStats = connection.getFilterStats(filter.id);
      setStats(filterStats);
    }
  }, [connection, filter.id]);

  // Update stats periodically
  useEffect(() => {
    if (!connection) return;

    const interval = setInterval(() => {
      if (connection && typeof connection.getFilterStats === 'function') {
        const filterStats = connection.getFilterStats(filter.id);
        setStats(filterStats);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [connection, filter.id]);

  const getFilterIcon = (type) => {
    switch(type) {
      case 'grep': return '🔍';
      case 'string': return '📝';
      case 'regex': return '⚡';
      case 'prompt': return '⏱️';
      case 'lineCount': return '📊';
      default: return '🔧';
    }
  };

  const getFilterTypeLabel = (filter) => {
    if (filter.filter.mode) {
      return `${filter.filter.mode.toUpperCase()} (${filter.filter.filters?.length || 0} filters)`;
    }
    return filter.filter.type || 'unknown';
  };

  const getFilterPattern = (filter) => {
    if (filter.filter.mode) {
      return `${filter.filter.mode} mode`;
    }
    if (filter.filter.pattern instanceof RegExp) {
      return filter.filter.pattern.toString();
    }
    return filter.filter.pattern || 'N/A';
  };

  const isEnabled = filter.options?.enabled !== false;

  return (
    <div
      className={`filter-item ${isSelected ? 'selected' : ''} ${!isEnabled ? 'disabled' : ''}`}
      onClick={onSelect}
    >
      <div className="filter-item-header">
        <span className="filter-icon">{getFilterIcon(filter.filter.type || 'unknown')}</span>
        <span className="filter-name">
          {filter.name || `Filter ${filter.id.slice(-6)}`}
        </span>
        <div className="filter-actions">
          <button
            className={`toggle-btn ${isEnabled ? 'active' : ''}`}
            onClick={(e) => {
              e.stopPropagation();
              onToggle();
            }}
            title={isEnabled ? 'Disable' : 'Enable'}
          >
            {isEnabled ? 'ON' : 'OFF'}
          </button>
          <button
            className="delete-btn"
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            title="Delete"
          >
            ×
          </button>
        </div>
      </div>
      <div className="filter-item-pattern">
        {getFilterTypeLabel(filter)}: {getFilterPattern(filter)}
      </div>
      <div className="filter-item-stats">
        Matches: {stats.matches || 0}
      </div>
    </div>
  );
});

/**
 * AI Filter Input component
 */
const AIFilterInput = memo(function AIFilterInput({
  isVisible,
  onClose,
  onExecute,
  llmSettings
}) {
  const [input, setInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  if (!isVisible) return null;

  const handleExecute = async () => {
    if (!input.trim() || isProcessing) return;
    
    if (!llmSettings?.enabled) {
      alert('LLM is not enabled. Please enable it in Settings.');
      return;
    }

    setIsProcessing(true);
    try {
      await onExecute(input.trim());
      setInput('');
    } catch (error) {
      console.error('AI Filter generation error:', error);
      alert(`Error: ${error.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="ai-filter-input-overlay">
      <div className="ai-filter-input">
        <div className="ai-filter-input-header">
          <span>AI Filter Generation</span>
          <button onClick={onClose}>×</button>
        </div>
        <div className="ai-filter-input-body">
          <input
            type="text"
            placeholder="Describe filter condition... (e.g., 'notify me when error appears')"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleExecute();
              } else if (e.key === 'Escape') {
                onClose();
              }
            }}
            disabled={isProcessing}
            autoFocus
          />
          <div className="ai-filter-input-actions">
            <button
              onClick={handleExecute}
              disabled={!input.trim() || isProcessing}
            >
              {isProcessing ? 'Generating...' : 'Generate'}
            </button>
            <button onClick={onClose}>Cancel</button>
          </div>
        </div>
      </div>
    </div>
  );
});

/**
 * Expert Filter Editor component
 */
const ExpertFilterEditor = memo(function ExpertFilterEditor({
  isVisible,
  onClose,
  onSave
}) {
  const [jsonInput, setJsonInput] = useState(`{
  "filter": {
    "type": "grep",
    "pattern": "error|warning",
    "caseSensitive": false
  },
  "actions": [
    {
      "type": "beep",
      "frequency": 800,
      "duration": 500
    }
  ],
  "options": {
    "oneTime": false,
    "scope": "session"
  }
}`);

  if (!isVisible) return null;

  const handleSave = () => {
    try {
      const filterConfig = JSON.parse(jsonInput);
      
      if (!filterConfig.filter) {
        throw new Error('Filter configuration missing "filter" property');
      }
      if (!filterConfig.actions || !Array.isArray(filterConfig.actions)) {
        throw new Error('Filter configuration missing "actions" array');
      }

      onSave(filterConfig);
      setJsonInput(`{
  "filter": {
    "type": "grep",
    "pattern": "error|warning",
    "caseSensitive": false
  },
  "actions": [
    {
      "type": "beep",
      "frequency": 800,
      "duration": 500
    }
  ],
  "options": {
    "oneTime": false,
    "scope": "session"
  }
}`);
    } catch (error) {
      alert(`Invalid JSON: ${error.message}`);
    }
  };

  return (
    <div className="expert-filter-editor-overlay">
      <div className="expert-filter-editor">
        <div className="expert-filter-editor-header">
          <span>Expert Mode - Filter JSON</span>
          <button onClick={onClose}>×</button>
        </div>
        <div className="expert-filter-editor-body">
          <textarea
            value={jsonInput}
            onChange={(e) => setJsonInput(e.target.value)}
            placeholder="Enter filter configuration JSON..."
            spellCheck={false}
          />
          <div className="expert-filter-editor-actions">
            <button onClick={handleSave}>Save</button>
            <button onClick={onClose}>Cancel</button>
          </div>
        </div>
      </div>
    </div>
  );
});

