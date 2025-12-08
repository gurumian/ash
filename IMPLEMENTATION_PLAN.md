# 구현 계획: 큐 기반 해결 방법

## Qwen-Agent 동작 이해

### 실제 처리 순서

1. **첫 번째 yield (89줄)**: `response + output`
   - `output`에 tool_call 메시지 포함
   - `response`는 이전까지의 메시지들

2. **tool 실행 (97줄)**: `self._call_tool(...)`
   - tool_call에서 추출한 tool_name, tool_args로 즉시 실행

3. **두 번째 yield (104줄)**: `response`
   - `response`에 tool_call + tool_result 포함 (누적)

### 우리 코드에서의 처리

```python
for response_chunk in assistant.run(messages=messages):
    # 첫 번째 chunk: tool_call만
    # 두 번째 chunk: tool_call + tool_result (누적)
    
    for idx, message in enumerate(response_chunk):
        if event_type == 'assistant' and function_call:
            # tool_call 처리 (새로운 메시지일 때만)
        
        elif event_type in ('tool', 'function'):
            # tool_result 처리 (새로운 메시지일 때만)
```

## 구현 방법: 큐 사용

실행 순서가 보장되므로, FIFO 큐를 사용하면 확실합니다.

### 1단계: 백엔드 - 큐 생성 및 command 저장

```python
# generate() 함수 시작 부분
tool_command_queue = []  # FIFO 큐

# tool_call 단계
if command:
    tool_command_queue.append(command)

# tool_result 단계
if tool_command_queue:
    command = tool_command_queue.pop(0)
```

### 2단계: 백엔드 - tool_result에 command 포함

```python
structured_result = {
    'type': 'tool_result',
    'name': tool_name,
    'command': command,  # 큐에서 가져온 command
    ...
}
```

### 3단계: 프론트엔드 - command 추출 및 표시

이미 구현되어 있음 (이전에 수정한 부분)

## 구현 순서

1. 백엔드: 큐 생성 및 command 저장
2. 백엔드: tool_result에 command 포함
3. 프론트엔드: 이미 되어있음

