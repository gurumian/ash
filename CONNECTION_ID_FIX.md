# Connection ID 수정 - AI 명령 실행 문제 해결

## 문제
AI가 `connectionKey`를 `connectionId`로 사용하여 명령 실행 시 연결을 찾지 못하는 문제가 발생했습니다.

## 원인
- `useAICommand`에서 AI에게 전달하는 메시지에 `connectionKey`를 포함시켰지만
- Backend의 `ash_execute_command`는 실제 연결 실행을 위해 `sessionConnectionId`가 필요함
- `ssh-list-connections`는 `sessionConnectionId` 목록을 반환하므로 매칭 실패

## 해결
- AI에게 전달하는 메시지에는 `sessionConnectionId` 사용 (명령 실행용)
- Chat history에는 `connectionKey` 사용 (세션 간 공유)

## 변경 사항
- `useAICommand.js`: `sessionConnectionId`와 `connectionKey`를 명확히 구분하여 사용
  - AI 메시지: `sessionConnectionId` 사용
  - Chat history: `connectionKey` 사용
