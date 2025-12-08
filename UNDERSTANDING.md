# Qwen-Agent의 실제 동작 방식 정확한 이해

## Qwen-Agent 코드 분석 (fncall_agent.py)

```python
# 87-89줄: LLM 응답 스트리밍
for output in output_stream:
    if output:
        yield response + output  # tool_call 메시지 포함

# 90-92줄: output을 response에 추가
if output:
    response.extend(output)
    messages.extend(output)

# 94-105줄: tool_call 감지 및 실행
for out in output:
    use_tool, tool_name, tool_args, _ = self._detect_tool(out)
    if use_tool:
        tool_result = self._call_tool(...)  # 즉시 실행
        fn_msg = Message(role=FUNCTION, name=tool_name, content=tool_result, ...)
        response.append(fn_msg)  # tool_result를 response에 추가
        yield response  # tool_call과 tool_result 함께 yield
```

## 실제 흐름

### 시나리오 1: 같은 response_chunk

```
response_chunk = [
    {'role': 'assistant', 'function_call': {...}},  # tool_call (idx=0)
    {'role': 'function', 'name': 'ash_ssh_execute', ...}  # tool_result (idx=1)
]
```

- 87-89줄에서 tool_call만 yield
- 104줄에서 tool_call + tool_result 함께 yield
- **같은 response_chunk에 순서대로 있음!**

### 시나리오 2: 다른 response_chunk

```
response_chunk_1 = [
    {'role': 'assistant', 'function_call': {...}}  # tool_call
]
# yield response + output (tool_call만)

response_chunk_2 = [
    {'role': 'function', 'name': 'ash_ssh_execute', ...}  # tool_result
]
# yield response (tool_call + tool_result)
```

- 첫 번째 chunk: tool_call만
- 두 번째 chunk: tool_call + tool_result (누적)
- **다른 response_chunk에 있지만, 순서는 보장됨!**

## 핵심 발견

1. **tool_call과 tool_result는 순차적으로 처리됨**
   - tool_call이 먼저
   - 그 다음에 tool_result

2. **같은 함수 스코프 내에서 처리됨**
   - `_run()` 메서드 내에서 모든 처리
   - 변수를 공유할 수 있음

3. **response_chunk는 누적됨**
   - `response + output` 형태
   - 이전 메시지들이 계속 포함됨

## 가장 확실한 해결 방법

### 방법: 큐 사용 (FIFO)

```python
tool_command_queue = []  # FIFO 큐

# tool_call 단계: 큐에 추가
if command:
    tool_command_queue.append(command)

# tool_result 단계: 큐에서 가져오기
if tool_command_queue:
    command = tool_command_queue.pop(0)
```

**왜 이 방법이 확실한가:**
- ✅ 실행 순서 보장 (Qwen-Agent가 순차 처리)
- ✅ 같은 tool_name이 연속 실행되어도 정확히 매칭
- ✅ 구현이 간단하고 명확
- ✅ 타입 문제 없음

