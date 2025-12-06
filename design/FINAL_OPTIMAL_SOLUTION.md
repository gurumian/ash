# 최종 최적 해결 방안

## 목적
1. **Tool call을 실시간으로 사용자에게 표시**
2. **Reasoning/Thinking 과정을 실시간으로 표시**
3. **Tool result를 실시간으로 표시**
4. **중복/무한 루프 없이 안정적으로 동작**

## 핵심 발견

### Qwen-Agent의 스트리밍 방식

```python
# FnCallAgent._run() 내부
for output in output_stream:
    if output:
        yield response + output  # ← 누적된 전체 응답 반환!
```

**문제**: 각 yield마다 `[이전 모든 메시지들] + [새 메시지]`가 반환됩니다.
- 첫 번째 yield: `[assistant_msg_1]`
- 두 번째 yield: `[assistant_msg_1, assistant_msg_2]` ← assistant_msg_1이 또 포함됨!
- 세 번째 yield: `[assistant_msg_1, assistant_msg_2, function_msg_1]`

### 현재 구현의 문제

```python
# backend/app.py 310-333번 줄
for response_chunk in assistant.run(messages=messages):
    for message in response_chunk:  # ← response_chunk는 누적된 전체 응답
        # 같은 메시지가 여러 번 처리될 수 있음!
        if event_type == 'assistant':
            yield f"data: {json.dumps({'type': 'content', 'content': content})}\n\n"
            # ❌ Tool call을 스트리밍하지 않음
            function_call = message.get('function_call')
            if function_call:
                # Don't stream tool call to client - user doesn't need to see this
```

## 최적 해결 방안

### 핵심 아이디어

1. **이전 response를 추적해서 새로운 부분만 추출**
2. **Tool call을 실시간으로 스트리밍**
3. **Content를 증분으로 스트리밍**
4. **중복 메시지 방지**

### 구현 코드

```python
def generate():
    messages = []
    if request.conversation_history:
        messages.extend(request.conversation_history)
    messages.append({"role": "user", "content": request.message})
    
    # 상태 추적
    previous_response = []  # 이전 response_chunk 저장
    seen_message_ids = set()  # 처리된 메시지 ID 추적
    previous_assistant_content = ''  # Assistant content 증분 스트리밍용
    
    final_response = []
    
    for response_chunk in assistant.run(messages=messages):
        # response_chunk는 누적된 전체 응답: [msg1, msg2, msg3, ...]
        # 이전 response와 비교해서 새로운 메시지만 추출
        new_messages = response_chunk[len(previous_response):]
        
        for message in new_messages:
            role = message.get('role')
            content = message.get('content', '')
            
            # Assistant 메시지 처리
            if role == 'assistant':
                # 1. Content 증분 스트리밍
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
                
                # 2. Tool call 실시간 스트리밍 (핵심!)
                function_call = message.get('function_call')
                if function_call:
                    tool_name = function_call.get('name')
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
                    
                    yield f"data: {json.dumps({
                        'type': 'tool_call',
                        'name': tool_name,
                        'args': tool_args,
                        'command': command
                    })}\n\n"
            
            # Tool result 처리
            elif role in ('function', 'tool'):
                tool_name = message.get('name')
                tool_content = str(content)
                
                # Tool result 파싱
                parsed_result = parse_tool_result(tool_content)
                yield f"data: {json.dumps({
                    'type': 'tool_result',
                    'name': tool_name,
                    'stdout': parsed_result.get('stdout', ''),
                    'stderr': parsed_result.get('stderr', ''),
                    'exitCode': parsed_result.get('exitCode', 0)
                })}\n\n"
        
        # 이전 response 업데이트
        previous_response = response_chunk.copy()
        final_response = response_chunk.copy()
    
    # Conversation history는 프론트엔드에서 관리
    # (Qwen-Agent가 이미 messages에 추가했으므로)
    
    yield f"data: {json.dumps({'type': 'done'})}\n\n"
```

### 개선 포인트

1. ✅ **새로운 메시지만 처리**: `new_messages = response_chunk[len(previous_response):]`
2. ✅ **Tool call 실시간 스트리밍**: `function_call` 필드를 감지해서 즉시 전송
3. ✅ **Content 증분 스트리밍**: 이전 content와 비교해서 새로운 부분만 전송
4. ✅ **중복 방지**: 새로운 메시지만 처리하므로 중복이 없음

## 구현 우선순위

### Phase 1: 핵심 기능 (즉시 구현)
1. ✅ Tool call 실시간 스트리밍 추가
2. ✅ 새로운 메시지만 처리하도록 수정
3. ✅ Content 증분 스트리밍

### Phase 2: 최적화
1. Conversation history 관리 개선
2. 에러 처리 강화
3. 로깅 개선

## 테스트 계획

1. **Tool call이 실시간으로 표시되는지 확인**
2. **Content가 증분으로 스트리밍되는지 확인**
3. **중복 content가 발생하지 않는지 확인**
4. **무한 루프가 발생하지 않는지 확인**

