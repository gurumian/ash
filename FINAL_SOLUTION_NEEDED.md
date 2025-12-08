# 최종 해결 방법 필요

## 문제 확인

로그 분석 결과:
1. `tool_args`가 빈 문자열로 옴
2. command 추출 실패
3. 큐에 저장되지 않음

## 해결 방법

가장 확실한 방법: 백엔드 로그에서 command를 파싱해서 추출

백엔드 로그를 보면:
```
[ash_ssh_execute] connection_id=..., command=uname -a
```

이 로그에서 command를 추출할 수 있습니다.

또는 tool 실행 시점에 command를 저장하는 방법도 있습니다.

하지만 가장 간단한 방법은: `agent_tools.py`에서 tool 실행 시 command를 반환값에 포함시키는 것입니다.

