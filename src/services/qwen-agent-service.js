/**
 * Qwen-Agent Service - Calls Python backend with Qwen-Agent
 */

const BACKEND_URL = 'http://127.0.0.1:54111';

class QwenAgentService {
  constructor() {
    this.backendUrl = BACKEND_URL;
    // Store conversation history per connection
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
   * @returns {Promise<string>} - Final response
   */
  async executeTask(message, connectionId = null, onChunk = null, llmSettings = null, onToolResult = null, onToolCall = null, onContentChunk = null) {
    try {
      // Get conversation history for this connection (or use default)
      const historyKey = connectionId || 'default';
      const conversationHistory = this.conversationHistory.get(historyKey) || [];
      
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
      
      const response = await fetch(`${this.backendUrl}/agent/execute/stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
      });

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
          const { done, value } = await reader.read();
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
                
                if (data.type === 'content_chunk' && data.content) {
                  // New streaming protocol: backend sends chunks incrementally
                  if (onContentChunk) {
                    onContentChunk(data.content);
                  }
                  fullResponse += data.content;
                } else if (data.type === 'content' && data.content) {
                  // Legacy fallback: backend sends full accumulated content.
                  // This is for compatibility, new logic should use content_chunk.
                  if (onChunk) {
                    onChunk(data.content);
                  }
                  fullResponse = data.content;
                } else if (data.type === 'tool_call') {
                  // Tool call request - LLM is requesting to call a tool
                  const toolName = data.name || 'unknown_tool';
                  if (onToolCall) {
                    onToolCall(toolName, data.args || '{}');
                  }
                  // Don't add to messages or display - user doesn't need to see tool calls
                } else if (data.type === 'tool_result') {
                  // Tool execution result
                  const toolName = data.name || 'unknown_tool';
                  
                  if (toolName === 'ash_list_connections') {
                    messages.push({ role: 'tool', name: toolName, content: data.content || '' });
                  } else {
                    // Parse tool result content which may contain STDOUT/STDERR markers
                    const toolResult = {
                      name: toolName,
                      success: data.success !== undefined ? data.success : true,
                      exitCode: data.exitCode !== undefined ? data.exitCode : 0,
                      content: data.content || '',
                      stdout: (data.content || '').includes("STDOUT") ? data.content.split("--- STDOUT ---")[1]?.split("--- END STDOUT ---")[0]?.trim() : data.content,
                      stderr: (data.content || '').includes("STDERR") ? data.content.split("--- STDERR ---")[1]?.split("--- END STDERR ---")[0]?.trim() : ''
                    };
                    
                    messages.push({ role: 'tool', name: toolName, toolResult });
                    
                    if (onToolResult) {
                      onToolResult(toolName, toolResult);
                    }
                  }
                } else if (data.type === 'message') {
                  // Other message types (for debugging/visibility)
                  if (onChunk) {
                    onChunk(`\n[${data.role || 'unknown'}]: ${data.content || ''}\n`);
                  }
                } else if (data.type === 'done') {
                  // Task completed
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
      } finally {
        reader.releaseLock();
      }

      // Update conversation history
      const updatedHistory = [...conversationHistory];
      updatedHistory.push({ role: 'user', content: message });
      
      // Add assistant's final response
      if (fullResponse) {
          messages.push({ role: 'assistant', content: fullResponse });
      }
      updatedHistory.push(...messages);
      
      const trimmedHistory = updatedHistory.slice(-50);
      this.conversationHistory.set(historyKey, trimmedHistory);
      
      if (process.env.NODE_ENV === 'development') {
        console.debug(`Updated conversation history for ${historyKey}: ${trimmedHistory.length} messages (kept last 50 for context)`);
      }
      
      return fullResponse;
    } catch (error) {
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

