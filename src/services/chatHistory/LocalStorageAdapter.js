/**
 * LocalStorage Adapter for Chat History Storage
 * 
 * Phase 1: LocalStorage-based storage
 * - Fast implementation
 * - Sufficient capacity (typically 5-10MB)
 * - Consistent with existing project patterns
 */

const STORAGE_KEY = 'ash-chat-history';
const ACTIVE_CONVERSATION_KEY = 'ash-active-conversations'; // { connectionId: conversationId }

class LocalStorageAdapter {
  constructor() {
    this.storage = window.localStorage;
    // Memory cache for faster access
    this._dataCache = null;
    this._cacheTimestamp = null;
    this._cacheTimeout = 5000; // 5 seconds cache timeout
  }

  /**
   * Get all data from storage (with memory caching)
   */
  _getData() {
    const now = Date.now();
    
    // Return cached data if available and fresh
    if (this._dataCache !== null && this._cacheTimestamp !== null) {
      if (now - this._cacheTimestamp < this._cacheTimeout) {
        return this._dataCache;
      }
    }

    // Load from localStorage
    try {
      const dataString = this.storage.getItem(STORAGE_KEY);
      const data = dataString ? JSON.parse(dataString) : { conversations: [], messages: [] };
      
      // Update cache
      this._dataCache = data;
      this._cacheTimestamp = now;
      
      return data;
    } catch (error) {
      console.error('Failed to read chat history from localStorage:', error);
      const emptyData = { conversations: [], messages: [] };
      this._dataCache = emptyData;
      this._cacheTimestamp = now;
      return emptyData;
    }
  }

  /**
   * Invalidate cache (call after writing to localStorage)
   */
  _invalidateCache() {
    this._dataCache = null;
    this._cacheTimestamp = null;
  }

  /**
   * Save data to storage
   */
  _saveData(data) {
    try {
      this.storage.setItem(STORAGE_KEY, JSON.stringify(data));
      // Update cache immediately
      this._dataCache = data;
      this._cacheTimestamp = Date.now();
      return true;
    } catch (error) {
      console.error('Failed to save chat history to localStorage:', error);
      // Invalidate cache on error
      this._invalidateCache();
      // Handle quota exceeded error
      if (error.name === 'QuotaExceededError') {
        console.warn('localStorage quota exceeded, clearing old conversations...');
        // Clear oldest conversations
        this._clearOldConversations();
        // Retry once
        try {
          const retryData = this._getData();
          this.storage.setItem(STORAGE_KEY, JSON.stringify(retryData));
          this._dataCache = retryData;
          this._cacheTimestamp = Date.now();
          return true;
        } catch (retryError) {
          console.error('Failed to save after clearing old data:', retryError);
          this._invalidateCache();
          return false;
        }
      }
      return false;
    }
  }

  /**
   * Clear oldest conversations when storage is full
   */
  _clearOldConversations() {
    const data = this._getData();
    // Keep only the 10 most recent conversations
    const sortedConversations = data.conversations.sort((a, b) => 
      new Date(b.updatedAt) - new Date(a.updatedAt)
    );
    const keptConversations = sortedConversations.slice(0, 10);
    const keptIds = new Set(keptConversations.map(c => c.id));
    
    // Remove messages from deleted conversations
    const keptMessages = data.messages.filter(m => keptIds.has(m.conversationId));
    
    data.conversations = keptConversations;
    data.messages = keptMessages;
    this._saveData(data);
  }

  /**
   * Create a new conversation
   */
  async createConversation(title, connectionId = null) {
    const data = this._getData();
    const conversation = {
      id: `conv-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      title: title || `Chat ${new Date().toLocaleString()}`,
      connectionId: connectionId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      lastSyncedAt: null,
      syncId: null,
      version: 1
    };
    
    data.conversations.push(conversation);
    this._saveData(data);
    
    return conversation;
  }

  /**
   * Get conversation by ID
   */
  async getConversation(conversationId) {
    const data = this._getData();
    return data.conversations.find(c => c.id === conversationId) || null;
  }

  /**
   * Get conversation by connection ID
   */
  async getConversationByConnectionId(connectionId) {
    const data = this._getData();
    // Find most recent conversation for this connection
    const conversations = data.conversations
      .filter(c => c.connectionId === connectionId)
      .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
    
    return conversations.length > 0 ? conversations[0] : null;
  }

  /**
   * Get or create conversation for connection
   */
  async getOrCreateConversation(connectionId, title = null) {
    let conversation = await this.getConversationByConnectionId(connectionId);
    
    if (!conversation) {
      conversation = await this.createConversation(
        title || `Chat with ${connectionId}`,
        connectionId
      );
    }
    
    return conversation;
  }

  /**
   * Update conversation
   */
  async updateConversation(conversationId, updates) {
    const data = this._getData();
    const index = data.conversations.findIndex(c => c.id === conversationId);
    
    if (index === -1) {
      throw new Error(`Conversation not found: ${conversationId}`);
    }
    
    data.conversations[index] = {
      ...data.conversations[index],
      ...updates,
      updatedAt: new Date().toISOString(),
      version: (data.conversations[index].version || 1) + 1
    };
    
    this._saveData(data);
    return data.conversations[index];
  }

  /**
   * Save a message
   */
  async saveMessage(conversationId, role, content, toolResults = null) {
    const data = this._getData();
    
    // Ensure conversation exists
    let conversation = data.conversations.find(c => c.id === conversationId);
    if (!conversation) {
      // Create conversation if it doesn't exist
      conversation = await this.createConversation(
        `Chat ${new Date().toLocaleString()}`,
        null
      );
      conversationId = conversation.id;
    }
    
    const message = {
      id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      conversationId: conversationId,
      role: role,
      content: content,
      timestamp: new Date().toISOString(),
      toolResults: toolResults || []
    };
    
    data.messages.push(message);
    
    // Update conversation's updatedAt
    const convIndex = data.conversations.findIndex(c => c.id === conversationId);
    if (convIndex !== -1) {
      data.conversations[convIndex].updatedAt = new Date().toISOString();
    }
    
    this._saveData(data);
    return message;
  }

  /**
   * Get conversation history
   */
  async getConversationHistory(conversationId, limit = null) {
    const data = this._getData();
    let messages = data.messages
      .filter(m => m.conversationId === conversationId)
      .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    
    if (limit) {
      messages = messages.slice(-limit);
    }
    
    return messages;
  }

  /**
   * Get all conversations
   */
  async getAllConversations() {
    const data = this._getData();
    return data.conversations.sort((a, b) => 
      new Date(b.updatedAt) - new Date(a.updatedAt)
    );
  }

  /**
   * List conversations for a specific connection
   */
  async listConversations(connectionId) {
    const data = this._getData();
    const conversations = data.conversations
      .filter(c => c.connectionId === connectionId)
      .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
    
    return conversations.map(c => ({
      id: c.id,
      title: c.title,
      connectionId: c.connectionId,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
      messageCount: data.messages.filter(m => m.conversationId === c.id).length
    }));
  }

  /**
   * Save active conversation for a connection
   */
  saveActiveConversation(connectionId, conversationId) {
    try {
      const data = this.storage.getItem(ACTIVE_CONVERSATION_KEY);
      const activeConversations = data ? JSON.parse(data) : {};
      activeConversations[connectionId] = conversationId;
      this.storage.setItem(ACTIVE_CONVERSATION_KEY, JSON.stringify(activeConversations));
      return true;
    } catch (error) {
      console.error('Failed to save active conversation:', error);
      return false;
    }
  }

  /**
   * Get active conversation for a connection
   */
  getActiveConversation(connectionId) {
    try {
      const data = this.storage.getItem(ACTIVE_CONVERSATION_KEY);
      if (!data) return null;
      const activeConversations = JSON.parse(data);
      return activeConversations[connectionId] || null;
    } catch (error) {
      console.error('Failed to get active conversation:', error);
      return null;
    }
  }

  /**
   * Delete conversation and its messages
   */
  async deleteConversation(conversationId) {
    const data = this._getData();
    
    // Remove conversation
    data.conversations = data.conversations.filter(c => c.id !== conversationId);
    
    // Remove messages
    data.messages = data.messages.filter(m => m.conversationId !== conversationId);
    
    this._saveData(data);
    return true;
  }

  /**
   * Clear all data
   */
  async clearAll() {
    try {
      this.storage.removeItem(STORAGE_KEY);
      return true;
    } catch (error) {
      console.error('Failed to clear chat history:', error);
      return false;
    }
  }
}

export default LocalStorageAdapter;
