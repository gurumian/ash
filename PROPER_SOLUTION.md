# 올바른 해결 방법: Qwen-Agent의 실제 동작 기반

## Qwen-Agent의 실제 동작

코드를 보면:

```python
# fncall_agent.py의 _run() 메서드
for output in output_stream:
    yield response + output  # tool_call 메시지들 yield

for out in output:
    if use_tool:
        tool_result = self._call_tool(...)  # 즉시 실행
        fn_msg = Message(...)  # tool_result 메시지 생성
        response.append(fn_msg)
        yield response  # tool_result 포함된 response yield
```

**중요한 점**:
- tool_call과 tool_result는 **서로 다른 response_chunk**에 올 수 있음
- 하지만 **순차적으로** 처리됨
- 같은 `_run()` 메서드 내에서 처리됨

## 가장 확실한 방법: 큐 사용

function_id 매칭은 복잡하고 실패할 수 있으므로, **실행 순서 기반 큐**를 사용:

```python
tool_command_queue = []  # FIFO 큐

# tool_call: 큐에 추가
if command:
    tool_command_queue.append(command)

# tool_result: 큐에서 가져오기
if tool_command_queue:
    command = tool_command_queue.pop(0)
```

이 방법이 가장 확실하고 간단합니다.

