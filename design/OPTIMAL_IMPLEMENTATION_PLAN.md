# 최적 구현 방안

## 목적
1. **Tool call을 실시간으로 사용자에게 표시** (어떤 명령이 실행되는지)
2. **Reasoning/Thinking 과정을 실시간으로 표시**
3. **Tool result를 실시간으로 표시** (명령 실행 결과)
4. **중복/무한 루프 없이 안정적으로 동작**

## Qwen-Agent의 실제 동작 방식

### `FnCallAgent._run()` 메서드 분석

```python
def _run(self, messages, **kwargs) -> Iterator[List[Message]]:
    response = []
    while True:  # 내부적으로 자동으로 ReAct 루프를 돕니다
        # 1. LLM 호출 (스트리밍)
        output_stream = self._call_llm(messages=messages, ...)
        output: List[Message] = []
        
        # 2. 스트리밍: response + 새로운 output을 yield
        for output in output_stream:
            if output:
                yield response + output  # ← 이게 핵심!
        
        if output:
            response.extend(output)
            messages.extend(output)
            
            # 3. Tool call 감지 및 자동 실행
            used_any_tool = False
            for out in output:
                use_tool, tool_name, tool_args, _ = self._detect_tool(out)
                if use_tool:
                    tool_result = self._call_tool(tool_name, tool_args, ...)
                    fn_msg = Message(role=FUNCTION, name=tool_name, content=tool_result)
                    messages.append(fn_msg)
                    response.append(fn_msg)
                    yield response  # Tool result도 yield
                    used_any_tool = True
            
            if not used_any_tool:
                break
    
    yield response
```

### 핵심 발견

1. **Qwen-Agent는 이미 자동으로 모든 것을 처리합니다**
   - Tool call 감지
   - Tool 실행
   - Tool result를 messages에 추가
   - 다음 LLM 호출 시 tool result가 자동으로 포함됨

2. **스트리밍 방식**
   - `yield response + output` 형태로 누적된 응답을 반환
   - 각 yield마다 전체 `response`를 반환 (증분이 아님)

3. **Message 구조**
   - Assistant 메시지: `{'role': 'assistant', 'content': '...', 'function_call': {...}}`
   - Tool result 메시지: `{'role': 'function', 'name': 'tool_name', 'content': '...'}`

## 현재 구현의 문제점

### 문제 1: Tool Call을 실시간으로 스트리밍하지 않음

```python
# 현재 코드
function_call = message.get('function_call')
if function_call:
    logger.info(f"Tool call request: {tool_name}...")
    # ❌ Don't stream tool call to client - user doesn't need to see this
```

**문제**: 사용자가 tool call을 실시간으로 보고 싶어합니다!

### 문제 2: Content가 증분 스트리밍되지 않음

Qwen-Agent는 `yield response + output` 형태로 전체 응답을 반환합니다.
- 첫 번째 yield: `[assistant_msg_1]`
- 두 번째 yield: `[assistant_msg_1, assistant_msg_2]`
- 세 번째 yield: `[assistant_msg_1, assistant_msg_2, function_msg_1]`

**문제**: 같은 content가 반복적으로 스트리밍될 수 있습니다.

### 문제 3: Conversation History 업데이트 누락

```python
for response_chunk in assistant.run(messages=messages):
    # 스트리밍 처리
    ...
# ❌ messages.extend(response)가 없음!
```

**문제**: Conversation history가 업데이트되지 않아 다음 대화에서 맥락이 유지되지 않습니다.

## 최적 구현 방안

### 방안 1: Qwen-Agent의 자동 처리를 그대로 활용 (추천)

**장점:**
- 코드가 단순함
- Qwen-Agent가 검증된 로직으로 처리
- 무한 루프 방지 로직 내장 (`MAX_LLM_CALL_PER_RUN`)

**구현:**
```python
def generate():
    messages = []
    if request.conversation_history:
        messages.extend(request.conversation_history)
    messages.append({"role": "user", "content": request.message})
    
    previous_response = []  # 이전 response를 추적
    final_response = []      # 최종 response 저장
    
    for response_chunk in assistant.run(messages=messages):
        # response_chunk는 List[Message] - 누적된 전체 응답
        
        # 이전 response와 비교해서 새로운 부분만 추출
        new_messages = response_chunk[len(previous_response):]
        
        for message in new_messages:
            role = message.get('role')
            content = message.get('content', '')
            
            # 1. Assistant 메시지 스트리밍
            if role == 'assistant':
                # Content 증분 스트리밍
                if content:
                    # 이전 content와 비교해서 새로운 부분만
                    prev_content = get_previous_assistant_content(previous_response)
                    if content.startswith(prev_content):
                        new_chunk = content[len(prev_content):]
                        if new_chunk:
                            yield f"data: {json.dumps({'type': 'content_chunk', 'content': new_chunk})}\n\n"
                
                # Tool call 실시간 표시
                function_call = message.get('function_call')
                if function_call:
                    tool_name = function_call.get('name')
                    tool_args = function_call.get('arguments', '{}')
                    yield f"data: {json.dumps({'type': 'tool_call', 'name': tool_name, 'args': tool_args})}\n\n"
            
            # 2. Tool result 스트리밍
            elif role in ('function', 'tool'):
                tool_name = message.get('name')
                tool_content = str(content)
                yield f"data: {json.dumps({'type': 'tool_result', 'name': tool_name, 'content': tool_content})}\n\n"
        
        previous_response = response_chunk.copy()
        final_response = response_chunk.copy()
    
    # Conversation history 업데이트
    messages.extend(final_response)
    
    yield f"data: {json.dumps({'type': 'done'})}\n\n"
```

### 방안 2: LLM 스트리밍을 직접 처리 (더 세밀한 제어)

**장점:**
- Content를 토큰 단위로 실시간 스트리밍 가능
- Tool call을 더 빠르게 감지 가능

**단점:**
- 구현이 복잡함
- Qwen-Agent의 자동 처리를 우회해야 함

## 추천 구현: 방안 1 개선 버전

```python
def generate():
    messages = []
    if request.conversation_history:
        messages.extend(request.conversation_history)
    messages.append({"role": "user", "content": request.message})
    
    # 이전 상태 추적
    seen_messages = set()  # 중복 방지
    previous_assistant_content = ''
    
    final_response = []
    
    for response_chunk in assistant.run(messages=messages):
        # response_chunk는 누적된 전체 응답
        # 새로운 메시지만 처리
        for message in response_chunk:
            # 중복 체크
            msg_id = get_message_id(message)
            if msg_id in seen_messages:
                continue
            seen_messages.add(msg_id)
            
            role = message.get('role')
            content = message.get('content', '')
            
            # Assistant 메시지 처리
            if role == 'assistant':
                # Content 증분 스트리밍
                if content and content != previous_assistant_content:
                    if content.startswith(previous_assistant_content):
                        # 새로운 부분만 스트리밍
                        new_chunk = content[len(previous_assistant_content):]
                        if new_chunk:
                            yield f"data: {json.dumps({'type': 'content_chunk', 'content': new_chunk})}\n\n"
                    else:
                        # 완전히 다른 content (새로운 응답)
                        yield f"data: {json.dumps({'type': 'content', 'content': content})}\n\n"
                    previous_assistant_content = content
                
                # Tool call 실시간 표시
                function_call = message.get('function_call')
                if function_call:
                    tool_name = function_call.get('name')
                    tool_args = function_call.get('arguments', '{}')
                    yield f"data: {json.dumps({'type': 'tool_call', 'name': tool_name, 'args': tool_args})}\n\n"
            
            # Tool result 처리
            elif role in ('function', 'tool'):
                tool_name = message.get('name')
                tool_content = str(content)
                
                # Tool result 파싱 및 구조화
                parsed_result = parse_tool_result(tool_content)
                yield f"data: {json.dumps({
                    'type': 'tool_result',
                    'name': tool_name,
                    'stdout': parsed_result.get('stdout', ''),
                    'stderr': parsed_result.get('stderr', ''),
                    'exitCode': parsed_result.get('exitCode', 0)
                })}\n\n"
        
        final_response = response_chunk.copy()
    
    # Conversation history 업데이트 (중요!)
    # 이 부분이 없으면 다음 대화에서 맥락이 유지되지 않음
    # 하지만 여기서 messages를 업데이트하면 안 됨 (이미 assistant.run() 내부에서 처리됨)
    # 대신 프론트엔드에서 conversation history를 관리해야 함
    
    yield f"data: {json.dumps({'type': 'done'})}\n\n"
```

## 핵심 개선 사항

1. ✅ **Tool Call 실시간 스트리밍**: `function_call` 필드를 감지해서 즉시 프론트엔드로 전송
2. ✅ **Content 증분 스트리밍**: 이전 content와 비교해서 새로운 부분만 전송
3. ✅ **중복 방지**: `seen_messages`로 같은 메시지를 여러 번 처리하지 않음
4. ✅ **Conversation History 관리**: 프론트엔드에서 `final_response`를 history에 추가

## 다음 단계

1. Backend 구현 개선
2. Frontend에서 conversation history 관리 확인
3. 테스트 및 디버깅

