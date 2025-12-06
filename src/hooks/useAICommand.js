import { useCallback, useState, useEffect, useRef } from 'react';
import LLMService from '../services/llm-service';
import QwenAgentService from '../services/qwen-agent-service';
import chatHistoryService from '../services/chatHistory/ChatHistoryService';
import { formatAICommandError } from '../utils/errorFormatter';

/**
 * Custom hook for AI command execution
 * 
 * Supports both 'ask' mode (simple command generation) and 'agent' mode (multi-step task execution).
 * 
 * @param {Object} options - Configuration options
 * @param {string} options.activeSessionId - Currently active session ID
 * @param {Object} options.terminalInstances - Ref object containing terminal instances
 * @param {Object} options.sshConnections - Ref object containing SSH/Serial connections
 * @param {Object} options.llmSettings - LLM settings configuration
 * @param {Function} options.setErrorDialog - Function to set error dialog state
 * @param {Function} options.setIsAIProcessing - Function to set AI processing state
 * @param {Function} options.setShowAICommandInput - Function to control AI command input visibility
 * @param {Function} options.onAIMessageUpdate - Callback to update AI messages in sidebar (optional)
 * @param {Function} options.onBackendStarting - Callback when backend is starting (for status indicator) (optional)
 * @returns {Object} Object containing executeAICommand function, aiMessages, and clearAIMessages
 */
export function useAICommand({
  activeSessionId,
  terminalInstances,
  sshConnections,
  llmSettings,
  setErrorDialog,
  setIsAIProcessing,
  setShowAICommandInput,
  onAIMessageUpdate = null,
  onBackendStarting = null
}) {
  const [aiMessages, setAiMessages] = useState([]);
  const [conversationId, setConversationId] = useState(null);
  const [conversations, setConversations] = useState([]); // List of all conversations for current connection
  const [streamingToolResult, setStreamingToolResult] = useState(null); // Current executing tool result
  const [processingConversationId, setProcessingConversationId] = useState(null); // ID of conversation currently being processed
  const onAIMessageUpdateRef = useRef(onAIMessageUpdate);
  const lastConnectionIdRef = useRef(null);
  const assistantMessageRef = useRef(null); // Stable reference to current assistant message
  
  // Keep ref updated
  useEffect(() => {
    onAIMessageUpdateRef.current = onAIMessageUpdate;
  }, [onAIMessageUpdate]);

  // Load conversations list and active conversation when activeSessionId changes
  useEffect(() => {
    if (!activeSessionId) {
      setAiMessages([]);
      setConversationId(null);
      setConversations([]);
      lastConnectionIdRef.current = null;
      if (onAIMessageUpdateRef.current) {
        onAIMessageUpdateRef.current([]);
      }
      return;
    }

    // Get connection ID from SSH connection
    const connection = sshConnections.current[activeSessionId];
    if (!connection) {
      setAiMessages([]);
      setConversationId(null);
      setConversations([]);
      lastConnectionIdRef.current = null;
      if (onAIMessageUpdateRef.current) {
        onAIMessageUpdateRef.current([]);
      }
      return;
    }

    const connectionId = connection.connectionId || activeSessionId;
    
    // Only load if connection ID changed
    if (connectionId === lastConnectionIdRef.current) {
      return;
    }
    
    lastConnectionIdRef.current = connectionId;

    // Load conversations list and restore active conversation
    (async () => {
      try {
        // Load all conversations for this connection
        const conversationsList = await chatHistoryService.listConversations(connectionId);
        setConversations(conversationsList);
        
        // Try to restore last active conversation
        let activeConversationId = chatHistoryService.getActiveConversation(connectionId);
        let activeConversation = null;
        
        if (activeConversationId) {
          // Verify the conversation still exists
          activeConversation = conversationsList.find(c => c.id === activeConversationId);
        }
        
        // If no active conversation or it doesn't exist, use most recent or create new
        if (!activeConversation) {
          if (conversationsList.length > 0) {
            activeConversation = conversationsList[0]; // Most recent
            activeConversationId = activeConversation.id;
          } else {
            // Create new conversation
            activeConversation = await chatHistoryService.createConversation(
              `New Chat ${new Date().toLocaleTimeString()}`,
              connectionId
            );
            activeConversationId = activeConversation.id;
            // Refresh conversations list
            const updatedList = await chatHistoryService.listConversations(connectionId);
            setConversations(updatedList);
          }
        }
        
        setConversationId(activeConversationId);
        chatHistoryService.saveActiveConversation(connectionId, activeConversationId);
        
        // Load messages for active conversation
        const history = await chatHistoryService.getConversationHistory(activeConversationId);
        
        // Convert back to display format
        const displayMessages = history.map(msg => ({
          id: msg.id,
          role: msg.role,
          content: msg.content,
          toolResults: msg.toolResults || [],
          toolResult: msg.toolResults && msg.toolResults[0] ? {
            name: msg.toolResults[0].name,
            success: msg.toolResults[0].success,
            exitCode: msg.toolResults[0].exitCode,
            stdout: msg.toolResults[0].stdout,
            stderr: msg.toolResults[0].stderr
          } : null
        }));
        
        setAiMessages(displayMessages);
        if (onAIMessageUpdateRef.current) {
          onAIMessageUpdateRef.current(displayMessages);
        }
      } catch (error) {
        console.error('Failed to load conversation history:', error);
        setAiMessages([]);
        setConversationId(null);
        setConversations([]);
        if (onAIMessageUpdateRef.current) {
          onAIMessageUpdateRef.current([]);
        }
      }
    })();
  }, [activeSessionId]); // Only depend on activeSessionId

  /**
   * Execute AI command from natural language input
   * @param {string} naturalLanguage - Natural language command description
   * @param {string} mode - AI mode: 'ask' (simple) or 'agent' (multi-step)
   */
  const executeAICommand = useCallback(async (naturalLanguage, mode = 'ask') => {
    setIsAIProcessing(true);
    try {
      if (process.env.NODE_ENV === 'development') {
        console.log('AI Command requested:', naturalLanguage, 'mode:', mode);
      }
      
      if (!llmSettings?.enabled) {
        throw new Error('LLM is not enabled. Please enable it in Settings.');
      }

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
        const connectionId = connection.connectionId || activeSessionId;
        
        if (process.env.NODE_ENV === 'development') {
          console.log('Agent mode - connectionId:', connectionId, 'activeSessionId:', activeSessionId);
        }
        
        // Ensure conversation exists
        let currentConversationId = conversationId;
        if (!currentConversationId) {
          const conversation = await chatHistoryService.getOrCreateConversation(connectionId);
          currentConversationId = conversation.id;
          setConversationId(conversation.id);
          // Refresh conversations list
          const updatedList = await chatHistoryService.listConversations(connectionId);
          setConversations(updatedList);
        }
        
        // Set processing state for this specific conversation
        setProcessingConversationId(currentConversationId);
        
        // Create Qwen-Agent service
        const qwenAgent = new QwenAgentService();
        
        // Check backend health
        let isHealthy = await qwenAgent.checkHealth();
        if (!isHealthy) {
          // Try on-demand loading: start backend if available
          if (window.electronAPI && window.electronAPI.startBackend) {
            if (onBackendStarting) {
              onBackendStarting(); // Set status to 'starting'
            }
            
            const startResult = await window.electronAPI.startBackend();
            if (!startResult.success) {
              throw new Error(`Failed to start backend: ${startResult.error || 'Unknown error'}`);
            }
            
            // Wait for backend to be ready (with timeout)
            let retries = 30; // 30 seconds timeout
            while (retries > 0) {
              await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
              isHealthy = await qwenAgent.checkHealth();
              if (isHealthy) {
                break;
              }
              retries--;
            }
            
            if (!isHealthy) {
              throw new Error('Backend started but health check failed. Please check backend logs.');
            }
          } else {
            throw new Error('Qwen-Agent backend is not available. Please ensure the backend is running.');
          }
        }

        // Add user message to sidebar
        const userMessage = { 
          id: `msg-${Date.now()}-user`,
          role: 'user', 
          content: naturalLanguage 
        };
        setAiMessages(prev => {
          const updated = [...prev, userMessage];
          if (onAIMessageUpdateRef.current) {
            onAIMessageUpdateRef.current(updated);
          }
          return updated;
        });

        // Save user message to history
        await chatHistoryService.saveMessage(conversationId, 'user', naturalLanguage);

        // Collect assistant response and tool results
        let assistantContent = '';
        let lastAssistantMessageIndex = -1;
        const messageId = `msg-${Date.now()}-assistant`;
        const toolResults = []; // Store all tool results for this assistant message
        
        // Initialize assistant message ref
        assistantMessageRef.current = {
          id: messageId,
          role: 'assistant',
          content: '',
          toolResults: [],
          thinking: '' // Separate thinking/reasoning from final content
        };

        // Execute task with streaming
        await qwenAgent.executeTask(
          naturalLanguage,
          connectionId,
          (fullContent) => {
            // qwen-agent-service sends full accumulated content
            assistantContent = String(fullContent || '');
            
            if (process.env.NODE_ENV === 'development') {
              console.log(`[useAICommand] 📝 Content chunk callback: ${assistantContent.length} chars`);
            }
            
            // Update only content, don't touch toolResults to avoid flickering
            // Use functional update with stable reference
            setAiMessages(prev => {
              const updatedMessages = [...prev];
              
              // Find or create assistant message
              if (lastAssistantMessageIndex === -1) {
                const userMessageIndex = updatedMessages.findLastIndex(msg => 
                  msg.role === 'user' && msg.content === naturalLanguage
                );
                
                const existingAssistantIndex = updatedMessages.findIndex((msg, idx) => 
                  idx > userMessageIndex && msg.role === 'assistant' && msg.id === messageId
                );
                
                if (existingAssistantIndex >= 0) {
                  lastAssistantMessageIndex = existingAssistantIndex;
                } else {
                  // Create new assistant message with stable ID
                  updatedMessages.push({ 
                    role: 'assistant', 
                    content: assistantContent,
                    id: messageId,
                    toolResults: [],
                    thinking: ''
                  });
                  lastAssistantMessageIndex = updatedMessages.length - 1;
                }
              }
              
              // Update only content, preserve toolResults and thinking
              if (lastAssistantMessageIndex >= 0 && lastAssistantMessageIndex < updatedMessages.length) {
                const existing = updatedMessages[lastAssistantMessageIndex];
                updatedMessages[lastAssistantMessageIndex] = { 
                  ...existing, // Preserve all existing properties
                  content: assistantContent, // Only update content
                  id: messageId // Ensure stable ID
                };
              }
              
              // Update ref
              if (assistantMessageRef.current) {
                assistantMessageRef.current.content = assistantContent;
              }
              
              if (onAIMessageUpdateRef.current) {
                onAIMessageUpdateRef.current(updatedMessages);
              }
              return updatedMessages;
            });
          },
          llmSettings,
          // Tool result callback
          async (toolName, toolResult) => {
            // Add tool result to the array (preserve all previous results)
            const toolResultData = typeof toolResult === 'object' ? toolResult : { 
              name: toolName, 
              content: toolResult,
              success: true,
              exitCode: 0
            };
            
            // Show stdout in "AI is thinking" area while processing
            if (toolResultData.stdout) {
              setStreamingToolResult({
                name: toolName,
                stdout: toolResultData.stdout,
                stderr: toolResultData.stderr || ''
              });
            }
            
            toolResults.push(toolResultData);
            
            // Update assistant message with all tool results (separate from content updates)
            // This prevents flickering by updating toolResults independently
            setAiMessages(prev => {
              const updatedMessages = [...prev];
              
              // Find assistant message by stable ID
              let targetIndex = -1;
              if (lastAssistantMessageIndex >= 0 && lastAssistantMessageIndex < updatedMessages.length) {
                if (updatedMessages[lastAssistantMessageIndex].id === messageId) {
                  targetIndex = lastAssistantMessageIndex;
                }
              }
              
              if (targetIndex === -1) {
                // Find by ID
                targetIndex = updatedMessages.findIndex(msg => msg.id === messageId && msg.role === 'assistant');
              }
              
              if (targetIndex >= 0) {
                // Update only toolResults, preserve content and other properties
                const existing = updatedMessages[targetIndex];
                updatedMessages[targetIndex] = { 
                  ...existing, // Preserve all existing properties (content, thinking, etc.)
                  toolResults: [...toolResults] // Only update toolResults
                };
              } else {
                // Create new if not found (shouldn't happen, but safety check)
                const userMessageIndex = updatedMessages.findLastIndex(msg => 
                  msg.role === 'user' && msg.content === naturalLanguage
                );
                
                if (userMessageIndex >= 0) {
                  updatedMessages.splice(userMessageIndex + 1, 0, {
                    role: 'assistant',
                    content: assistantContent,
                    id: messageId,
                    toolResults: [...toolResults],
                    thinking: ''
                  });
                  lastAssistantMessageIndex = userMessageIndex + 1;
                }
              }
              
              // Update ref
              if (assistantMessageRef.current) {
                assistantMessageRef.current.toolResults = [...toolResults];
              }
              
              if (onAIMessageUpdateRef.current) {
                onAIMessageUpdateRef.current(updatedMessages);
              }
              return updatedMessages;
            });

            // Save tool result to history
            if (conversationId) {
              await chatHistoryService.saveMessage(
                conversationId,
                'tool',
                typeof toolResult === 'string' ? toolResult : JSON.stringify(toolResult),
                typeof toolResult === 'object' ? [toolResult] : null
              );
            }
          },
          // Tool call callback (when LLM requests to call a tool) - don't display
          (toolName, toolArgs) => {
            // Don't display tool calls to user
          }
        );

        // Save assistant message to history
        if (conversationId && assistantContent) {
          await chatHistoryService.saveMessage(conversationId, 'assistant', assistantContent);
        }

        // Final update (preserve all tool results and content)
        setAiMessages(prev => {
          const updatedMessages = [...prev];
          
          // Find by stable ID
          let targetIndex = updatedMessages.findIndex(msg => msg.id === messageId && msg.role === 'assistant');
          
          if (targetIndex >= 0) {
            // Final update with all accumulated data
            const existing = updatedMessages[targetIndex];
            updatedMessages[targetIndex] = { 
              ...existing, // Preserve all existing properties
              content: assistantContent, // Final content
              toolResults: [...toolResults] // Final tool results
            };
          }
          
          // Clear ref
          assistantMessageRef.current = null;
          
          if (onAIMessageUpdateRef.current) {
            onAIMessageUpdateRef.current(updatedMessages);
          }
          return updatedMessages;
        });

        if (process.env.NODE_ENV === 'development') {
          console.log('Qwen-Agent task completed');
        }

        return; // Agent mode completed
      }

      // Ask mode: Simple command generation
      const llmService = new LLMService(llmSettings);
      
      const context = {
        currentDirectory: 'unknown' // TODO: Get actual current directory from terminal
      };

      // Ensure conversation exists for ask mode
      let currentConversationId = conversationId;
      if (!currentConversationId && activeSessionId) {
        const connection = sshConnections.current[activeSessionId];
        if (connection) {
          const connectionId = connection.connectionId || activeSessionId;
          const conversation = await chatHistoryService.getOrCreateConversation(connectionId);
          currentConversationId = conversation.id;
          setConversationId(conversation.id);
          // Refresh conversations list
          const updatedList = await chatHistoryService.listConversations(connectionId);
          setConversations(updatedList);
        }
      }

      // Set processing state for this specific conversation (ask mode)
      if (currentConversationId) {
        setProcessingConversationId(currentConversationId);
      }

      // Add user message to sidebar
      const userMessage = { 
        id: `msg-${Date.now()}-user`,
        role: 'user', 
        content: naturalLanguage 
      };
      setAiMessages(prev => {
        const updated = [...prev, userMessage];
        if (onAIMessageUpdateRef.current) {
          onAIMessageUpdateRef.current(updated);
        }
        return updated;
      });

      // Save user message to history
      if (conversationId) {
        await chatHistoryService.saveMessage(conversationId, 'user', naturalLanguage);
      }

      // Collect assistant response for sidebar
      let assistantContent = '';
      const streamingChunks = [];
      
      const command = await llmService.convertToCommand(
        naturalLanguage, 
        context,
        // Streaming callback
        (chunk) => {
          streamingChunks.push(chunk);
          assistantContent += chunk;
          
          // Update assistant message in sidebar
          const assistantMessage = { 
            id: `msg-${Date.now()}-assistant`,
            role: 'assistant', 
            content: `Generating command: ${assistantContent}` 
          };
          setAiMessages(prev => {
            const updated = [...prev];
            const lastIndex = updated.length - 1;
            if (lastIndex >= 0 && updated[lastIndex].role === 'assistant' && updated[lastIndex].content.startsWith('Generating command:')) {
              updated[lastIndex] = assistantMessage;
            } else {
              updated.push(assistantMessage);
            }
            if (onAIMessageUpdateRef.current) {
              onAIMessageUpdateRef.current(updated);
            }
            return updated;
          });
        }
      );
      
      if (process.env.NODE_ENV === 'development') {
        console.log('LLM returned command:', command);
      }

      // Final assistant message with command
      const finalAssistantMessage = { 
        id: `msg-${Date.now()}-assistant`,
        role: 'assistant', 
        content: `Generated command: \`${command}\`` 
      };
      setAiMessages(prev => {
        const updated = [...prev];
        const lastIndex = updated.length - 1;
        if (lastIndex >= 0 && updated[lastIndex].role === 'assistant') {
          updated[lastIndex] = finalAssistantMessage;
        } else {
          updated.push(finalAssistantMessage);
        }
        if (onAIMessageUpdateRef.current) {
          onAIMessageUpdateRef.current(updated);
        }
        return updated;
      });

      // Save assistant message to history
      if (conversationId) {
        await chatHistoryService.saveMessage(conversationId, 'assistant', `Generated command: ${command}`);
      }

      // Execute command in active session
      if (activeSessionId && sshConnections.current[activeSessionId]) {
        const connection = sshConnections.current[activeSessionId];
        if (connection.isConnected) {
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
      
      const formattedError = formatAICommandError(error, { llmSettings });
      
      setErrorDialog({
        isOpen: true,
        ...formattedError
      });
    } finally {
      setIsAIProcessing(false);
      setShowAICommandInput(false);
      setStreamingToolResult(null); // Clear streaming tool result when done
      setProcessingConversationId(null); // Clear processing conversation ID
      
      // Refresh conversations list after message is saved
      if (lastConnectionIdRef.current && conversationId) {
        (async () => {
          try {
            const updatedList = await chatHistoryService.listConversations(lastConnectionIdRef.current);
            setConversations(updatedList);
          } catch (error) {
            console.error('Failed to refresh conversations list:', error);
          }
        })();
      }
    }
  }, [
    activeSessionId,
    terminalInstances,
    sshConnections,
    llmSettings,
    setErrorDialog,
    setIsAIProcessing,
    setShowAICommandInput,
    conversationId,
    onBackendStarting
  ]);

  const clearAIMessages = useCallback(() => {
    setAiMessages([]);
    if (onAIMessageUpdateRef.current) {
      onAIMessageUpdateRef.current([]);
    }
    // Clear conversation history
    if (conversationId) {
      chatHistoryService.deleteConversation(conversationId);
      setConversationId(null);
      // Refresh conversations list
      if (lastConnectionIdRef.current) {
        (async () => {
          try {
            const updatedList = await chatHistoryService.listConversations(lastConnectionIdRef.current);
            setConversations(updatedList);
          } catch (error) {
            console.error('Failed to refresh conversations list:', error);
          }
        })();
      }
    }
    lastConnectionIdRef.current = null;
  }, [conversationId]);

  // Switch to a different conversation
  const switchConversation = useCallback(async (targetConversationId) => {
    if (targetConversationId === conversationId) {
      return; // Already active
    }

    try {
      const history = await chatHistoryService.getConversationHistory(targetConversationId);
      
      // Convert back to display format
      const displayMessages = history.map(msg => ({
        id: msg.id,
        role: msg.role,
        content: msg.content,
        toolResults: msg.toolResults || [],
        toolResult: msg.toolResults && msg.toolResults[0] ? {
          name: msg.toolResults[0].name,
          success: msg.toolResults[0].success,
          exitCode: msg.toolResults[0].exitCode,
          stdout: msg.toolResults[0].stdout,
          stderr: msg.toolResults[0].stderr
        } : null
      }));
      
      setConversationId(targetConversationId);
      setAiMessages(displayMessages);
      
      // Save as active conversation
      if (lastConnectionIdRef.current) {
        chatHistoryService.saveActiveConversation(lastConnectionIdRef.current, targetConversationId);
      }
      
      if (onAIMessageUpdateRef.current) {
        onAIMessageUpdateRef.current(displayMessages);
      }
    } catch (error) {
      console.error('Failed to switch conversation:', error);
    }
  }, [conversationId]);

  // Create a new conversation
  const createNewConversation = useCallback(async () => {
    if (!activeSessionId) {
      return null;
    }

    const connection = sshConnections.current[activeSessionId];
    if (!connection) {
      return null;
    }

    const connectionId = connection.connectionId || activeSessionId;

    try {
      const newConversation = await chatHistoryService.createConversation(
        `New Chat ${new Date().toLocaleTimeString()}`,
        connectionId
      );
      
      // Refresh conversations list
      const updatedList = await chatHistoryService.listConversations(connectionId);
      setConversations(updatedList);
      
      // Switch to new conversation
      setConversationId(newConversation.id);
      setAiMessages([]);
      chatHistoryService.saveActiveConversation(connectionId, newConversation.id);
      
      if (onAIMessageUpdateRef.current) {
        onAIMessageUpdateRef.current([]);
      }
      
      return newConversation;
    } catch (error) {
      console.error('Failed to create new conversation:', error);
      return null;
    }
  }, [activeSessionId]);

  // Delete a conversation
  const deleteConversation = useCallback(async (targetConversationId) => {
    if (!targetConversationId) {
      return;
    }

    try {
      await chatHistoryService.deleteConversation(targetConversationId);
      
      // If deleted conversation was active, switch to another or create new
      if (targetConversationId === conversationId) {
        const connection = sshConnections.current[activeSessionId];
        if (connection) {
          const connectionId = connection.connectionId || activeSessionId;
          const updatedList = await chatHistoryService.listConversations(connectionId);
          setConversations(updatedList);
          
          if (updatedList.length > 0) {
            // Switch to most recent conversation
            await switchConversation(updatedList[0].id);
          } else {
            // No conversations left, create new one
            await createNewConversation();
          }
        }
      } else {
        // Just refresh the list
        const connection = sshConnections.current[activeSessionId];
        if (connection) {
          const connectionId = connection.connectionId || activeSessionId;
          const updatedList = await chatHistoryService.listConversations(connectionId);
          setConversations(updatedList);
        }
      }
    } catch (error) {
      console.error('Failed to delete conversation:', error);
    }
  }, [activeSessionId, conversationId, switchConversation, createNewConversation]);

  return {
    executeAICommand,
    aiMessages,
    clearAIMessages,
    streamingToolResult, // Expose current streaming tool result
    processingConversationId, // ID of conversation currently being processed
    conversations, // List of all conversations for current connection
    activeConversationId: conversationId, // Current active conversation ID
    switchConversation, // Function to switch to a different conversation
    createNewConversation, // Function to create a new conversation
    deleteConversation // Function to delete a conversation
  };
}
