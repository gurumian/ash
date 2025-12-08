# Qwen-Agent 이해 기반 해결 방법

## Qwen-Agent의 실제 동작 분석

### 코드 분석 (fncall_agent.py)

```python
# 87-89줄: LLM 응답 스트리밍 (tool_call 포함)
for output in output_stream:
    if output:
        yield response + output  # tool_call 메시지 yield

# 90-92줄: output을 response에 추가
if output:
    response.extend(output)  # tool_call 메시지 추가
    messages.extend(output)

# 94-105줄: tool_call 감지 및 실행
for out in output:  # 위에서 추가한 output을 순회
    use_tool, tool_name, tool_args, _ = self._detect_tool(out)
    if use_tool:
        tool_result = self._call_tool(...)  # 즉시 실행
        fn_msg = Message(role=FUNCTION, name=tool_name, content=tool_result, ...)
        response.append(fn_msg)  # tool_result를 response에 추가
        yield response  # tool_call + tool_result 함께 yield
```

### 실제 흐름

1. **첫 번째 yield (89줄)**: `response + output`
   - `output`에 tool_call 메시지 포함
   - `response`는 이전까지의 메시지들

2. **tool 실행 (97줄)**: `self._call_tool(...)`
   - tool_call 메시지에서 tool_name, tool_args 추출
   - 즉시 tool 실행

3. **두 번째 yield (104줄)**: `response`
   - `response`에 tool_call + tool_result 포함
   - 누적된 전체 response

### 우리 코드에서의 처리

```python
for response_chunk in assistant.run(messages=messages):
    # response_chunk는 누적된 전체 응답
    for idx, message in enumerate(response_chunk):
        if event_type == 'assistant' and function_call:
            # tool_call 처리 (89줄에서 yield된 것)
        
        elif event_type in ('tool', 'function'):
            # tool_result 처리 (104줄에서 yield된 것)
```

## 핵심 발견

1. **tool_call과 tool_result는 서로 다른 response_chunk에 옴**
   - 첫 번째 chunk: tool_call만
   - 두 번째 chunk: tool_call + tool_result (누적)

2. **하지만 순서가 보장됨**
   - tool_call이 먼저 처리됨
   - 그 다음에 tool_result가 처리됨
   - 같은 `_run()` 메서드 내에서 순차 처리

3. **같은 함수 스코프**
   - `generate()` 함수 내에서 모든 처리
   - 변수를 공유할 수 있음

## 가장 확실한 해결 방법: 큐 사용

실행 순서가 보장되므로, FIFO 큐를 사용하면 확실합니다:

```python
tool_command_queue = []  # FIFO 큐

# tool_call: 큐에 추가
if command:
    tool_command_queue.append(command)

# tool_result: 큐에서 가져오기
if tool_command_queue:
    command = tool_command_queue.pop(0)
```

## 구현 계획

1. `generate()` 함수 시작 부분에 큐 생성
2. tool_call 단계에서 command를 큐에 추가
3. tool_result 단계에서 큐에서 command를 가져오기
4. tool_result 이벤트에 command 포함
5. 프론트엔드에서 command 표시

