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
  async executeTask(message, connectionId = null, onChunk = null, llmSettings = null, onToolResult = null, onToolCall = null) {
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
      let lastContentLength = 0; // Track last content length to extract delta
      let lastReasoningLength = 0; // Track last reasoning length to extract delta

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
                
                if (data.type === 'content' && data.content) {
                  // Qwen-Agent may send accumulated content, so we need to extract delta
                  const currentContent = data.content;
                  const delta = currentContent.length > lastContentLength 
                    ? currentContent.substring(lastContentLength)
                    : currentContent; // If length decreased, it's a new response
                  
                  // Update full response with delta only
                  fullResponse += delta;
                  lastContentLength = currentContent.length;
                  
                  // Display only the delta (new content)
                  if (onChunk && delta) {
                    onChunk(delta);
                  }
                  
                  // Track assistant messages for history (keep accumulated content)
                  if (!messages.length || messages[messages.length - 1].role !== 'assistant') {
                    messages.push({ role: 'assistant', content: currentContent });
                  } else {
                    // Update with full accumulated content
                    messages[messages.length - 1].content = currentContent;
                  }
                } else if (data.type === 'reasoning') {
                  // LLM reasoning/thinking process - this is what we want to show prominently
                  const currentReasoning = data.content || '';
                  
                  // Extract delta from reasoning (similar to content)
                  const reasoningDelta = currentReasoning.length > lastReasoningLength
                    ? currentReasoning.substring(lastReasoningLength)
                    : currentReasoning; // If length decreased, it's a new reasoning
                  
                  // Update full response with reasoning delta
                  fullResponse += reasoningDelta;
                  lastReasoningLength = currentReasoning.length;
                  
                  // Display only the delta (new reasoning content)
                  if (onChunk && reasoningDelta) {
                    onChunk(reasoningDelta);
                  }
                  
                  // Track reasoning for history (keep accumulated content)
                  if (!messages.length || messages[messages.length - 1].role !== 'assistant') {
                    messages.push({ role: 'assistant', content: currentReasoning });
                  } else {
                    // Update with full accumulated reasoning
                    messages[messages.length - 1].content = currentReasoning;
                  }
                } else if (data.type === 'tool_call') {
                  // Tool call request - LLM is requesting to call a tool
                  // Don't display to user, just track internally if needed
                  const toolName = data.tool_name || 'unknown_tool';
                  
                  // Call tool call callback if provided (for internal tracking)
                  if (onToolCall) {
                    onToolCall(toolName, data.arguments || '{}');
                  }
                  
                  // Don't add to messages or display - user doesn't need to see tool calls
                } else if (data.type === 'tool_result') {
                  // Tool execution result - Qwen-Agent automatically includes this in conversation
                  // Track tool messages for history
                  // Qwen-Agent format: { role: 'tool', name: tool_name, content: tool_result }
                  
                  // Don't display ash_list_connections results - they're not useful to the user
                  if (data.tool_name === 'ash_list_connections') {
                    // Still track it for conversation history, but don't show to user
                    messages.push({ role: 'tool', name: data.tool_name, content: data.content });
                    // Don't call onToolResult callback for this tool - skip displaying it
                  } else {
                    // For other tools, track and display normally
                    messages.push({ role: 'tool', name: data.tool_name, content: data.content });
                    
                    // Call tool result callback if provided
                    if (onToolResult) {
                      onToolResult(data.tool_name, data.content);
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
      // Qwen-Agent automatically includes tool results in the conversation
      // We need to reconstruct the full conversation including tool results
      const updatedHistory = [...conversationHistory];
      
      // Add user message
      updatedHistory.push({ role: 'user', content: message });
      
      // Add all messages from this response (assistant + tool results)
      // Qwen-Agent format: tool results are included as { role: 'tool', name: ..., content: ... }
      updatedHistory.push(...messages);
      
      // Keep last 50 messages to maintain full context (increased from 30 for better context retention)
      // This ensures all previous commands, results, and OS detection are preserved
      const trimmedHistory = updatedHistory.slice(-50);
      this.conversationHistory.set(historyKey, trimmedHistory);
      
      console.debug(`Updated conversation history for ${historyKey}: ${trimmedHistory.length} messages (kept last 50 for context)`);
      
      console.debug(`Updated conversation history for ${historyKey}: ${trimmedHistory.length} messages`);
      
      // Return formatted response (without markdown) for terminal display
      return fullResponse;
    } catch (error) {
      console.error('Qwen-Agent service error:', error);
      throw new Error(`Failed to execute task: ${error.message}`);
    }
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

