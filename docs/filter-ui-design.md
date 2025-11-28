# Filter UI Design - Right Sidebar

## Layout Structure

```
┌─────────────────┬──────────────────────┬─────────────────┐
│                 │                       │                 │
│ Session Manager │   Terminal View       │  Filter Sidebar │
│  (Left, 250px)  │   (Center, flex: 1)   │  (Right, 300px) │
│                 │                       │                 │
│ - Sessions      │ - Terminal Tabs       │ - Filter List   │
│ - Groups        │ - Terminal Content    │ - Add Filter    │
│ - Favorites     │                       │ - Filter Stats  │
│                 │                       │                 │
└─────────────────┴──────────────────────┴─────────────────┘
```

## Filter Sidebar Components

### 1. Header
- Title: "Filters"
- Toggle button (show/hide sidebar)
- Active session indicator
- Filter count badge

### 2. Filter List
- Scrollable list of filters for current session
- Each filter item shows:
  - Filter name/description
  - Filter type badge (grep, string, prompt, etc.)
  - Active/Inactive toggle
  - Match count
  - Actions (edit, delete)

### 3. Add Filter Section
- Quick add button
- AI Filter button (opens AI input)
- Expert mode button (opens JSON editor)

### 4. Filter Details Panel
- When filter is selected:
  - Filter configuration
  - Actions list
  - Statistics (matches, last match time)
  - Test button

## Component Structure

```javascript
// FilterSidebar.jsx
export const FilterSidebar = ({
  activeSessionId,
  sessions,
  sshConnections,
  showFilterSidebar,
  setShowFilterSidebar,
  filterSidebarWidth,
  setFilterSidebarWidth,
  onAddFilter,
  onEditFilter,
  onDeleteFilter,
  onToggleFilter,
  llmSettings,
  onExecuteAIFilter
}) => {
  // Filter management state
  const [filters, setFilters] = useState({}); // sessionId -> filters[]
  const [selectedFilterId, setSelectedFilterId] = useState(null);
  const [showAIFilterInput, setShowAIFilterInput] = useState(false);
  const [showExpertMode, setShowExpertMode] = useState(false);
  
  // ...
};
```

## UI Mockup

```
┌─────────────────────────────────────┐
│ Filters                    [×] [≡] │ ← Header with close/toggle
├─────────────────────────────────────┤
│ Active: session-123                  │ ← Current session indicator
│ 3 filters active                     │ ← Filter count
├─────────────────────────────────────┤
│ [+ Add Filter]                       │ ← Quick add section
│ [🤖 AI Filter] [⚙️ Expert]          │
├─────────────────────────────────────┤
│ Filter List                          │
│ ┌─────────────────────────────────┐ │
│ │ 🔍 Error Detection      [ON] [×] │ │ ← Filter item
│ │    grep: error|warning           │ │
│ │    Matches: 5                     │ │
│ └─────────────────────────────────┘ │
│ ┌─────────────────────────────────┐ │
│ │ 📢 Build Complete       [ON] [×] │ │
│ │    string: "Build complete"      │ │
│ │    Matches: 1                     │ │
│ └─────────────────────────────────┘ │
│ ┌─────────────────────────────────┐ │
│ │ ⏱️  Prompt Detection   [OFF][×] │ │
│ │    prompt: /\$\s*$/             │ │
│ │    Matches: 0                    │ │
│ └─────────────────────────────────┘ │
└─────────────────────────────────────┘
```

## Filter Item Component

```javascript
// FilterItem.jsx
export const FilterItem = ({
  filter,
  isActive,
  matchCount,
  onToggle,
  onEdit,
  onDelete,
  onSelect
}) => {
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

  return (
    <div 
      className="filter-item"
      onClick={() => onSelect(filter.id)}
    >
      <div className="filter-item-header">
        <span className="filter-icon">{getFilterIcon(filter.type)}</span>
        <span className="filter-name">{filter.name || 'Unnamed Filter'}</span>
        <div className="filter-actions">
          <button 
            className={`toggle-btn ${isActive ? 'active' : ''}`}
            onClick={(e) => {
              e.stopPropagation();
              onToggle(filter.id);
            }}
            title={isActive ? 'Disable' : 'Enable'}
          >
            {isActive ? 'ON' : 'OFF'}
          </button>
          <button 
            className="delete-btn"
            onClick={(e) => {
              e.stopPropagation();
              onDelete(filter.id);
            }}
            title="Delete"
          >
            ×
          </button>
        </div>
      </div>
      <div className="filter-item-pattern">
        {filter.type}: {filter.pattern}
      </div>
      <div className="filter-item-stats">
        Matches: {matchCount}
      </div>
    </div>
  );
};
```

## Add Filter Dialog

### AI Mode
```javascript
// Similar to TerminalAICommandInput but for filters
<AIFilterInput
  isVisible={showAIFilterInput}
  onClose={() => setShowAIFilterInput(false)}
  onExecute={async (naturalLanguage) => {
    const filterConfig = await llmService.convertToFilter(naturalLanguage);
    onAddFilter(activeSessionId, filterConfig);
  }}
  isProcessing={isAIProcessing}
/>
```

### Expert Mode
```javascript
<ExpertFilterEditor
  isVisible={showExpertMode}
  onClose={() => setShowExpertMode(false)}
  onSave={(jsonConfig) => {
    try {
      const filterConfig = JSON.parse(jsonConfig);
      onAddFilter(activeSessionId, filterConfig);
    } catch (error) {
      // Show error
    }
  }}
/>
```

## Filter Details Panel

When a filter is selected, show detailed view:

```javascript
<FilterDetails
  filter={selectedFilter}
  stats={filterStats[selectedFilter.id]}
  onEdit={() => {
    // Open edit dialog
  }}
  onTest={() => {
    // Test filter against sample output
  }}
/>
```

## CSS Layout

```css
/* Filter Sidebar */
.filter-sidebar {
  width: 300px;
  height: 100%;
  background: #000000;
  border-left: 1px solid #1a1a1a;
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  transition: width 0.3s ease, opacity 0.3s ease;
  overflow: hidden;
}

.filter-sidebar.hidden {
  width: 0 !important;
  opacity: 0;
  overflow: hidden;
  border-left: none;
}

.filter-sidebar-header {
  padding: 12px;
  border-bottom: 1px solid #1a1a1a;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.filter-sidebar-content {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 8px;
}

.filter-item {
  background: #1a1a1a;
  border: 1px solid #2a2a2a;
  border-radius: 4px;
  padding: 12px;
  margin-bottom: 8px;
  cursor: pointer;
  transition: all 0.2s;
}

.filter-item:hover {
  background: #2a2a2a;
  border-color: #00ff41;
}

.filter-item.selected {
  border-color: #00ff41;
  background: #1a2a1a;
}

.filter-item-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.filter-icon {
  font-size: 16px;
}

.filter-name {
  flex: 1;
  font-weight: 600;
  color: #00ff41;
}

.filter-actions {
  display: flex;
  gap: 4px;
}

.toggle-btn {
  padding: 4px 8px;
  background: #1a1a1a;
  border: 1px solid #2a2a2a;
  border-radius: 3px;
  color: #888;
  cursor: pointer;
  font-size: 11px;
}

.toggle-btn.active {
  background: #00ff41;
  color: #000;
  border-color: #00ff41;
}

.delete-btn {
  padding: 4px 8px;
  background: transparent;
  border: 1px solid #2a2a2a;
  border-radius: 3px;
  color: #888;
  cursor: pointer;
  font-size: 14px;
}

.delete-btn:hover {
  color: #ff4444;
  border-color: #ff4444;
}

.filter-item-pattern {
  font-size: 11px;
  color: #888;
  margin-bottom: 4px;
  font-family: monospace;
}

.filter-item-stats {
  font-size: 11px;
  color: #666;
}
```

## Resize Handle

Similar to SessionManager, add resize handle:

```javascript
<div 
  className="filter-resize-handle"
  onMouseDown={handleResizeStart}
/>
```

```css
.filter-resize-handle {
  width: 4px;
  background: transparent;
  cursor: col-resize;
  flex-shrink: 0;
  transition: background 0.2s;
}

.filter-resize-handle:hover {
  background: #4a90e2;
}
```

## Keyboard Shortcuts

- `Ctrl+Shift+F`: Toggle filter sidebar
- `Ctrl+Shift+N`: Add new filter (AI mode)
- `Ctrl+Shift+J`: Expert mode

## Integration with App.jsx

```javascript
// App.jsx
const [showFilterSidebar, setShowFilterSidebar] = useState(false);
const [filterSidebarWidth, setFilterSidebarWidth] = useState(300);

// Filter management
const [sessionFilters, setSessionFilters] = useState({}); // sessionId -> filters[]

// Add filter
const handleAddFilter = (sessionId, filterConfig) => {
  const connection = sshConnections.current[sessionId];
  if (connection) {
    const filterId = connection.addFilter(filterConfig);
    // Update UI state
    setSessionFilters(prev => ({
      ...prev,
      [sessionId]: [...(prev[sessionId] || []), { id: filterId, ...filterConfig }]
    }));
  }
};

// In render
<div className="main-content">
  <SessionManager ... />
  <ResizeHandle ... />
  <TerminalView ... />
  <ResizeHandle 
    ref={filterResizeHandleRef}
    className="filter-resize-handle"
    onMouseDown={handleFilterResizeStart}
  />
  <FilterSidebar
    activeSessionId={activeSessionId}
    sessions={sessions}
    sshConnections={sshConnections}
    showFilterSidebar={showFilterSidebar}
    setShowFilterSidebar={setShowFilterSidebar}
    filterSidebarWidth={filterSidebarWidth}
    setFilterSidebarWidth={setFilterSidebarWidth}
    filters={sessionFilters[activeSessionId] || []}
    onAddFilter={handleAddFilter}
    onEditFilter={handleEditFilter}
    onDeleteFilter={handleDeleteFilter}
    onToggleFilter={handleToggleFilter}
    llmSettings={llmSettings}
    onExecuteAIFilter={handleAIFilterGeneration}
  />
</div>
```

## Advantages of Right Sidebar

1. **Non-intrusive**: Doesn't block terminal view
2. **Always visible**: Can monitor filters while working
3. **Session-specific**: Shows filters for active session
4. **Resizable**: User can adjust width
5. **Consistent**: Matches SessionManager pattern
6. **Accessible**: Easy to toggle on/off

## Alternative: Collapsible Panel

If sidebar feels too heavy, could use a collapsible panel that slides in from right:

```javascript
// Slide-in panel (overlay)
<div className={`filter-panel ${showFilterPanel ? 'open' : ''}`}>
  {/* Filter content */}
</div>
```

But sidebar is better for:
- Always-visible monitoring
- Quick access
- Better UX for power users

