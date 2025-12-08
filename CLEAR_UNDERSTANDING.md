# Qwen-Agent 동작 명확한 이해

## 핵심 발견

Qwen-Agent 코드를 분석한 결과:

### 실제 처리 흐름

```python
# fncall_agent.py의 _run() 메서드

# 1. LLM 응답 스트리밍
for output in output_stream:
    yield response + output  # tool_call 메시지 포함

# 2. output을 response에 추가
response.extend(output)  # tool_call 메시지 추가

# 3. tool_call 감지 및 실행
for out in output:
    if use_tool:
        tool_result = self._call_tool(...)  # 즉시 실행
        fn_msg = Message(role=FUNCTION, ...)  # tool_result 생성
        response.append(fn_msg)  # tool_result 추가
        yield response  # tool_call + tool_result 함께 yield
```

## 우리 코드에서의 처리

```python
for response_chunk in assistant.run(messages=messages):
    # response_chunk는 누적된 전체 응답
    for idx, message in enumerate(response_chunk):
        # 첫 번째 chunk: tool_call만
        # 두 번째 chunk: tool_call + tool_result (누적)
```

## 핵심

1. **tool_call과 tool_result는 순차적으로 처리됨**
   - tool_call이 먼저 옴
   - 그 다음에 tool_result가 옴

2. **같은 함수 스코프 내에서 처리**
   - `generate()` 함수 내에서 모든 처리
   - 변수를 공유할 수 있음

3. **실행 순서 보장**
   - Qwen-Agent가 순차적으로 실행
   - tool_call → tool_result 순서

## 가장 확실한 해결 방법: 큐 사용

**실행 순서가 보장되므로, FIFO 큐를 사용하면 확실합니다!**

```python
tool_command_queue = []  # FIFO 큐

# tool_call: 큐에 추가
if command:
    tool_command_queue.append(command)

# tool_result: 큐에서 가져오기
if tool_command_queue:
    command = tool_command_queue.pop(0)
```

