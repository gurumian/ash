# Terminal Filter System Design

## Concept

A system that applies **Filters** to terminal output to detect specific conditions and trigger events.

## Filter Types

### 1. String Filter (String Detection)
```javascript
{
  type: 'string',
  pattern: 'Build complete',
  caseSensitive: false
}
```

### 2. Regex Filter (Regular Expression)
```javascript
{
  type: 'regex',
  pattern: /\$\s*$/,  // Prompt detection
  flags: 'g'
}
```

### 3. Grep Filter (Grep Pattern)
```javascript
{
  type: 'grep',
  pattern: 'error|warning|failed',
  caseSensitive: false
}
```

### 4. Prompt Filter (Prompt Detection - Special Case)
```javascript
{
  type: 'prompt',
  pattern: /\$\s*$/,  // Automatically detect prompt
  timeout: 300000
}
```

### 5. Line Count Filter (Line Count Based)
```javascript
{
  type: 'lineCount',
  count: 10,  // Trigger when 10 lines are output
  resetOnMatch: true
}
```

### 6. Timeout Filter (Time Based)
```javascript
{
  type: 'timeout',
  duration: 5000  // Trigger after 5 seconds
}
```

## Filter Chaining

Multiple filters can be combined:

```javascript
// AND condition: All filters must match
{
  mode: 'and',
  filters: [
    { type: 'string', pattern: 'Build' },
    { type: 'string', pattern: 'complete' }
  ]
}

// OR condition: At least one must match
{
  mode: 'or',
  filters: [
    { type: 'grep', pattern: 'error' },
    { type: 'grep', pattern: 'warning' }
  ]
}
```

## Actions (Executed When Filter Matches)

### 1. Beep Action
```javascript
{
  type: 'beep',
  frequency: 800,
  duration: 500
}
```

### 2. Webhook Action
```javascript
{
  type: 'webhook',
  url: 'https://discord.com/api/webhooks/...',
  method: 'POST',
  body: {
    content: 'Command completed: {{command}}'
  }
}
```

### 3. Notification Action
```javascript
{
  type: 'notification',
  title: 'Command Complete',
  message: '{{command}} finished',
  sound: true
}
```

### 4. Custom Callback Action
```javascript
{
  type: 'callback',
  handler: (data) => {
    console.log('Filter matched:', data);
  }
}
```

## Usage Examples

### Basic Usage

```javascript
const connection = sshConnections.current[sessionId];

// String detection filter
const filterId = connection.addFilter({
  filter: {
    type: 'string',
    pattern: 'Build complete'
  },
  actions: [
    { type: 'beep' },
    { type: 'webhook', url: '...' }
  ]
});

// Execute command
connection.write('make build\r\n');
```

### Prompt Detection

```javascript
// Notify when prompt reappears
const filterId = connection.addFilter({
  filter: {
    type: 'prompt',
    pattern: /\$\s*$/
  },
  actions: [
    { type: 'beep' },
    {
      type: 'webhook',
      url: 'https://discord.com/api/webhooks/...',
      body: {
        content: 'Command completed: `{{command}}`'
      }
    }
  ]
});

connection.write('long-running-command\r\n');
```

### Grep Pattern

```javascript
// Detect errors or warnings
const filterId = connection.addFilter({
  filter: {
    type: 'grep',
    pattern: 'error|warning|failed',
    caseSensitive: false
  },
  actions: [
    { type: 'beep', frequency: 1000 },  // High frequency for warning
    {
      type: 'notification',
      title: 'Error Detected',
      message: '{{matchedLine}}'
    }
  ]
});
```

### Composite Filter (AND)

```javascript
// When both "Build" and "complete" appear
const filterId = connection.addFilter({
  filter: {
    mode: 'and',
    filters: [
      { type: 'string', pattern: 'Build' },
      { type: 'string', pattern: 'complete' }
    ]
  },
  actions: [
    { type: 'beep' }
  ]
});
```

### Composite Filter (OR)

```javascript
// When either error or warning appears
const filterId = connection.addFilter({
  filter: {
    mode: 'or',
    filters: [
      { type: 'grep', pattern: 'error' },
      { type: 'grep', pattern: 'warning' }
    ]
  },
  actions: [
    { type: 'beep' }
  ]
});
```

### Line Count Based

```javascript
// Notify when 10 lines are output
const filterId = connection.addFilter({
  filter: {
    type: 'lineCount',
    count: 10
  },
  actions: [
    { type: 'beep' }
  ]
});
```

### Timeout

```javascript
// Timeout if prompt doesn't appear after 5 seconds
const filterId = connection.addFilter({
  filter: {
    type: 'prompt',
    pattern: /\$\s*$/,
    timeout: 5000
  },
  actions: [
    {
      type: 'webhook',
      url: '...',
      body: {
        content: 'Command timeout after 5 seconds'
      }
    }
  ]
});
```

## API Design

### Adding Filter

```javascript
/**
 * Add a filter and return its ID
 * @param {Object} config - Filter configuration
 * @param {Object} config.filter - Filter definition
 * @param {Array} config.actions - Actions to execute when filter matches
 * @param {Object} config.options - Additional options (oneTime, scope, etc.)
 * @returns {string} filterId
 */
addFilter(config) {
  const filterId = `filter_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  this.filters.set(filterId, {
    id: filterId,
    filter: config.filter,
    actions: config.actions || [],
    options: {
      oneTime: config.options?.oneTime ?? false,  // Match only once
      scope: config.options?.scope ?? 'session',   // 'session' | 'command'
      ...config.options
    },
    createdAt: Date.now(),
    matched: false
  });
  
  return filterId;
}
```

### Removing Filter

```javascript
/**
 * Remove a filter
 * @param {string} filterId
 */
removeFilter(filterId) {
  this.filters.delete(filterId);
}

/**
 * Remove all filters
 */
clearFilters() {
  this.filters.clear();
}
```

### Data Processing

```javascript
/**
 * Apply filters to incoming data
 * @param {string} data - Terminal output data
 */
processDataWithFilters(data) {
  if (this.filters.size === 0) return;

  // Add to buffer
  this.filterBuffer += data;
  
  // Split by lines
  const lines = this.filterBuffer.split(/\r?\n/);
  this.filterBuffer = lines.pop() || '';

  // Check each filter
  this.filters.forEach((filterConfig, filterId) => {
    if (filterConfig.options.oneTime && filterConfig.matched) {
      return; // Skip already matched oneTime filters
    }

    const matched = this.evaluateFilter(filterConfig.filter, lines);
    
    if (matched) {
      filterConfig.matched = true;
      this.executeActions(filterConfig.actions, {
        filterId,
        matchedLines: lines,
        matchedLine: lines[lines.length - 1]
      });
      
      // Remove oneTime filters
      if (filterConfig.options.oneTime) {
        this.filters.delete(filterId);
      }
    }
  });
}

/**
 * Evaluate filter
 */
evaluateFilter(filter, lines) {
  // Single filter
  if (filter.type) {
    return this.evaluateSingleFilter(filter, lines);
  }
  
  // Composite filter
  if (filter.mode === 'and') {
    return filter.filters.every(f => this.evaluateSingleFilter(f, lines));
  }
  
  if (filter.mode === 'or') {
    return filter.filters.some(f => this.evaluateSingleFilter(f, lines));
  }
  
  return false;
}

/**
 * Evaluate single filter
 */
evaluateSingleFilter(filter, lines) {
  switch (filter.type) {
    case 'string':
      return lines.some(line => 
        filter.caseSensitive 
          ? line.includes(filter.pattern)
          : line.toLowerCase().includes(filter.pattern.toLowerCase())
      );
    
    case 'regex':
      const regex = filter.pattern instanceof RegExp 
        ? filter.pattern 
        : new RegExp(filter.pattern, filter.flags || '');
      return lines.some(line => regex.test(line));
    
    case 'grep':
      const grepRegex = new RegExp(filter.pattern, filter.caseSensitive ? 'g' : 'gi');
      return lines.some(line => grepRegex.test(line));
    
    case 'prompt':
      // Check if last line matches prompt pattern
      const lastLine = lines[lines.length - 1] || '';
      const promptRegex = filter.pattern instanceof RegExp 
        ? filter.pattern 
        : new RegExp(filter.pattern);
      return promptRegex.test(lastLine);
    
    case 'lineCount':
      return lines.length >= filter.count;
    
    case 'timeout':
      // Requires separate timer-based handling
      return false;
    
    default:
      return false;
  }
}

/**
 * Execute actions
 */
async executeActions(actions, context) {
  for (const action of actions) {
    try {
      switch (action.type) {
        case 'beep':
          await this.executeBeep(action);
          break;
        
        case 'webhook':
          await this.executeWebhook(action, context);
          break;
        
        case 'notification':
          await this.executeNotification(action, context);
          break;
        
        case 'callback':
          if (action.handler) {
            action.handler(context);
          }
          break;
      }
    } catch (error) {
      console.error('Action execution failed:', error);
    }
  }
}
```

## Advanced Features

### Filter Groups

```javascript
// Manage multiple filters as a group
const groupId = connection.createFilterGroup('build-monitoring');

connection.addFilter({
  filter: { type: 'string', pattern: 'Build complete' },
  actions: [{ type: 'beep' }],
  group: groupId
});

connection.addFilter({
  filter: { type: 'grep', pattern: 'error' },
  actions: [{ type: 'beep', frequency: 1000 }],
  group: groupId
});

// Remove entire group
connection.removeFilterGroup(groupId);
```

### Filter Statistics

```javascript
// Filter matching statistics
const stats = connection.getFilterStats(filterId);
// { matches: 5, firstMatch: timestamp, lastMatch: timestamp }
```

## Advantages

1. **General and Extensible**: Can detect various conditions
2. **Composable**: Can combine conditions with AND/OR
3. **Reusable**: Filters can be managed independently
4. **Clear Concept**: Separation of Filter and Action
5. **Flexible**: Easy to add new filter and action types
