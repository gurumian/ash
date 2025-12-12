/**
 * Qwen-Agent Service - Calls Python backend with Qwen-Agent
 */

import chatHistoryService from './chatHistory/ChatHistoryService.js';

const BACKEND_URL = 'http://127.0.0.1:54111';

class QwenAgentService {
  constructor() {
    this.backendUrl = BACKEND_URL;
    // Store conversation history per connection (memory cache as fallback)
    this.conversationHistory = new Map();
  }

  /**
   * Execute a task using Qwen-Agent backend
   * @param {string} message - Natural language request
   * @param {string} connectionId - Active SSH/Serial connection ID (optional)
   * @param {Function} onChunk - Callback for streaming chunks
   * @param {Object} llmSettings - LLM settings from frontend (optional)
   * @param {Function} onToolResult - Callback for tool results (optional)
   * @param {Function} onToolCall - Callback for tool call requests (optional)
   * @param {AbortSignal} abortSignal - Signal for cancellation (optional)
   * @param {string} conversationId - Conversation ID for loading history from DB (optional)
   * @returns {Promise<string>} - Final response
   */
  async executeTask(message, connectionId = null, onChunk = null, llmSettings = null, onToolResult = null, onToolCall = null, abortSignal = null, conversationId = null) {
  // Command 큐: tool_call과 tool_result를 순차적으로 매칭하기 위한 FIFO 큐
  const commandQueue = [];
    try {
      // Load conversation history from DB if conversationId is provided
      // This ensures context persists across app restarts
      // Note: New conversations (with no messages) will return empty array, which is fine
      let conversationHistory = [];
      
      if (conversationId) {
        try {
          // Debug: Log which conversation we're loading
          console.log(`[QwenAgentService] Loading history for conversationId: ${conversationId}, connectionId: ${connectionId}`);
          
          // Load from database
          const dbHistory = await chatHistoryService.getConversationHistory(conversationId);
          
          console.log(`[QwenAgentService] DB returned ${dbHistory?.length || 0} messages for conversation ${conversationId}`);
          
          // Only convert if there are messages (optimization: skip for new conversations)
          if (dbHistory && dbHistory.length > 0) {
            // Convert DB messages to Qwen-Agent format
            conversationHistory = chatHistoryService.convertToQwenAgentFormat(dbHistory);
            
            // Remove the last user message if it matches the current request
            // This prevents duplicate messages since saveMessage is called before executeTask
            if (conversationHistory.length > 0) {
              const lastMessage = conversationHistory[conversationHistory.length - 1];
              if (lastMessage.role === 'user' && lastMessage.content === message) {
                console.log(`[QwenAgentService] Removing duplicate last user message: "${message}"`);
                conversationHistory = conversationHistory.slice(0, -1);
              }
            }
            
            console.log(`[QwenAgentService] Converted to ${conversationHistory.length} Qwen-Agent format messages (after deduplication)`);
            if (conversationHistory.length > 0) {
              console.log(`[QwenAgentService] First message:`, conversationHistory[0]);
              console.log(`[QwenAgentService] Last message:`, conversationHistory[conversationHistory.length - 1]);
            }
          } else {
            // New conversation with no messages - no need to load history
            console.log(`[QwenAgentService] New conversation ${conversationId} - no history to load`);
          }
        } catch (dbError) {
          console.error('[QwenAgentService] Failed to load history from DB:', dbError);
          console.error('[QwenAgentService] conversationId was:', conversationId);
          // Fallback to memory cache if DB load fails
          const historyKey = connectionId || 'default';
          conversationHistory = this.conversationHistory.get(historyKey) || [];
          console.log(`[QwenAgentService] Using memory cache fallback: ${conversationHistory.length} messages`);
        }
      } else {
        // Fallback to memory cache if no conversationId provided
        const historyKey = connectionId || 'default';
        conversationHistory = this.conversationHistory.get(historyKey) || [];
        
        if (process.env.NODE_ENV === 'development') {
          console.log(`[QwenAgentService] Using memory cache for ${historyKey} (no conversationId provided)`);
        }
      }
      
      // Build request body
      const requestBody = {
        message,
        conversation_history: conversationHistory,
        connection_id: connectionId
      };
      
      // Add LLM config if provided
      if (llmSettings) {
        requestBody.llm_config = {
          provider: llmSettings.provider || 'ollama',
          api_key: llmSettings.apiKey || null,
          base_url: llmSettings.baseURL || null,
          model: llmSettings.model || null,
          temperature: llmSettings.temperature !== undefined ? llmSettings.temperature : null,
          max_tokens: llmSettings.maxTokens !== undefined ? llmSettings.maxTokens : null
        };
      }
      
      let response;
      try {
        response = await fetch(`${this.backendUrl}/agent/execute/stream`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody),
          signal: abortSignal
        });
      } catch (fetchError) {
        // Handle fetch abort errors
        if (fetchError.name === 'AbortError' || abortSignal?.aborted) {
          throw new Error('Request cancelled by user');
        }
        throw fetchError;
      }

      if (!response.ok) {
        throw new Error(`Backend error: ${response.status} ${response.statusText}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let fullResponse = '';
      let buffer = '';
      const messages = []; // Collect all messages for conversation history

      try {
        while (true) {
          // Check if aborted
          if (abortSignal && abortSignal.aborted) {
            reader.cancel();
            throw new Error('Request cancelled by user');
          }
          
          let done, value;
          try {
            const result = await reader.read();
            done = result.done;
            value = result.value;
          } catch (readError) {
            // Handle reader abort errors
            if (readError.name === 'AbortError' || abortSignal?.aborted) {
              reader.cancel();
              throw new Error('Request cancelled by user');
            }
            throw readError;
          }
          
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          
          // Keep the last incomplete line in buffer
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (!line.trim() || line === 'data: [DONE]') continue;
            
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.substring(6));
                
                if (data.type === 'content_chunk' && data.content !== undefined) {
                  // Backend sends incremental content chunks
                  // Accumulate chunks to build the full response (Qwen-Agent 방식)
                  const chunkContent = String(data.content || '');
                  if (chunkContent) {
                    fullResponse += chunkContent;
                    
                    // Call onChunk with accumulated full content
                    if (onChunk) {
                      console.log(`[QwenAgentService] 📝 Content chunk received: ${chunkContent.length} chars, total: ${fullResponse.length} chars`);
                      onChunk(fullResponse);  // Send full accumulated content
                    }
                    
                    // Track assistant messages for history
                    if (!messages.length || messages[messages.length - 1].role !== 'assistant') {
                      messages.push({ role: 'assistant', content: fullResponse });
                    } else {
                      // Update with accumulated content
                      messages[messages.length - 1].content = fullResponse;
                    }
                  }
                } else if (data.type === 'content' && data.content) {
                  // Backend sends full accumulated content (fallback for non-incremental case)
                  // Note: [function]: {...} patterns in content will be parsed and displayed 
                  // separately in the UI using FunctionResult component
                  let currentContent = data.content;
                  
                  // Clean up excessive newlines only (keep function patterns for parsing)
                  currentContent = currentContent.replace(/\n\s*\n\s*\n+/g, '\n\n').trim();
                  
                  // Update full response (keep full content including function patterns for parsing)
                  fullResponse = currentContent;
                  
                  // Call onChunk with FULL content - UI will parse [function]: patterns and display them nicely
                  if (onChunk && currentContent) {
                    onChunk(currentContent);
                  }
                  
                  // Track assistant messages for history (keep full content for parsing in UI)
                  if (!messages.length || messages[messages.length - 1].role !== 'assistant') {
                    messages.push({ role: 'assistant', content: currentContent });
                  } else {
                    // Update with full accumulated content
                    messages[messages.length - 1].content = currentContent;
                  }
                } else if (data.type === 'tool_call') {
                  // Tool call request - LLM is requesting to call a tool
                  const toolName = data.name || data.tool_name || 'unknown_tool';
                  const toolArgs = data.args || data.arguments || '{}';
                  
                  // Command 추출 및 큐에 저장 (ash_ssh_execute 또는 ash_telnet_execute인 경우)
                  console.log(`[QwenAgentService] 🔧 Tool call: name=${toolName}, command=${data.command || 'null'}, hasCommand=${!!data.command}`);
                  
                  if (toolName === 'ash_ssh_execute' || toolName === 'ash_telnet_execute') {
                    // 백엔드에서 command를 전달하지 않은 경우, toolArgs에서 추출
                    let command = data.command;
                    if (!command && toolArgs) {
                      try {
                        const args = JSON.parse(toolArgs);
                        command = args.command || null;
                      } catch (e) {
                        // JSON 파싱 실패시 그대로 사용
                        command = toolArgs;
                      }
                    }
                    
                    if (command) {
                      commandQueue.push(command);
                      console.log(`[QwenAgentService] ✅ Saved command to queue: '${command}' (queue size: ${commandQueue.length})`);
                    } else {
                      console.warn(`[QwenAgentService] ⚠️ No command found for ${toolName}, toolArgs:`, toolArgs);
                    }
                  }
                  
                  // Call tool call callback if provided (for displaying to user)
                  if (onToolCall) {
                    onToolCall(toolName, toolArgs);
                  }
                  
                  // Track for history but don't add to messages array (handled by backend)
                } else if (data.type === 'tool_result') {
                  // Tool execution result - Backend sends structured format:
                  // { type: 'tool_result', name: '...', success: true/false, exitCode: 0, stdout: '...', stderr: '...' }
                  // OR legacy format: { type: 'tool_result', tool_name: '...', content: '...' }
                  
                  const toolName = data.name || data.tool_name || 'unknown_tool';
                  
                  // Don't display ash_list_connections results - they're not useful to the user
                  if (toolName === 'ash_list_connections') {
                    // Still track it for conversation history, but don't show to user
                    messages.push({ role: 'tool', name: toolName, content: data.content || '' });
                    // Don't call onToolResult callback for this tool - skip displaying it
                  } else {
                    // For other tools, track and display normally
                    
                    // Handle structured format from backend
                    if (data.name && (data.stdout !== undefined || data.stderr !== undefined)) {
                      // Command 가져오기 (백엔드에서 전달된 command 우선 사용, 없으면 큐에서)
                      let command = data.command || null;
                      if (!command && toolName === 'ash_ssh_execute' && commandQueue.length > 0) {
                        command = commandQueue.shift();
                        console.log(`[QwenAgentService] ⚠️ Backend didn't send command, using queue: '${command}'`);
                      }
                      
                      // New structured format
                      const toolResult = {
                        name: data.name,
                        command: command,
                        success: data.success !== undefined ? data.success : true,
                        exitCode: data.exitCode !== undefined ? data.exitCode : 0,
                        stdout: data.stdout || '',
                        stderr: data.stderr || ''
                      };
                      
                      console.log(`[QwenAgentService] 📤 Tool result: name=${toolResult.name}, command=${toolResult.command || 'null'}`);
                      
                      messages.push({ role: 'tool', name: toolName, toolResult });
                      
                      // Call onToolResult callback with structured data
                      if (onToolResult) {
                        onToolResult(toolName, toolResult);
                      }
                    } else {
                      // Legacy format
                      const toolResult = {
                        name: toolName,
                        content: data.content || ''
                      };
                      
                      messages.push({ role: 'tool', name: toolName, toolResult });
                      
                      // Call onToolResult callback
                      if (onToolResult) {
                        onToolResult(toolName, data.content || '');
                      }
                    }
                  }
                } else if (data.type === 'message') {
                  // Other message types (for debugging/visibility)
                  if (onChunk) {
                    onChunk(`\n[${data.role || 'unknown'}]: ${data.content || ''}\n`);
                  }
                } else if (data.type === 'done') {
                  // Task completed - send final content update before breaking
                  if (onChunk && fullResponse) {
                    console.log(`[QwenAgentService] ✅ Final done signal, sending final content: ${fullResponse.length} chars`);
                    onChunk(fullResponse);
                  }
                  break;
                } else if (data.type === 'error') {
                  throw new Error(data.content || 'Unknown error');
                }
              } catch (e) {
                // Skip invalid JSON
                console.warn('Failed to parse SSE data:', line, e);
              }
            }
          }
        }
      } catch (streamError) {
        // Handle streaming errors, especially abort
        if (
          streamError?.name === 'AbortError' ||
          streamError?.name === 'AbortedError' ||
          streamError?.message?.includes('aborted') ||
          streamError?.message?.includes('cancelled') ||
          abortSignal?.aborted
        ) {
          // Clean up and throw cancellation error
          try {
            reader.cancel();
          } catch (cancelError) {
            // Ignore cancel errors
          }
          throw new Error('Request cancelled by user');
        }
        // Re-throw other errors
        throw streamError;
      } finally {
        try {
          reader.releaseLock();
        } catch (lockError) {
          // Ignore lock release errors (may fail if already released)
        }
      }

      // Update conversation history in memory cache (for fallback)
      // Note: DB updates are handled by useAICommand hook which saves messages separately
      const historyKey = connectionId || 'default';
      const updatedHistory = [...conversationHistory];
      
      // Add user message
      updatedHistory.push({ role: 'user', content: message });
      
      // Add all messages from this response (assistant + tool results)
      // Qwen-Agent format: tool results are included as { role: 'tool', name: ..., content: ... }
      updatedHistory.push(...messages);
      
      // Keep last 50 messages to maintain full context
      // This ensures all previous commands, results, and OS detection are preserved
      const trimmedHistory = updatedHistory.slice(-50);
      this.conversationHistory.set(historyKey, trimmedHistory);
      
      if (process.env.NODE_ENV === 'development') {
        console.debug(`[QwenAgentService] Updated memory cache for ${historyKey}: ${trimmedHistory.length} messages (kept last 50 for context)`);
      }
      
      // Return formatted response
      return fullResponse;
    } catch (error) {
      // If aborted, throw a clear cancellation error
      if (abortSignal && abortSignal.aborted) {
        throw new Error('Request cancelled by user');
      }
      
      // Check if the original error was an abort
      const errorMessage = error.message || '';
      const errorName = error.name || '';
      
      if (
        errorName === 'AbortError' || 
        errorName === 'AbortedError' ||
        errorMessage.includes('aborted') ||
        errorMessage.includes('abort') ||
        errorMessage.includes('cancelled')
      ) {
        throw new Error('Request cancelled by user');
      }
      
      console.error('Qwen-Agent service error:', error);
      throw new Error(`Failed to execute task: ${error.message}`);
    }
  }

  /**
   * Get conversation history for a connection
   * @param {string} connectionId - Connection ID (optional, defaults to 'default')
   * @returns {Array} Conversation history
   */
  getConversationHistory(connectionId = null) {
    const historyKey = connectionId || 'default';
    return this.conversationHistory.get(historyKey) || [];
  }

  /**
   * Clear conversation history for a connection
   * @param {string} connectionId - Connection ID (optional, defaults to 'default')
   */
  clearConversationHistory(connectionId = null) {
    const historyKey = connectionId || 'default';
    this.conversationHistory.delete(historyKey);
  }

  /**
   * Check if backend is available
   */
  async checkHealth() {
    try {
      const response = await fetch(`${this.backendUrl}/health`);
      return response.ok;
    } catch {
      return false;
    }
  }
}

export default QwenAgentService;

