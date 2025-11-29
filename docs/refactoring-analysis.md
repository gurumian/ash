# 리팩토링 분석 보고서

## 📊 현재 상태 분석

### 1. 파일 크기 및 복잡도

#### 🔴 높은 우선순위
- **`src/App.jsx`** (1,356 라인)
  - React 컴포넌트로는 과도하게 큼
  - 62개의 React hooks 사용 (useState, useEffect, useCallback, useMemo)
  - 단일 책임 원칙(SRP) 위반
  - 유지보수성 저하

#### 🟡 중간 우선순위
- **`src/hooks/useTerminalManagement.js`** (664 라인)
  - 터미널 관리 로직이 집중되어 있음
  - 일부 기능을 더 작은 훅으로 분리 가능

- **`src/hooks/useConnectionManagement.js`** (629 라인)
  - 연결 관리 로직이 복잡함
  - 에러 처리 로직이 포함되어 있음

- **`src/components/SessionManager.jsx`** (526 라인)
  - 많은 props 전달 (60+ props)
  - 컴포넌트 분리 고려 필요

### 2. 주요 리팩토링 포인트

## 🎯 리팩토링 제안

### 우선순위 1: App.jsx 분해

#### 1.1 AI 명령 처리 로직 추출
**현재 위치**: `App.jsx` 952-1080 라인

**문제점**:
- 130줄의 인라인 AI 명령 처리 로직
- 에러 처리 로직이 복잡하고 중복됨
- 테스트하기 어려움

**제안**:
```javascript
// hooks/useAICommand.js
export function useAICommand({
  activeSessionId,
  terminalInstances,
  sshConnections,
  llmSettings,
  setErrorDialog,
  setIsAIProcessing,
  setShowAICommandInput
}) {
  const executeAICommand = useCallback(async (naturalLanguage) => {
    // AI 명령 처리 로직
  }, [/* dependencies */]);
  
  return { executeAICommand };
}
```

**예상 효과**:
- App.jsx에서 130줄 제거
- 재사용 가능한 훅으로 분리
- 테스트 용이성 향상

#### 1.2 다이얼로그 상태 관리 통합
**현재 상태**:
- `showSettings`, `showAboutDialog`, `showTftpServerDialog`, `showWebServerDialog`, `showIperfServerDialog`, `showSessionDialog`, `showLibraryDialog`, `showFileUploadDialog`, `showLibraryImportDialog`, `showGroupNameDialog`, `showConnectionForm` 등 11개의 다이얼로그 상태

**문제점**:
- 상태 관리가 분산되어 있음
- 각 다이얼로그마다 별도의 useState
- 열림/닫힘 로직이 반복됨

**제안**:
```javascript
// hooks/useDialogManager.js
export function useDialogManager() {
  const [dialogs, setDialogs] = useState({
    settings: false,
    about: false,
    tftpServer: false,
    webServer: false,
    iperfServer: false,
    session: false,
    library: false,
    fileUpload: false,
    libraryImport: false,
    groupName: false,
    connectionForm: false
  });
  
  const openDialog = useCallback((dialogName) => {
    setDialogs(prev => ({ ...prev, [dialogName]: true }));
  }, []);
  
  const closeDialog = useCallback((dialogName) => {
    setDialogs(prev => ({ ...prev, [dialogName]: false }));
  }, []);
  
  return { dialogs, openDialog, closeDialog };
}
```

**예상 효과**:
- 상태 관리 일원화
- 코드 중복 제거
- 새로운 다이얼로그 추가 용이

#### 1.3 서버 상태 관리 통합
**현재 상태**:
- `tftpStatus`, `webStatus`, `iperfStatus` 각각 별도 상태
- 각각 별도의 useEffect로 폴링

**제안**:
```javascript
// hooks/useServerStatus.js
export function useServerStatus() {
  const [serverStatuses, setServerStatuses] = useState({
    tftp: { running: false, port: null },
    web: { running: false, port: null },
    iperf: { running: false, port: null }
  });
  
  // 통합 폴링 로직
  useEffect(() => {
    // ...
  }, []);
  
  return { serverStatuses };
}
```

#### 1.4 에러 다이얼로그 처리 추출
**현재 위치**: `App.jsx` 1033-1076 라인

**문제점**:
- 에러 타입별 분기 처리가 복잡함
- 다른 곳에서도 유사한 에러 처리 필요

**제안**:
```javascript
// hooks/useErrorHandler.js
export function useErrorHandler(setErrorDialog) {
  const handleError = useCallback((error, context = {}) => {
    const errorInfo = formatError(error, context);
    setErrorDialog({
      isOpen: true,
      ...errorInfo
    });
  }, [setErrorDialog]);
  
  return { handleError };
}

function formatError(error, context) {
  // 에러 포맷팅 로직
}
```

### 우선순위 2: 훅 분리 및 최적화

#### 2.1 useTerminalManagement 분리
**제안**:
- `useTerminalResize.js` - 리사이즈 로직만
- `useTerminalData.js` - 데이터 처리 로직만
- `useTerminalKeyboard.js` - 키보드 이벤트만

#### 2.2 useConnectionManagement 분리
**제안**:
- `useSSHConnection.js` - SSH 연결 전용
- `useSerialConnection.js` - Serial 연결 전용
- `useConnectionError.js` - 에러 처리 전용

### 우선순위 3: 컴포넌트 개선

#### 3.1 SessionManager props 최적화
**현재**: 60+ props 전달

**제안**:
```javascript
// Context API 사용
<SessionManagerContext.Provider value={sessionManagerState}>
  <SessionManager />
</SessionManagerContext.Provider>
```

또는

```javascript
// 단일 객체로 props 전달
<SessionManager config={sessionManagerConfig} />
```

#### 3.2 Dialog 컴포넌트 통합
**제안**: 공통 Dialog 래퍼 컴포넌트 생성

```javascript
// components/BaseDialog.jsx
export function BaseDialog({ isOpen, onClose, title, children, ...props }) {
  if (!isOpen) return null;
  return (
    <Modal onClose={onClose}>
      {title && <DialogTitle>{title}</DialogTitle>}
      {children}
    </Modal>
  );
}
```

## 📈 예상 개선 효과

### 코드 메트릭
- **App.jsx**: 1,356 라인 → 약 600-700 라인 (50% 감소)
- **재사용성**: 훅 분리로 재사용 가능한 로직 증가
- **테스트 용이성**: 작은 단위로 분리되어 테스트 작성 용이
- **유지보수성**: 단일 책임 원칙 준수로 변경 영향 범위 축소

### 성능
- 불필요한 리렌더링 감소 (메모이제이션 개선)
- 코드 스플리팅 가능 (다이얼로그 지연 로딩)

## 🗺️ 리팩토링 로드맵

### Phase 1: AI 명령 처리 추출 (1-2일)
1. `useAICommand` 훅 생성
2. App.jsx에서 AI 로직 제거
3. 테스트 및 검증

### Phase 2: 다이얼로그 관리 통합 (1일)
1. `useDialogManager` 훅 생성
2. 모든 다이얼로그 상태 마이그레이션
3. 컴포넌트 업데이트

### Phase 3: 에러 처리 개선 (1일)
1. `useErrorHandler` 훅 생성
2. 에러 포맷팅 로직 통합
3. 전체 앱에 적용

### Phase 4: 서버 상태 관리 (0.5일)
1. `useServerStatus` 훅 생성
2. 폴링 로직 통합

### Phase 5: 훅 세분화 (2-3일)
1. useTerminalManagement 분리
2. useConnectionManagement 분리
3. 테스트 및 검증

## ⚠️ 주의사항

1. **점진적 리팩토링**: 한 번에 모든 것을 바꾸지 말고 단계적으로 진행
2. **테스트**: 각 단계마다 기능 테스트 필수
3. **Git 커밋**: 각 Phase마다 커밋하여 롤백 가능하게 유지
4. **기능 동일성**: 리팩토링 후 기능이 동일하게 동작하는지 확인

## 🔍 추가 개선 사항

### 코드 품질
- TypeScript 도입 고려 (점진적 마이그레이션)
- ESLint 규칙 강화
- Prettier 설정 통일

### 성능 최적화
- React.memo 적용 검토
- useMemo/useCallback 최적화
- 코드 스플리팅 (React.lazy)

### 문서화
- JSDoc 주석 추가
- 컴포넌트 사용 예제 작성
- 훅 사용 가이드 작성

