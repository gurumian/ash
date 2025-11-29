import { useCallback } from 'react';
import LLMService from '../services/llm-service';
import { formatAICommandError } from '../utils/errorFormatter';

/**
 * Custom hook for AI command execution
 * 
 * This hook extracts AI command handling logic from App.jsx.
 * It can be used alongside existing code without breaking changes.
 * 
 * @param {Object} options - Configuration options
 * @param {string} options.activeSessionId - Currently active session ID
 * @param {Object} options.terminalInstances - Ref object containing terminal instances
 * @param {Object} options.sshConnections - Ref object containing SSH/Serial connections
 * @param {Object} options.llmSettings - LLM settings configuration
 * @param {Function} options.setErrorDialog - Function to set error dialog state
 * @param {Function} options.setIsAIProcessing - Function to set AI processing state
 * @param {Function} options.setShowAICommandInput - Function to control AI command input visibility
 * @returns {Object} Object containing executeAICommand function
 */
export function useAICommand({
  activeSessionId,
  terminalInstances,
  sshConnections,
  llmSettings,
  setErrorDialog,
  setIsAIProcessing,
  setShowAICommandInput
}) {
  /**
   * Execute AI command from natural language input
   * @param {string} naturalLanguage - Natural language command description
   */
  const executeAICommand = useCallback(async (naturalLanguage) => {
    setIsAIProcessing(true);
    try {
      if (process.env.NODE_ENV === 'development') {
        console.log('AI Command requested:', naturalLanguage);
      }
      
      if (!llmSettings?.enabled) {
        throw new Error('LLM is not enabled. Please enable it in Settings.');
      }

      // Show AI request in terminal (grey color)
      if (activeSessionId && terminalInstances.current[activeSessionId]) {
        terminalInstances.current[activeSessionId].write(`\r\n\x1b[90m# AI: ${naturalLanguage}\x1b[0m\r\n`);
      }

      // Create LLM service instance
      const llmService = new LLMService(llmSettings);
      
      // Get current directory context (if available)
      const context = {
        currentDirectory: 'unknown' // TODO: Get actual current directory from terminal
      };

      // Convert natural language to command with streaming
      if (process.env.NODE_ENV === 'development') {
        console.log('Calling LLM service...');
      }
      
      // Optimized: Use array for efficient string building
      const streamingChunks = [];
      const terminal = activeSessionId && terminalInstances.current[activeSessionId];
      
      // Show streaming indicator
      if (terminal) {
        terminal.write(`\r\n\x1b[90m# Generating command...\x1b[0m\r\n`);
      }
      
      const command = await llmService.convertToCommand(
        naturalLanguage, 
        context,
        // Streaming callback
        (chunk) => {
          streamingChunks.push(chunk);
          // Show streaming text in terminal (grey color, overwrite previous line)
          if (terminal) {
            // Join array efficiently only for display
            const streamingText = streamingChunks.join('');
            // Clear previous line and show current text
            // Use carriage return to overwrite the line
            terminal.write(`\r\x1b[K\x1b[90m# Generating: ${streamingText}\x1b[0m`);
          }
        }
      );
      
      if (process.env.NODE_ENV === 'development') {
        console.log('LLM returned command:', command);
      }

      // Clear streaming line and show final command
      if (terminal) {
        // Clear the streaming line and move to new line
        terminal.write(`\r\x1b[K`); // Clear to end of line
        terminal.write(`\x1b[90m# Generated command: ${command}\x1b[0m\r\n`);
      }

      // Execute command in active session
      if (activeSessionId && sshConnections.current[activeSessionId]) {
        const connection = sshConnections.current[activeSessionId];
        if (connection.isConnected) {
          // Write command to terminal
          connection.write(command + '\r\n');
          if (process.env.NODE_ENV === 'development') {
            console.log('Command executed:', command);
          }
        } else {
          throw new Error('Session is not connected');
        }
      } else {
        throw new Error('No active session');
      }
    } catch (error) {
      console.error('AI Command error:', error);
      
      // Use error formatter utility
      const formattedError = formatAICommandError(error, { llmSettings });
      
      // Show error dialog
      setErrorDialog({
        isOpen: true,
        ...formattedError
      });
    } finally {
      setIsAIProcessing(false);
      setShowAICommandInput(false);
    }
  }, [
    activeSessionId,
    terminalInstances,
    sshConnections,
    llmSettings,
    setErrorDialog,
    setIsAIProcessing,
    setShowAICommandInput
  ]);

  return {
    executeAICommand
  };
}

