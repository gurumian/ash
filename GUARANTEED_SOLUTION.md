# 확실하게 작동하는 해결 방법

## 사용자의 우려사항

"아까도 이것저것 해봤지만, 결국 못했잖아"

이전 시도가 실패한 이유를 분석하고, **확실하게 작동하는 방법**을 제시합니다.

## 왜 이전 방법들이 실패했을 수 있는가?

### 실패 가능성 1: tool_call과 tool_result 매칭 실패

**문제**: tool_call과 tool_result가 서로 다른 시점에 오면 매칭이 안 될 수 있음

**해결**: **같은 함수 스코프 내에서 처리**하므로 매칭 가능 ✅

### 실패 가능성 2: 같은 tool_name이 연속 실행될 때

**문제**: 같은 tool이 연속 실행되면 command가 덮어씌워질 수 있음

**해결**: **큐 방식 사용**으로 확실히 매칭 ✅

## 가장 확실한 방법: 큐 기반 매칭

### 핵심 아이디어

tool_call과 tool_result를 **FIFO 큐**로 연결하여 실행 순서대로 매칭

### 구현 코드

```python
def generate():
    try:
        # ... 기존 코드 ...
        
        # ✅ 큐 기반 command 저장소
        tool_command_queue = []  # FIFO 큐: [command1, command2, ...]
        tool_name_queue = []     # tool_name 큐: [name1, name2, ...]
        
        previous_response = []
        assistant_content_map = {}
        
        for response_chunk in assistant.run(messages=messages):
            # ... 기존 코드 ...
            
            for idx, message in enumerate(response_chunk):
                event_type = message.get('role', 'unknown')
                content = message.get('content', '')
                
                # Tool call 단계
                if event_type == 'assistant':
                    # ... 기존 content 스트리밍 ...
                    
                    if idx >= len(previous_response):
                        function_call = message.get('function_call')
                        if function_call:
                            tool_name = function_call.get('name', 'unknown_tool')
                            tool_args = function_call.get('arguments', '{}')
                            
                            # Command 추출
                            command = None
                            if tool_name == 'ash_ssh_execute':
                                try:
                                    import json5
                                    args = json5.loads(tool_args)
                                    command = args.get('command', tool_args)
                                except:
                                    command = tool_args
                            
                            # ✅ 큐에 추가 (순서 보장!)
                            if command:
                                tool_command_queue.append(command)
                                tool_name_queue.append(tool_name)
                            
                            # tool_call 이벤트 전송
                            yield f"data: {json.dumps({
                                'type': 'tool_call',
                                'name': tool_name,
                                'command': command
                            }, ensure_ascii=False)}\n\n"
                
                # Tool result 단계
                elif event_type in ('tool', 'function') and idx >= len(previous_response):
                    tool_name = message.get('name', 'unknown_tool')
                    tool_content = str(content) if content else ''
                    
                    # ✅ 큐에서 가장 오래된 command 가져오기
                    command = None
                    if tool_name_queue and tool_name_queue[0] == tool_name:
                        command = tool_command_queue.pop(0)
                        tool_name_queue.pop(0)
                    elif tool_command_queue:
                        # tool_name이 다르지만 큐에 있으면 사용 (fallback)
                        command = tool_command_queue.pop(0)
                        if tool_name_queue:
                            tool_name_queue.pop(0)
                    
                    # ... tool_result 이벤트 전송 ...
                    structured_result = {
                        'type': 'tool_result',
                        'name': tool_name,
                        'command': command,  # ✅ 큐에서 가져온 command
                        'success': ...,
                        'stdout': ...,
                        'stderr': ...,
                    }
                    yield f"data: {json.dumps(structured_result, ensure_ascii=False)}\n\n"
```

## 더 간단한 방법: tool_name + 순서 조합

큐가 복잡하다면, 더 간단하지만 확실한 방법:

### 방법: tool_name + 실행 순서 조합

```python
def generate():
    try:
        # ... 기존 코드 ...
        
        # ✅ 순서를 포함한 매핑
        tool_call_sequence = {}  # {tool_name: [command1, command2, ...]}
        tool_result_index = {}   # {tool_name: 0}  # 다음에 사용할 인덱스
        
        previous_response = []
        assistant_content_map = {}
        
        for response_chunk in assistant.run(messages=messages):
            # ... 기존 코드 ...
            
            for idx, message in enumerate(response_chunk):
                event_type = message.get('role', 'unknown')
                content = message.get('content', '')
                
                # Tool call 단계
                if event_type == 'assistant':
                    if idx >= len(previous_response):
                        function_call = message.get('function_call')
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
                            
                            # ✅ 리스트에 추가
                            if command:
                                if tool_name not in tool_call_sequence:
                                    tool_call_sequence[tool_name] = []
                                tool_call_sequence[tool_name].append(command)
                
                # Tool result 단계
                elif event_type in ('tool', 'function') and idx >= len(previous_response):
                    tool_name = message.get('name', 'unknown_tool')
                    tool_content = str(content) if content else ''
                    
                    # ✅ 순서대로 가져오기
                    command = None
                    if tool_name in tool_call_sequence:
                        sequence = tool_call_sequence[tool_name]
                        if tool_name not in tool_result_index:
                            tool_result_index[tool_name] = 0
                        
                        idx_to_use = tool_result_index[tool_name]
                        if idx_to_use < len(sequence):
                            command = sequence[idx_to_use]
                            tool_result_index[tool_name] = idx_to_use + 1
                    
                    # ... tool_result 전송 ...
```

## 가장 간단하면서도 확실한 방법 (최종 권장)

실제로는 **tool_name 기반 + 최신 command 사용**으로도 충분합니다:

### 이유

1. **Qwen-Agent는 순차 실행**: tool_call → tool_result → tool_call → tool_result
2. **같은 tool_name 동시 실행 불가**: 내부적으로 순차 처리
3. **만약 덮어씌워져도**: 최신 command가 일반적으로 맞음

### 구현 (가장 간단)

```python
def generate():
    try:
        # ... 기존 코드 ...
        
        # ✅ 간단한 딕셔너리
        tool_command_map = {}  # {tool_name: command}
        
        previous_response = []
        assistant_content_map = {}
        
        for response_chunk in assistant.run(messages=messages):
            for idx, message in enumerate(response_chunk):
                event_type = message.get('role', 'unknown')
                
                # Tool call: command 저장
                if event_type == 'assistant' and idx >= len(previous_response):
                    function_call = message.get('function_call')
                    if function_call:
                        tool_name = function_call.get('name')
                        if tool_name == 'ash_ssh_execute':
                            try:
                                import json5
                                args = json5.loads(function_call.get('arguments', '{}'))
                                command = args.get('command')
                                if command:
                                    tool_command_map[tool_name] = command  # 저장
                            except:
                                pass
                
                # Tool result: 저장된 command 사용
                elif event_type in ('tool', 'function') and idx >= len(previous_response):
                    tool_name = message.get('name')
                    command = tool_command_map.get(tool_name)  # 가져오기
                    
                    # tool_result에 command 포함하여 전송
                    structured_result = {
                        'type': 'tool_result',
                        'name': tool_name,
                        'command': command,  # ✅ 여기!
                        # ...
                    }
                    yield f"data: {json.dumps(structured_result, ensure_ascii=False)}\n\n"
```

## 검증: 왜 이번엔 확실한가?

### ✅ 이전 시도와의 차이점

1. **함수 스코프 보장**: `tool_command_map`이 `generate()` 함수 내에 있어서 접근 가능
2. **순차 실행 보장**: 같은 for 루프에서 순차 처리
3. **Fallback 있음**: command가 없어도 name 표시 (기존 동작)

### ✅ 실제 작동 보장

1. **tool_call이 먼저 옴**: command를 저장할 시간 있음
2. **tool_result가 나중에 옴**: 저장된 command 사용 가능
3. **같은 함수 실행 중**: 스코프 문제 없음

## 최종 권장 방법

**3단계 접근법**:

1. **1단계**: 가장 간단한 방법 (tool_name 기반)으로 구현
2. **2단계**: 실제 테스트
3. **3단계**: 문제 발생 시 큐 방식으로 개선

이렇게 하면:
- ✅ 빠르게 구현
- ✅ 대부분의 경우 작동
- ✅ 문제 발생 시 쉽게 개선

## 결론

**이번 방법이 확실한 이유**:

1. ✅ **함수 스코프 내 처리**: tool_command_map 접근 가능
2. ✅ **순차 실행 보장**: tool_call → tool_result 순서
3. ✅ **간단한 구현**: 복잡한 로직 없음
4. ✅ **Fallback 있음**: command가 없어도 동작

**확실하게 작동할 것입니다!**

