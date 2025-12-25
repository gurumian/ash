# 연결 관리 설계 검토

## 현재 구현의 문제점

### 1. connectionId의 의미가 모호함
- **현재**: `connectionId`는 세션별로 고유한 ID (실제로는 "세션 연결 ID")
- **문제**: 이름이 "connectionId"인데 실제로는 세션별 고유 ID라서 혼란스러움
- **영향**: 코드를 읽을 때 "연결 ID"인지 "세션 연결 ID"인지 불명확

### 2. logicalConnectionId의 필요성과 명확성
- **현재**: chat history를 공유하기 위해 별도의 `logicalConnectionId` 사용
- **문제**: 
  - connectionId와 logicalConnectionId를 함께 관리해야 하는 복잡성
  - 두 ID의 관계가 명확하지 않음
  - Fallback 로직 (`logicalConnectionId || connectionId`)이 있는데 이게 항상 올바른가?

### 3. Serial의 특수 처리
- **현재**: 포트를 순회하면서 기존 연결을 찾아 자동으로 닫음
- **문제**:
  - 포트 충돌을 조용히 처리하여 사용자가 인지하지 못함
  - `portPath`를 connection info에 저장하는 방식이 깔끔하지 않음
  - 에러가 아니라 연결을 끊어버리는 방식이 예측 불가능

### 4. 일관성 부족
- **SSH/Telnet**: 여러 세션 가능, connectionId에 sessionId 포함
- **Serial**: 하나만 가능, 같은 포트면 기존 연결 닫음
- **문제**: 같은 프로토콜 내에서도 처리 방식이 다름

## 개선된 설계 제안

### 1. 개념 명확화

```typescript
// 명확한 개념 분리
class Connection {
  sessionConnectionId: string;  // 세션별 고유 ID (기존 connectionId)
  connectionKey: string;        // 논리적 연결 키 (chat history용, 기존 logicalConnectionId 대체)
  sessionId: string;            // 세션 ID
  // ...
}
```

**용도**:
- `sessionConnectionId`: 실제 연결 관리용 (IPC 통신, 데이터 전송)
- `connectionKey`: chat history 그룹화용 (`type:host:port:user:sessionName`)
- `sessionId`: 세션 추적용

### 2. Serial의 명시적 처리

```typescript
// 현재: 조용히 기존 연결 닫기
if (existingConnectionId) {
  closeExistingConnection(existingConnectionId);
}

// 개선: 명시적 에러
if (isPortInUse(portPath)) {
  throw new Error(`Serial port ${portPath} is already in use by another session`);
}
```

**장점**:
- 사용자가 명시적으로 알 수 있음
- 예측 가능한 동작
- 필요시 UI에서 "연결 끊고 새로 연결" 옵션 제공 가능

### 3. connectionKey 계산 로직 통일

```typescript
function getConnectionKey(type: 'ssh' | 'telnet' | 'serial', params: ConnectionParams): string {
  if (type === 'ssh' || type === 'telnet') {
    return `${type}:${params.sessionName || ''}:${params.user}@${params.host}:${params.port}`;
  } else if (type === 'serial') {
    return `serial:${params.sessionName || ''}:${params.portPath}`;
  }
}
```

### 4. 일관된 에러 처리

```typescript
// 모든 프로토콜에 대해 일관된 에러 처리
try {
  await connection.connect(...);
} catch (error) {
  if (error.code === 'PORT_IN_USE') {
    // Serial 특정 에러
    showPortInUseDialog(portPath);
  } else {
    // 일반 연결 에러
    showConnectionError(error);
  }
}
```

## 권장 사항

### 옵션 A: 점진적 개선 (현재 구조 유지 + 명확화)
1. 변수명을 `sessionConnectionId`로 변경 (또는 주석으로 명확화)
2. `logicalConnectionId`를 `connectionKey`로 rename
3. Serial의 자동 연결 끊기를 에러로 변경

### 옵션 B: 근본적 리팩토링 (권장)
1. Connection 클래스에 `sessionConnectionId`, `connectionKey` 속성 명시
2. 모든 핸들러에서 일관된 방식으로 ID 생성
3. Serial은 명시적 에러 처리
4. chat history는 `connectionKey` 사용

## 결론

현재 구현은 **기능적으로는 동작하지만 설계적으로는 개선의 여지가 있음**:

1. ✅ **세션별 고유 연결 ID**: 올바른 접근
2. ⚠️ **logicalConnectionId**: 필요하지만 이름과 사용 방식이 개선 필요
3. ❌ **Serial의 자동 연결 끊기**: 명시적 에러 처리로 변경 필요
4. ⚠️ **일관성**: 프로토콜별 차이를 명확하게 문서화하고 처리 필요

**권장**: 옵션 B (근본적 리팩토링)를 진행하여 장기적으로 유지보수하기 쉬운 구조로 개선
