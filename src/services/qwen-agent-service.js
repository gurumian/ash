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

    // Chunk accumulator for large tool results
    const chunkAccumulators = new Map(); // tool_name -> { stdout: '', stderr: '', metadata: {} }

    try {
      // Load conversation history from DB if conversationId is provided
      // This ensures context persists across app restarts
      // Note: New conversations (with no messages) will return empty array, which is fine
      let conversationHistory = [];

      if (conversationId) {
        try {
          // Debug: Log which conversation we're loading
          console.log(`[QwenAgentService] Loading history for conversationId: ${conversationId}, connectionId: ${connectionId}`);

          // Summary + delete: compact stored tool outputs before loading
          // This prevents repeated failures when a conversation contains huge command outputs.
          try {
            const compactResult = await chatHistoryService.compactConversation(conversationId);
            if (compactResult?.updated > 0) {
              console.log(`[QwenAgentService] 🧹 Compacted conversation ${conversationId}: updated ${compactResult.updated} messages`);
            }
          } catch (compactError) {
            console.warn('[QwenAgentService] Failed to compact conversation history (continuing):', compactError);
          }

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
        // Check for specific error types
        if (response.status === 413 || response.statusText.includes('Payload Too Large')) {
          console.error(`[QwenAgentService] ❌ HTTP 413 Payload Too Large error`);
          throw new Error('Server response exceeded size limit. The command output was too large to process.');
        }
        // Try to get error message from response body
        let errorMessage = `Backend error: ${response.status} ${response.statusText}`;
        try {
          const errorText = await response.text();
          console.error(`[QwenAgentService] ❌ HTTP ${response.status} error: ${response.statusText}, body: ${errorText.substring(0, 500)}`);
          if (errorText.includes('Payload Too Large') ||
            errorText.includes('Response too large') ||
            errorText.includes('exceeded size limit') ||
            errorText.includes('too large')) {
            errorMessage = 'Server response exceeded size limit. The command output was too large to process.';
          } else if (errorText) {
            errorMessage = `Backend error: ${response.status} ${response.statusText} - ${errorText.substring(0, 200)}`;
          }
        } catch (e) {
          // Ignore error reading response body
          console.error(`[QwenAgentService] ❌ Failed to read error response body: ${e}`);
        }
        throw new Error(errorMessage);
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
                  // May be chunked if content is very large (chunk_index will be present)
                  // Accumulate chunks to build the full response (Qwen-Agent 방식)
                  const chunkContent = String(data.content || '');
                  const chunkIndex = data.chunk_index;

                  if (chunkContent) {
                    if (chunkIndex !== undefined) {
                      // This is a chunked content - log for debugging
                      console.log(`[QwenAgentService] 📦 Content chunk ${chunkIndex} received: ${chunkContent.length} chars`);
                    }

                    fullResponse += chunkContent;

                    // Call onChunk with accumulated full content
                    if (onChunk) {
                      // NOTE: very noisy; keep disabled unless actively debugging streaming.
                      // if (process.env.NODE_ENV === 'development') {
                      //   if (chunkIndex !== undefined) {
                      //     console.log(`[QwenAgentService] 📝 Content chunk ${chunkIndex}: ${chunkContent.length} chars, total: ${fullResponse.length} chars`);
                      //   } else {
                      //     console.log(`[QwenAgentService] 📝 Content chunk received: ${chunkContent.length} chars, total: ${fullResponse.length} chars`);
                      //   }
                      // }
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
                  let extractedCommand = data.command || null;

                  // Command 추출 및 큐에 저장 (ash_ssh_execute 또는 ash_telnet_execute인 경우)
                  // console.log(`[QwenAgentService] 🔧 Tool call: name=${toolName}, command=${data.command || 'null'}, hasCommand=${!!data.command}`);

                  if (toolName === 'ash_ssh_execute' || toolName === 'ash_telnet_execute' || toolName === 'ash_execute_command') {
                    // 백엔드에서 command를 전달하지 않은 경우, toolArgs에서 추출
                    if (!extractedCommand && toolArgs) {
                      if (typeof toolArgs === 'object') {
                        extractedCommand = toolArgs.command || null;
                      } else {
                        try {
                          const args = JSON.parse(toolArgs);
                          extractedCommand = args.command || null;
                        } catch (e) {
                          // JSON 파싱 실패시: 비어있지 않으면 그대로 사용
                          extractedCommand = typeof toolArgs === 'string' && toolArgs.trim() ? toolArgs : null;
                        }
                      }
                    }

                    if (extractedCommand) {
                      commandQueue.push(extractedCommand);
                      console.log(`[QwenAgentService] ✅ Saved command to queue: '${extractedCommand}' (queue size: ${commandQueue.length})`);
                    } else {
                      const argsStr = typeof toolArgs === 'string' ? toolArgs.trim() : '';
                      // Some models may emit an empty/placeholder tool_call before correcting.
                      // This is usually harmless if the backend includes the command in tool_result.
                      if (argsStr && argsStr !== '{}' && argsStr !== 'null') {
                        console.warn(`[QwenAgentService] ⚠️ No command found for ${toolName}, toolArgs:`, toolArgs);
                      } else if (process.env.NODE_ENV === 'development') {
                        console.debug(`[QwenAgentService] ℹ️ Tool call without command for ${toolName} (likely placeholder), toolArgs:`, toolArgs);
                      }
                    }
                  }

                  // Log final extracted command state
                  console.log(`[QwenAgentService] 🔧 Tool call: name=${toolName}, command=${extractedCommand || 'null'}, args=${typeof toolArgs === 'string' ? toolArgs.substring(0, 50) + '...' : 'object'}`);

                  // Call tool call callback if provided (for displaying to user)
                  if (onToolCall) {
                    onToolCall(toolName, {
                      args: toolArgs,
                      command: extractedCommand
                    });
                  }

                  // Track for history but don't add to messages array (handled by backend)
                } else if (data.type === 'tool_result') {
                  // Tool execution result - Backend sends structured format:
                  // { type: 'tool_result', name: '...', success: true/false, exitCode: 0, stdout: '...', stderr: '...' }
                  // OR chunked format: { type: 'tool_result', name: '...', chunked: true, ... }
                  // OR legacy format: { type: 'tool_result', tool_name: '...', content: '...' }

                  const toolName = data.name || data.tool_name || 'unknown_tool';

                  // Don't display ash_list_connections results - they're not useful to the user
                  if (toolName === 'ash_list_connections') {
                    // Still track it for conversation history, but don't show to user
                    messages.push({ role: 'tool', name: toolName, content: data.content || '' });
                    // Don't call onToolResult callback for this tool - skip displaying it
                  } else {
                    // For other tools, track and display normally

                    // Handle chunked format (large outputs)
                    if (data.chunked) {
                      // Initialize accumulator for this tool
                      if (!chunkAccumulators.has(toolName)) {
                        chunkAccumulators.set(toolName, {
                          stdout: '',
                          stderr: '',
                          metadata: {
                            name: data.name,
                            command: data.command || null,
                            success: data.success !== undefined ? data.success : true,
                            exitCode: data.exitCode !== undefined ? data.exitCode : 0,
                            total_size: data.total_size || 0
                          }
                        });
                      }
                      // Wait for chunks - don't process yet
                    } else if (data.name && (data.stdout !== undefined || data.stderr !== undefined)) {
                      // Non-chunked structured format
                      // Command 가져오기 (백엔드에서 전달된 command 우선 사용, 없으면 큐에서)
                      let command = data.command || null;
                      if (!command && (toolName === 'ash_ssh_execute' || toolName === 'ash_telnet_execute' || toolName === 'ash_execute_command') && commandQueue.length > 0) {
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
                } else if (data.type === 'tool_result_chunk') {
                  // Handle chunked tool result data
                  const toolName = data.name || 'unknown_tool';
                  const accumulator = chunkAccumulators.get(toolName);

                  if (accumulator) {
                    // Append chunk to appropriate stream
                    if (data.stream === 'stdout') {
                      accumulator.stdout += data.chunk || '';
                    } else if (data.stream === 'stderr') {
                      accumulator.stderr += data.chunk || '';
                    }
                    console.log(`[QwenAgentService] 📦 Received chunk: tool=${toolName}, stream=${data.stream}, index=${data.index}, chunk_size=${(data.chunk || '').length} bytes, accumulated=${accumulator.stdout.length + accumulator.stderr.length} bytes`);
                  } else {
                    // Accumulator not initialized - this shouldn't happen, but create one as fallback
                    console.warn(`[QwenAgentService] ⚠️ Received chunk for ${toolName} but accumulator not found, creating fallback accumulator`);
                    chunkAccumulators.set(toolName, {
                      stdout: data.stream === 'stdout' ? (data.chunk || '') : '',
                      stderr: data.stream === 'stderr' ? (data.chunk || '') : '',
                      metadata: {
                        name: toolName,
                        command: null,
                        success: true,
                        exitCode: 0,
                        total_size: 0
                      }
                    });
                  }
                } else if (data.type === 'tool_result_complete') {
                  // All chunks received, assemble final result
                  const toolName = data.name || 'unknown_tool';
                  const accumulator = chunkAccumulators.get(toolName);

                  if (accumulator) {
                    // Command 가져오기
                    let command = accumulator.metadata.command || null;
                    if (!command && (toolName === 'ash_ssh_execute' || toolName === 'ash_telnet_execute' || toolName === 'ash_execute_command') && commandQueue.length > 0) {
                      command = commandQueue.shift();
                      console.log(`[QwenAgentService] ⚠️ Backend didn't send command in chunked result, using queue: '${command}'`);
                    }

                    const totalReceived = accumulator.stdout.length + accumulator.stderr.length;
                    const expectedSize = accumulator.metadata.total_size || 0;

                    const toolResult = {
                      name: accumulator.metadata.name || toolName,
                      command: command,
                      success: accumulator.metadata.success,
                      exitCode: accumulator.metadata.exitCode,
                      stdout: accumulator.stdout,
                      stderr: accumulator.stderr
                    };

                    console.log(`[QwenAgentService] 📤 Tool result (chunked): name=${toolResult.name}, command=${toolResult.command || 'null'}, received=${totalReceived} bytes, expected=${expectedSize} bytes`);

                    // Verify all data was received
                    if (expectedSize > 0 && Math.abs(totalReceived - expectedSize) > 100) {
                      console.warn(`[QwenAgentService] ⚠️ Size mismatch: received ${totalReceived} bytes but expected ${expectedSize} bytes (diff: ${Math.abs(totalReceived - expectedSize)} bytes)`);
                    }

                    messages.push({ role: 'tool', name: toolName, toolResult });

                    // Call onToolResult callback with structured data
                    if (onToolResult) {
                      onToolResult(toolName, toolResult);
                    }

                    // Clean up accumulator
                    chunkAccumulators.delete(toolName);
                  } else {
                    console.warn(`[QwenAgentService] ⚠️ Received tool_result_complete for ${toolName} but accumulator not found. Creating fallback result.`);

                    // Fallback: Create result even if accumulator missing (to prevent hanging state)
                    let command = null;
                    // Try to get command from queue for known execution tools
                    if ((toolName === 'ash_ssh_execute' || toolName === 'ash_telnet_execute' || toolName === 'ash_execute_command') && commandQueue.length > 0) {
                      command = commandQueue.shift();
                      console.log(`[QwenAgentService] ⚠️ Using queued command for fallback: '${command}'`);
                    }

                    const toolResult = {
                      name: toolName,
                      command: command,
                      success: data.success !== undefined ? data.success : false,
                      exitCode: data.exitCode !== undefined ? data.exitCode : -1,
                      stdout: '',
                      stderr: '[Error: Output data stream was missing or interrupted]'
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
                  // Task completed - send final content update before breaking
                  if (onChunk && fullResponse) {
                    console.log(`[QwenAgentService] ✅ Final done signal, sending final content: ${fullResponse.length} chars`);
                    onChunk(fullResponse);
                  }

                  // Clean up any remaining accumulators (in case tool_result_complete was missed)
                  if (chunkAccumulators.size > 0) {
                    console.warn(`[QwenAgentService] ⚠️ Cleaning up ${chunkAccumulators.size} remaining accumulators at done signal`);
                    chunkAccumulators.clear();
                  }

                  break;
                } else if (data.type === 'error') {
                  // Clean up accumulators on error
                  chunkAccumulators.clear();
                  console.log(`[QwenAgentService] 🧹 Cleared chunk accumulators due to server error`);

                  const errorContent = data.content || '';
                  console.error(`[QwenAgentService] ❌ Server error received: ${errorContent}`);

                  // Check if it's a "Payload Too Large" or size limit error
                  if (errorContent.includes('Payload Too Large') ||
                    errorContent.includes('<!DOCTYPE html>') ||
                    errorContent.includes('Response too large') ||
                    errorContent.includes('exceeded size limit') ||
                    errorContent.includes('too large')) {
                    throw new Error('Server response exceeded size limit. The command output was too large to process.');
                  }
                  throw new Error(data.content || 'Unknown error');
                }
              } catch (e) {
                // Check if it's a JSON parse error or actual error
                if (e instanceof Error && e.message) {
                  // If it's already an Error object with a message, re-throw it
                  throw e;
                }

                // Check if the line contains HTML error (like "Payload Too Large")
                if (line && typeof line === 'string' && (line.includes('Payload Too Large') || line.includes('<!DOCTYPE html>'))) {
                  throw new Error('Server response is too large. An error occurred while processing the result of a command with very large output. Please try reducing the command output or use a different approach.');
                }

                // Skip invalid JSON (but log it)
                console.warn('Failed to parse SSE data:', line, e);
                // Don't throw for invalid JSON - just skip that line
              }
            }
          }
        }
      } catch (streamError) {
        // Clean up accumulators on any error
        chunkAccumulators.clear();
        console.log(`[QwenAgentService] 🧹 Cleared chunk accumulators due to error: ${streamError?.message || streamError}`);

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
        // Always clean up accumulators when stream ends (success or error)
        if (chunkAccumulators.size > 0) {
          console.log(`[QwenAgentService] 🧹 Cleaning up ${chunkAccumulators.size} accumulators in finally block`);
          chunkAccumulators.clear();
        }

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
      // NOTE:
      // - DB (localStorage) is the source of truth and is compacted/summarized there.
      // - This memory cache is only a fallback if DB load fails.
      // Keep it safe by sanitizing huge tool outputs to avoid in-memory bloat.
      const MAX_TOOL_RESULT_BYTES_FOR_CACHE = 10 * 1024; // 10KB

      const summarizeTextForCache = (text, maxLines = 80) => {
        if (!text || typeof text !== 'string') return '';
        const lines = text.split('\n');
        if (lines.length <= maxLines) return text;
        const head = lines.slice(0, 40);
        const tail = lines.slice(-40);
        const omitted = Math.max(0, lines.length - head.length - tail.length);
        return `${head.join('\n')}\n\n... [${omitted} lines omitted] ...\n\n${tail.join('\n')}`;
      };

      const sanitizeForCache = (msg) => {
        if (!msg || typeof msg !== 'object') return msg;

        // Do not keep <think> blocks in cached history (used as fallback conversation_history)
        if (msg.role === 'assistant' && typeof msg.content === 'string') {
          const stripped = msg.content
            .replace(/<think>[\s\S]*?<\/think>/g, '')
            .split('<think>')[0];
          if (stripped !== msg.content) {
            return { ...msg, content: stripped };
          }
        }

        if (msg.role !== 'tool' || !msg.toolResult || typeof msg.toolResult !== 'object') return msg;

        const tr = msg.toolResult;
        const stdout = typeof tr.stdout === 'string' ? tr.stdout : '';
        const stderr = typeof tr.stderr === 'string' ? tr.stderr : '';
        const bytes = stdout.length + stderr.length; // approximate, good enough for cache safety

        if (bytes <= MAX_TOOL_RESULT_BYTES_FOR_CACHE) return msg;

        return {
          ...msg,
          toolResult: {
            ...tr,
            stdout: summarizeTextForCache(stdout),
            stderr: summarizeTextForCache(stderr),
            summary: true,
            originalSize: bytes
          }
        };
      };

      updatedHistory.push(...messages.map(sanitizeForCache));

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
      // Clean up accumulators on any error (defensive cleanup)
      if (chunkAccumulators && chunkAccumulators.size > 0) {
        console.log(`[QwenAgentService] 🧹 Cleared ${chunkAccumulators.size} accumulators due to error: ${error?.message || error}`);
        chunkAccumulators.clear();
      }

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

