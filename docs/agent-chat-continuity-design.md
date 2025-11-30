# Agent Chat Continuity Design - log-chat 방식 적용

## 현재 상황 (ash)

### 현재 구조
- **탭 기반 관리**: `aiChatTabs` 배열로 탭 관리
- **메모리 기반**: 탭 데이터가 메모리에만 존재
- **대화 히스토리**: `conversationHistory`를 백엔드에 전달하지만, 영구 저장 없음
- **연결 ID 기반**: `connectionId`로 히스토리 키 생성

### 문제점
- 앱 재시작 시 대화 히스토리 손실
- 탭 간 대화가 독립적이지만, 같은 connection에서 이어지지 않음
- Agent 모드에서 이전 대화 컨텍스트가 유지되지 않음

## log-chat 방식

### 핵심 구조

1. **SQLite 데이터베이스**
   - `conversations` 테이블: 대화 세션 관리
   - `messages` 테이블: 각 대화의 메시지 저장
   - `conversation_id`로 대화 구분

2. **대화 히스토리 관리**
   ```javascript
   // 대화 생성
   const conversationId = await chatHistory.createConversation(title);
   
   // 메시지 저장
   await chatHistory.saveMessage(conversationId, 'user', userMessage);
   await chatHistory.saveMessage(conversationId, 'assistant', assistantMessage);
   
   // 대화 히스토리 불러오기
   const history = await chatHistory.getConversationHistory(conversationId);
   ```

3. **백엔드에 히스토리 전달**
   ```javascript
   const conversationHistory = chatMessages.map(msg => ({
     role: msg.role,
     content: msg.content
   }));
   
   await backend.chatStream(userMessage, context, conversationHistory, ...);
   ```

4. **스트리밍 중에도 저장**
   - 스트리밍이 완료되면 최종 메시지를 DB에 저장
   - 대화 컨텍스트가 유지됨

## ash에 적용할 설계

### 1. 데이터베이스 구조

**옵션 A: SQLite 사용 (log-chat과 동일)**
- Electron의 `app.getPath('userData')` 사용
- `chatHistory.js` 모듈 생성

**옵션 B: localStorage 사용 (간단)**
- 브라우저 localStorage 활용
- SQLite 설치 불필요

**권장: SQLite (옵션 A)**
- 더 안정적이고 확장 가능
- log-chat과 일관성 유지

### 2. 탭과 Conversation 연결

```javascript
// App.jsx
const [aiChatTabs, setAiChatTabs] = useState([]);
// 각 탭에 conversationId 추가
{
  id: 'tab-1',
  title: 'Chat 1',
  conversationId: 123, // SQLite conversation ID
  messages: [...],
  connectionId: 'conn-1'
}
```

### 3. 대화 히스토리 관리 흐름

```
1. 새 탭 생성
   → createConversation() → conversationId 생성
   → 탭에 conversationId 저장

2. 메시지 전송
   → 현재 탭의 conversationId 확인
   → 대화 히스토리 불러오기 (getConversationHistory)
   → 백엔드에 conversationHistory 전달
   → 스트리밍 응답 받기
   → 메시지 저장 (saveMessage)

3. 탭 전환
   → 해당 탭의 conversationId로 히스토리 불러오기
   → 메시지 표시

4. 앱 재시작
   → 모든 conversations 불러오기
   → 각 conversation의 최신 메시지로 탭 복원
```

### 4. 구현 단계

#### Step 1: chatHistory 모듈 생성
- `src/services/chatHistory.js` 생성
- log-chat의 `chatHistory.js` 기반으로 수정
- Electron IPC 통신 추가

#### Step 2: App.jsx 수정
- 탭에 `conversationId` 추가
- 새 탭 생성 시 `createConversation()` 호출
- 탭 전환 시 `getConversationHistory()` 호출
- 메시지 저장 로직 추가

#### Step 3: useAICommand.js 수정
- `conversationId`를 받아서 히스토리 불러오기
- 백엔드에 히스토리 전달
- 응답 완료 후 메시지 저장

#### Step 4: 백엔드 확인
- `conversation_history` 파라미터가 제대로 처리되는지 확인
- Qwen-Agent가 히스토리를 올바르게 사용하는지 확인

### 5. 코드 예시

#### chatHistory.js (Electron Main Process)
```javascript
// src/main.js 또는 별도 파일
import ChatHistory from './services/chatHistory';

const chatHistory = new ChatHistory();

// IPC 핸들러
ipcMain.handle('chatHistory:createConversation', async (event, title) => {
  const id = await chatHistory.createConversation(title);
  return { conversationId: id };
});

ipcMain.handle('chatHistory:saveMessage', async (event, conversationId, role, content) => {
  await chatHistory.saveMessage(conversationId, role, content);
  return { success: true };
});

ipcMain.handle('chatHistory:getConversationHistory', async (event, conversationId) => {
  const history = await chatHistory.getConversationHistory(conversationId);
  return { messages: history };
});
```

#### App.jsx 수정
```javascript
// 탭 생성 시
const createNewChatTab = async () => {
  const conversationId = await window.electronAPI.chatHistory.createConversation();
  const newTab = {
    id: `tab-${Date.now()}`,
    title: 'New Chat',
    conversationId,
    messages: [],
    connectionId: activeSessionId
  };
  setAiChatTabs(prev => [...prev, newTab]);
};

// 메시지 전송 시
const sendMessage = async (message, tabId) => {
  const tab = aiChatTabs.find(t => t.id === tabId);
  if (!tab.conversationId) {
    // 탭에 conversationId가 없으면 생성
    tab.conversationId = await window.electronAPI.chatHistory.createConversation();
  }
  
  // 히스토리 불러오기
  const history = await window.electronAPI.chatHistory.getConversationHistory(tab.conversationId);
  
  // 백엔드에 전달
  await qwenAgent.executeTask(message, connectionId, onChunk, llmSettings, null, null, {
    conversationHistory: history.map(msg => ({
      role: msg.role,
      content: msg.content
    }))
  });
  
  // 메시지 저장
  await window.electronAPI.chatHistory.saveMessage(tab.conversationId, 'user', message);
  await window.electronAPI.chatHistory.saveMessage(tab.conversationId, 'assistant', assistantResponse);
};
```

#### useAICommand.js 수정
```javascript
// conversationHistory를 받아서 백엔드에 전달
await qwenAgent.executeTask(
  naturalLanguage,
  connectionId,
  onChunk,
  llmSettings,
  onToolResult,
  onToolCall,
  {
    conversationHistory: conversationHistoryOverride || await loadConversationHistory(tabId)
  }
);
```

### 6. 고려사항

1. **Connection ID와 Conversation ID**
   - 같은 connection에서 여러 conversation 가능
   - 또는 connection별로 하나의 conversation만 유지

2. **메시지 저장 타이밍**
   - 스트리밍 중: 실시간 업데이트는 메모리만
   - 스트리밍 완료: 최종 메시지를 DB에 저장

3. **히스토리 크기 관리**
   - 너무 긴 히스토리는 토큰 제한 문제
   - 최근 N개 메시지만 전달 (예: 최근 50개)

4. **탭 복원**
   - 앱 재시작 시 모든 conversations 불러오기
   - 각 conversation의 최신 메시지로 탭 생성
   - 또는 사용자가 명시적으로 불러오기

### 7. 마이그레이션 전략

1. **기존 탭 데이터**
   - 기존 탭은 conversationId 없이 시작
   - 첫 메시지 전송 시 conversationId 생성

2. **하위 호환성**
   - conversationId가 없어도 동작 (기존 방식)
   - 점진적으로 migration

## 참고 파일

- `../log-chat/src/chatHistory.js`: SQLite 기반 대화 관리
- `../log-chat/src/App.jsx`: 대화 히스토리 사용 예시
- `src/App.jsx`: 현재 탭 관리 구조
- `src/hooks/useAICommand.js`: 메시지 전송 로직
- `src/services/qwen-agent-service.js`: 백엔드 통신

