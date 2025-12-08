# 문제 분석: "Executing: ash_ssh_execute" 대신 실제 명령어 표시하기

## 현재 상황

사용자가 SSH 명령어를 실행할 때:
- 표시되는 메시지: `Executing: ash_ssh_execute`
- 사용자가 원하는 메시지: `Executing: ls -alt` (실제 명령어)

## 데이터 흐름 분석

### 1. 백엔드 (backend/app.py)

**Tool Call 단계 (381-386줄):**
```python
yield f"data: {json.dumps({
    'type': 'tool_call',
    'name': tool_name,
    'args': tool_args,
    'command': command  # ✅ 실제 명령어가 여기에 포함됨!
}, ensure_ascii=False)}\n\n"
```

백엔드는 `tool_call` 이벤트에 `command` 필드를 포함시켜 전송합니다.

**Tool Result 단계 (400-410줄):**
```python
structured_result = {
    'type': 'tool_result',
    'name': tool_name,  # ❌ 'ash_ssh_execute'만 포함
    'success': ...,
    'exitCode': ...,
    'stdout': ...,
    'stderr': ...,
    # ❌ command 필드가 없음!
}
```

`tool_result` 이벤트에는 `command` 정보가 포함되지 않습니다.

### 2. 프론트엔드 - 서비스 레이어 (src/services/qwen-agent-service.js)

**Tool Call 처리 (159-167줄):**
```javascript
else if (data.type === 'tool_call') {
    const toolName = data.name || data.tool_name || 'unknown_tool';
    const toolArgs = data.args || data.arguments || '{}';
    
    // Call tool call callback if provided (for displaying to user)
    if (onToolCall) {
        onToolCall(toolName, toolArgs);  // ❌ command 정보를 전달하지 않음
    }
}
```

`tool_call` 이벤트를 받지만, `command` 필드를 사용하지 않고 `onToolCall` 콜백을 호출합니다.

**Tool Result 처리 (170-201줄):**
```javascript
else if (data.type === 'tool_result') {
    const toolName = data.name || data.tool_name || 'unknown_tool';
    
    if (data.name && (data.stdout !== undefined || data.stderr !== undefined)) {
        const toolResult = {
            name: data.name,  // ❌ 'ash_ssh_execute'
            success: ...,
            exitCode: ...,
            stdout: ...,
            stderr: ...
            // ❌ command 정보가 없음
        };
        
        if (onToolResult) {
            onToolResult(toolName, toolResult);  // command 없이 전달
        }
    }
}
```

`tool_result`를 처리할 때 `command` 정보가 없습니다.

### 3. 프론트엔드 - Hook 레이어 (src/hooks/useAICommand.js)

**Tool Result 콜백 (414-435줄):**
```javascript
async (toolName, toolResult) => {
    const toolResultData = typeof toolResult === 'object' ? toolResult : { 
        name: toolName,  // ❌ 'ash_ssh_execute'
        content: toolResult,
        ...
    };
    
    if (toolResultData.stdout && !abortSignal?.aborted) {
        setStreamingToolResult({
            name: toolName,  // ❌ 'ash_ssh_execute'만 설정
            stdout: toolResultData.stdout,
            stderr: toolResultData.stderr || ''
        });
    }
}
```

`setStreamingToolResult`를 호출할 때 `name`에 `ash_ssh_execute`가 들어갑니다.

**Tool Call 콜백 (516-518줄):**
```javascript
// Tool call callback (when LLM requests to call a tool) - don't display
(toolName, toolArgs) => {
    // Don't display tool calls to user  // ❌ 아무것도 하지 않음
}
```

`tool_call` 콜백이 있지만 아무것도 하지 않습니다.

### 4. 프론트엔드 - UI 레이어 (src/components/AIChatSidebar.jsx)

**표시 부분 (1132줄):**
```jsx
Executing: {streamingToolResult.name}  // ❌ 'ash_ssh_execute' 표시
```

## 문제의 핵심

1. **백엔드는 `tool_call`에 `command`를 포함시킵니다** ✅
2. **하지만 프론트엔드는 `tool_call`을 사용하지 않습니다** ❌
3. **프론트엔드는 `tool_result`만 사용하는데, `tool_result`에는 `command`가 없습니다** ❌
4. **현재 `streamingToolResult.name`에는 도구 이름(`ash_ssh_execute`)만 저장됩니다** ❌

## 해결 방안

### 방안 1: Tool Call 단계에서 Command 저장하기 (권장)

1. **백엔드**: `tool_result` 이벤트에 `command` 필드 추가
   - `tool_call` 단계에서 추출한 `command`를 저장해두고
   - `tool_result` 단계에서 함께 전송

2. **프론트엔드**: `tool_result`에서 `command` 추출하여 사용
   - `tool_result`의 `command` 필드를 `streamingToolResult.command`에 저장
   - UI에서 `command`가 있으면 그것을 표시, 없으면 `name` 표시

### 방안 2: Tool Call 단계에서 Command 저장하고 Tool Result에서 참조

1. **프론트엔드**: `tool_call` 단계에서 `command`를 상태에 저장
   - `tool_call` 콜백에서 `command`를 맵에 저장 (toolName → command)
   - `tool_result` 콜백에서 저장된 `command`를 찾아서 사용

### 방안 3: 백엔드에서 Tool Result에 Command 포함

1. **백엔드**: `tool_result` 생성 시 원본 `command`를 포함
   - Tool 실행 함수에서 `command`를 반환하도록 수정
   - `tool_result` 이벤트에 `command` 필드 추가

## 권장 해결책

**방안 1 + 방안 3 결합**을 권장합니다:

1. **백엔드 수정**: `tool_result` 이벤트에 `command` 필드 추가
   - Tool 실행 시 사용한 명령어를 결과에 포함
   
2. **프론트엔드 수정**: 
   - `tool_result`에서 `command` 필드 추출
   - `streamingToolResult`에 `command` 필드 추가
   - UI에서 `command`가 있으면 표시, 없으면 `name` 표시

이 방식의 장점:
- 가장 깔끔하고 명확함
- Tool call과 tool result가 독립적으로 동작
- 백엔드와 프론트엔드 모두 명확한 데이터 구조

## 상세한 문제 분석

### 백엔드에서 tool_call과 tool_result의 관계

백엔드 코드 (`backend/app.py`)를 보면:

1. **Tool Call 단계 (362-386줄)**:
   - `assistant.run()`이 반환하는 `response_chunk`에서 `function_call`을 감지
   - `ash_ssh_execute`인 경우, `tool_args`에서 `command`를 추출
   - `tool_call` 이벤트로 스트리밍: `{ type: 'tool_call', name: 'ash_ssh_execute', command: 'ls -alt', ... }`

2. **Tool Result 단계 (390-414줄)**:
   - 이후 `assistant.run()`이 tool 실행 결과를 포함한 새로운 `response_chunk`를 반환
   - `role: 'tool'` 또는 `role: 'function'`인 메시지를 감지
   - `tool_result` 이벤트로 스트리밍: `{ type: 'tool_result', name: 'ash_ssh_execute', stdout: '...', ... }`

**핵심 문제**: 
- `tool_call`과 `tool_result`는 **별도의 스트리밍 이벤트**입니다
- `tool_call`에서 추출한 `command` 정보가 `tool_result` 단계에서는 **사용할 수 없습니다**
- Qwen-Agent가 tool을 실행한 후 반환하는 메시지에는 원본 `command` 정보가 없습니다

### 프론트엔드에서의 흐름

1. **qwen-agent-service.js**:
   - `tool_call` 이벤트를 받지만 `onToolCall` 콜백만 호출하고 끝
   - `tool_result` 이벤트를 받아서 `onToolResult` 콜백 호출
   - 현재는 `tool_call`의 `command` 정보를 저장하지 않음

2. **useAICommand.js**:
   - `tool_call` 콜백은 비어있음 (516-518줄)
   - `tool_result` 콜백만 사용해서 `streamingToolResult` 설정
   - `tool_result`에는 `command` 정보가 없으므로 `name`만 사용

3. **AIChatSidebar.jsx**:
   - `streamingToolResult.name`을 표시
   - `name`은 `ash_ssh_execute`이므로 사용자가 원하는 실제 명령어가 아님

## 해결 방안 상세 비교

### 방안 1: 백엔드에서 tool_result에 command 포함 (가장 권장)

**장점:**
- ✅ 가장 깔끔하고 명확
- ✅ 프론트엔드 수정이 최소화됨
- ✅ tool_call과 tool_result가 독립적으로 동작
- ✅ 백엔드에서 모든 정보를 관리

**구현 방법:**
1. 백엔드: `tool_call` 단계에서 추출한 `command`를 딕셔너리에 임시 저장 (예: `tool_command_map[tool_call_id] = command`)
2. 백엔드: `tool_result` 단계에서 해당 `command`를 찾아서 이벤트에 포함
3. 프론트엔드: `tool_result.command`를 사용하여 표시

**문제점:**
- Qwen-Agent의 tool 실행 메커니즘을 봐야 함
- `tool_call`과 `tool_result`를 연결할 수 있는 ID가 필요할 수 있음

### 방안 2: 프론트엔드에서 tool_call의 command 저장 (간단)

**장점:**
- ✅ 백엔드 수정 불필요
- ✅ 구현이 간단함

**구현 방법:**
1. 프론트엔드: `tool_call` 콜백에서 `command`를 Map에 저장
2. 프론트엔드: `tool_result` 콜백에서 저장된 `command`를 찾아서 사용

**문제점:**
- ❌ tool_call과 tool_result를 매칭하는 로직 필요
- ❌ 여러 tool이 동시에 실행될 경우 처리 복잡
- ❌ tool_call이 오지 않고 tool_result만 올 경우 처리 불가

### 방안 3: 백엔드에서 tool 실행 시 command를 결과에 포함

**장점:**
- ✅ Tool 실행 함수 레벨에서 해결
- ✅ 가장 근본적인 해결

**구현 방법:**
1. 백엔드: `agent_tools.py`의 `SSHExecuteTool.call()` 메서드가 반환하는 결과에 `command` 포함
2. 백엔드: `tool_result` 이벤트 생성 시 반환된 결과에서 `command` 추출

**문제점:**
- ❌ Qwen-Agent가 tool 결과를 어떻게 처리하는지 확인 필요
- ❌ Tool 결과 포맷이 변경될 수 있음

## 최종 권장 해결책

### 방안 A: 백엔드에서 tool_call의 command를 tool_result에 포함 (가장 권장)

**핵심 아이디어**: 
- `tool_call` 단계에서 추출한 `command`를 메모리에 임시 저장
- `tool_result` 단계에서 해당 `command`를 찾아서 함께 전송

**구현 방법**:

1. **백엔드 수정**: `tool_call`에서 추출한 `command`를 딕셔너리에 저장
   ```python
   # generate() 함수 시작 부분에 추가
   tool_command_map = {}  # {tool_name: command} 또는 {idx: command}
   
   # tool_call 단계 (362-386줄)
   if function_call:
       tool_name = function_call.get('name', 'unknown_tool')
       tool_args = function_call.get('arguments', '{}')
       
       command = None
       if tool_name == 'ash_ssh_execute':
           try:
               import json5
               args = json5.loads(tool_args)
               command = args.get('command', tool_args)
           except:
               command = tool_args
       
       # command를 맵에 저장 (tool_name을 키로 사용)
       if command:
           tool_command_map[tool_name] = command  # 또는 고유 키 사용
   ```

2. **백엔드 수정**: `tool_result`에 저장된 `command` 포함
   ```python
   # tool_result 단계 (390-414줄)
   elif event_type in ('tool', 'function'):
       tool_name = message.get('name', 'unknown_tool')
       
       # 저장된 command 가져오기
       command = tool_command_map.get(tool_name)
       
       structured_result = {
           'type': 'tool_result',
           'name': tool_name,
           'command': command,  # ✅ command 추가
           'success': ...,
           ...
       }
   ```

3. **프론트엔드 수정**: `tool_result`에서 `command` 사용
   ```javascript
   // qwen-agent-service.js (186-194줄)
   const toolResult = {
       name: data.name,
       command: data.command,  // ✅ command 추가
       success: ...,
       ...
   };
   ```

4. **프론트엔드 수정**: UI에서 `command` 표시
   ```jsx
   // AIChatSidebar.jsx (1132줄)
   Executing: {streamingToolResult.command || streamingToolResult.name}
   ```

**문제점**:
- ❌ 여러 tool이 동시에 실행될 경우, 같은 tool_name이 중복될 수 있음
- ✅ 하지만 일반적으로 순차 실행되므로 큰 문제 없음

**개선된 방법**: 인덱스 기반 매칭
```python
# tool_call과 tool_result를 인덱스로 매칭
tool_command_map = {}  # {idx: command}

# tool_call 단계
tool_command_map[idx] = command

# tool_result 단계
command = tool_command_map.get(idx)
```

### 방안 B: 프론트엔드에서 tool_call의 command 저장 (더 간단)

**핵심 아이디어**:
- `tool_call` 이벤트에서 `command`를 받아서 프론트엔드에서 저장
- `tool_result` 이벤트에서 저장된 `command`를 참조

**구현 방법**:

1. **프론트엔드 수정**: `tool_call` 콜백에서 `command` 저장
   ```javascript
   // useAICommand.js
   const toolCommandMap = useRef(new Map());  // toolName -> command 매핑
   
   // tool_call 콜백
   (toolName, toolArgs, command) => {  // command 파라미터 추가 필요
       if (command) {
           toolCommandMap.current.set(toolName, command);
       }
   }
   ```

2. **프론트엔드 수정**: `tool_result`에서 저장된 `command` 사용
   ```javascript
   // tool_result 콜백
   async (toolName, toolResult) => {
       const command = toolCommandMap.current.get(toolName);
       
       setStreamingToolResult({
           name: toolName,
           command: command,  // ✅ 저장된 command 사용
           stdout: toolResultData.stdout,
           ...
       });
   }
   ```

3. **프론트엔드 수정**: `qwen-agent-service.js`에서 `command` 전달
   ```javascript
   // tool_call 이벤트 처리 (159-167줄)
   else if (data.type === 'tool_call') {
       const toolName = data.name;
       const command = data.command;  // ✅ command 추출
       
       if (onToolCall) {
           onToolCall(toolName, toolArgs, command);  // command 전달
       }
   }
   ```

**문제점**:
- ❌ 여러 tool이 동시에 실행될 경우 매칭 문제
- ❌ tool_call이 오지 않고 tool_result만 올 경우 처리 불가
- ✅ 하지만 구현이 간단하고 백엔드 수정 불필요

## 최종 추천

**방안 A (백엔드 중심)**를 권장합니다:
- ✅ 모든 정보가 백엔드에서 관리됨 (단일 소스)
- ✅ 프론트엔드는 단순히 표시만 하면 됨
- ✅ tool_call과 tool_result의 연결이 명확
- ✅ 나중에 다른 정보를 추가하기도 쉬움

**구현 우선순위**:
1. 백엔드: `tool_call`에서 `command` 추출 및 저장
2. 백엔드: `tool_result`에 `command` 포함
3. 프론트엔드: `tool_result`에서 `command` 추출
4. 프론트엔드: UI에서 `command` 표시

## 추가 고려사항

### tool_call과 tool_result의 순서

Qwen-Agent의 동작 방식:
1. `assistant.run()` 호출
2. LLM이 tool call을 요청 → `function_call` 포함된 assistant 메시지
3. Qwen-Agent가 tool 실행
4. tool 결과 포함된 새로운 `response_chunk` 반환

**중요**: `tool_call`과 `tool_result`는 **같은 `response_chunk` 내에 있을 수도 있고, 다른 `response_chunk`에 있을 수도 있습니다**.
- 같은 `response_chunk`: `[assistant with function_call, tool result]`
- 다른 `response_chunk`: 첫 번째 `[assistant with function_call]`, 두 번째 `[tool result]`

따라서 **인덱스 기반 매칭보다는 tool_name 기반 매칭이 더 안전**할 수 있습니다 (단, 동일 tool_name이 연속 실행될 경우 문제 가능).

### 더 안전한 방법: tool_call_id 사용

Qwen-Agent나 LLM 프레임워크가 `tool_call_id`를 제공한다면:
```python
tool_command_map = {}  # {tool_call_id: command}

# tool_call 단계
tool_call_id = function_call.get('id')  # 또는 message.get('tool_call_id')
tool_command_map[tool_call_id] = command

# tool_result 단계  
tool_call_id = message.get('tool_call_id')
command = tool_command_map.get(tool_call_id)
```

하지만 현재 코드를 보면 `tool_call_id`를 사용하지 않는 것 같으므로, **tool_name 기반 + 실행 순서 기반** 매칭을 사용하는 것이 현실적입니다.

