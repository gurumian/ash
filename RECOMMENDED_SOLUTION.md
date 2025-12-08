# 최종 권장 해결 방법

## 문제 요약

현재 "Executing: ash_ssh_execute"가 표시되는 문제:
- 백엔드는 `tool_call` 이벤트에 실제 명령어(`command`)를 포함해서 전송함 ✅
- 하지만 프론트엔드는 `tool_call` 이벤트를 무시하고 `tool_result` 이벤트만 사용함
- `tool_result`에는 실제 명령어 정보가 없어서 도구 이름만 표시됨 ❌

## 최종 권장 방법: 백엔드에서 tool_result에 command 포함

### 핵심 아이디어

**백엔드에서 tool_call 단계에서 추출한 `command`를 메모리에 저장하고, tool_result 단계에서 함께 전송**

이 방법이 가장 권장되는 이유:
1. ✅ **단일 소스 원칙**: 모든 정보를 백엔드에서 관리
2. ✅ **프론트엔드 단순화**: 프론트엔드는 단순히 표시만 하면 됨
3. ✅ **명확한 데이터 구조**: tool_result에 필요한 모든 정보 포함
4. ✅ **유지보수 용이**: 나중에 다른 정보 추가하기 쉬움

### 구현 방법

#### 1단계: 백엔드 수정 - tool_call에서 command 저장

`backend/app.py`의 `generate()` 함수 시작 부분에 저장소 추가:

```python
def generate():
    try:
        # ... 기존 코드 ...
        
        # Command 저장소 추가 (tool_name을 키로 사용)
        tool_command_map = {}  # {tool_name: command}
        
        previous_response = []
        assistant_content_map = {}
        
        for response_chunk in assistant.run(messages=messages):
            # ... 기존 코드 ...
            
            for idx, message in enumerate(response_chunk):
                # ... 기존 코드 ...
                
                if event_type == 'assistant':
                    # ... 기존 content 스트리밍 코드 ...
                    
                    # Tool call 단계 (기존 코드 361-386줄)
                    if idx >= len(previous_response):
                        function_call = message.get('function_call')
                        if function_call:
                            tool_name = function_call.get('name', 'unknown_tool')
                            tool_args = function_call.get('arguments', '{}')
                            
                            # Command 추출 (ash_ssh_execute인 경우)
                            command = None
                            if tool_name == 'ash_ssh_execute':
                                try:
                                    import json5
                                    args = json5.loads(tool_args)
                                    command = args.get('command', tool_args)
                                except:
                                    command = tool_args
                            
                            # ✅ Command를 맵에 저장 (여기가 핵심!)
                            if command:
                                tool_command_map[tool_name] = command
                            
                            # ... 기존 tool_call 이벤트 스트리밍 코드 ...
```

#### 2단계: 백엔드 수정 - tool_result에 command 포함

`backend/app.py`의 tool_result 처리 부분 (390-414줄) 수정:

```python
# Tool result 단계
elif event_type in ('tool', 'function') and idx >= len(previous_response):
    tool_name = message.get('name', 'unknown_tool')
    tool_content = str(content) if content else ''
    
    # ✅ 저장된 command 가져오기
    command = tool_command_map.get(tool_name)
    
    logger.info(f"Tool {tool_name} result (role={event_type}): {tool_content[:100]}...")
    
    try:
        parsed_result = json.loads(tool_content) if isinstance(tool_content, str) and tool_content.strip().startswith('{') else tool_content
        
        structured_result = {
            'type': 'tool_result',
            'name': tool_name,
            'command': command,  # ✅ command 추가!
            'success': parsed_result.get('success', True) if isinstance(parsed_result, dict) else True,
            'exitCode': parsed_result.get('exitCode', 0) if isinstance(parsed_result, dict) else 0,
            'stdout': parsed_result.get('output', '') if isinstance(parsed_result, dict) else '',
            'stderr': parsed_result.get('error', '') if isinstance(parsed_result, dict) else '',
        }
        
        yield f"data: {json.dumps(structured_result, ensure_ascii=False)}\n\n"
    except (json.JSONDecodeError, AttributeError) as e:
        # Fallback
        yield f"data: {json.dumps({
            'type': 'tool_result', 
            'name': tool_name, 
            'command': command,  # ✅ command 추가!
            'content': tool_content
        })}\n\n"
```

#### 3단계: 프론트엔드 수정 - tool_result에서 command 추출

`src/services/qwen-agent-service.js`의 tool_result 처리 부분 (186-194줄) 수정:

```javascript
// Handle structured format from backend
if (data.name && (data.stdout !== undefined || data.stderr !== undefined)) {
    const toolResult = {
        name: data.name,
        command: data.command || null,  // ✅ command 추가!
        success: data.success !== undefined ? data.success : true,
        exitCode: data.exitCode !== undefined ? data.exitCode : 0,
        stdout: data.stdout || '',
        stderr: data.stderr || ''
    };
    
    messages.push({ role: 'tool', name: toolName, toolResult });
    
    if (onToolResult) {
        onToolResult(toolName, toolResult);
    }
}
```

#### 4단계: 프론트엔드 수정 - streamingToolResult에 command 저장

`src/hooks/useAICommand.js`의 tool_result 콜백 (429-435줄) 수정:

```javascript
// Show stdout in "AI is thinking" area while processing
if (toolResultData.stdout && !abortSignal?.aborted) {
    setStreamingToolResult({
        name: toolName,
        command: toolResultData.command || null,  // ✅ command 추가!
        stdout: toolResultData.stdout,
        stderr: toolResultData.stderr || ''
    });
}
```

#### 5단계: 프론트엔드 수정 - UI에서 command 표시

`src/components/AIChatSidebar.jsx`의 표시 부분 (1132줄) 수정:

```jsx
{streamingToolResult.name && (
    <div
        style={{
            fontSize: '10px',
            color: '#888',
            marginBottom: '4px',
            fontWeight: '600'
        }}
    >
        Executing: {streamingToolResult.command || streamingToolResult.name}
        {/* ✅ command가 있으면 command 표시, 없으면 name 표시 */}
    </div>
)}
```

## 구현 순서

1. **백엔드**: `tool_call`에서 `command` 추출 및 저장 (1단계)
2. **백엔드**: `tool_result`에 `command` 포함 (2단계)
3. **프론트엔드**: `tool_result`에서 `command` 추출 (3단계)
4. **프론트엔드**: `streamingToolResult`에 `command` 저장 (4단계)
5. **프론트엔드**: UI에서 `command` 표시 (5단계)

## 주의사항

### tool_name 기반 매칭의 한계

현재 방법은 `tool_name`을 키로 사용하므로, 같은 tool이 연속으로 실행되면 마지막 command만 저장됩니다.

예시:
```
1. ash_ssh_execute(ls -la) → tool_command_map['ash_ssh_execute'] = 'ls -la'
2. ash_ssh_execute(ps aux) → tool_command_map['ash_ssh_execute'] = 'ps aux' (덮어씌워짐!)
```

하지만 일반적으로:
- Tool은 순차적으로 실행됨
- tool_result가 tool_call 직후에 오므로 문제 없음
- 동일 tool_name이 연속 실행되는 경우는 드묾

### 더 안전한 방법 (선택사항)

만약 동일 tool_name이 연속 실행되는 경우를 대비하려면:

1. **인덱스 기반 매칭**: `tool_command_map[idx] = command` 형태로 저장
2. **큐 방식**: `tool_command_queue = []`로 순서대로 저장하고 pop

하지만 일반적으로는 tool_name 기반으로도 충분합니다.

## 대안 방법들

### 대안 1: 프론트엔드에서 tool_call의 command 저장

**장점**: 백엔드 수정 불필요

**단점**:
- ❌ 프론트엔드에 복잡한 상태 관리 필요
- ❌ tool_call과 tool_result 매칭 로직 필요
- ❌ tool_call이 오지 않고 tool_result만 올 경우 처리 불가

### 대안 2: 백엔드 tool 실행 함수에서 command 반환

**장점**: Tool 실행 레벨에서 해결

**단점**:
- ❌ Tool 결과 포맷 변경 필요
- ❌ Qwen-Agent 내부 동작 이해 필요

## 결론

**최종 권장**: **백엔드에서 tool_result에 command 포함 (위에서 제시한 방법)**

이 방법이 가장:
- ✅ 깔끔하고 명확함
- ✅ 유지보수하기 쉬움
- ✅ 확장 가능함
- ✅ 프론트엔드 단순화

