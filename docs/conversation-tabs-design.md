# 대화 탭 관리 설계

## 목표
1. 각 연결(connection)별로 여러 대화(conversation)를 관리
2. 대화를 탭으로 표시하고 닫기 기능 제공
3. 앱 재시작 시 마지막 상태 복원

## 데이터 구조

### Conversation (대화)
```javascript
{
  id: "conv-123",
  title: "Chat 1",  // 자동 생성 또는 사용자 지정
  connectionId: "conn-456",  // 연결 ID
  createdAt: "2024-01-01T00:00:00Z",
  updatedAt: "2024-01-01T01:00:00Z",
  isActive: false  // 현재 활성 대화 여부 (선택적)
}
```

### Message (메시지)
```javascript
{
  id: "msg-789",
  conversationId: "conv-123",
  role: "user" | "assistant" | "tool",
  content: "...",
  timestamp: "2024-01-01T00:00:00Z",
  toolResults: [...]  // Tool 실행 결과
}
```

## 상태 관리

### useAICommand Hook
```javascript
{
  // 대화 목록 (현재 연결의 모든 대화)
  conversations: Conversation[],
  
  // 현재 활성 대화 ID
  activeConversationId: string | null,
  
  // 현재 대화의 메시지
  aiMessages: Message[],
  
  // 처리 중인 대화 ID (독립성 보장)
  processingConversationId: string | null,
  
  // 함수들
  switchConversation: (conversationId: string) => void,
  createNewConversation: () => Conversation,
  deleteConversation: (conversationId: string) => void,
  executeAICommand: (message: string, mode: 'ask' | 'agent') => void
}
```

## UI 구조

### AIChatSidebar
```
┌─────────────────────────────────────┐
│ [Tab1] [Tab2] [Tab3] [+ New Chat]  │  ← 탭 바
├─────────────────────────────────────┤
│                                     │
│  메시지 영역                          │
│  - User messages                    │
│  - Assistant messages               │
│  - Tool results                     │
│                                     │
├─────────────────────────────────────┤
│ [Ask/Agent] [Input...] [Send]      │  ← 입력 영역
└─────────────────────────────────────┘
```

### 탭 구조
- 각 탭: 제목 + 닫기 버튼 (×)
- 활성 탭: 하이라이트
- 탭 클릭: 해당 대화로 전환
- 닫기 클릭: 대화 삭제 (확인 다이얼로그)

## 동작 흐름

### 1. 대화 생성
```
사용자 입력 → executeAICommand
  → 현재 conversationId 확인
  → 없으면 새 대화 생성
  → 메시지 저장
  → 대화 목록 갱신
```

### 2. 대화 전환
```
탭 클릭 → switchConversation(conversationId)
  → 해당 대화의 메시지 로드
  → activeConversationId 업데이트
  → UI 업데이트
```

### 3. 대화 삭제
```
닫기 버튼 클릭 → deleteConversation(conversationId)
  → 확인 다이얼로그
  → 대화 및 메시지 삭제
  → 다른 대화로 전환 (또는 새 대화 생성)
  → 대화 목록 갱신
```

### 4. 상태 복원
```
앱 시작 → activeSessionId 확인
  → 해당 연결의 대화 목록 로드
  → 마지막 활성 대화 복원 (또는 최신 대화)
  → 메시지 로드
```

## 독립성 보장

### 처리 상태 분리
- `processingConversationId`: 현재 처리 중인 대화 ID
- `isProcessing`: `processingConversationId === activeConversationId`일 때만 true
- "AI is thinking"은 활성 대화에서만 표시

### 메시지 분리
- 각 대화는 독립적인 메시지 배열
- 대화 전환 시 해당 대화의 메시지만 표시

## 구현 단계

### Phase 1: 기본 구조
1. `useAICommand`에 conversations 목록 추가
2. `listConversations` API 사용
3. 탭 UI 추가 (닫기 버튼 포함)

### Phase 2: 대화 관리
1. `switchConversation` 구현
2. `createNewConversation` 구현
3. `deleteConversation` 구현

### Phase 3: 상태 복원
1. 마지막 활성 대화 저장 (localStorage)
2. 앱 시작 시 복원 로직

### Phase 4: 독립성 보장
1. `processingConversationId` 추가
2. 처리 상태 분리
3. UI 업데이트

## API 확장

### ChatHistoryService
```javascript
// 이미 구현됨
listConversations(connectionId)  // 연결별 대화 목록
createConversation(title, connectionId)  // 새 대화 생성
deleteConversation(conversationId)  // 대화 삭제
getConversationHistory(conversationId)  // 대화 메시지 로드
```

### 추가 필요
```javascript
// 마지막 활성 대화 저장/로드
saveActiveConversation(connectionId, conversationId)
getActiveConversation(connectionId)  // 마지막 활성 대화 ID 반환
```

## 주의사항

1. **대화 제목 자동 생성**
   - 첫 메시지의 일부를 제목으로 사용
   - 또는 "Chat 1", "Chat 2" 형식

2. **빈 대화 처리**
   - 메시지가 없는 대화는 자동 삭제할지 결정
   - 또는 "New Chat"으로 표시

3. **성능**
   - 대화 목록이 많을 경우 가상화 고려
   - 메시지 로드는 필요할 때만

4. **동시성**
   - 여러 탭에서 동시에 처리 중일 수 있음
   - 각 탭의 처리 상태를 독립적으로 관리

