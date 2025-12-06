# 디버깅 로그 가이드

## 추가된 로그

전체 흐름을 추적할 수 있도록 상세한 로그를 추가했습니다. 브라우저 개발자 도구 콘솔에서 다음과 같은 로그를 확인할 수 있습니다:

### 1. QwenAgentService 로그

- `[QwenAgentService] 📤 Sending request to backend...` - Backend로 요청 전송
- `[QwenAgentService] 📥 Received response from backend:` - Backend 응답 수신
- `[QwenAgentService] Starting SSE stream connection...` - SSE 스트림 연결 시작
- `[QwenAgentService] Reading SSE stream...` - SSE 스트림 읽기 시작
- `[QwenAgentService] Event #N - Type: ...` - 각 SSE 이벤트 수신
- `[QwenAgentService] ⚙️ Tool call received:` - Tool call 이벤트 수신
- `[QwenAgentService] 📊 Tool result received:` - Tool result 이벤트 수신
- `[QwenAgentService] 📝 Content chunk received:` - Content chunk 이벤트 수신

### 2. useAICommand 로그

- `[useAICommand] 🚀 Starting agent execution` - Agent 실행 시작
- `[useAICommand] 📡 Calling qwenAgent.executeTask...` - executeTask 호출
- `[useAICommand] 🔧 Tool call callback triggered:` - Tool call 콜백 실행
- `[useAICommand] 📊 Tool result callback triggered:` - Tool result 콜백 실행
- `[useAICommand] 📝 Content chunk received:` - Content chunk 수신
- `[useAICommand] ✅ Agent execution completed` - Agent 실행 완료

## 문제 진단

### 로그가 전혀 안 나오는 경우

1. **요청이 전송되지 않음**
   - `[QwenAgentService] 📤 Sending request to backend...` 로그가 없으면
   - `executeAICommand` 함수가 호출되지 않았거나
   - Backend URL이 잘못되었을 수 있음

2. **SSE 스트림이 연결되지 않음**
   - `[QwenAgentService] Starting SSE stream connection...` 로그가 없으면
   - Backend 응답이 오지 않거나
   - SSE 연결이 실패했을 수 있음

### Tool call/result가 표시되지 않는 경우

1. **Tool call이 수신되지 않음**
   - `[QwenAgentService] ⚙️ Tool call received:` 로그 확인
   - 없으면 Backend에서 tool call 이벤트를 전송하지 않음

2. **Tool call 콜백이 실행되지 않음**
   - `[useAICommand] 🔧 Tool call callback triggered:` 로그 확인
   - 없으면 `onToolCall` 콜백이 전달되지 않았거나 실행되지 않음

3. **State 업데이트가 안 됨**
   - `[useAICommand] 📢 Setting streamingToolCall:` 로그 확인
   - `setStreamingToolCall`이 호출되었는지 확인

## 다음 단계

1. 브라우저 개발자 도구 콘솔 열기 (F12)
2. Agent 모드로 질문 실행
3. 로그를 확인하여 어디서 문제가 발생하는지 파악
4. 로그를 공유하면 더 정확한 진단 가능

