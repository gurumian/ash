# 불필요한 코드 분석

## 제거 가능한 코드

### 1. Auto-reconnect 관련 코드 (작동하지 않음)

#### App.jsx
- `onSshCloseRef` ref (386-387줄)
- `handleSshCloseForReconnect` 함수 전체 (471-555줄)
- `useEffect` for updating `onSshCloseRef` (558-561줄)
- Serial close의 auto-reconnect 로직 (625-785줄)
- 모든 `[Auto-reconnect]` 디버깅 console.log들

#### useTerminalManagement.js
- `onSshClose` prop (24줄)
- `onSshCloseRef` ref (35-36줄)
- `useEffect` for updating `onSshCloseRef` (59-62줄)
- `handleSshClose`에서 `onSshCloseRef.current` 호출 부분 (613-614줄)

### 2. 유지해야 할 코드

#### Settings.jsx
- Auto-reconnect 토글 옵션 (사용자가 나중에 다시 시도할 수 있도록)
- Reconnect retry 설정 (interval, maxAttempts) - 이건 작동함

#### useConnectionManagement.js
- `reconnectSSHSession`의 재시도 로직 - 이건 작동함 (수동 reconnect 버튼에서 사용)

#### App.jsx
- `autoReconnect` state - Settings와 연동되어 있음
- `reconnectRetry` state - 재시도 설정용
- 수동 reconnect 버튼 관련 코드 - 이건 작동함

## 정리 계획

1. **제거할 것:**
   - `handleSshCloseForReconnect` 함수 전체
   - `onSshCloseRef` 관련 코드
   - `useTerminalManagement`의 `onSshClose` prop 관련 코드
   - Serial close의 auto-reconnect 로직
   - 모든 디버깅 console.log

2. **유지할 것:**
   - Settings의 auto-reconnect 옵션 (UI는 유지, 기능은 나중에 다시 구현 가능)
   - Reconnect retry 로직 (수동 reconnect에서 사용 중)
   - 수동 reconnect 버튼 관련 코드









