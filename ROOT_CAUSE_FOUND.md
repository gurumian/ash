# 근본 원인 발견

## 문제

로그 분석 결과:
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

백엔드에서 `tool_call` 이벤트를 생성할 때 `tool_args`가 비어있어서 command를 추출하지 못합니다.

하지만 Qwen-Agent가 tool을 실제로 실행할 때는 정상적으로 command를 전달합니다.

## 해결 방법

가장 확실한 방법: `agent_tools.py`에서 tool 실행 시 command를 전역 변수나 컨텍스트에 저장하고, `tool_result`에서 사용하기.

하지만 더 간단한 방법: 백엔드 로그를 파싱해서 command를 추출하거나, tool_result에서 역으로 command를 찾기.

실제로는 백엔드 로그에서 이미 command를 볼 수 있으므로, 로그를 파싱하는 방법도 있습니다.

하지만 가장 깔끔한 방법은: tool 실행 시점에 command를 저장하는 것입니다.

