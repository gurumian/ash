# [function]: {...} 패턴 필터링 문제 분석

## 문제 상황

AI 응답에서 `[function]: {...}` 형태의 JSON 패턴이 계속 나타나며, 각 문자마다 반복되어 출력됩니다.

### 증상

```
[function]: {"success": true, "output": "total        used        free...", "error": "", "exitCode": 0}
 total
[function]: {"success": true, "output": "total        used        free...", "error": "", "exitCode": 0}
        used
[function]: {"success": true, "output": "total        used        free...", "error": "", "exitCode": 0}
        free
...
```

- 각 문자/단어마다 동일한 `[function]: {...}` 패턴이 반복됨
- 사용자에게는 불필요한 내부 JSON 형식이 노출됨
- 스트리밍 중에 패턴이 계속 나타남

## 현재 아키텍처

### 데이터 흐름

1. **Qwen-Agent (Backend)** → Tool 결과를 JSON으로 반환
2. **Backend (`app.py`)** → SSE로 스트리밍 (`content`, `reasoning`, `tool_result`)
3. **Frontend (`qwen-agent-service.js`)** → 델타 추출 및 필터링
4. **Frontend (`useAICommand.js`)** → 메시지 업데이트
5. **Frontend (`AIChatSidebar.jsx`)** → ReactMarkdown으로 렌더링

### 스트리밍 방식

- Backend가 매번 **전체 누적된 content**를 보냄
- Frontend에서 **이전 길이와 비교하여 델타 추출**
- 델타만 사용자에게 표시

## 시도한 해결 방법들

### 1. 프롬프트 강화

**위치**: `backend/app.py` - `build_system_prompt()`

**시도 내용**:
```python
"RESPONSE FORMAT (CRITICAL):\n"
"- ABSOLUTELY NEVER include [function]: {...} patterns in your response\n"
"- ABSOLUTELY NEVER include raw JSON like {\"success\": true, \"output\": \"...\"} in your response\n"
"- When you receive tool results, extract ONLY the 'output' field value\n"
"- Format the 'output' as readable text using Markdown code blocks or inline code\n"
"- If you see [function]: {...} in your thinking, remove it completely before responding\n"
```

**결과**: ❌ LLM이 여전히 패턴을 포함함

### 2. 백엔드 필터링 (스트리밍 전)

**위치**: `backend/app.py` - `generate()` 함수

**시도 내용**:
```python
# Filter out [function]: {...} patterns BEFORE calculating delta
import re
display_content = re.sub(r'\[function\]:\s*\{[^}]*"success"[^}]*\}', '', display_content)
display_content = re.sub(r'\[function\]:\s*\{[^}]+\}', '', display_content)
display_content = re.sub(r'\{"success":\s*(?:true|false)[^}]+\}', '', display_content)
display_content = re.sub(r'\n\s*\n\s*\n+', '\n\n', display_content).strip()
```

**결과**: ❌ 여전히 패턴이 나타남 (필터링이 제대로 작동하지 않음)

### 3. 프론트엔드 필터링 (델타 추출 후)

**위치**: `src/services/qwen-agent-service.js`

**시도 내용**:
```javascript
// Filter from full content
currentContent = currentContent.replace(/\[function\]:\s*\{[^}]*"success"[^}]*\}/g, '');
currentContent = currentContent.replace(/\[function\]:\s*\{[^}]+\}/g, '');
currentContent = currentContent.replace(/\{"success":\s*(?:true|false)[^}]+\}/g, '');

// Also filter delta directly
delta = delta.replace(/\[function\]:\s*\{[^}]*"success"[^}]*\}/g, '');
delta = delta.replace(/\[function\]:\s*\{[^}]+\}/g, '');
delta = delta.replace(/\{"success":\s*(?:true|false)[^}]+\}/g, '');
```

**결과**: ❌ 여전히 패턴이 나타남

### 4. 정규식 패턴 개선 시도

**다양한 패턴 시도**:
- `\[function\]:\s*\{[^}]*"success"[^}]*\}`
- `\[function\]:\s*\{[^}]+\}`
- `\{"success":\s*(?:true|false)[^}]+\}`
- 멀티라인 매칭 (`/s` 플래그)

**결과**: ❌ 여전히 작동하지 않음

## 근본 원인 분석

### 가능한 원인들

1. **LLM이 스트리밍 중에 패턴을 계속 생성**
   - 프롬프트로는 막을 수 없음
   - LLM이 내부적으로 tool 결과를 이 형식으로 표현하려고 함

2. **필터링 타이밍 문제**
   - 델타가 매우 작은 단위(한 글자씩)로 오는 경우
   - 패턴이 여러 델타에 걸쳐 있을 때 필터링이 실패
   - 예: 첫 델타에 `[function]: {`, 두 번째에 `"success"`, 세 번째에 `: true...}`

3. **정규식이 패턴을 제대로 매칭하지 못함**
   - 실제 패턴이 예상과 다를 수 있음
   - 특수 문자 이스케이프 문제
   - 멀티라인 문제

4. **Qwen-Agent의 내부 동작**
   - Qwen-Agent가 tool 결과를 특정 형식으로 변환
   - 이 변환 과정에서 `[function]: {...}` 형식이 생성됨
   - Backend/Frontend에서 이를 제어하기 어려움

## 현재 코드 상태

### Backend (`backend/app.py`)

```python
# Line 340-350: display_content 필터링
if display_content:
    # Filter out [function]: {...} patterns BEFORE calculating delta
    import re
    display_content = re.sub(r'\[function\]:\s*\{[^}]*"success"[^}]*\}', '', display_content)
    display_content = re.sub(r'\[function\]:\s*\{[^}]+\}', '', display_content)
    display_content = re.sub(r'\{"success":\s*(?:true|false)[^}]+\}', '', display_content)
    display_content = re.sub(r'\n\s*\n\s*\n+', '\n\n', display_content).strip()
    
    # ... delta 계산 및 스트리밍
```

### Frontend (`src/services/qwen-agent-service.js`)

```javascript
// Line 87-135: content 필터링
if (data.type === 'content' && data.content) {
    let delta = data.delta;
    let currentContent = data.content;
    
    // ... delta 추출 로직
    
    // Filter from full content
    const functionPattern = /\[function\]:\s*\{[^}]*"success"[^}]*\}/g;
    const functionPattern2 = /\[function\]:\s*\{[^}]+\}/g;
    const jsonPattern = /\{"success":\s*(?:true|false)[^}]+\}/g;
    
    currentContent = currentContent.replace(functionPattern, '');
    currentContent = currentContent.replace(functionPattern2, '');
    currentContent = currentContent.replace(jsonPattern, '');
    
    // ... delta 재계산 및 표시
}
```

## 디버깅을 위한 정보

### 실제 패턴 예시

```
[function]: {"success": true, "output": "total        used        free      shared  buff/cache   available\nMem:            61Gi        11Gi       1.6Gi        62Mi        49Gi        50Gi\nSwap:          2.0Gi       1.0Mi       2.0Gi", "error": "", "exitCode": 0}
```

### 패턴 특징

- `[function]:` 로 시작
- JSON 객체 포함: `{"success": true, "output": "...", "error": "", "exitCode": 0}`
- `output` 필드에 실제 명령어 결과가 들어있음
- 멀티라인일 수 있음 (`\n` 포함)

### 스트리밍 동작

- Backend가 매번 전체 누적 content를 보냄
- Frontend가 이전 길이와 비교하여 델타 추출
- 델타가 매우 작을 수 있음 (한 글자씩)

## 가능한 해결 방법들

### 방법 1: Qwen-Agent 레벨에서 처리

Qwen-Agent의 tool 결과 처리 방식을 수정하여 `[function]: {...}` 형식을 생성하지 않도록 함.

**장점**: 근본 원인 해결
**단점**: Qwen-Agent 라이브러리 수정 필요, 복잡할 수 있음

### 방법 2: 더 강력한 정규식 + 버퍼링

작은 델타들을 버퍼에 모아서 패턴이 완성될 때까지 기다린 후 필터링.

```javascript
// 의사코드
let buffer = '';
buffer += delta;
if (buffer.includes('[function]:')) {
    // 패턴이 완성될 때까지 기다림
    // 완성되면 필터링하고 flush
}
```

**장점**: 델타가 작아도 패턴을 잡을 수 있음
**단점**: 지연 발생 가능, 복잡한 버퍼 관리 필요

### 방법 3: 백엔드에서 더 강력한 필터링

Qwen-Agent의 응답을 받은 직후, 스트리밍하기 전에 완전히 필터링.

**장점**: 프론트엔드로 전달되기 전에 제거
**단점**: 현재도 시도했지만 작동하지 않음

### 방법 4: LLM 모델 변경 또는 프롬프트 엔지니어링

다른 LLM 모델 사용 또는 프롬프트를 완전히 재작성.

**장점**: 근본 원인 해결 가능
**단점**: 모델 변경은 큰 변경, 프롬프트만으로는 한계가 있을 수 있음

### 방법 5: Post-processing 파이프라인

스트리밍이 완료된 후 최종 메시지에서 패턴 제거.

**장점**: 확실하게 제거 가능
**단점**: 스트리밍 중에는 여전히 보일 수 있음

## 권장 접근 방법

1. **먼저 디버깅**: 실제로 어떤 형식으로 패턴이 오는지 로그로 확인
   - Backend에서 `display_content` 로그
   - Frontend에서 `data.content`, `data.delta` 로그
   - 정규식이 매칭되는지 확인

2. **버퍼링 방식 시도**: 작은 델타들을 모아서 패턴 완성 대기

3. **Qwen-Agent 소스 확인**: `[function]: {...}` 형식이 어디서 생성되는지 확인

4. **대안**: 사용자에게 이 패턴이 나타나는 것은 알려진 이슈이며, 최종 메시지에서는 제거됨을 안내

## 관련 파일

- `backend/app.py` (Line 139-148, 340-350)
- `src/services/qwen-agent-service.js` (Line 87-135)
- `src/hooks/useAICommand.js` (메시지 업데이트)
- `src/components/AIChatSidebar.jsx` (렌더링)

## 질문할 내용

1. Qwen-Agent에서 `[function]: {...}` 형식이 생성되는 정확한 위치는?
2. 스트리밍 중 작은 델타에 걸쳐 있는 패턴을 어떻게 필터링할까?
3. 더 효과적인 정규식 패턴은?
4. 버퍼링 방식의 구현 방법과 트레이드오프는?
5. Qwen-Agent의 tool 결과 포맷팅을 커스터마이징할 수 있는가?

