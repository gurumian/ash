# Qwen-Agent 무한 루프 문제 해결 요청

## 프로젝트 개요

**ash** - Electron 기반 터미널 클라이언트에 **Qwen-Agent**를 통합하여 AI Agent 모드를 구현 중입니다.

### 목표
- 사용자가 자연어로 요청하면 AI가 SSH/Serial 연결을 통해 원격 서버에서 명령을 실행
- Multi-step task를 자동으로 계획하고 실행
- 예: "메모리 사용량 조사해줘" → AI가 `free -h`, `df -h` 등을 자동 실행하고 분석

## 현재 구현 상태

### ✅ 구현 완료
1. **Python Backend (FastAPI)**
   - `backend/app.py`: FastAPI 서버, Qwen-Agent 통합
   - `backend/agent_tools.py`: Custom tools (`ash_ssh_execute`, `ash_list_connections`)
   - SSE 스트리밍 응답

2. **IPC Bridge**
   - Electron main process에서 HTTP 서버 (포트 54112)
   - Python backend가 Electron의 SSH 기능을 호출할 수 있도록 연결

3. **Frontend**
   - `src/services/qwen-agent-service.js`: Backend와 통신
   - `src/components/AIChatSidebar.jsx`: AI 채팅 UI
   - Conversation history 관리 (Map 기반)

### ❌ 핵심 문제: 무한 루프

**증상:**
- Qwen-Agent가 같은 tool (`ash_ssh_execute`)을 같은 인자로 반복 호출
- 예: `uname -a`, `free -h` 같은 명령을 수십~수백 번 반복
- Safety limit에 걸려서 에러 발생

**로그 예시:**
```
INFO:app:Tool call request: ash_ssh_execute with args: {"connection_id": "...", "command": "uname -a"}
INFO:app:Tool ash_ssh_execute result (role=function): {"success": true, "output": "Linux ..."}
INFO:app:Tool call request: ash_ssh_execute with args: {"connection_id": "...", "command": "uname -a"}  # ← 반복!
INFO:app:Tool ash_ssh_execute result (role=function): {"success": true, "output": "Linux ..."}
INFO:app:Tool call request: ash_ssh_execute with args: {"connection_id": "...", "command": "uname -a"}  # ← 또 반복!
... (수십 번 반복)
```

## 현재 코드 구조

### Backend (`backend/app.py`)

```python
@app.post("/agent/execute/stream")
async def execute_task_stream(request: TaskRequest):
    messages = []
    if request.conversation_history:
        messages.extend(request.conversation_history)
    messages.append({"role": "user", "content": request.message})
    
    def generate():
        for response_chunk in assistant.run(messages=messages):
            # ❓ 여기서 messages.extend(response_chunk)를 해야 하나?
            for message in response_chunk:
                # Stream to client...
```

### Tool (`backend/agent_tools.py`)

```python
@register_tool('ash_ssh_execute')
class SSHExecuteTool(BaseTool):
    def call(self, params: str, **kwargs) -> str:
        data = json5.loads(params)
        connection_id = data.get('connection_id')
        command = data.get('command')
        
        result = call_ash_ipc('ssh-exec-command', connection_id, command)
        return json.dumps(result, ensure_ascii=False)  # {"success": true, "output": "...", "error": "", "exitCode": 0}
```

## 시도한 해결책

### 1. 정석 패턴 적용 시도
```python
for response_chunk in assistant.run(messages=messages):
    messages.extend(response_chunk)  # ✅ Tool result를 히스토리에 추가
    for message in response_chunk:
        ...
```
- **결과**: 여전히 무한 루프 발생

### 2. System Prompt 강화
- "DO NOT repeat commands that were already executed"
- "Check conversation history BEFORE executing commands"
- **결과**: 효과 없음

### 3. Safety Limit 추가
- 같은 tool이 같은 args로 3번 연속 호출되면 중단
- **결과**: 무한 루프는 막지만 근본 원인 해결 안 됨

## 핵심 질문

### 1. Qwen-Agent의 올바른 사용법

**질문:**
- `Assistant.run(messages=messages)`를 호출할 때, Qwen-Agent는 내부적으로 어떻게 동작하나요?
- Tool call → Tool execution → Tool result → Assistant response의 흐름이 자동으로 처리되나요?
- `messages.extend(batch)`를 해야 하나요? 아니면 Qwen-Agent가 내부적으로 관리하나요?

**정석 예시 코드가 필요합니다:**
```python
assistant = Assistant(llm=llm_cfg, system_message="...", function_list=['ash_ssh_execute'])
messages = []

# 사용자 요청 추가
messages.append({"role": "user", "content": "메모리 사용량 조사해줘"})

# ✅ 올바른 사용법은?
for batch in assistant.run(messages=messages):
    # 여기서 무엇을 해야 하나요?
    # messages.extend(batch)를 해야 하나요?
    # Tool result를 어떻게 처리해야 하나요?
    for message in batch:
        # ...
```

### 2. Tool Result 형식

**질문:**
- Qwen-Agent가 기대하는 tool result의 정확한 형식은 무엇인가요?
- `BaseTool.call()` 메서드가 반환해야 하는 형식은?
- JSON string인가요? Dict인가요? 다른 형식인가요?

**현재 구현:**
```python
def call(self, params: str, **kwargs) -> str:
    result = {
        "success": True,
        "output": "...",
        "error": "",
        "exitCode": 0
    }
    return json.dumps(result)  # JSON string 반환
```

### 3. Conversation History 관리

**질문:**
- Qwen-Agent가 conversation history를 어떻게 관리하나요?
- `assistant.run(messages=messages)`에 전달하는 `messages` 배열에 이전 대화를 모두 포함해야 하나요?
- Tool result를 conversation history에 포함해야 하나요? 포함한다면 어떤 형식으로?

**현재 구현:**
```python
# 매번 전체 conversation history를 전달
messages = []
if request.conversation_history:
    messages.extend(request.conversation_history)
messages.append({"role": "user", "content": request.message})
```

### 4. 무한 루프 원인

**질문:**
- Qwen-Agent가 tool result를 받았는데도 같은 tool을 반복 호출하는 이유는?
- Tool result format이 LLM이 이해하기 어려운가요?
- System prompt가 부족한가요?
- Qwen-Agent의 내부 동작 방식 문제인가요?

## 환경 정보

- **Qwen-Agent 버전**: `>=0.0.31`
- **LLM**: Qwen3:14b (Ollama)
- **Python**: 3.x
- **Framework**: FastAPI, Qwen-Agent

## 요청 사항

1. **올바른 Qwen-Agent 사용법 예시 코드** 제공
2. **Tool result format** 명확히 설명
3. **Conversation history 관리 방법** 설명
4. **무한 루프 원인 분석 및 해결책** 제시

## 참고 자료

- Qwen-Agent 공식 문서 (있다면)
- Qwen-Agent 사용 예시 코드
- Tool result format 스펙

---

**핵심 목표**: Qwen-Agent가 tool result를 받았을 때, 이를 인식하고 같은 tool을 반복 호출하지 않도록 하는 것.

