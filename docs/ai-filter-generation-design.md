# AI-Based Filter Generation System Design

## Concept

A system where users generate filters using natural language, and AI converts them into filter configurations for registration.

## Usage Scenarios

### 1. Natural Language Input
```
"notify me when error or warning appears"
"alert me when build completes"
"notify me when prompt appears"
"beep when 10 lines are output"
```

### 2. AI Generates Filter
AI analyzes natural language and generates filter configuration JSON:
```json
{
  "filter": {
    "mode": "or",
    "filters": [
      { "type": "grep", "pattern": "error", "caseSensitive": false },
      { "type": "grep", "pattern": "warning", "caseSensitive": false }
    ]
  },
  "actions": [
    { "type": "beep", "frequency": 800, "duration": 500 }
  ]
}
```

### 3. Filter Registration
Register the generated filter to the connection

## LLMService Extension

### New Method Addition

```javascript
// llm-service.js
class LLMService {
  /**
   * Convert natural language to filter configuration
   * @param {string} naturalLanguage - Natural language input
   * @param {Object} context - Context information
   * @param {Function} onChunk - Callback for streaming chunks (optional)
   * @returns {Promise<Object>} - Filter configuration object
   */
  async convertToFilter(naturalLanguage, context = {}, onChunk = null) {
    const prompt = this.buildFilterPrompt(naturalLanguage, context);
    
    try {
      const response = await this.callLLM(prompt, onChunk);
      return this.parseFilterResponse(response);
    } catch (error) {
      console.error('LLM Service error:', error);
      throw new Error(`Failed to convert to filter: ${error.message}`);
    }
  }

  /**
   * Build prompt for filter generation
   */
  buildFilterPrompt(naturalLanguage, context) {
    const systemPrompt = `You are a helpful assistant that converts natural language requests into terminal output monitoring filter configurations.

IMPORTANT: Filters do NOT execute commands. They only monitor terminal output.

A filter monitors terminal output and triggers actions when certain conditions are met in the output.

The user will execute commands manually, and the filter will monitor the output.

Available filter types:
1. string - Match exact string in output
2. regex - Match regular expression pattern in output
3. grep - Match grep-like pattern in output (supports | for OR)
4. prompt - Detect shell prompt in output (e.g., $, #, >)
5. lineCount - Trigger after N lines of output
6. timeout - Trigger after N milliseconds

Available action types:
1. beep - Play beep sound (frequency, duration)
2. webhook - Send HTTP request (url, method, body)
3. notification - Show system notification (title, message)
4. callback - Execute custom function

Filter modes:
- Single filter: { "type": "grep", "pattern": "error" }
- AND mode: { "mode": "and", "filters": [...] }
- OR mode: { "mode": "or", "filters": [...] }

Return ONLY a valid JSON object in this format:
{
  "filter": { ... },
  "actions": [ ... ],
  "options": { "oneTime": false, "scope": "session" }
}

Do not include explanations or comments. Return only the JSON.

Examples:
- "notify me when error or warning appears" → {
    "filter": {
      "mode": "or",
      "filters": [
        { "type": "grep", "pattern": "error", "caseSensitive": false },
        { "type": "grep", "pattern": "warning", "caseSensitive": false }
      ]
    },
    "actions": [
      { "type": "beep", "frequency": 800, "duration": 500 }
    ]
  }

- "alert me when build completes" → {
    "filter": {
      "type": "string",
      "pattern": "Build complete",
      "caseSensitive": false
    },
    "actions": [
      {
        "type": "webhook",
        "url": "https://discord.com/api/webhooks/...",
        "method": "POST",
        "body": {
          "content": "Build complete!"
        }
      }
    ]
  }

- "notify me when prompt appears" → {
    "filter": {
      "type": "prompt",
      "pattern": "\\$\\s*$"
    },
    "actions": [
      { "type": "beep" }
    ]
  }

User request: ${naturalLanguage}
Context: ${JSON.stringify(context)}

Filter configuration:`;

    return {
      system: systemPrompt,
      user: naturalLanguage
    };
  }

  /**
   * Parse LLM response to extract filter configuration
   */
  parseFilterResponse(response) {
    if (!response) {
      throw new Error('Empty response from LLM');
    }

    // Remove markdown code blocks if present
    let jsonStr = response.trim();
    jsonStr = jsonStr.replace(/^```json\n?/g, '');
    jsonStr = jsonStr.replace(/^```\n?/g, '');
    jsonStr = jsonStr.replace(/\n?```$/g, '');
    jsonStr = jsonStr.trim();

    // Try to extract JSON from response
    // Sometimes LLM adds explanation before/after JSON
    const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      jsonStr = jsonMatch[0];
    }

    try {
      const filterConfig = JSON.parse(jsonStr);
      
      // Validate structure
      if (!filterConfig.filter) {
        throw new Error('Filter configuration missing "filter" property');
      }
      if (!filterConfig.actions || !Array.isArray(filterConfig.actions)) {
        throw new Error('Filter configuration missing "actions" array');
      }

      return filterConfig;
    } catch (error) {
      console.error('Failed to parse filter response:', error);
      console.error('Response:', response);
      throw new Error(`Failed to parse filter configuration: ${error.message}`);
    }
  }
}
```

## UI Extension

### TerminalAICommandInput Extension

```javascript
// TerminalAICommandInput.jsx - add mode
export const TerminalAICommandInput = memo(function TerminalAICommandInput({
  terminal,
  isVisible,
  onClose,
  onExecute,
  onExecuteFilter,  // new prop
  mode = 'command',  // 'command' | 'filter' | 'expert'
  isProcessing = false
}) {
  // ...
  
  const placeholder = mode === 'filter' 
    ? "Describe filter condition... (e.g., 'notify me when error appears')"
    : mode === 'expert'
    ? "Enter filter JSON directly..."
    : "Describe what you want to do... (e.g., 'find all jpg files')";

  // ...
});
```

### Filter Generation Handler in App.jsx

```javascript
// App.jsx
const handleAIFilterGeneration = async (naturalLanguage) => {
  setIsAIProcessing(true);
  try {
    if (!llmSettings?.enabled) {
      throw new Error('LLM is not enabled. Please enable it in Settings.');
    }

    // Show AI request in terminal
    if (activeSessionId && terminalInstances.current[activeSessionId]) {
      terminalInstances.current[activeSessionId].write(
        `\r\n\x1b[90m# AI Filter: ${naturalLanguage}\x1b[0m\r\n`
      );
    }

    // Create LLM service instance
    const llmService = new LLMService(llmSettings);
    
    const context = {
      currentDirectory: 'unknown'
    };

    const terminal = activeSessionId && terminalInstances.current[activeSessionId];
    const streamingChunks = [];

    if (terminal) {
      terminal.write(`\r\n\x1b[90m# Generating filter...\x1b[0m\r\n`);
    }

    // Convert natural language to filter configuration
    const filterConfig = await llmService.convertToFilter(
      naturalLanguage,
      context,
      (chunk) => {
        streamingChunks.push(chunk);
        if (terminal) {
          const streamingText = streamingChunks.join('');
          terminal.write(`\r\x1b[K\x1b[90m# Generating: ${streamingText}\x1b[0m`);
        }
      }
    );

    if (terminal) {
      terminal.write(`\r\x1b[K`);
      terminal.write(`\x1b[90m# Generated filter configuration\x1b[0m\r\n`);
    }

    // Register filter
    if (activeSessionId && sshConnections.current[activeSessionId]) {
      const connection = sshConnections.current[activeSessionId];
      if (connection.isConnected) {
        const filterId = connection.addFilter(filterConfig);
        
        if (terminal) {
          terminal.write(
            `\x1b[90m# Filter registered: ${filterId}\x1b[0m\r\n`
          );
        }

        console.log('Filter registered:', filterId, filterConfig);
      } else {
        throw new Error('Session is not connected');
      }
    } else {
      throw new Error('No active session');
    }
  } catch (error) {
    // Error handling
    console.error('AI Filter generation error:', error);
    if (activeSessionId && terminalInstances.current[activeSessionId]) {
      terminalInstances.current[activeSessionId].write(
        `\r\n\x1b[91m# Error: ${error.message}\x1b[0m\r\n`
      );
    }
  } finally {
    setIsAIProcessing(false);
  }
};
```

## Usage Examples

### 1. Basic Usage (AI Command Mode)
```
User: "find all jpg files"
→ AI generates command: "find . -name '*.jpg'"
→ Command executed
```

### 2. Filter Generation Mode
```
User: "notify me when error or warning appears"
→ AI generates filter:
{
  "filter": {
    "mode": "or",
    "filters": [
      { "type": "grep", "pattern": "error", "caseSensitive": false },
      { "type": "grep", "pattern": "warning", "caseSensitive": false }
    ]
  },
  "actions": [{ "type": "beep" }]
}
→ Filter registered
```

### 3. Expert Mode (Direct JSON Input)
```
User: Direct JSON input
{
  "filter": { "type": "grep", "pattern": "error" },
  "actions": [{ "type": "beep" }]
}
→ JSON parsed and filter registered
```

## UI Mode Switching

### Keyboard Shortcuts
- `Ctrl+Shift+A`: AI Command mode
- `Ctrl+Shift+F`: AI Filter generation mode
- `Ctrl+Shift+J`: Expert mode (direct JSON input)

### UI Display
```javascript
// TerminalAICommandInput.jsx
<div className="ai-input-label">
  <span style={{ color: '#00ff41' }}>
    {mode === 'filter' ? 'AI Filter:' : mode === 'expert' ? 'Expert:' : 'AI:'}
  </span>
</div>
```

## Expert Mode (Direct Input)

```javascript
// Support direct JSON input
const handleExpertMode = (jsonInput) => {
  try {
    const filterConfig = JSON.parse(jsonInput);
    
    // Validate
    if (!filterConfig.filter || !filterConfig.actions) {
      throw new Error('Invalid filter configuration');
    }
    
    // Register filter
    const connection = sshConnections.current[activeSessionId];
    const filterId = connection.addFilter(filterConfig);
    
    console.log('Filter registered (expert mode):', filterId);
  } catch (error) {
    console.error('Invalid JSON:', error);
  }
};
```

## Advantages

1. **User-Friendly**: Generate filters using natural language
2. **Flexible**: Supports both AI generation and expert direct input
3. **Reuses Existing Infrastructure**: Leverages LLMService
4. **Extensible**: Easy to add new filter/action types

## Implementation Order

1. Add `convertToFilter` method to LLMService
2. Add mode to TerminalAICommandInput
3. Add filter generation handler to App.jsx
4. Add expert mode (direct JSON input)
5. Add keyboard shortcuts
