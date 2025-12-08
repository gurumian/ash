# 정석 방식: 프론트엔드에서 tool_call과 tool_result 매칭

## 원리

1. **백엔드**: `tool_call` 이벤트에 `command` 포함 (이미 구현됨)
2. **프론트엔드**: `tool_call`에서 `command`를 받아서 FIFO 큐에 저장
3. **프론트엔드**: `tool_result`가 올 때 큐에서 `command`를 가져와서 사용
4. **프론트엔드**: UI에서 `command` 표시

## 구현 순서

1. 프론트엔드 서비스 레이어: tool_call에서 command 추출 및 큐에 저장
2. 프론트엔드 서비스 레이어: tool_result에서 큐에서 command 가져오기
3. 프론트엔드 Hook: streamingToolResult에 command 저장
4. 프론트엔드 UI: command 표시

## 장점

- ✅ 백엔드 변경 최소화
- ✅ 프론트엔드에서 완전히 제어
- ✅ 순서 보장 (FIFO 큐)
- ✅ 간단하고 명확

