# Qwen-Agent 올바른 사용법 분석

## 핵심 발견: Qwen-Agent는 자동으로 Tool Call을 처리합니다!

Qwen-Agent 오픈소스 코드를 분석한 결과, **수동 ReAct 루프는 필요 없습니다**. Qwen-Agent가 내부적으로 모든 것을 처리합니다.

## Qwen-Agent의 내부 동작 방식

### `FnCallAgent._run()` 메서드 분석

```python
def _run(self, messages: List[Message], **kwargs) -> Iterator[List[Message]]:
    messages = copy.deepcopy(messages)
    response = []
    
    while True:
        # 1. LLM 호출
        output_stream = self._call_llm(messages=messages, ...)
        output: List[Message] = []
        
        # 2. 스트리밍: response + 새로운 output을 yield
        for output in output_stream:
            if output:
                yield response + output
        
        if output:
            response.extend(output)      # response에 추가
            messages.extend(output)      # messages 히스토리에도 추가
            
            # 3. Tool call 감지 및 자동 실행
            used_any_tool = False
            for out in output:
                use_tool, tool_name, tool_args, _ = self._detect_tool(out)
                if use_tool:
                    # Tool 자동 실행
                    tool_result = self._call_tool(tool_name, tool_args, ...)
                    
                    # Tool result를 Message로 생성
                    fn_msg = Message(
                        role=FUNCTION,
                        name=tool_name,
                        content=tool_result,
                        ...
                    )
                    
                    # 히스토리에 자동 추가
                    messages.append(fn_msg)    # 다음 LLM 호출에 포함됨
                    response.append(fn_msg)    # 스트리밍 응답에도 포함
                    yield response
                    used_any_tool = True
            
            # 4. Tool을 사용하지 않으면 종료
            if not used_any_tool:
                break
    
    yield response
```

## 올바른 사용법

### 예제 코드 (Qwen-Agent 공식 예제)

```python
# Step 1: Assistant 생성
bot = Assistant(llm=llm_cfg, function_list=tools)

# Step 2: 메시지 히스토리 관리
messages = []

# Step 3: 사용자 메시지 추가
messages.append({'role': 'user', 'content': query})

# Step 4: Assistant.run() 호출 - 자동으로 모든 것을 처리!
response = []
for response in bot.run(messages=messages):
    # response는 List[Message] - assistant 응답 + tool results가 포함됨
    # 스트리밍 출력 처리
    print(response)

# Step 5: 히스토리에 추가 (중요!)
messages.extend(response)  # response에는 assistant 응답과 tool results가 모두 포함됨
```

## 현재 구현의 문제점

### 현재 구현 (수동 ReAct 루프)

```python
while True:
    responses = assistant.run(messages=messages)
    
    has_tool_calls = False
    for chunk in responses:
        messages.extend(chunk)  # ❌ 문제: 이미 Qwen-Agent가 처리했는데 또 추가?
        
        for message in chunk:
            if message.get('tool_calls'):
                has_tool_calls = True
                # ❌ 문제: Qwen-Agent가 이미 실행했는데 또 실행?
                tool_result = assistant.execute_tool(...)
                messages.append(tool_result)  # ❌ 문제: 이미 추가되었는데 또 추가?
    
    if not has_tool_calls:
        break
```

### 올바른 구현

```python
# Qwen-Agent가 모든 것을 자동으로 처리합니다!
response = []
for response in assistant.run(messages=messages):
    # 스트리밍 처리
    yield response  # 또는 프론트엔드로 스트리밍

# 마지막에 히스토리에 추가
messages.extend(response)
```

## 스트리밍 처리

Qwen-Agent의 `run()` 메서드는 **generator**를 반환하므로, 각 단계마다 `List[Message]`를 yield합니다:

```python
for response_chunk in assistant.run(messages=messages):
    # response_chunk는 List[Message]
    # 각 Message는 다음 중 하나:
    # - {'role': 'assistant', 'content': '...', 'tool_calls': [...]}
    # - {'role': 'function', 'name': 'tool_name', 'content': '...'}
    
    # 스트리밍 처리
    for message in response_chunk:
        if message.get('role') == 'assistant':
            # Assistant 응답 스트리밍
            yield message.get('content', '')
        elif message.get('role') == 'function':
            # Tool result 스트리밍
            yield f"Tool {message.get('name')} result: {message.get('content')}"
```

## 핵심 포인트

1. ✅ **Qwen-Agent가 자동으로 Tool Call을 감지하고 실행합니다**
2. ✅ **Tool Result가 자동으로 messages 히스토리에 추가됩니다**
3. ✅ **다음 LLM 호출 시 Tool Result가 자동으로 포함됩니다**
4. ✅ **수동으로 Tool을 실행할 필요가 없습니다**
5. ✅ **수동으로 Tool Result를 추가할 필요가 없습니다**

## 우리가 해야 할 일

1. `assistant.run(messages=messages)`를 호출
2. Generator에서 나오는 각 `response`를 스트리밍
3. 마지막에 `messages.extend(response)`로 히스토리 업데이트

**끝!** 그게 전부입니다.

## 다음 단계

현재 구현을 단순화해야 합니다:
- 수동 ReAct 루프 제거
- Tool call 수동 실행 제거
- Tool result 수동 추가 제거
- Qwen-Agent의 자동 처리를 그대로 사용

