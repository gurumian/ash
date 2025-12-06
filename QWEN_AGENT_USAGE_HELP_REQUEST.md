# Qwen-Agent 사용법 도움 요청

## 프로젝트 개요

**ash**는 Electron 기반의 터미널 클라이언트입니다. SSH와 Serial 연결을 지원하며, 사용자가 원격 서버나 시리얼 장치에 연결하여 명령을 실행할 수 있습니다.

우리는 **Qwen-Agent**를 통합하여 사용자가 자연어로 요청하면, AI가 자동으로:
1. 요청을 분석하고 계획을 수립
2. 필요한 명령을 SSH/Serial 연결을 통해 실행
3. 결과를 분석하고 다음 단계를 결정
4. 최종 결과를 사용자에게 제공

이런 **능동적인 문제 해결 Agent**를 구현하려고 합니다.

## 현재 구현 상태

### 1. 아키텍처
```
Electron App (Frontend)
  ↓ HTTP API
Python Backend (FastAPI)
  ↓ Qwen-Agent
Agent Tools (ash_ssh_execute, ash_list_connections)
  ↓ IPC Bridge
Electron Main Process
  ↓ SSH/Serial Connection
Remote Server / Serial Device
```

### 2. 구현된 컴포넌트

#### Backend (`backend/app.py`)
- FastAPI 서버 (포트 54111)
- Qwen-Agent `Assistant` 인스턴스 생성 및 관리
- `/agent/execute/stream` 엔드포인트: SSE 스트리밍 응답
- Conversation history 관리 시도

#### Agent Tools (`backend/agent_tools.py`)
- `ash_ssh_execute`: SSH 연결에서 명령 실행
- `ash_list_connections`: 활성 연결 목록 조회
- IPC Bridge를 통해 Electron과 통신

#### Frontend (`src/services/qwen-agent-service.js`)
- Backend와 SSE 스트리밍 통신
- Conversation history를 Map으로 관리 (connection별)
- Tool results 수집 및 표시

### 3. 현재 코드 구조

#### Backend에서 Qwen-Agent 사용
```python
from qwen_agent.agents import Assistant

# Assistant 생성
assistant = Assistant(
    llm=model_config,
    system_message=system_prompt,
    function_list=['ash_ssh_execute', 'ash_list_connections'],
)

# Task 실행
for response_chunk in assistant.run(messages=messages):
    for message in response_chunk:
        role = message.get('role')
        if role == 'assistant':
            # Assistant 응답 처리
        elif role == 'tool':
            # Tool result 처리
```

#### Agent Tool 구현
```python
@register_tool('ash_ssh_execute')
class SSHExecuteTool(BaseTool):
    def call(self, params: str, **kwargs) -> str:
        # IPC Bridge를 통해 SSH 명령 실행
        result = call_ash_ipc('ssh-exec-command', connection_id, command)
        return json.dumps(result)  # JSON string 반환
```

## 문제 상황

### 증상
1. **첫 요청부터 무한 루프 발생**
   - Qwen-Agent가 같은 tool(`ash_ssh_execute`)을 반복 호출
   - 예: `uname -a`, `free -h` 같은 명령을 계속 반복
   - Safety limit (5회)에 걸려서 에러 발생

2. **Conversation history가 작동하지 않음**
   - Frontend에서 `conversation_history`를 전달하지만
   - Backend에서 받지 못하거나, 받더라도 Qwen-Agent가 인식하지 못함
   - 로그에 "No conversation history provided" 경고 발생

### 실제 로그 분석

**요청 시작:**
```
INFO:app:Streaming task request: 메모리사용량을 조사해줘...
WARNING:app:No conversation history provided - agent will start fresh
INFO:app:Running assistant with 1 messages.
```

**무한 루프 패턴:**
```
INFO:app:Tool call request: ash_ssh_execute with args: {"connection_id": "...", "command": "uname -a"}
INFO:agent_tools:[ash_ssh_execute] Result: success=True, output length=133
INFO:app:Tool ash_ssh_execute result (role=function): {"success": true, "output": "Linux ..."}
INFO:app:Tool call request: ash_ssh_execute with args: {"connection_id": "...", "command": "uname -a"}  # ← 같은 명령 반복!
INFO:app:Tool ash_ssh_execute result (role=function): {"success": true, "output": "Linux ..."}
INFO:app:Tool call request: ash_ssh_execute with args: {"connection_id": "...", "command": "uname -a"}  # ← 또 반복!
... (수십 번 반복)
```

**관찰:**
- ✅ Tool result는 정상적으로 반환됨: `{"success": true, "output": "..."}`
- ✅ Tool result의 role은 `function`으로 표시됨
- ❌ 하지만 Qwen-Agent가 tool result를 받아도 같은 tool을 계속 호출함
- ❌ Conversation history가 전달되지 않음 (첫 요청이지만, 이전 실행 결과도 기억하지 못함)

### 예상 원인
1. **Qwen-Agent의 표준 사용법을 잘못 이해**
   - `assistant.run(messages=messages)`의 동작 방식
   - Tool result를 어떻게 처리해야 하는지
   - Conversation history를 어떻게 관리해야 하는지
   - **핵심 질문: Qwen-Agent가 tool result를 받았는데도 같은 tool을 반복 호출하는 이유는?**

2. **Tool result 형식이 올바르지 않을 수 있음**
   - 현재 반환 형식: `{"success": true, "output": "...", "error": "", "exitCode": 0}` (JSON string)
   - Qwen-Agent가 기대하는 형식과 다를 수 있음
   - **로그상으로는 tool result가 정상 반환되지만, Qwen-Agent가 이를 인식하지 못하는 것 같음**

3. **Conversation history 형식이 올바르지 않을 수 있음**
   - 현재 전달 형식: `[{"role": "user", "content": "..."}, {"role": "assistant", "content": "..."}, {"role": "tool", "name": "...", "content": "..."}]`
   - Qwen-Agent가 기대하는 형식과 다를 수 있음
   - **첫 요청에서도 conversation history가 전달되지 않음 (Frontend 문제일 수도 있음)**

4. **Qwen-Agent의 내부 동작 문제**
   - Tool result를 받았지만, 이를 conversation에 포함시키지 못함
   - 다음 iteration에서 tool result를 인식하지 못함
   - **같은 tool을 계속 호출하는 것은 Qwen-Agent가 tool result를 "처리되지 않은" 것으로 인식하는 것일 수 있음**

## 도움 요청 사항

### 1. Qwen-Agent의 올바른 사용법

**질문:**
- `Assistant.run(messages=messages)`를 호출할 때, Qwen-Agent는 내부적으로 어떻게 동작하나요?
- Tool call → Tool execution → Tool result → Assistant response의 흐름이 자동으로 처리되나요?
- 아니면 우리가 수동으로 tool을 호출하고 결과를 messages에 추가해야 하나요?

**예시 코드가 필요합니다:**
```python
# 올바른 사용법 예시를 알려주세요
assistant = Assistant(...)
messages = [...]
for response_chunk in assistant.run(messages=messages):
    # 여기서 무엇을 해야 하나요?
    # Tool result를 어떻게 처리해야 하나요?
    # Conversation history를 어떻게 업데이트해야 하나요?
```

### 2. Tool Result 형식

**질문:**
- Qwen-Agent가 기대하는 tool result의 정확한 형식은 무엇인가요?
- `BaseTool.call()` 메서드가 반환해야 하는 형식은?
- JSON string인가요? Dict인가요? 다른 형식인가요?

**현재 구현:**
```python
@register_tool('ash_ssh_execute')
class SSHExecuteTool(BaseTool):
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
- 아니면 Assistant 인스턴스가 내부적으로 history를 관리하나요?
- Tool result를 conversation history에 포함해야 하나요? 포함한다면 어떤 형식으로?

**현재 구현:**
```python
# 매번 전체 conversation history를 전달
messages = []
if request.conversation_history:
    messages.extend(request.conversation_history)
messages.append({"role": "user", "content": request.message})

for response_chunk in assistant.run(messages=messages):
    # Tool result를 collected_messages에 추가
    collected_messages.append(message)
```

### 4. 무한 루프 방지

**질문:**
- Qwen-Agent가 tool result를 받았는데도 같은 tool을 반복 호출하는 이유는?
- Tool result를 인식하지 못하는 것인가요?
- Conversation history에 tool result가 포함되지 않아서 그런가요?
- System prompt에서 이를 방지할 수 있나요?

**현재 System Prompt:**
```python
system_prompt = """
You are an intelligent terminal assistant...
- IMPORTANT: Before executing any command, review the conversation history.
- Avoid redundant command executions unless explicitly required.
- Detect OS only once per conversation.
"""
```

### 5. Best Practices

**질문:**
- Qwen-Agent를 사용한 멀티 스텝 작업 실행의 best practice는?
- Tool call이 실패했을 때 재시도 로직은 어떻게 처리하나요?
- Long-running tasks는 어떻게 처리하나요?
- Error handling은 어떻게 하나요?

## 목표

우리가 구현하려는 것:
1. **능동적인 문제 해결 Agent**
   - 사용자가 "서버 상태를 확인해줘"라고 하면
   - AI가 자동으로 `uname -a`, `free -h`, `df -h` 등을 실행
   - 결과를 분석하고 사용자에게 요약 제공

2. **Context-aware 대화**
   - 이전 대화를 기억하여 중복 명령 방지
   - OS 정보를 한 번만 감지하고 재사용
   - 연결 정보를 기억하여 매번 조회하지 않음

3. **Streaming 응답**
   - 실시간으로 AI의 생각과 실행 과정 표시
   - Tool execution 결과를 실시간으로 표시

## 참고 정보

- **Qwen-Agent 버전**: `qwen-agent>=0.0.31`
- **Python 버전**: 3.13
- **프레임워크**: FastAPI, Qwen-Agent
- **통신**: SSE (Server-Sent Events) for streaming

## 결론

Qwen-Agent의 올바른 사용법을 모르는 상태에서 구현을 시도하다 보니 무한 루프 문제가 발생했습니다. 

**핵심 질문:**
1. Qwen-Agent의 표준 사용 패턴은 무엇인가요?
2. Tool result를 올바르게 처리하는 방법은?
3. Conversation history를 올바르게 관리하는 방법은?
4. 무한 루프를 방지하는 방법은?

**도움을 요청합니다:**
- Qwen-Agent의 올바른 사용법 가이드
- Tool result 처리 예시 코드
- Conversation history 관리 예시 코드
- Best practices 및 주의사항

감사합니다!

