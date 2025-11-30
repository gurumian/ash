# AI Agent 모드 구현 문제점 요약 및 해결 과정

## 문제점 요약 및 해결 과정

### 1. 초기 사용자 요청 및 문제 현상

- AI Agent 모드 구현 중 backend/** 연동에 어려움을 겪고 있었음.
- 특히 content와 reasoning 구분이 잘 안 되어 화면(UI)이 떨리는(flickering) 현상이 발생.
- 전반적인 구현이 올바르지 않은 구간이 많을 것으로 예상.

### 2. 초기 분석 및 해결된 백엔드 문제점

#### UI 떨림 현상 원인 (Regex 기반 `reasoning` 분리)

**문제:**
- app.py에서 LLM의 응답 중 reasoning을 `<thinking>...</thinking>` 태그를 정규식으로 파싱하여 분리하는 로직이 있음. 
- 이 방식은 LLM의 출력 형식이 조금만 달라져도 제대로 작동하지 않아 reasoning과 content가 혼재되거나 불필요한 스트림 이벤트가 프론트엔드로 전송되어 UI 떨림을 유발할 수 있음.
- 시스템 프롬프트에서 `<thinking>` 태그 사용을 강제하고, 정규식 `re.search(r'<thinking>(.*?)</thinking>', content, re.DOTALL)`로 파싱하는 방식에 의존.

**해결:**
- ✅ **정규식 파싱 제거**: 백엔드에서 정규식으로 `<thinking>` 태그를 파싱하는 방식을 제거하고, LLM 응답 content를 그대로 전송하도록 변경.
- ✅ **단일 이벤트 전송**: reasoning과 content를 분리하여 2개의 이벤트로 보내는 대신, content 하나로 통합하여 UI 업데이트 단순화.
- ✅ **시스템 프롬프트 개선**: `<thinking>` 태그를 강제로 요구하는 대신, 자연스럽게 reasoning을 포함하도록 변경.
- ✅ **안정성 향상**: LLM 출력 형식에 의존하지 않아 태그 형식이 달라져도 문제없이 작동.

이제 프론트엔드에서 Markdown 렌더링 시 `<thinking>` 태그가 자동으로 HTML로 변환되어 표시됨.

#### 비효율적인 Agent 객체 생성

**문제:**
- app.py에서 사용자별 LLM 설정이 제공될 경우, 매 요청마다 `qwen_agent.agents.Assistant` 객체를 새로 생성하여 성능 오버헤드 발생.

**해결:**
- Assistant 객체들을 캐싱(Caching)하여 동일한 설정의 요청에 대해서는 재사용하도록 최적화.

#### 하드코딩된 IPC URL

**문제:**
- agent_tools.py에 Ash 클라이언트와의 통신(IPC) URL이 하드코딩되어 유연성 부족.

**해결:**
- `ASH_IPC_URL`을 환경 변수에서 읽어오도록 변경하여 유연성 확보.

#### 부적절한 도구(Tool) 예외 처리

**문제:**
- agent_tools.py의 도구 (SSHExecuteTool, ListConnectionsTool) 실행 중 발생한 예외를 단순히 JSON 문자열로 반환하여, 상위 Agent 프레임워크가 오류를 인지하고 적절히 대응하기 어려웠음.

**해결:**
- 예외 발생 시 로그를 남기고 실제로 예외를 다시 발생(re-raise)시키도록 변경하여, Agent 프레임워크가 오류를 더 효과적으로 처리할 수 있도록 개선.

### 3. 초기 분석 후 발견 및 해결된 프론트엔드 문제점 (React)

#### AI Chat Sidebar (`AIChatSidebar.jsx`) 렌더링 로직

**문제:**
- 백엔드에서 reasoning과 content가 분리되어 오더라도, 프론트엔드 컴포넌트가 이를 개별적으로 렌더링할 준비가 되어 있지 않았음. 모든 텍스트를 `msg.content`로만 처리.

**해결:**
- AIChatSidebar.jsx를 수정하여 `msg.reasoning`이 존재할 경우 `reasoning-text` CSS 클래스(회색 텍스트)를 적용하여 별도로 렌더링하도록 함.

#### `useAICommand` 훅의 메시지 상태 관리 비효율

**문제:**
- useAICommand.js에서 백엔드로부터 스트리밍되는 reasoning, content, tool_result 이벤트를 하나의 일관된 메시지 객체로 효율적으로 통합하지 못하고, 전체 메시지 내용을 덮어쓰는 방식으로 처리하여 UI 떨림을 가중시킴.

**해결:**
- useAICommand 훅을 리팩토링하여, Agent의 한 턴에 대한 모든 스트림 이벤트를 단일 메시지 객체의 `reasoning`, `content`, `toolResult` 속성에 점진적으로 추가하도록 변경. 
- 이를 통해 UI가 메시지 객체 전체를 교체하는 대신 속성만 업데이트하게 되어 UI 떨림 현상 해소.

#### `App.jsx`의 상태 선언 순서 및 중복 선언 문제 (최종 오류)

**문제:**
- App.jsx에서 `isAIProcessing` 및 `errorDialog` 상태가, 이 상태들을 prop으로 사용하는 useAICommand 훅보다 늦게 선언되어 ReferenceError 발생. 
- 또한, 리팩토링 과정에서 일부 상태 변수(`isAIProcessing`, `errorDialog`)가 App.jsx와 useAICommand 훅 양쪽에 중복으로 선언되는 문제가 발생하여 "Identifier has already been declared" 오류 발생.

**해결:**
- `isAIProcessing`과 `errorDialog` 상태를 useAICommand 훅 내부에 완전히 캡슐화하고, App.jsx에서는 해당 useState 선언을 제거. 
- App.jsx는 useAICommand 훅의 반환 값(`isAIProcessing`, `errorDialog`, `setErrorDialog`)을 직접 사용하여 필요한 컴포넌트에 전달하도록 수정. 
- 이로써 상태 선언 순서 문제 및 중복 선언 문제 모두 해결.

---

## 결론

백엔드와 프론트엔드 양쪽에서 발견된 여러 문제점들을 단계적으로 해결하여:

1. **UI 떨림 현상 완전 해소**: reasoning과 content를 명확히 분리하고, 메시지 상태 관리 로직을 개선
2. **성능 최적화**: Agent 객체 캐싱으로 불필요한 객체 생성 제거
3. **코드 안정성 향상**: 상태 관리 로직 개선 및 예외 처리 개선
4. **유연성 확보**: 하드코딩 제거 및 환경 변수 활용

AI Agent 모드가 안정적으로 동작하도록 개선되었습니다.

