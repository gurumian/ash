# 디버깅 분석: function_id=2인데 command를 찾지 못함

## 로그 분석

```
WARNING:app: No command found for tool_name=ash_ssh_execute, function_id=2
```

이것은 다음을 의미합니다:
- ✅ tool_result에서 `function_id=2`를 추출했음
- ❌ 하지만 `tool_command_map`에 `function_id=2`로 저장된 command가 없음

## 가능한 원인들

### 원인 1: tool_call 단계에서 function_id를 추출하지 못함

tool_call 메시지의 `extra` 필드에 `function_id`가 없을 수 있음.

**확인 방법**: tool_call 로그에서 function_id가 None인지 확인

### 원인 2: function_id 타입 불일치

- tool_call: `function_id`가 문자열 `'2'`로 저장
- tool_result: `function_id`가 숫자 `2`로 조회
- 또는 그 반대

**확인 방법**: 키 타입과 조회 타입이 일치하는지 확인

### 원인 3: tool_call이 실행되지 않음

tool_call 단계가 스킵되어 command가 저장되지 않았을 수 있음.

**확인 방법**: tool_call 로그가 출력되는지 확인

### 원인 4: 다른 response_chunk에 있음

tool_call과 tool_result가 다른 response_chunk에 있고, tool_call이 나중에 처리될 수 있음.

하지만 일반적으로는 tool_call이 먼저 오고 tool_result가 나중에 옴.

## 해결 방법

### 방법 1: 타입 정규화

모든 function_id를 문자열로 통일:

```python
# tool_call
if function_id is not None:
    function_id = str(function_id)

# tool_result
if function_id is not None:
    function_id = str(function_id)
```

### 방법 2: 문자열과 숫자 모두 시도

```python
command = tool_command_map.get(function_id)
if not command and function_id:
    # 숫자/문자열 모두 시도
    try:
        alt_id = int(function_id) if isinstance(function_id, str) else str(function_id)
        command = tool_command_map.get(alt_id)
    except:
        pass
```

### 방법 3: 큐 사용 (가장 확실)

function_id 대신 실행 순서 기반 큐 사용:

```python
tool_command_queue = []

# tool_call
if command:
    tool_command_queue.append(command)

# tool_result
if tool_command_queue:
    command = tool_command_queue.pop(0)
```

## 다음 단계

1. 로그를 더 상세하게 추가
2. tool_call과 tool_result의 function_id 타입 확인
3. tool_command_map의 키들을 확인

