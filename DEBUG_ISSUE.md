# 문제 진단: ash_ssh_execute가 여전히 표시됨

## 현재 구현 상태

1. ✅ 백엔드: `tool_call`에 `command` 포함 (line 385)
2. ✅ 프론트엔드: `tool_call`에서 `command`를 큐에 저장 (line 167-168)
3. ✅ 프론트엔드: `tool_result`에서 큐에서 `command` 가져오기 (line 195-198)
4. ✅ UI: `command` 표시 (fallback to name)

## 가능한 문제들

### 문제 1: 백엔드에서 command가 None일 수 있음
- `tool_args` 파싱 실패
- `args.get('command')`가 None 반환

### 문제 2: 프론트엔드에서 command가 전달되지 않을 수 있음
- `data.command`가 undefined일 수 있음
- 백엔드에서 `command` 필드가 제대로 전송되지 않을 수 있음

### 문제 3: 큐 순서 문제
- `tool_call`과 `tool_result`가 다른 순서로 도착할 수 있음

### 문제 4: command 추출 실패
- `tool_args`가 예상과 다른 형식일 수 있음

## 디버깅 필요

1. 백엔드 로그 확인: `command` 값 확인
2. 프론트엔드 콘솔 확인: `data.command` 값 확인
3. 큐 상태 확인: 큐에 저장/가져오기 동작 확인

