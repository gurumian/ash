# Agent Mode 무한 루프 문제 정리

## 현재 상황

### 구현된 기능
- ✅ Python Backend (FastAPI) - Qwen-Agent 통합
- ✅ Agent Tools (`ash_ssh_execute`, `ash_list_connections`)
- ✅ IPC Bridge (Electron ↔ Python 통신)
- ✅ Frontend Service (`QwenAgentService`)
- ✅ Streaming 응답 (SSE)
- ✅ Conversation History 관리 (Frontend에서 Map으로 저장)

### 문제점
**첫 요청부터 무한 루프 발생:**
- Qwen-Agent가 `ash_ssh_execute`를 반복 호출 (예: `uname -a`, `free -h` 같은 명령)
- Safety limit (MAX_TOOL_CALLS_PER_TOOL = 5)에 걸려서 에러 발생
- Conversation history가 전달되지 않거나, 전달되더라도 Qwen-Agent가 인식하지 못함

## 아키텍처

### 1. Frontend → Backend 요청 흐름
```
Frontend (QwenAgentService)
  ↓ conversation_history 전달
Backend (FastAPI /agent/execute/stream)
  ↓ messages 배열 구성
Qwen-Agent (assistant.run(messages=messages))
  ↓ tool call → tool result → assistant response
Backend (SSE 스트리밍)
  ↓ conversation_history 업데이트
Frontend (conversationHistory Map 업데이트)
```

### 2. 핵심 코드 위치
- **Backend**: `backend/app.py` - `execute_task_stream()` 함수
- **Frontend**: `src/services/qwen-agent-service.js` - `executeTask()` 메서드
- **Tool**: `backend/agent_tools.py` - `SSHExecuteTool`, `ListConnectionsTool`

### 3. Conversation History 형식
Qwen-Agent가 기대하는 형식:
```python
messages = [
    {"role": "user", "content": "..."},
    {"role": "assistant", "content": "..."},
    {"role": "tool", "name": "ash_ssh_execute", "content": '{"success": true, "output": "...", "error": "", "exitCode": 0}'},
    {"role": "assistant", "content": "..."},
    ...
]
```

## 핵심 질문

### 1. Qwen-Agent의 표준 동작 방식
- `assistant.run(messages=messages)` 호출 시:
  - Qwen-Agent가 내부적으로 tool call → tool result → assistant response를 자동 처리하는가?
  - 아니면 우리가 수동으로 tool을 호출하고 결과를 messages에 추가해야 하는가?

### 2. Conversation History 전달
- Frontend에서 `conversation_history`를 전달하는데, Backend에서 받지 못하는 이유는?
- 또는 받더라도 Qwen-Agent가 인식하지 못하는 이유는?

### 3. Tool Result 형식
- Qwen-Agent가 기대하는 tool result 형식이 정확히 무엇인가?
- 현재 우리가 반환하는 형식: `{"success": true, "output": "...", "error": "", "exitCode": 0}` (JSON string)
- 이것이 올바른 형식인가?

### 4. 무한 루프 원인
- Qwen-Agent가 tool result를 받았는데도 같은 tool을 반복 호출하는 이유는?
- Tool result를 인식하지 못하는가?
- Conversation history에 tool result가 포함되지 않는가?

## 목표

1. **무한 루프 해결**: Qwen-Agent가 tool result를 받으면 다음 단계로 진행하도록
2. **Conversation History 정상 동작**: 이전 대화를 기억하여 중복 명령 실행 방지
3. **표준 방식 준수**: Qwen-Agent의 표준 tool 처리 방식에 맞춰 구현

## 참고 자료

- Qwen-Agent 공식 문서 (필요시 확인)
- `ash-agent-ex` 프로젝트 (비교 참고용)
- 현재 코드베이스의 `backend/app.py`, `src/services/qwen-agent-service.js`

## 다음 단계

1. Qwen-Agent의 표준 tool 처리 방식 확인
2. `ash-agent-ex`에서 어떻게 구현했는지 확인
3. Tool result 형식이 올바른지 확인
4. Conversation history 전달이 제대로 되는지 확인


