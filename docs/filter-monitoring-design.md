# Terminal Output Monitoring Filter System Design

## Core Concept

**Filters do NOT execute commands. They only monitor terminal output.**

This terminal is:
- SSH Connection: A client connected to a remote server's shell
- Serial Connection: A client communicating with a serial device

Therefore, filters:
- ✅ **Passive Monitoring**: Monitor output data and match conditions
- ❌ **NOT Command Execution**: Do not execute commands

## How It Works

### 1. Filter Registration
```javascript
// When a filter is registered, it monitors all subsequent terminal output
const filterId = connection.addFilter({
  filter: { type: 'grep', pattern: 'error' },
  actions: [{ type: 'beep' }]
});

// User manually enters command
connection.write('make build\r\n');

// Or execute another command
connection.write('ls -la\r\n');

// Filter monitors all output and executes actions when conditions match
```

### 2. Output Stream Monitoring

```
[User Input] → connection.write('make build\r\n')
                    ↓
[Remote Server/Serial Device] → Output data stream
                    ↓
[Terminal Data Handler] → handleSshData / handleSerialData
                    ↓
[Filter Processing] → processDataWithFilters(data)
                    ↓
[Condition Matching] → evaluateFilter()
                    ↓
[Action Execution] → executeActions()
```

## Filter's Role

### ✅ What Filters Do
1. **Output Monitoring**: Monitor all terminal output data
2. **Condition Matching**: Check if specified patterns/conditions appear in output
3. **Action Triggering**: Execute actions when conditions match

### ❌ What Filters Don't Do
1. **Command Execution**: Filters themselves do not execute commands
2. **Output Modification**: Do not modify output data
3. **Command Generation**: Do not generate commands

## Usage Scenarios

### Scenario 1: Build Completion Detection
```javascript
// 1. Register filter (detect build completion)
const filterId = connection.addFilter({
  filter: { type: 'string', pattern: 'Build complete' },
  actions: [{ type: 'beep' }]
});

// 2. User manually enters command
connection.write('make build\r\n');

// 3. Filter monitors during build output
// 4. When "Build complete" string appears, beep executes
```

### Scenario 2: Error Detection
```javascript
// 1. Register filter (detect errors)
const filterId = connection.addFilter({
  filter: { type: 'grep', pattern: 'error|warning|failed' },
  actions: [
    { type: 'beep', frequency: 1000 },
    { type: 'webhook', url: '...' }
  ]
});

// 2. User executes command
connection.write('npm test\r\n');

// 3. When error appears in test output, immediately notify
```

### Scenario 3: Prompt Detection
```javascript
// 1. Register filter (detect prompt)
const filterId = connection.addFilter({
  filter: { type: 'prompt', pattern: /\$\s*$/ },
  actions: [{ type: 'beep' }]
});

// 2. User executes long-running command
connection.write('long-running-command\r\n');

// 3. When command completes and prompt reappears, notify
```

## Meaning of AI Filter Generation

### What AI Generates
```javascript
// User: "notify me when error or warning appears"
// AI generates:
{
  "filter": {
    "mode": "or",
    "filters": [
      { "type": "grep", "pattern": "error" },
      { "type": "grep", "pattern": "warning" }
    ]
  },
  "actions": [{ "type": "beep" }]
}
```

### What AI Doesn't Do
- ❌ Does not execute commands
- ❌ Does not generate commands
- ✅ **Only generates output monitoring rules**

## Relationship Between Filters and Commands

```
[Filter Registration] ← Independent
     ↓
[Command Execution] ← User manually enters
     ↓
[Output Stream] ← From remote server/serial device
     ↓
[Filter Monitoring] ← Monitors all output
     ↓
[Condition Matching] ← Pattern check
     ↓
[Action Execution] ← beep, webhook, etc.
```

## Implementation Notes

### 1. Filters Only Monitor Output
```javascript
// ❌ Incorrect understanding
filter.executeCommand('make build');  // Filter executes command

// ✅ Correct understanding
connection.addFilter({...});  // Register filter
connection.write('make build\r\n');  // User executes command
// Filter only monitors output
```

### 2. Filters Are Independent Per Session
```javascript
// Each session (SSH/Serial connection) has independent filters
const session1Filter = sshConnections.current[session1].addFilter({...});
const session2Filter = sshConnections.current[session2].addFilter({...});
```

### 3. Filters Continuously Monitor
```javascript
// After filter registration, it continuously monitors
const filterId = connection.addFilter({...});

// All subsequent output passes through filter
connection.write('command1\r\n');  // Filter monitors
connection.write('command2\r\n');  // Filter monitors
connection.write('command3\r\n');  // Filter monitors

// Monitoring stops when filter is removed
connection.removeFilter(filterId);
```

## AI Filter Generation Prompt

```javascript
buildFilterPrompt(naturalLanguage, context) {
  const systemPrompt = `You are a helpful assistant that converts natural language requests into terminal output monitoring filter configurations.

IMPORTANT: Filters do NOT execute commands. They only monitor terminal output.

A filter monitors terminal output and triggers actions when certain conditions are met in the output.

The user will execute commands manually, and the filter will monitor the output.

Available filter types:
1. string - Match exact string in output
2. regex - Match regular expression pattern in output
3. grep - Match grep-like pattern in output
4. prompt - Detect shell prompt in output (e.g., $, #, >)
5. lineCount - Trigger after N lines of output
6. timeout - Trigger after N milliseconds

Available action types:
1. beep - Play beep sound
2. webhook - Send HTTP request
3. notification - Show system notification
4. callback - Execute custom function

Return ONLY a valid JSON object in this format:
{
  "filter": { ... },
  "actions": [ ... ],
  "options": { "oneTime": false, "scope": "session" }
}

Examples:
- "notify me when error or warning appears" → Monitor output for "error" or "warning", beep when found
- "alert me when build completes" → Monitor output for "Build complete", notify when found
- "notify me when prompt appears" → Monitor output for prompt pattern, notify when found

User request: ${naturalLanguage}
Filter configuration:`;

  return {
    system: systemPrompt,
    user: naturalLanguage
  };
}
```

## Summary

1. **Filter = Output Monitoring**: Not command execution, but output monitoring
2. **User Executes Commands**: User enters commands independently of filters
3. **Filter Monitors Output**: Monitors all output and matches conditions
4. **AI Generates Monitoring Rules**: Generates monitoring rules, not commands
