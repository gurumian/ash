# 리팩토링 개선 사항 조사 보고서

## 📊 현재 상태 요약

### 주요 메트릭
- **App.jsx**: 약 1,500 라인 (매우 큰 컴포넌트)
- **React Hooks 사용**: 68개 (useState, useEffect, useCallback, useMemo)
- **다이얼로그 상태**: 11개 분산 관리
- **서버 상태**: 3개 분산 관리 (TFTP, Web, iperf3)
- **SessionManager props**: 60+ 개

---

## 🎯 개선 가능한 항목들

### 1. 다이얼로그 상태 관리 통합 ⭐⭐⭐ (높은 우선순위)

**현재 문제점:**
- 11개의 다이얼로그 상태가 각각 `useState`로 분산되어 있음
- 코드 중복: 각 다이얼로그마다 `setShowXXXDialog(true/false)` 반복
- 새로운 다이얼로그 추가 시 매번 동일한 패턴 반복

**영향받는 상태들:**
```javascript
showSettings, showAboutDialog, showTftpServerDialog, showWebServerDialog, 
showIperfServerDialog, showSessionDialog, showLibraryDialog, 
showFileUploadDialog, showLibraryImportDialog, showGroupNameDialog, 
showConnectionForm
```

**개선 방안:**
```javascript
// hooks/useDialogManager.js 생성
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

**예상 효과:**
- App.jsx에서 약 20-30 라인 감소
- 코드 일관성 향상
- 새로운 다이얼로그 추가 용이

**기능 영향:** 없음 (기능 동일)

---

### 2. 서버 상태 관리 통합 ⭐⭐⭐ (높은 우선순위)

**현재 문제점:**
- TFTP, Web, iperf3 서버 상태가 각각 별도 `useState`로 관리
- 각각 별도의 `useEffect`로 10초마다 폴링 (중복 로직)
- 유사한 패턴이 3번 반복됨

**현재 코드:**
```javascript
const [tftpStatus, setTftpStatus] = useState({ running: false, port: null });
const [webStatus, setWebStatus] = useState({ running: false, port: null });
const [iperfStatus, setIperfStatus] = useState({ running: false, port: null });

// 각각 별도의 useEffect로 폴링 (198-279 라인)
```

**개선 방안:**
```javascript
// hooks/useServerStatus.js 생성
export function useServerStatus() {
  const [serverStatuses, setServerStatuses] = useState({
    tftp: { running: false, port: null },
    web: { running: false, port: null },
    iperf: { running: false, port: null }
  });
  
  // 통합 폴링 로직
  useEffect(() => {
    const pollStatus = async () => {
      const [tftp, web, iperf] = await Promise.all([
        window.electronAPI?.tftpStatus?.(),
        window.electronAPI?.webStatus?.(),
        window.electronAPI?.iperfStatus?.()
      ]);
      
      setServerStatuses({
        tftp: tftp || { running: false, port: null },
        web: web || { running: false, port: null },
        iperf: iperf || { running: false, port: null }
      });
    };
    
    pollStatus();
    const interval = setInterval(pollStatus, 10000);
    return () => clearInterval(interval);
  }, []);
  
  return { serverStatuses };
}
```

**예상 효과:**
- App.jsx에서 약 80-100 라인 감소
- 폴링 로직 통합으로 성능 개선 (3개 요청을 병렬 처리)
- 코드 중복 제거

**기능 영향:** 없음 (기능 동일, 성능 개선)

---

### 3. Auto-Reconnect 로직 통합 ⭐⭐⭐ (높은 우선순위)

**현재 문제점:**
- SSH와 Serial 연결의 auto-reconnect 로직이 거의 동일하게 중복됨
- `handleSshCloseForReconnect` (505-590 라인)와 `handleSerialClose` (762-831 라인)이 유사한 로직
- 약 70라인의 중복 코드

**개선 방안:**
```javascript
// hooks/useAutoReconnect.js 생성
export function useAutoReconnect({
  autoReconnect,
  reconnectSession,
  sessions,
  setSessions,
  setReconnectingSessions,
  updateConnectionIdMap
}) {
  const handleConnectionClose = useCallback((sessionId) => {
    // 세션 상태를 disconnected로 업데이트
    setSessions(prev => prev.map(s => 
      s.id === sessionId ? { ...s, isConnected: false } : s
    ));
    
    if (!autoReconnect) return;
    
    setTimeout(async () => {
      // 재연결 로직 (공통)
      // ...
    }, 500);
  }, [autoReconnect, reconnectSession, sessions, setSessions, setReconnectingSessions, updateConnectionIdMap]);
  
  return { handleConnectionClose };
}
```

**예상 효과:**
- App.jsx에서 약 70-80 라인 감소
- 코드 중복 제거
- 유지보수성 향상 (한 곳에서 수정)

**기능 영향:** 없음 (기능 동일)

---

### 4. 에러 다이얼로그 처리 통합 ⭐⭐ (중간 우선순위)

**현재 문제점:**
- 에러 다이얼로그 설정 로직이 여러 곳에 분산
- Web Server, TFTP Server 에러 핸들러가 유사한 패턴 반복 (281-317 라인)
- 에러 포맷팅 로직이 중복될 수 있음

**개선 방안:**
```javascript
// hooks/useErrorHandler.js 생성
export function useErrorHandler() {
  const [errorDialog, setErrorDialog] = useState({
    isOpen: false,
    title: '',
    message: '',
    detail: '',
    error: null
  });
  
  const showError = useCallback((errorData) => {
    setErrorDialog({
      isOpen: true,
      title: errorData.title || 'Error',
      message: errorData.message || 'An error occurred',
      detail: errorData.detail || '',
      error: errorData.error || null
    });
  }, []);
  
  const closeError = useCallback(() => {
    setErrorDialog({
      isOpen: false,
      title: '',
      message: '',
      detail: '',
      error: null
    });
  }, []);
  
  return { errorDialog, showError, closeError };
}
```

**예상 효과:**
- App.jsx에서 약 30-40 라인 감소
- 에러 처리 일관성 향상
- 재사용 가능한 에러 핸들러

**기능 영향:** 없음 (기능 동일)

---

### 5. SessionManager Props 최적화 ⭐⭐ (중간 우선순위)

**현재 문제점:**
- SessionManager에 60+ 개의 props 전달
- Props drilling 문제
- 컴포넌트 인터페이스가 복잡함

**개선 방안 1: Context API 사용**
```javascript
// contexts/SessionManagerContext.js 생성
const SessionManagerContext = createContext();

// App.jsx에서 Provider로 감싸기
<SessionManagerContext.Provider value={sessionManagerState}>
  <SessionManager />
</SessionManagerContext.Provider>
```

**개선 방안 2: 단일 Config 객체**
```javascript
// Props를 단일 객체로 전달
<SessionManager config={sessionManagerConfig} />
```

**예상 효과:**
- Props 개수 감소
- 컴포넌트 인터페이스 단순화
- 유지보수성 향상

**기능 영향:** 없음 (기능 동일)

---

### 6. App Info 로딩 로직 통합 ⭐ (낮은 우선순위)

**현재 문제점:**
- App info를 로드하는 로직이 여러 곳에 분산 (181-196, 1012-1024, 1340-1352 라인)
- 유사한 패턴이 3번 반복됨

**개선 방안:**
```javascript
// hooks/useAppInfo.js 생성
export function useAppInfo() {
  const [appInfo, setAppInfo] = useState({ 
    version: '', 
    author: { name: 'Bryce Ghim', email: 'admin@toktoktalk.com' } 
  });
  
  const loadAppInfo = useCallback(async () => {
    try {
      const info = await window.electronAPI.getAppInfo();
      if (info.success) {
        setAppInfo({
          version: info.version,
          author: info.author,
        });
      }
    } catch (error) {
      console.error('Failed to load app info:', error);
    }
  }, []);
  
  useEffect(() => {
    loadAppInfo();
  }, [loadAppInfo]);
  
  return { appInfo, loadAppInfo };
}
```

**예상 효과:**
- App.jsx에서 약 20-30 라인 감소
- 코드 중복 제거

**기능 영향:** 없음 (기능 동일)

---

### 7. iperf3 Availability 체크 통합 ⭐ (낮은 우선순위)

**현재 문제점:**
- iperf3 availability 체크가 별도 useEffect로 분리 (242-257 라인)
- 서버 상태와 함께 관리 가능

**개선 방안:**
- `useServerStatus` 훅에 통합

**예상 효과:**
- App.jsx에서 약 15-20 라인 감소

**기능 영향:** 없음 (기능 동일)

---

## 📈 예상 개선 효과

### 코드 메트릭
- **App.jsx 라인 수**: 1,500 라인 → 약 1,200 라인 (약 20% 감소)
- **중복 코드 제거**: 약 200-250 라인
- **새로운 훅 생성**: 5-6개

### 품질 개선
- **코드 재사용성**: 향상
- **유지보수성**: 향상
- **테스트 용이성**: 향상
- **가독성**: 향상

### 성능 개선
- 서버 상태 폴링 최적화 (병렬 처리)
- 불필요한 리렌더링 감소 가능

---

## 🗺️ 리팩토링 우선순위

### Phase 1: 높은 우선순위 (기능 영향 없음, 큰 효과)
1. ✅ 다이얼로그 상태 관리 통합
2. ✅ 서버 상태 관리 통합
3. ✅ Auto-Reconnect 로직 통합

### Phase 2: 중간 우선순위 (기능 영향 없음, 중간 효과)
4. ✅ 에러 다이얼로그 처리 통합
5. ✅ SessionManager Props 최적화

### Phase 3: 낮은 우선순위 (기능 영향 없음, 작은 효과)
6. ✅ App Info 로딩 로직 통합
7. ✅ iperf3 Availability 체크 통합

---

## ⚠️ 주의사항

1. **점진적 리팩토링**: 한 번에 모든 것을 바꾸지 말고 단계적으로 진행
2. **기능 테스트**: 각 단계마다 기능이 동일하게 동작하는지 확인
3. **Git 커밋**: 각 Phase마다 커밋하여 롤백 가능하게 유지
4. **의존성 주의**: 훅 간 의존성 순서 확인 (예: useConnectionManagement 후 useAutoReconnect)

---

## 🔍 추가 개선 가능 사항

### 코드 품질
- TypeScript 도입 고려 (점진적 마이그레이션)
- ESLint 규칙 강화
- JSDoc 주석 추가

### 성능 최적화
- React.memo 적용 검토
- useMemo/useCallback 최적화
- 코드 스플리팅 (React.lazy) - 다이얼로그 지연 로딩

---

## 📝 결론

위의 개선 사항들은 모두 **기능에 영향을 미치지 않으면서** 코드 품질과 유지보수성을 크게 향상시킬 수 있습니다. 

**Phase 1부터 시작하는 것을 권장**하며, 각 단계마다 테스트를 진행하면서 점진적으로 리팩토링을 진행하는 것이 안전합니다.










