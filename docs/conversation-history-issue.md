# 대화 히스토리 문제 분석

## 문제 상황

1. **대화 내용이 기억되지 않음**: 새로운 입력이 들어갈 때 이전 대화가 화면에서 사라짐
2. **스크롤 문제**: 이전 대화를 스크롤해서 볼 수 없음

## 현재 구현 분석

### 1. 백엔드 히스토리 (작동 중 ✅)

**qwen-agent-service.js:**
```javascript
// 메모리에 히스토리 저장 (라인 10-11)
this.conversationHistory = new Map();

// 히스토리 불러오기 (라인 28)
const conversationHistory = this.conversationHistory.get(historyKey) || [];

// 백엔드에 전달 (라인 33)
conversation_history: conversationHistory

// 히스토리 업데이트 (라인 199-214)
updatedHistory.push(...messages);
this.conversationHistory.set(historyKey, trimmedHistory);
```

✅ **백엔드는 대화 히스토리를 기억하고 있음**

### 2. UI 히스토리 (문제 ❌)

**useAICommand.js (라인 93):**
```javascript
// 새 요청마다 빈 배열로 시작!
const collectedMessages = [userMessage];
```

**문제점:**
- `collectedMessages`가 매번 새로 시작됨
- 기존 메시지(`aiMessages`)를 포함하지 않음
- 결과: UI에 이전 대화가 표시되지 않음

## 해결 방법

### 수정 전 (현재):
```javascript
const collectedMessages = [userMessage];  // 기존 메시지 없음!

// 업데이트할 때도 기존 메시지 포함 안 함
const updatedMessages = [...collectedMessages];
setAiMessages(updatedMessages);  // 기존 메시지 덮어씀!
```

### 수정 후 (제안):
```javascript
// 기존 메시지를 포함해서 시작
const collectedMessages = [...aiMessages, userMessage];

// 업데이트할 때도 기존 메시지 유지
const updatedMessages = [...aiMessages, ...collectedMessages];
setAiMessages(updatedMessages);  // 기존 메시지 + 새 메시지
```

## 비교: log-chat vs ash

### log-chat 방식
- ✅ DB에 영구 저장
- ✅ 대화 히스토리 로드
- ✅ 이전 대화 모두 표시
- ✅ 스크롤 가능

### ash 현재 방식
- ❌ 메모리만 저장 (앱 재시작 시 손실)
- ✅ 백엔드에는 히스토리 전달
- ❌ UI에 이전 대화 표시 안 함
- ❌ 새 입력 시 화면 리셋

## 수정 계획

1. **즉시 수정 (UI 문제 해결)**:
   - `useAICommand.js`에서 기존 메시지 유지
   - 새 메시지를 기존 메시지 뒤에 추가

2. **장기 개선 (영구 저장)**:
   - DB 또는 localStorage에 대화 저장
   - 앱 재시작 후에도 대화 복원

