# 연결 관리 설계 리팩토링 요약

## 완료된 작업

### 1. Connection 클래스 업데이트 ✅
- `SSHConnection`, `TelnetConnection`, `SerialConnection`에 `sessionConnectionId`와 `connectionKey` 속성 추가
- Deprecated getter를 통한 하위 호환성 유지 (`connectionId`, `logicalConnectionId`)

### 2. 핸들러 업데이트 ✅
- **SSH 핸들러**: `connectionId` → `sessionConnectionId`, `logicalConnectionId` → `connectionKey`
- **Telnet 핸들러**: `connectionId` → `sessionConnectionId`, `logicalConnectionId` → `connectionKey`
- **Serial 핸들러**: 
  - `connectionId` → `sessionConnectionId`, `logicalConnectionId` → `connectionKey`
  - **명시적 에러 처리**: 포트 충돌 시 자동으로 기존 연결을 끊지 않고 명시적 에러 발생

### 3. 사용 코드 업데이트 ✅
- `useAICommand`: `connectionKey` 사용 (하위 호환성을 위한 fallback 유지)
- `useTerminalManagement`: 주석 명확화 및 `sessionConnectionId` 사용
- `useConnectionManagement`: 주석 업데이트

## 주요 변경 사항

### 명확한 개념 분리
- `sessionConnectionId`: 세션별 고유 ID (IPC 통신, 연결 관리용)
- `connectionKey`: 논리적 연결 키 (chat history 공유용)

### Serial 포트 명시적 에러 처리
기존에는 포트 충돌 시 조용히 기존 연결을 끊었지만, 이제는 명시적 에러를 발생시킵니다:
```javascript
throw new Error(`Serial port ${portPath} is already in use by another session. Please disconnect the existing session first.`);
```

### 하위 호환성
- Deprecated getter를 통해 기존 코드와의 호환성 유지
- IPC 인터페이스는 기존 이름 유지 (주석으로 명확화)

## 다음 단계 (선택사항)

1. **IPC 인터페이스 리팩토링**: `connectionId` 파라미터를 `sessionConnectionId`로 변경 (breaking change)
2. **Deprecated 코드 제거**: 모든 코드가 새로운 속성을 사용하도록 업데이트 후 deprecated getter 제거
3. **문서화**: API 문서에 새로운 속성 명확히 문서화

## 테스트 권장 사항

1. 같은 SSH/Telnet 서버에 여러 세션 열기 (각 세션이 독립적으로 유지되는지)
2. Serial 포트 충돌 시 명시적 에러 발생 확인
3. Chat history가 같은 연결 정보를 가진 세션들 간에 공유되는지 확인
4. 기존 세션들이 정상적으로 작동하는지 확인 (하위 호환성)
