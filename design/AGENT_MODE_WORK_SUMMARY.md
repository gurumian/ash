# Agent Mode 작업 내역 요약

## 개요
`ash-agent-ex` 프로젝트에서 agent-mode 구현을 위한 작업들이 진행되었으나 마무리되지 않았습니다. 
주요 작업 영역: Python Backend, Ask/Agent 모드, UI 컴포넌트, 대화 히스토리 관리

---

## 1. Python Backend 구현

### 1.1 Backend 서버 (`backend/app.py`)
- **FastAPI 기반 백엔드 서버** (포트 54111)
- **Qwen-Agent 통합**: `qwen_agent.agents.Assistant` 사용
- **스트리밍 응답**: Server-Sent Events (SSE)로 실시간 스트리밍
- **Agent 캐싱**: LLM 설정별로 Assistant 객체 캐싱하여 성능 최적화
- **시스템 프롬프트**: SSH/Serial 연결 기반 명령 실행 가이드
- **대화 히스토리 지원**: `conversation_history` 파라미터로 이전 대화 전달
- **LLM 설정 지원**: Ollama, OpenAI, Anthropic 등 다양한 LLM 프로바이더 지원

**주요 엔드포인트:**
- `GET /health`: 헬스 체크
- `POST /agent/execute/stream`: Agent 작업 실행 (스트리밍)

**주요 기능:**
- Reasoning과 Content를 분리하지 않고 통합 전송 (UI 떨림 현상 해결)
- Tool 결과를 구조화된 형태로 전송 (`tool_result` 타입)
- 환경 변수로 Qwen-Agent workspace 설정

### 1.2 Agent Tools (`backend/agent_tools.py`)
- **SSH Execute Tool** (`ash_ssh_execute`): SSH 연결에서 명령 실행
- **List Connections Tool** (`ash_list_connections`): 활성 연결 목록 조회
- **IPC Bridge 통신**: Electron IPC를 HTTP API로 브리징
- **환경 변수 설정**: `ASH_IPC_URL`, `ASH_IPC_HOST`, `ASH_IPC_PORT`로 IPC URL 설정

**주요 개선사항:**
- 하드코딩된 IPC URL을 환경 변수로 변경
- 예외 처리 개선 (예외를 다시 발생시켜 Agent 프레임워크가 처리)

---

## 2. 프론트엔드 서비스

### 2.1 Qwen-Agent Service (`src/services/qwen-agent-service.js`)
- **백엔드 통신**: FastAPI 백엔드와 SSE 스트리밍 통신
- **대화 히스토리 관리**: Connection ID별로 메모리에 히스토리 저장
- **스트리밍 처리**: Content, Tool Result, Tool Call 등 다양한 이벤트 타입 처리
- **Tool Result 구조화**: 백엔드에서 받은 구조화된 tool_result 처리

**주요 기능:**
- `executeTask()`: Agent 작업 실행 및 스트리밍 응답 처리
- `checkHealth()`: 백엔드 헬스 체크
- 대화 히스토리 자동 관리 (최근 50개 메시지 유지)

### 2.2 Agent Service (`src/services/agent-service.js`) - 미사용?
- ReAct 패턴 기반 Agent 구현 (직접 구현 방식)
- Qwen-Agent 대신 사용하려던 것으로 보이지만, 현재는 Qwen-Agent Service를 사용 중

---

## 3. UI 컴포넌트

### 3.1 AI Chat Sidebar (`src/components/AIChatSidebar.jsx`)
- **대화 UI**: 사용자/AI 메시지 표시
- **Markdown 렌더링**: `react-markdown`으로 AI 응답 렌더링
- **Function Result 표시**: 구조화된 tool 실행 결과 표시
- **모드 선택**: 'ask' vs 'agent' 모드 선택 드롭다운
- **실시간 스트리밍**: 스트리밍 중 메시지 업데이트

**주요 기능:**
- Markdown hydration 에러 방지 (code block unwrapping)
- Function result 파싱 및 표시
- 터미널 테마 스타일링

### 3.2 Agent Thought Overlay (`src/components/AgentThoughtOverlay.jsx`)
- **실시간 사고 과정 표시**: Agent가 생각하는 과정을 오버레이로 표시
- **Step 표시**: 현재 Step / 전체 Step 표시
- **미사용 상태**: 현재는 Qwen-Agent를 사용하므로 reasoning이 content에 포함되어 표시됨

### 3.3 Function Result (`src/components/FunctionResult.jsx`)
- **구조화된 결과 표시**: Tool 실행 결과를 깔끔하게 표시
- **성공/실패 상태**: ✓/✗ 아이콘과 색상 구분
- **Exit Code 배지**: 명령 실행 결과 코드 표시
- **stdout/stderr 분리**: 표준 출력과 에러 출력을 별도로 표시

---

## 4. Hooks 및 상태 관리

### 4.1 useAICommand Hook (`src/hooks/useAICommand.js`)
- **AI 명령 실행**: Ask 모드와 Agent 모드 모두 처리
- **Agent 모드**: Qwen-Agent Service를 사용하여 복잡한 작업 실행
- **Ask 모드**: LLM Service를 사용하여 단순 명령 생성
- **메시지 관리**: AI Chat Sidebar에 표시할 메시지 상태 관리

**주요 기능:**
- `executeAICommand()`: 자연어 명령 실행
- `aiMessages`: 대화 메시지 상태
- `clearAIMessages()`: 메시지 초기화

**문제점 (해결 필요):**
- 대화 히스토리 UI 표시 문제 (conversation-history-issue.md 참고)
- 메시지 상태 관리 복잡성

---

## 5. Backend 통합

### 5.1 Backend Handler (`src/main/backend-handler.js`)
- **Python 백엔드 프로세스 관리**: 백엔드 시작/중지
- **개발 모드**: `uv` 또는 `python`으로 백엔드 실행
- **프로덕션 모드**: PyInstaller 번들 (미구현)
- **포트 충돌 처리**: 기존 프로세스 종료 후 시작
- **헬스 체크**: 백엔드 준비 대기

**주요 함수:**
- `startBackend()`: 백엔드 프로세스 시작
- `stopBackend()`: 백엔드 프로세스 종료
- `getBackendUrl()`: 백엔드 URL 반환
- `isBackendRunning()`: 백엔드 실행 상태 확인

### 5.2 IPC Bridge Handler (`src/main/ipc-bridge-handler.js`)
- **HTTP API 서버**: Electron IPC를 HTTP로 노출 (포트 54112)
- **SSH 명령 실행**: `ssh-exec-command` 핸들러
- **연결 목록 조회**: `ssh-list-connections` 핸들러
- **CORS 지원**: Python 백엔드에서 접근 가능하도록 CORS 헤더 설정

**주요 기능:**
- `startIPCBridge()`: IPC Bridge 서버 시작
- `stopIPCBridge()`: IPC Bridge 서버 중지
- `callSSHExecute()`: SSH 연결에서 명령 실행

---

## 6. 유틸리티

### 6.1 Function Result Parser (`src/utils/parseFunctionResult.js`)
- **Content 파싱**: AI 응답 content에서 `[function]: {...}` 패턴 파싱
- **구조화된 데이터 변환**: JSON 문자열을 객체로 변환
- **Cleaned Content**: Function 패턴이 제거된 깨끗한 content 반환

---

## 7. 문서화

### 7.1 문제 분석 문서
- `docs/agent-mode-issues-summary.md`: Agent 모드 구현 문제점 및 해결 과정
- `docs/agent-chat-continuity-design.md`: 대화 연속성 설계 (log-chat 방식 적용)
- `docs/conversation-history-issue.md`: 대화 히스토리 UI 문제 분석
- `docs/function-result-structuring.md`: Function Result 구조화 및 렌더링 개선

### 7.2 기타 문서
- `docs/backend-packaging.md`: 백엔드 패키징 관련
- `docs/reasoning-parsing-comparison.md`: Reasoning 파싱 비교
- `docs/markdown-hydration-error-analysis.md`: Markdown hydration 에러 분석

---

## 8. 해결된 문제들

### 8.1 UI 떨림 현상
- **원인**: Reasoning과 Content를 정규식으로 분리하여 2개의 이벤트로 전송
- **해결**: Content 하나로 통합하여 전송, 프론트엔드에서 Markdown 렌더링 시 `<thinking>` 태그 처리

### 8.2 Agent 객체 생성 비효율
- **원인**: 매 요청마다 Assistant 객체 생성
- **해결**: LLM 설정별로 Assistant 객체 캐싱

### 8.3 Function Result 표시 문제
- **원인**: `[function]: {...}` 패턴이 content에 섞여 표시
- **해결**: 백엔드에서 구조화된 tool_result 전송, 프론트엔드에서 FunctionResult 컴포넌트로 표시

---

## 9. 미완성/해결 필요 사항

### 9.1 대화 히스토리 UI 문제 ⚠️
- **문제**: 새 메시지 입력 시 이전 대화가 화면에서 사라짐
- **원인**: `useAICommand.js`에서 기존 메시지를 포함하지 않고 새로 시작
- **상태**: 백엔드는 히스토리를 기억하지만, UI에 표시되지 않음
- **참고**: `docs/conversation-history-issue.md`

### 9.2 대화 영구 저장 미구현 ⚠️
- **현재**: 메모리에만 저장 (앱 재시작 시 손실)
- **계획**: SQLite 또는 localStorage로 영구 저장 (log-chat 방식 참고)
- **참고**: `docs/agent-chat-continuity-design.md`

### 9.3 프로덕션 백엔드 패키징 미구현 ⚠️
- **현재**: 개발 모드만 지원 (uv/python으로 실행)
- **필요**: PyInstaller로 번들링하여 프로덕션 배포
- **참고**: `docs/backend-packaging.md`

### 9.4 Agent Thought Overlay 미사용
- **현재**: Qwen-Agent를 사용하므로 reasoning이 content에 포함되어 별도 오버레이 불필요
- **상태**: 컴포넌트는 구현되어 있으나 사용되지 않음

---

## 10. 파일 구조

```
ash-agent-ex/
├── backend/
│   ├── app.py                    # FastAPI 백엔드 서버
│   ├── agent_tools.py            # Qwen-Agent Tools (SSH Execute, List Connections)
│   ├── requirements.txt          # Python 의존성
│   └── pyproject.toml            # Python 프로젝트 설정
│
├── src/
│   ├── services/
│   │   ├── qwen-agent-service.js    # Qwen-Agent 백엔드 통신 서비스
│   │   ├── agent-service.js          # ReAct 패턴 Agent (미사용?)
│   │   └── llm-service.js            # LLM 서비스 (Ask 모드용)
│   │
│   ├── components/
│   │   ├── AIChatSidebar.jsx         # AI 대화 사이드바
│   │   ├── AgentThoughtOverlay.jsx   # Agent 사고 과정 오버레이 (미사용)
│   │   └── FunctionResult.jsx        # Tool 실행 결과 표시
│   │
│   ├── hooks/
│   │   └── useAICommand.js           # AI 명령 실행 훅
│   │
│   ├── main/
│   │   ├── backend-handler.js        # Python 백엔드 프로세스 관리
│   │   └── ipc-bridge-handler.js     # IPC Bridge HTTP 서버
│   │
│   └── utils/
│       └── parseFunctionResult.js    # Function Result 파서
│
└── docs/
    ├── agent-mode-issues-summary.md
    ├── agent-chat-continuity-design.md
    ├── conversation-history-issue.md
    └── function-result-structuring.md
```

---

## 11. 다음 단계 (재개 시 우선순위)

### 우선순위 1: 대화 히스토리 UI 수정
- `useAICommand.js`에서 기존 메시지 유지하도록 수정
- 새 메시지를 기존 메시지 뒤에 추가

### 우선순위 2: 대화 영구 저장 구현
- SQLite 또는 localStorage로 대화 저장
- 앱 재시작 후 대화 복원

### 우선순위 3: 프로덕션 백엔드 패키징
- PyInstaller로 백엔드 번들링
- Electron 앱에 포함

### 우선순위 4: 코드 정리
- 미사용 컴포넌트 정리 (AgentThoughtOverlay, agent-service.js)
- 코드 주석 및 문서화

---

## 12. 참고 자료

- **Qwen-Agent**: https://github.com/QwenLM/Qwen-Agent
- **FastAPI**: https://fastapi.tiangolo.com/
- **log-chat**: 대화 히스토리 관리 참고 프로젝트

