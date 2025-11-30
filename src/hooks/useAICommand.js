import { useCallback, useState } from 'react';
import LLMService from '../services/llm-service';
import QwenAgentService from '../services/qwen-agent-service';
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
  setShowAICommandInput,
  onAIMessageUpdate = null // Callback to update AI messages in sidebar
}) {
  const [aiMessages, setAiMessages] = useState([]);
  /**
   * Execute AI command from natural language input
   * @param {string} naturalLanguage - Natural language command description
   * @param {string} mode - AI mode: 'ask' (simple) or 'agent' (multi-step)
   */
  const executeAICommand = useCallback(async (naturalLanguage, mode = 'ask') => {
    setIsAIProcessing(true);
    try {
      if (process.env.NODE_ENV === 'development') {
        console.log('AI Command requested:', naturalLanguage);
      }
      
      if (!llmSettings?.enabled) {
        throw new Error('LLM is not enabled. Please enable it in Settings.');
      }

      // Don't show AI request in terminal - it will be shown in sidebar
      // if (activeSessionId && terminalInstances.current[activeSessionId]) {
      //   const modeLabel = mode === 'agent' ? 'agent' : 'ask';
      //   terminalInstances.current[activeSessionId].write(`\r\n\x1b[90m# AI [${modeLabel}]: ${naturalLanguage}\x1b[0m\r\n`);
      // }

      // Handle agent mode with Qwen-Agent
      if (mode === 'agent') {
        if (!activeSessionId || !sshConnections.current[activeSessionId]) {
          throw new Error('No active session');
        }

        const connection = sshConnections.current[activeSessionId];
        if (!connection.isConnected) {
          throw new Error('Session is not connected');
        }

        // Get connection ID from SSHConnection object
        // The connectionId is the actual UUID from main process, not the session ID
        const connectionId = connection.connectionId || activeSessionId;
        const terminal = activeSessionId && terminalInstances.current[activeSessionId];
        
        if (process.env.NODE_ENV === 'development') {
          console.log('Agent mode - connectionId:', connectionId, 'activeSessionId:', activeSessionId);
        }
        
        // Create Qwen-Agent service
        const qwenAgent = new QwenAgentService();
        
        // Check backend health
        const isHealthy = await qwenAgent.checkHealth();
        if (!isHealthy) {
          throw new Error('Qwen-Agent backend is not available. Please ensure the backend is running.');
        }

        // Add user message to sidebar
        const userMessage = { role: 'user', content: naturalLanguage };
        setAiMessages(prev => [...prev, userMessage]);
        if (onAIMessageUpdate) {
          onAIMessageUpdate([...aiMessages, userMessage]);
        }

        // Collect assistant response and tool results
        let assistantContent = '';
        const collectedMessages = [userMessage];
        let lastAssistantMessageIndex = -1;
        let messageId = Date.now(); // Unique ID for this assistant message

        // Execute task with streaming
        await qwenAgent.executeTask(
          naturalLanguage,
          connectionId,
          (chunk) => {
            // Collect chunks for sidebar (not terminal)
            // This includes reasoning (thinking process) and regular content
            // chunk is already a delta from qwen-agent-service
            assistantContent += chunk;
            
            // Update assistant message in sidebar (replace entire message, not append)
            const updatedMessages = [...collectedMessages];
            
            // Find or create assistant message
            if (lastAssistantMessageIndex === -1) {
              // Create new assistant message with unique ID
              updatedMessages.push({ 
                role: 'assistant', 
                content: assistantContent,
                id: messageId // Add unique ID for React key stability
              });
              lastAssistantMessageIndex = updatedMessages.length - 1;
            } else {
              // Replace entire assistant message with accumulated content (not append)
              updatedMessages[lastAssistantMessageIndex] = { 
                role: 'assistant', 
                content: assistantContent, // Full accumulated content, not +=
                id: messageId
              };
            }
            
            setAiMessages(updatedMessages);
            if (onAIMessageUpdate) {
              onAIMessageUpdate(updatedMessages);
            }
          },
          llmSettings,
          // Tool result callback
          (toolName, toolContent) => {
            // Add tool result as a message (but don't show it prominently - just in tool result section)
            const toolMessage = { 
              role: 'tool', 
              content: toolContent, 
              toolResult: { name: toolName, content: toolContent },
              id: `tool-${Date.now()}-${Math.random()}` // Unique ID for tool message
            };
            collectedMessages.push(toolMessage);
            
            // Update messages with tool result and current assistant content (replace, not append)
            const updatedMessages = [...collectedMessages];
            if (lastAssistantMessageIndex >= 0) {
              updatedMessages[lastAssistantMessageIndex] = { 
                role: 'assistant', 
                content: assistantContent, // Full content, not +=
                id: messageId
              };
            } else {
              updatedMessages.push({ 
                role: 'assistant', 
                content: assistantContent,
                id: messageId
              });
              lastAssistantMessageIndex = updatedMessages.length - 1;
            }
            
            setAiMessages(updatedMessages);
            if (onAIMessageUpdate) {
              onAIMessageUpdate(updatedMessages);
            }
          },
          // Tool call callback (when LLM requests to call a tool) - don't display
          (toolName, toolArgs) => {
            // Don't display tool calls to user - just track internally if needed
            // The reasoning/thinking is what matters
          }
        );

        // Final assistant message (ensure it has the ID)
        const finalAssistantMessage = { 
          role: 'assistant', 
          content: assistantContent,
          id: messageId
        };
        const finalMessages = [...collectedMessages];
        if (lastAssistantMessageIndex >= 0) {
          finalMessages[lastAssistantMessageIndex] = finalAssistantMessage;
        } else {
          finalMessages.push(finalAssistantMessage);
        }
        setAiMessages(finalMessages);
        if (onAIMessageUpdate) {
          onAIMessageUpdate(finalMessages);
        }

        if (process.env.NODE_ENV === 'development') {
          console.log('Qwen-Agent task completed');
        }

        return; // Agent mode completed
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
      
      // Add user message to sidebar
      const userMessage = { role: 'user', content: naturalLanguage };
      setAiMessages(prev => [...prev, userMessage]);
      if (onAIMessageUpdate) {
        onAIMessageUpdate([...aiMessages, userMessage]);
      }

      // Collect assistant response for sidebar
      let assistantContent = '';
      const streamingChunks = [];
      
      const command = await llmService.convertToCommand(
        naturalLanguage, 
        context,
        // Streaming callback - collect for sidebar
        (chunk) => {
          streamingChunks.push(chunk);
          assistantContent += chunk;
          
          // Update assistant message in sidebar
          const assistantMessage = { role: 'assistant', content: `Generating command: ${assistantContent}` };
          const updatedMessages = [...aiMessages, userMessage, assistantMessage];
          setAiMessages(updatedMessages);
          if (onAIMessageUpdate) {
            onAIMessageUpdate(updatedMessages);
          }
        }
      );
      
      if (process.env.NODE_ENV === 'development') {
        console.log('LLM returned command:', command);
      }

      // Final assistant message with command
      const finalAssistantMessage = { role: 'assistant', content: `Generated command: \`${command}\`` };
      setAiMessages(prev => {
        const updated = [...prev];
        const lastIndex = updated.length - 1;
        if (lastIndex >= 0 && updated[lastIndex].role === 'assistant') {
          updated[lastIndex] = finalAssistantMessage;
        } else {
          updated.push(finalAssistantMessage);
        }
        if (onAIMessageUpdate) {
          onAIMessageUpdate(updated);
        }
        return updated;
      });

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
    executeAICommand,
    aiMessages,
    clearAIMessages: () => {
      setAiMessages([]);
      if (onAIMessageUpdate) {
        onAIMessageUpdate([]);
      }
    }
  };
}

