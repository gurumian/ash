# 근본 원인 분석: function_id=2인데 command를 찾지 못함

## 로그 분석

```
WARNING:app: No command found for tool_name=ash_ssh_execute, function_id=2
```

## 핵심 문제

`function_id=2`가 있는데도 command를 찾지 못했다는 것은:

1. **tool_call 단계에서 function_id로 저장하지 않았거나**
2. **저장한 function_id와 조회한 function_id가 다르거나**
3. **tool_call이 아예 실행되지 않았을 가능성**

## 가장 확실한 해결 방법

### 방법 1: tool_result에서 직접 command 추출

tool_result의 content는 JSON이고, 실제로는 tool이 실행한 결과만 포함됩니다. 하지만 tool_result를 생성할 때 원본 command 정보를 알 수 없습니다.

### 방법 2: tool_call 이벤트를 프론트엔드에서도 사용

현재는 tool_call 이벤트를 무시하고 있는데, 프론트엔드에서도 사용하면:
- tool_call에서 command를 받아서 저장
- tool_result에서 저장된 command 사용

### 방법 3: 큐 사용 (가장 확실)

실행 순서 기반 큐:
```python
tool_command_queue = []  # FIFO

# tool_call
tool_command_queue.append(command)

# tool_result  
command = tool_command_queue.pop(0) if tool_command_queue else None
```

## 실제 문제

로그를 보면:
- tool_result에서 `function_id=2`를 찾았음
- 하지만 tool_command_map에 `function_id=2`가 없음

이는 다음 중 하나:
1. tool_call에서 function_id를 추출하지 못했거나
2. function_id가 다르게 저장되었거나 (타입 차이 등)
3. tool_call 로그가 없어서 저장이 안 되었을 수도

## 다음 조치

더 상세한 로그를 추가해서:
1. tool_call에서 어떤 function_id로 저장했는지
2. tool_command_map에 어떤 키들이 있는지
3. 타입이 일치하는지

확인해야 합니다.

