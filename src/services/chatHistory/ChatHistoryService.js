/**
 * Chat History Service
 * 
 * Main service for managing chat history.
 * Uses Storage Adapter pattern to support different storage backends.
 */

import LocalStorageAdapter from './LocalStorageAdapter.js';

class ChatHistoryService {
  constructor(adapter = null) {
    // Use LocalStorageAdapter by default (Phase 1)
    this.adapter = adapter || new LocalStorageAdapter();
  }

  /**
   * Strip <think>...</think> blocks from assistant messages before persisting/sending as history.
   * We may still display <think> in UI, but history should be clean to avoid confusing the model.
   */
  _stripThinkBlocks(text) {
    if (!text || typeof text !== 'string') return '';
    // Remove complete think blocks
    let out = text.replace(/<think>[\s\S]*?<\/think>/g, '');
    // If an unterminated <think> exists, drop everything after it
    const start = out.indexOf('<think>');
    if (start !== -1) {
      out = out.slice(0, start);
    }
    return out;
  }

  /**
   * Summarize large text deterministically (no LLM call).
   * Keeps head/tail and reports omitted lines/bytes.
   */
  _summarizeText(text, opts = {}) {
    const {
      maxBytes = 10 * 1024, // target summary size
      headLines = 40,
      tailLines = 40,
    } = opts;

    if (!text || typeof text !== 'string') return '';
    const rawBytes = new TextEncoder().encode(text).length;
    if (rawBytes <= maxBytes) return text;

    const lines = text.split('\n');
    if (lines.length <= headLines + tailLines + 1) {
      // Fallback: byte-truncate if it is one huge line
      return text.slice(0, Math.min(text.length, maxBytes)) + '\n... [truncated]';
    }

    const head = lines.slice(0, headLines);
    const tail = lines.slice(-tailLines);
    const omitted = Math.max(0, lines.length - head.length - tail.length);
    const summary = `${head.join('\n')}\n\n... [${omitted} lines omitted, original ~${rawBytes} bytes] ...\n\n${tail.join('\n')}`;

    // Ensure summary is not explosively large (e.g., very long lines)
    const summaryBytes = new TextEncoder().encode(summary).length;
    if (summaryBytes <= maxBytes * 2) return summary;
    return summary.slice(0, Math.min(summary.length, maxBytes * 2)) + '\n... [summary truncated]';
  }

  _summarizeToolResult(toolResult, maxBytes = 10 * 1024) {
    if (!toolResult || typeof toolResult !== 'object') return toolResult;

    const stdout = typeof toolResult.stdout === 'string' ? toolResult.stdout : '';
    const stderr = typeof toolResult.stderr === 'string' ? toolResult.stderr : '';
    const stdoutBytes = new TextEncoder().encode(stdout).length;
    const stderrBytes = new TextEncoder().encode(stderr).length;
    const totalBytes = stdoutBytes + stderrBytes;

    if (totalBytes <= maxBytes) return toolResult;

    // Allocate budget roughly proportional to original sizes
    const stdoutBudget = totalBytes > 0 ? Math.max(2048, Math.floor(maxBytes * (stdoutBytes / totalBytes))) : Math.floor(maxBytes / 2);
    const stderrBudget = Math.max(2048, maxBytes - stdoutBudget);

    return {
      ...toolResult,
      stdout: this._summarizeText(stdout, { maxBytes: stdoutBudget }),
      stderr: this._summarizeText(stderr, { maxBytes: stderrBudget }),
      summary: true,
      originalSize: totalBytes,
    };
  }

  /**
   * Create a new conversation
   */
  async createConversation(title, connectionId = null) {
    return await this.adapter.createConversation(title, connectionId);
  }

  /**
   * Get conversation by ID
   */
  async getConversation(conversationId) {
    return await this.adapter.getConversation(conversationId);
  }

  /**
   * Get conversation by connection ID
   */
  async getConversationByConnectionId(connectionId) {
    return await this.adapter.getConversationByConnectionId(connectionId);
  }

  /**
   * Get or create conversation for connection
   */
  async getOrCreateConversation(connectionId, title = null) {
    return await this.adapter.getOrCreateConversation(connectionId, title);
  }

  /**
   * Update conversation
   */
  async updateConversation(conversationId, updates) {
    return await this.adapter.updateConversation(conversationId, updates);
  }

  /**
   * Summary + delete (compact) existing stored tool outputs in ONE conversation.
   * This rewrites localStorage so the raw huge outputs are no longer persisted.
   */
  async compactConversation(conversationId, maxToolBytes = 10 * 1024) {
    if (!conversationId || typeof conversationId !== 'string') return { updated: 0 };
    if (typeof this.adapter.compactConversation !== 'function') return { updated: 0 };

    const compactFn = (msg) => {
      if (!msg || typeof msg !== 'object') return msg;
      if (msg.role !== 'tool') return msg;

      let changed = false;
      const next = { ...msg };

      if (next.toolResults && Array.isArray(next.toolResults) && next.toolResults.length > 0) {
        const summarized = next.toolResults.map((tr) => this._summarizeToolResult(tr, maxToolBytes));
        // detect change
        for (let i = 0; i < summarized.length; i += 1) {
          if (summarized[i] !== next.toolResults[i]) {
            changed = true;
            break;
          }
        }
        if (changed) {
          next.toolResults = summarized;
          try {
            next.content = summarized.length === 1 ? JSON.stringify(summarized[0]) : JSON.stringify(summarized);
          } catch {
            // keep existing content
          }
        }
      } else if (typeof next.content === 'string') {
        const summarizedContent = this._summarizeText(next.content, { maxBytes: maxToolBytes });
        if (summarizedContent !== next.content) {
          changed = true;
          next.content = summarizedContent;
        }
      }

      return changed ? next : msg;
    };

    return await this.adapter.compactConversation(conversationId, compactFn);
  }

  /**
   * Summary + delete (compact) ALL stored tool outputs across all conversations.
   */
  async compactAll(maxToolBytes = 10 * 1024) {
    if (typeof this.adapter.compactAll !== 'function') return { updated: 0 };

    const compactFn = (msg) => {
      if (!msg || typeof msg !== 'object') return msg;
      if (msg.role !== 'tool') return msg;

      let changed = false;
      const next = { ...msg };

      if (next.toolResults && Array.isArray(next.toolResults) && next.toolResults.length > 0) {
        const summarized = next.toolResults.map((tr) => this._summarizeToolResult(tr, maxToolBytes));
        for (let i = 0; i < summarized.length; i += 1) {
          if (summarized[i] !== next.toolResults[i]) {
            changed = true;
            break;
          }
        }
        if (changed) {
          next.toolResults = summarized;
          try {
            next.content = summarized.length === 1 ? JSON.stringify(summarized[0]) : JSON.stringify(summarized);
          } catch {
            // keep existing content
          }
        }
      } else if (typeof next.content === 'string') {
        const summarizedContent = this._summarizeText(next.content, { maxBytes: maxToolBytes });
        if (summarizedContent !== next.content) {
          changed = true;
          next.content = summarizedContent;
        }
      }

      return changed ? next : msg;
    };

    return await this.adapter.compactAll(compactFn);
  }

  /**
   * Save a message
   */
  async saveMessage(conversationId, role, content, toolResults = null) {
    // Do not persist chain-of-thought blocks in history.
    // (UI can still show it live; history is for context to the agent.)
    if (role === 'assistant' && typeof content === 'string') {
      content = this._stripThinkBlocks(content);
    }

    // IMPORTANT:
    // - Tool outputs can be huge (journalctl, dmesg, logread...)
    // - If we persist raw outputs, they get reloaded into conversation_history and cause repeated failures.
    // So: summarize toolResults BEFORE saving (this effectively "deletes" the raw output from DB).
    if (role === 'tool' && toolResults && Array.isArray(toolResults)) {
      const summarizedToolResults = toolResults.map((tr) => this._summarizeToolResult(tr));

      // Keep message.content consistent with toolResults (so convertToQwenAgentFormat never sees huge content)
      let newContent = content;
      try {
        if (summarizedToolResults.length === 1) {
          newContent = JSON.stringify(summarizedToolResults[0]);
        } else {
          newContent = JSON.stringify(summarizedToolResults);
        }
      } catch {
        // ignore, keep original content
      }

      return await this.adapter.saveMessage(conversationId, role, newContent, summarizedToolResults);
    }

    return await this.adapter.saveMessage(conversationId, role, content, toolResults);
  }

  /**
   * Get conversation history
   */
  async getConversationHistory(conversationId, limit = null) {
    return await this.adapter.getConversationHistory(conversationId, limit);
  }

  /**
   * Get all conversations
   */
  async getAllConversations() {
    return await this.adapter.getAllConversations();
  }

  /**
   * List conversations for a connection
   */
  async listConversations(connectionId) {
    return await this.adapter.listConversations(connectionId);
  }

  /**
   * Save active conversation for a connection
   */
  saveActiveConversation(connectionId, conversationId) {
    return this.adapter.saveActiveConversation(connectionId, conversationId);
  }

  /**
   * Get active conversation for a connection
   */
  getActiveConversation(connectionId) {
    return this.adapter.getActiveConversation(connectionId);
  }

  /**
   * Delete conversation
   */
  async deleteConversation(conversationId) {
    return await this.adapter.deleteConversation(conversationId);
  }

  /**
   * Clear all data
   */
  async clearAll() {
    return await this.adapter.clearAll();
  }

  /**
   * Convert messages to Qwen-Agent format
   * Qwen-Agent expects: [{ role: 'user', content: '...' }, { role: 'assistant', content: '...' }, { role: 'function', name: '...', content: '...' }]
   * Note: Qwen-Agent uses 'function' role for tool results, not 'tool'
   */
  convertToQwenAgentFormat(messages) {
    const result = [];
    
    for (const msg of messages) {
      if (msg.role === 'tool') {
        // Handle tool messages - convert to 'function' role for Qwen-Agent
        if (msg.toolResults && Array.isArray(msg.toolResults) && msg.toolResults.length > 0) {
          // Convert each tool result to Qwen-Agent format
          for (const toolResult of msg.toolResults) {
            if (toolResult && toolResult.name) {
              // Defensive: summarize again on read in case old DB entries contain huge outputs
              const safeToolResult = this._summarizeToolResult(toolResult);
              // Format tool result as JSON string (as Qwen-Agent expects)
              const content = typeof safeToolResult === 'string' 
                ? safeToolResult 
                : JSON.stringify({
                    success: safeToolResult.success !== undefined ? safeToolResult.success : true,
                    output: safeToolResult.stdout || safeToolResult.content || '',
                    error: safeToolResult.stderr || '',
                    exitCode: safeToolResult.exitCode || 0
                  });
              
              result.push({
                role: 'function', // Qwen-Agent uses 'function' role, not 'tool'
                name: safeToolResult.name,
                content: content
              });
            }
          }
        } else if (msg.content) {
          // If tool message has content but no toolResults, try to parse it
          // This handles cases where tool message was saved as JSON string
          try {
            const parsed = JSON.parse(msg.content);
            if (parsed.name) {
              result.push({
                role: 'function', // Qwen-Agent uses 'function' role, not 'tool'
                name: parsed.name,
                content: msg.content
              });
            } else {
              // Fallback: use content as-is
              result.push({
                role: 'function', // Qwen-Agent uses 'function' role, not 'tool'
                name: 'unknown_tool',
                content: msg.content
              });
            }
          } catch (e) {
            // Not JSON, use as-is
            result.push({
              role: 'function', // Qwen-Agent uses 'function' role, not 'tool'
              name: 'unknown_tool',
              content: this._summarizeText(msg.content)
            });
          }
        }
      } else {
        // For user and assistant messages, return as-is
        result.push({
          role: msg.role,
          content: msg.role === 'assistant' ? this._stripThinkBlocks(msg.content) : msg.content
        });
      }
    }
    
    return result;
  }
}

// Export singleton instance
const chatHistoryService = new ChatHistoryService();

export default chatHistoryService;
