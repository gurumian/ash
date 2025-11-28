# Terminal Line Events Usage Examples

You can execute commands line by line in the terminal and receive responses as events.

## Basic Usage

### Using with SSH Connection

```javascript
import { SSHConnection } from './connections/SSHConnection';

// Assuming connection is already established
const connection = sshConnections.current[sessionId];

// Execute command and receive line-by-line responses
const commandId = connection.executeCommandWithLineEvents(
  'ls -la',
  (line, isComplete) => {
    if (isComplete) {
      console.log('Command execution completed');
    } else {
      console.log('Response line:', line);
      // Logic to process each line
    }
  }
);
```

### Using with Serial Connection

```javascript
import { SerialConnection } from './connections/SerialConnection';

// Assuming connection is already established
const connection = serialConnections.current[sessionId];

// Execute command and receive line-by-line responses
const commandId = connection.executeCommandWithLineEvents(
  'AT+CGMI',
  (line, isComplete) => {
    if (isComplete) {
      console.log('Command execution completed');
    } else {
      console.log('Response line:', line);
    }
  }
);
```

## Executing Multiple Commands Sequentially

```javascript
const commands = ['ls', 'pwd', 'whoami'];
let currentIndex = 0;

const executeNext = () => {
  if (currentIndex >= commands.length) {
    console.log('All commands executed');
    return;
  }

  const command = commands[currentIndex];
  const commandId = connection.executeCommandWithLineEvents(
    command,
    (line, isComplete) => {
      if (!isComplete) {
        console.log(`[${command}] Response:`, line);
      } else {
        // Current command completed, execute next
        currentIndex++;
        setTimeout(executeNext, 500); // Wait 0.5s before next command
      }
    }
  );
};

executeNext();
```

## Collecting Responses

```javascript
const responses = [];

const commandId = connection.executeCommandWithLineEvents(
  'cat /etc/hosts',
  (line, isComplete) => {
    if (!isComplete && line.trim()) {
      responses.push(line);
    } else if (isComplete) {
      console.log('Full response:', responses.join('\n'));
      // Process response logic
    }
  }
);
```

## Command Completion Handling

```javascript
const commandId = connection.executeCommandWithLineEvents(
  'long-running-command',
  (line, isComplete) => {
    if (isComplete) {
      // Cleanup when command completes
      console.log('Command completed, listener cleaned up');
    } else {
      // Process ongoing responses
      console.log('In progress:', line);
    }
  }
);

// Manually complete if needed
// connection.completeCommand(commandId);
```

## Notes

1. **Line Separation**: Responses are delivered line by line, separated by `\r\n` or `\n`.
2. **Asynchronous Processing**: Command execution is asynchronous, and responses are received as a stream.
3. **Listener Cleanup**: Listeners are automatically removed when the command completes.
4. **Connection Disconnection**: All listeners are automatically cleaned up when the connection is closed.

## Real-world Usage Example (in App.jsx)

```javascript
// Can be used in onExecuteAICommand, etc.
const handleExecuteCommands = async (commands) => {
  if (!activeSessionId || !sshConnections.current[activeSessionId]) {
    return;
  }

  const connection = sshConnections.current[activeSessionId];
  
  for (const command of commands) {
    await new Promise((resolve) => {
      const commandId = connection.executeCommandWithLineEvents(
        command,
        (line, isComplete) => {
          if (isComplete) {
            resolve();
          } else {
            // Process each line
            console.log(`Response: ${line}`);
          }
        }
      );
    });
    
    // Wait before next command
    await new Promise(resolve => setTimeout(resolve, 500));
  }
};
```
