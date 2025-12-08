# Qwen-Agent의 실제 동작 방식 (정확한 이해)

## 핵심 발견

Qwen-Agent 코드를 정확히 분석한 결과:

### 실제 처리 흐름

```python
# fncall_agent.py의 _run() 메서드
for out in output:  # output 리스트를 순회
    use_tool, tool_name, tool_args, _ = self._detect_tool(out)
    if use_tool:
        # 1. tool_call 메시지: out (이미 output에 있음)
        # 2. 즉시 tool 실행
        tool_result = self._call_tool(tool_name, tool_args, ...)
        # 3. tool_result 메시지 생성 및 추가
        fn_msg = Message(role=FUNCTION, name=tool_name, content=tool_result, ...)
        response.append(fn_msg)
        yield response  # tool_call과 tool_result가 함께 yield됨
```

## 중요한 점

1. **tool_call과 tool_result는 같은 response_chunk에 포함됨**
   - `output` 리스트에 tool_call 메시지가 있음
   - 같은 for 루프에서 tool_result를 생성해서 `response`에 추가
   - `yield response`로 함께 반환됨

2. **순차 처리 보장**
   - tool_call이 먼저 output에 있음
   - 그 다음 for 루프에서 tool_result 생성
   - 같은 response_chunk에 순서대로 있음

3. **function_id는 매칭용이 아님**
   - `function_id`는 단순히 메시지에 포함시키는 것
   - 실제로 매칭에 사용하지 않음

## 우리 코드에서의 실제 순서

```python
for response_chunk in assistant.run(messages=messages):
    for idx, message in enumerate(response_chunk):
        # response_chunk = [
        #   {'role': 'assistant', 'function_call': {...}},  # idx=0: tool_call
        #   {'role': 'function', 'name': 'ash_ssh_execute', ...}  # idx=1: tool_result (바로 다음!)
        # ]
```

**중요**: tool_call과 tool_result는 **같은 response_chunk에 순서대로** 옵니다!

## 가장 확실한 해결 방법

### 방법 1: 인덱스 기반 (같은 response_chunk 내)

같은 response_chunk에서 tool_call 다음에 바로 tool_result가 옵니다:

```python
for idx, message in enumerate(response_chunk):
    if event_type == 'assistant' and function_call:
        # tool_call 처리
        command = extract_command(...)
        tool_command_map[idx] = command  # 인덱스로 저장
    
    elif event_type in ('tool', 'function'):
        # tool_result 처리
        # 바로 앞의 assistant 메시지에서 command 가져오기
        prev_idx = idx - 1
        command = tool_command_map.get(prev_idx)
```

하지만 이건 같은 response_chunk 내에서만 작동합니다.

### 방법 2: 큐 사용 (가장 확실)

실행 순서대로 큐에 저장:

```python
tool_command_queue = []

# tool_call
if command:
    tool_command_queue.append(command)

# tool_result
if tool_command_queue:
    command = tool_command_queue.pop(0)
```

### 방법 3: 순차 처리 보장 (더 간단)

Qwen-Agent는 항상 순차적으로 처리하므로:
- tool_call이 먼저 처리됨
- 그 다음에 tool_result가 처리됨
- 같은 함수 스코프 내에서 처리됨

따라서 단순히:
- tool_call: command 저장 (tool_name 또는 function_id로)
- tool_result: 저장된 command 사용

## 결론

**가장 확실한 방법**: **큐 사용**

Qwen-Agent는 순차 처리하므로, 큐로 확실하게 매칭할 수 있습니다.

