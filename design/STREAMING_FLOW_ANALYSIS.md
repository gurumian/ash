# Tool Call/Result 스트리밍 흐름 분석

## 전체 흐름

```
1. Backend (app.py)
   └─> Tool call 감지 → SSE 이벤트 전송 ('tool_call')
   └─> Tool 실행 → Tool result 생성
   └─> Tool result → SSE 이벤트 전송 ('tool_result')
   └─> Content chunk → SSE 이벤트 전송 ('content_chunk')

2. Frontend (qwen-agent-service.js)
   └─> SSE 스트림 읽기
   └─> 이벤트 파싱 (JSON.parse)
   └─> 이벤트 타입별 처리
       ├─> 'tool_call' → onToolCall 콜백 호출
       ├─> 'tool_result' → onToolResult 콜백 호출
       └─> 'content_chunk' → onContentChunk 콜백 호출

3. Frontend (useAICommand.js)
   └─> Tool call 콜백
       ├─> Command 추출
       ├─> setStreamingToolCall() 호출
       └─> Assistant message 생성 (없으면)
   └─> Tool result 콜백
       ├─> Tool result 파싱 (STDOUT/STDERR)
       ├─> setStreamingToolResult() 호출
       └─> Assistant message에 tool result 추가

4. Frontend (AIChatSidebar.jsx)
   └─> isProcessing && streamingToolCall → Tool call UI 표시
   └─> isProcessing && streamingToolResult → Tool result UI 표시
   └─> messages → Assistant message UI 표시
```

## 문제 진단 체크리스트

### 1단계: Backend에서 SSE 전송 확인
- [ ] Backend 로그에서 "Executing tool" 메시지 확인
- [ ] Backend 로그에서 "Tool ... result" 메시지 확인
- [ ] Backend 로그에서 SSE yield 확인

### 2단계: Frontend에서 SSE 수신 확인
- [ ] 콘솔에서 `[QwenAgentService] 📤 Sending request to backend...` 확인
- [ ] 콘솔에서 `[QwenAgentService] 📥 Received response from backend:` 확인
- [ ] 콘솔에서 `[QwenAgentService] Starting SSE stream connection...` 확인
- [ ] 콘솔에서 `[QwenAgentService] Reading SSE stream...` 확인

### 3단계: 이벤트 파싱 확인
- [ ] 콘솔에서 `[QwenAgentService] Event #N - Type: tool_call` 확인
- [ ] 콘솔에서 `[QwenAgentService] Event #N - Type: tool_result` 확인
- [ ] 콘솔에서 `[QwenAgentService] Event #N - Type: content_chunk` 확인

### 4단계: 콜백 실행 확인
- [ ] 콘솔에서 `[useAICommand] 🔧 Tool call callback triggered:` 확인
- [ ] 콘솔에서 `[useAICommand] 📊 Tool result callback triggered:` 확인
- [ ] 콘솔에서 `[useAICommand] 📝 Content chunk received:` 확인

### 5단계: State 업데이트 확인
- [ ] 콘솔에서 `[useAICommand] 📢 Setting streamingToolCall:` 확인
- [ ] 콘솔에서 `[useAICommand] 📺 Setting streamingToolResult:` 확인
- [ ] 콘솔에서 `[useAICommand] 🔄 Creating/updating assistant message` 확인

### 6단계: UI 렌더링 확인
- [ ] 화면에서 "AI is thinking..." 표시 확인
- [ ] 화면에서 "Executing command: ..." 표시 확인
- [ ] 화면에서 Tool result 표시 확인

## 예상 문제점

1. **SSE 이벤트가 Frontend로 전달되지 않음**
   - Backend에서 yield는 하지만 네트워크 문제로 전달 안 됨
   - CORS 문제

2. **이벤트 파싱 실패**
   - JSON 형식이 맞지 않음
   - Buffer 처리 문제

3. **콜백이 호출되지 않음**
   - Callback이 전달되지 않음
   - Callback 함수가 undefined

4. **State 업데이트 실패**
   - setStreamingToolCall/setStreamingToolResult가 호출되지 않음
   - State가 업데이트되지만 UI가 반영되지 않음

5. **UI 렌더링 실패**
   - isProcessing이 false로 설정됨
   - streamingToolCall/streamingToolResult가 null

## 해결 방법

각 단계마다 로그를 추가했으므로, 콘솔에서 어느 단계에서 문제가 발생하는지 확인할 수 있습니다.

