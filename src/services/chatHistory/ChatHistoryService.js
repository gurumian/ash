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
   * Save a message
   */
  async saveMessage(conversationId, role, content, toolResults = null) {
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
   * Qwen-Agent expects: [{ role: 'user', content: '...' }, { role: 'assistant', content: '...' }, { role: 'tool', name: '...', content: '...' }]
   */
  convertToQwenAgentFormat(messages) {
    return messages.map(msg => {
      if (msg.role === 'tool' && msg.toolResults) {
        // Convert tool results to Qwen-Agent format
        const toolResult = msg.toolResults[0]; // Take first tool result
        if (toolResult && toolResult.name) {
          // Format tool result as JSON string (as Qwen-Agent expects)
          const content = typeof toolResult === 'string' 
            ? toolResult 
            : JSON.stringify({
                success: toolResult.success !== undefined ? toolResult.success : true,
                output: toolResult.stdout || toolResult.content || '',
                error: toolResult.stderr || '',
                exitCode: toolResult.exitCode || 0
              });
          
          return {
            role: 'tool',
            name: toolResult.name,
            content: content
          };
        }
      }
      
      // For user and assistant messages, return as-is
      return {
        role: msg.role,
        content: msg.content
      };
    });
  }
}

// Export singleton instance
const chatHistoryService = new ChatHistoryService();

export default chatHistoryService;
