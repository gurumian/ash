# Chat History Storage Design - Local-First with Remote Sync

## 설계 원칙

### 1. Local-First (로컬 우선)
- **로컬 저장소가 소스 오브 트루스**: 항상 로컬에서 먼저 읽고 씀
- **오프라인 동작**: 네트워크 없이도 완전히 동작
- **빠른 응답**: 로컬 저장소는 즉시 응답

### 2. 확장 가능한 아키텍처
- **Storage Adapter 패턴**: 다양한 저장소 구현체 교체 가능
- **동일한 인터페이스**: 로컬/원격 모두 동일한 API 사용
- **점진적 마이그레이션**: localStorage → SQLite → Remote Sync

### 3. 원격 동기화 준비
- **동기화 메타데이터**: `lastSyncedAt`, `syncId`, `version` 등
- **충돌 해결 전략**: Last-Write-Wins 또는 사용자 선택
- **증분 동기화**: 전체가 아닌 변경사항만 동기화

---

## 아키텍처 설계

### Storage Adapter 패턴

```
┌─────────────────────────────────────┐
│     ChatHistoryService (Interface)  │
│  - createConversation()              │
│  - saveMessage()                     │
│  - getConversationHistory()          │
│  - sync() [optional]                 │
└─────────────────────────────────────┘
              │
              ├─────────────────┬─────────────────┐
              │                 │                 │
┌─────────────▼─────┐ ┌─────────▼─────────┐ ┌────▼──────────────┐
│ LocalStorageAdapter│ │ SQLiteAdapter     │ │ RemoteSyncAdapter │
│ (초기 구현)        │ │ (나중에 필요시)   │ │ (원격 동기화)     │
└────────────────────┘ └───────────────────┘ └───────────────────┘
```

### 구현 단계

#### Phase 1: LocalStorage (초기 구현)
- 빠른 구현
- 기존 프로젝트 패턴과 일관성
- 충분한 용량 (일반적으로 5-10MB)

#### Phase 2: SQLite (필요시)
- 더 많은 데이터 저장
- 복잡한 쿼리 지원
- 성능 최적화

#### Phase 3: Remote Sync (선택적)
- 클라우드 동기화
- 여러 기기 간 동기화
- 백업 및 복원

---

## 데이터 구조

### LocalStorage 구조

```javascript
// Key: 'ash-chat-history'
{
  "conversations": [
    {
      "id": "conv-123",
      "title": "Chat with server-1",
      "connectionId": "conn-456",
      "createdAt": "2024-01-01T00:00:00Z",
      "updatedAt": "2024-01-01T01:00:00Z",
      "lastSyncedAt": null,  // 원격 동기화용
      "syncId": null,        // 원격 동기화용
      "version": 1           // 충돌 해결용
    }
  ],
  "messages": [
    {
      "id": "msg-789",
      "conversationId": "conv-123",
      "role": "user",
      "content": "Show me the disk usage",
      "timestamp": "2024-01-01T00:00:00Z",
      "toolResults": []     // Tool 실행 결과 (선택적)
    },
    {
      "id": "msg-790",
      "conversationId": "conv-123",
      "role": "assistant",
      "content": "I'll check the disk usage...",
      "timestamp": "2024-01-01T00:00:10Z",
      "toolResults": [
        {
          "name": "ash_ssh_execute",
          "success": true,
          "exitCode": 0,
          "stdout": "...",
          "stderr": ""
        }
      ]
    }
  ]
}
```

### SQLite 구조 (Phase 2)

```sql
CREATE TABLE conversations (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  connection_id TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  last_synced_at INTEGER,
  sync_id TEXT,
  version INTEGER DEFAULT 1
);

CREATE TABLE messages (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  timestamp INTEGER NOT NULL,
  tool_results TEXT,  -- JSON string
  FOREIGN KEY (conversation_id) REFERENCES conversations(id)
);

CREATE INDEX idx_messages_conversation ON messages(conversation_id);
CREATE INDEX idx_messages_timestamp ON messages(timestamp);
```

---

## ChatHistoryService 인터페이스

### 기본 메서드

```javascript
class ChatHistoryService {
  // 대화 생성
  async createConversation(title, connectionId = null) {
    // Returns: { id, title, connectionId, createdAt, ... }
  }
  
  // 메시지 저장
  async saveMessage(conversationId, role, content, toolResults = null) {
    // Returns: { id, conversationId, role, content, timestamp, ... }
  }
  
  // 대화 히스토리 불러오기
  async getConversationHistory(conversationId, limit = 50) {
    // Returns: [{ role, content, timestamp, ... }, ...]
  }
  
  // 대화 목록 조회
  async listConversations(connectionId = null) {
    // Returns: [{ id, title, connectionId, updatedAt, ... }, ...]
  }
  
  // 대화 삭제
  async deleteConversation(conversationId) {
    // Returns: { success: true }
  }
  
  // 대화 제목 업데이트
  async updateConversationTitle(conversationId, title) {
    // Returns: { success: true }
  }
}
```

### 동기화 메서드 (Phase 3)

```javascript
class ChatHistoryService {
  // 원격 동기화 (선택적)
  async sync() {
    // Returns: { synced: true, conflicts: [] }
  }
  
  // 동기화 상태 확인
  async getSyncStatus() {
    // Returns: { lastSyncedAt, pendingChanges, ... }
  }
  
  // 충돌 해결
  async resolveConflict(conversationId, resolution) {
    // resolution: 'local' | 'remote' | 'merge'
  }
}
```

---

## LocalStorageAdapter 구현

### 초기 구현 (Phase 1)

```javascript
// src/services/chatHistory/localStorageAdapter.js

class LocalStorageAdapter {
  constructor() {
    this.storageKey = 'ash-chat-history';
    this.data = this.loadFromStorage();
  }
  
  loadFromStorage() {
    try {
      const stored = localStorage.getItem(this.storageKey);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (e) {
      console.error('Failed to load chat history:', e);
    }
    return { conversations: [], messages: [] };
  }
  
  saveToStorage() {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(this.data));
    } catch (e) {
      console.error('Failed to save chat history:', e);
      // Handle quota exceeded error
      if (e.name === 'QuotaExceededError') {
        this.handleQuotaExceeded();
      }
    }
  }
  
  handleQuotaExceeded() {
    // 전략: 오래된 대화 삭제 또는 SQLite로 마이그레이션 제안
    const conversations = this.data.conversations.sort((a, b) => 
      new Date(b.updatedAt) - new Date(a.updatedAt)
    );
    // 최근 50개 대화만 유지
    const keepIds = new Set(conversations.slice(0, 50).map(c => c.id));
    this.data.conversations = this.data.conversations.filter(c => keepIds.has(c.id));
    this.data.messages = this.data.messages.filter(m => keepIds.has(m.conversationId));
    this.saveToStorage();
  }
  
  async createConversation(title, connectionId = null) {
    const conversation = {
      id: `conv-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      title: title || 'New Chat',
      connectionId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      lastSyncedAt: null,
      syncId: null,
      version: 1
    };
    
    this.data.conversations.push(conversation);
    this.saveToStorage();
    return conversation;
  }
  
  async saveMessage(conversationId, role, content, toolResults = null) {
    const message = {
      id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      conversationId,
      role,
      content,
      timestamp: new Date().toISOString(),
      toolResults: toolResults || []
    };
    
    this.data.messages.push(message);
    
    // Update conversation's updatedAt
    const conversation = this.data.conversations.find(c => c.id === conversationId);
    if (conversation) {
      conversation.updatedAt = new Date().toISOString();
      conversation.version += 1;
    }
    
    this.saveToStorage();
    return message;
  }
  
  async getConversationHistory(conversationId, limit = 50) {
    const messages = this.data.messages
      .filter(m => m.conversationId === conversationId)
      .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))
      .slice(-limit)
      .map(m => ({
        role: m.role,
        content: m.content,
        timestamp: m.timestamp,
        toolResults: m.toolResults
      }));
    
    return messages;
  }
  
  async listConversations(connectionId = null) {
    let conversations = this.data.conversations;
    
    if (connectionId) {
      conversations = conversations.filter(c => c.connectionId === connectionId);
    }
    
    return conversations
      .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
      .map(c => ({
        id: c.id,
        title: c.title,
        connectionId: c.connectionId,
        updatedAt: c.updatedAt,
        messageCount: this.data.messages.filter(m => m.conversationId === c.id).length
      }));
  }
  
  async deleteConversation(conversationId) {
    this.data.conversations = this.data.conversations.filter(c => c.id !== conversationId);
    this.data.messages = this.data.messages.filter(m => m.conversationId !== conversationId);
    this.saveToStorage();
    return { success: true };
  }
  
  async updateConversationTitle(conversationId, title) {
    const conversation = this.data.conversations.find(c => c.id === conversationId);
    if (conversation) {
      conversation.title = title;
      conversation.updatedAt = new Date().toISOString();
      conversation.version += 1;
      this.saveToStorage();
      return { success: true };
    }
    return { success: false, error: 'Conversation not found' };
  }
}

export default LocalStorageAdapter;
```

---

## ChatHistoryService 래퍼

```javascript
// src/services/chatHistory/index.js

import LocalStorageAdapter from './localStorageAdapter';
// import SQLiteAdapter from './sqliteAdapter';  // Phase 2
// import RemoteSyncAdapter from './remoteSyncAdapter';  // Phase 3

class ChatHistoryService {
  constructor() {
    // Phase 1: LocalStorage
    this.adapter = new LocalStorageAdapter();
    
    // Phase 2: SQLite로 자동 마이그레이션 (필요시)
    // this.migrateToSQLiteIfNeeded();
    
    // Phase 3: 원격 동기화 활성화 (설정에서)
    // if (settings.enableSync) {
    //   this.syncAdapter = new RemoteSyncAdapter();
    // }
  }
  
  // Delegate all methods to adapter
  async createConversation(title, connectionId) {
    return this.adapter.createConversation(title, connectionId);
  }
  
  async saveMessage(conversationId, role, content, toolResults) {
    return this.adapter.saveMessage(conversationId, role, content, toolResults);
  }
  
  async getConversationHistory(conversationId, limit) {
    return this.adapter.getConversationHistory(conversationId, limit);
  }
  
  async listConversations(connectionId) {
    return this.adapter.listConversations(connectionId);
  }
  
  async deleteConversation(conversationId) {
    return this.adapter.deleteConversation(conversationId);
  }
  
  async updateConversationTitle(conversationId, title) {
    return this.adapter.updateConversationTitle(conversationId, title);
  }
  
  // Phase 3: 동기화 메서드
  // async sync() {
  //   if (this.syncAdapter) {
  //     return this.syncAdapter.sync(this.adapter);
  //   }
  // }
}

// Singleton instance
const chatHistoryService = new ChatHistoryService();
export default chatHistoryService;
```

---

## 원격 동기화 설계 (Phase 3)

### 동기화 전략

1. **Last-Write-Wins (기본)**
   - 가장 최근 업데이트가 우선
   - `updatedAt` 타임스탬프 비교

2. **사용자 선택 (고급)**
   - 충돌 발생 시 사용자에게 선택권 제공
   - 로컬/원격/병합 중 선택

3. **증분 동기화**
   - `lastSyncedAt` 이후 변경사항만 동기화
   - 전체 데이터가 아닌 델타만 전송

### 동기화 메타데이터

```javascript
{
  "conversationId": "conv-123",
  "lastSyncedAt": "2024-01-01T01:00:00Z",
  "syncId": "sync-abc-123",  // 원격 서버의 고유 ID
  "version": 5,              // 충돌 감지용
  "pendingChanges": false    // 동기화 대기 중인 변경사항
}
```

### RemoteSyncAdapter 인터페이스

```javascript
class RemoteSyncAdapter {
  constructor(apiEndpoint, authToken) {
    this.apiEndpoint = apiEndpoint;
    this.authToken = authToken;
  }
  
  async sync(localAdapter) {
    // 1. 로컬 변경사항 가져오기
    const localChanges = await this.getLocalChanges(localAdapter);
    
    // 2. 원격 변경사항 가져오기
    const remoteChanges = await this.getRemoteChanges();
    
    // 3. 충돌 감지 및 해결
    const conflicts = this.detectConflicts(localChanges, remoteChanges);
    
    // 4. 동기화 실행
    await this.applyChanges(localAdapter, localChanges, remoteChanges, conflicts);
    
    return { synced: true, conflicts };
  }
  
  async getLocalChanges(localAdapter) {
    // lastSyncedAt 이후 변경사항만 반환
  }
  
  async getRemoteChanges() {
    // 원격 서버에서 변경사항 가져오기
  }
  
  detectConflicts(localChanges, remoteChanges) {
    // 같은 항목이 양쪽에서 수정되었는지 확인
  }
  
  async applyChanges(localAdapter, localChanges, remoteChanges, conflicts) {
    // 변경사항 적용
  }
}
```

---

## 통합 방법

### Electron IPC 통신

```javascript
// src/main/chat-history-handler.js

import { ipcMain } from 'electron';
import chatHistoryService from '../services/chatHistory';

export function initializeChatHistoryHandlers() {
  ipcMain.handle('chatHistory:createConversation', async (event, title, connectionId) => {
    return await chatHistoryService.createConversation(title, connectionId);
  });
  
  ipcMain.handle('chatHistory:saveMessage', async (event, conversationId, role, content, toolResults) => {
    return await chatHistoryService.saveMessage(conversationId, role, content, toolResults);
  });
  
  ipcMain.handle('chatHistory:getConversationHistory', async (event, conversationId, limit) => {
    return await chatHistoryService.getConversationHistory(conversationId, limit);
  });
  
  ipcMain.handle('chatHistory:listConversations', async (event, connectionId) => {
    return await chatHistoryService.listConversations(connectionId);
  });
  
  ipcMain.handle('chatHistory:deleteConversation', async (event, conversationId) => {
    return await chatHistoryService.deleteConversation(conversationId);
  });
  
  ipcMain.handle('chatHistory:updateConversationTitle', async (event, conversationId, title) => {
    return await chatHistoryService.updateConversationTitle(conversationId, title);
  });
}
```

### Preload API

```javascript
// src/preload.js

contextBridge.exposeInMainWorld('electronAPI', {
  chatHistory: {
    createConversation: (title, connectionId) => 
      ipcRenderer.invoke('chatHistory:createConversation', title, connectionId),
    
    saveMessage: (conversationId, role, content, toolResults) => 
      ipcRenderer.invoke('chatHistory:saveMessage', conversationId, role, content, toolResults),
    
    getConversationHistory: (conversationId, limit) => 
      ipcRenderer.invoke('chatHistory:getConversationHistory', conversationId, limit),
    
    listConversations: (connectionId) => 
      ipcRenderer.invoke('chatHistory:listConversations', connectionId),
    
    deleteConversation: (conversationId) => 
      ipcRenderer.invoke('chatHistory:deleteConversation', conversationId),
    
    updateConversationTitle: (conversationId, title) => 
      ipcRenderer.invoke('chatHistory:updateConversationTitle', conversationId, title)
  }
});
```

---

## 마이그레이션 전략

### localStorage → SQLite (Phase 2)

```javascript
async migrateToSQLiteIfNeeded() {
  // 1. localStorage 데이터 확인
  const localStorageData = this.localStorageAdapter.loadFromStorage();
  
  // 2. 데이터 크기 확인 (예: 1MB 이상)
  const dataSize = JSON.stringify(localStorageData).length;
  if (dataSize > 1024 * 1024) {
    // 3. SQLite로 마이그레이션
    const sqliteAdapter = new SQLiteAdapter();
    await sqliteAdapter.migrateFromLocalStorage(localStorageData);
    
    // 4. Adapter 교체
    this.adapter = sqliteAdapter;
    
    // 5. localStorage 백업 (선택적)
    localStorage.setItem('ash-chat-history-backup', JSON.stringify(localStorageData));
  }
}
```

---

## 장점 요약

### 1. 확장성
- ✅ localStorage로 시작 (빠른 구현)
- ✅ 필요시 SQLite로 마이그레이션
- ✅ 원격 동기화 추가 가능

### 2. 유연성
- ✅ Adapter 패턴으로 구현체 교체 용이
- ✅ 동일한 인터페이스로 일관된 API
- ✅ 점진적 개발 가능

### 3. 사용자 경험
- ✅ 로컬 우선으로 빠른 응답
- ✅ 오프라인 동작 가능
- ✅ 원격 동기화는 선택적

### 4. 미래 대비
- ✅ 동기화 메타데이터 포함
- ✅ 충돌 해결 전략 준비
- ✅ 증분 동기화 지원

---

## 구현 우선순위

1. **Phase 1 (즉시)**: LocalStorageAdapter 구현
2. **Phase 2 (필요시)**: SQLiteAdapter 구현
3. **Phase 3 (나중에)**: RemoteSyncAdapter 구현

---

## 참고사항

- 기존 프로젝트 패턴과 일관성 유지 (localStorage 사용)
- Electron의 `app.getPath('userData')` 활용 가능
- SQLite는 `better-sqlite3` 또는 `sql.js` 사용 고려
- 원격 동기화는 REST API 또는 WebSocket 고려

