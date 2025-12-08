# 문제와 해결 방안

## 발견된 문제

백엔드 로그 분석 결과:
```
Tool call request: ash_ssh_execute with args: , command:
```

`tool_args`가 빈 문자열이고, `command`도 비어있습니다.

하지만 실제 tool 실행 시:
```
[ash_ssh_execute] connection_id=..., command=uname -a
```

실제로는 command가 있습니다!

## 원인

Qwen-Agent가 `function_call.arguments`를 빈 문자열로 전달하고 있습니다.

## 해결 방안

### 방안 1: tool 실행 시점에 command 저장 (가장 확실)

`agent_tools.py`에서 tool 실행 시 command를 반환값에 포함시키기

### 방안 2: 백엔드 로그 파싱

tool 실행 로그에서 command를 파싱해서 추출 (불안정)

### 방안 3: 구조 변경

Qwen-Agent의 tool 호출 방식을 확인하고 수정

## 권장: 방안 1

`agent_tools.py`에서 tool 실행 결과에 command를 포함시켜서, `tool_result`에서 command를 추출할 수 있도록 합니다.

