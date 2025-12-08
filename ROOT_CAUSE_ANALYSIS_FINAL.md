# 최종 근본 원인 분석

## 현재 구현 상태 확인

### 백엔드 (backend/app.py)
- `tool_call` 이벤트에 `command` 포함 (line 385)
- `command` 추출 로직 존재 (line 369-376)

### 프론트엔드 (src/services/qwen-agent-service.js)
- 큐 생성 (line 26)
- `tool_call`에서 `command` 큐에 저장 (line 167-169)
- `tool_result`에서 큐에서 `command` 가져오기 (line 195-198)

## 가능한 문제들

### 문제 1: 백엔드에서 command가 None
- `tool_args` 파싱 실패
- `args.get('command')`가 None 반환

### 문제 2: 프론트엔드에서 data.command가 없음
- 백엔드에서 전송되지 않음
- SSE 이벤트 파싱 문제

### 문제 3: toolArgs에서 직접 추출 필요
- 백엔드에서 command가 None인 경우
- 프론트엔드에서 toolArgs를 파싱해서 추출

## 해결 방안

1. **백엔드 로그 확인**: command 값 확인
2. **프론트엔드 콘솔 확인**: data.command 값 확인
3. **fallback 로직 추가**: toolArgs에서 직접 추출

## 개선된 구현

프론트엔드에서:
1. `data.command`가 있으면 사용
2. 없으면 `toolArgs`에서 직접 추출
3. 그래도 없으면 큐에서 가져오기

이렇게 하면 여러 경로로 command를 확보할 수 있습니다.

