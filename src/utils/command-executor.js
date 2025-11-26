/**
 * Command Executor Utility
 * Executes commands and captures output with completion detection
 */

import TerminalOutputCapture from '../services/terminal-output-capture';

/**
 * Execute command and wait for output
 * @param {Object} connection - SSH connection
 * @param {string} command - Command to execute
 * @param {TerminalOutputCapture} outputCapture - Output capture instance
 * @param {number} timeout - Timeout in milliseconds (default: 10000)
 * @returns {Promise<{output: string, error: string|null}>}
 */
export async function executeCommandAndWait(connection, command, outputCapture, timeout = 10000) {
  return new Promise((resolve, reject) => {
    if (!connection || !connection.isConnected) {
      reject(new Error('SSH connection not available'));
      return;
    }

    if (!outputCapture) {
      reject(new Error('Output capture not available'));
      return;
    }

    // Start capturing output
    const captureId = outputCapture.startCapture();
    let output = '';
    let error = null;
    let outputComplete = false;

    // Track if we've seen the command echo
    let commandEchoed = false;
    let lastDataTime = Date.now();
    let checkInterval = null;

    // Set timeout
    const timeoutId = setTimeout(() => {
      if (checkInterval) clearInterval(checkInterval);
      if (!outputComplete) {
        outputComplete = true;
        outputCapture.stopCapture(captureId);
        resolve({
          output: output || 'Command timed out',
          error: 'Command execution timeout'
        });
      }
    }, timeout);

    // Listen for output
    const outputHandler = (capturedOutput) => {
      output += capturedOutput;
      lastDataTime = Date.now();
      
      // Check if command was echoed (command appears in output)
      if (!commandEchoed && capturedOutput.includes(command.trim())) {
        commandEchoed = true;
      }
      
      // Detect prompt pattern - look for prompt at end of line
      // Common prompts: $, #, >, %, or username@hostname:path$
      const promptPattern = /(?:^|\r?\n)(?:[^\r\n]*@[^\r\n]*[:~]\s*)?[\$#%>]\s*$/;
      if (capturedOutput.match(promptPattern) && commandEchoed && !outputComplete) {
        // Wait a bit more to ensure all output is captured
        clearTimeout(timeoutId);
        if (checkInterval) clearInterval(checkInterval);
        setTimeout(() => {
          if (!outputComplete) {
            outputComplete = true;
            outputCapture.stopCapture(captureId);
            // Remove command echo and prompt from output
            let cleanOutput = output;
            // Remove command echo if present
            if (cleanOutput.includes(command.trim())) {
              const lines = cleanOutput.split('\n');
              const filteredLines = lines.filter(line => !line.trim().endsWith(command.trim()));
              cleanOutput = filteredLines.join('\n');
            }
            // Remove trailing prompt
            cleanOutput = cleanOutput.replace(/(?:^|\r?\n)(?:[^\r\n]*@[^\r\n]*[:~]\s*)?[\$#%>]\s*$/, '').trim();
            resolve({ output: cleanOutput, error });
          }
        }, 300); // Short wait for final output
      }
    };

    outputCapture.onOutput(captureId, outputHandler);

    // Execute command
    try {
      connection.write(command + '\r\n');
      
      // Fallback: if no prompt detected after reasonable time, assume done
      checkInterval = setInterval(() => {
        const timeSinceLastData = Date.now() - lastDataTime;
        
        // If we've seen command echo and no data for 500ms, likely done
        if (commandEchoed && timeSinceLastData > 500 && !outputComplete) {
          clearInterval(checkInterval);
          clearTimeout(timeoutId);
          if (!outputComplete) {
            outputComplete = true;
            outputCapture.stopCapture(captureId);
            // Clean output
            let cleanOutput = output;
            if (cleanOutput.includes(command.trim())) {
              const lines = cleanOutput.split('\n');
              const filteredLines = lines.filter(line => !line.trim().endsWith(command.trim()));
              cleanOutput = filteredLines.join('\n');
            }
            cleanOutput = cleanOutput.replace(/(?:^|\r?\n)(?:[^\r\n]*@[^\r\n]*[:~]\s*)?[\$#%>]\s*$/, '').trim();
            resolve({ output: cleanOutput, error });
          }
        }
      }, 100); // Check every 100ms
      
    } catch (err) {
      clearTimeout(timeoutId);
      if (checkInterval) clearInterval(checkInterval);
      outputCapture.stopCapture(captureId);
      reject(err);
    }
  });
}

