# App.jsx 큰 블록 분석

## 발견된 리팩토링 포인트

### 🔴 우선순위 높음 (명확한 중복/복잡도)

#### 1. 서버 상태 폴링 (215-296 라인)
**현재 상태:**
- TFTP, Web, iperf 각각 별도 useEffect로 폴링
- 거의 동일한 코드가 3번 반복
- 각각 10초마다 폴링

**리팩토링 제안:**
- `useServerStatus` 훅으로 통합
- 예상 감소: ~60줄

---

#### 2. 서버 에러 이벤트 리스너 (298-334 라인)
**현재 상태:**
- Web Server와 TFTP Server 에러 이벤트 리스너
- 거의 동일한 패턴 (다만 title만 다름)

**리팩토링 제안:**
- `useServerErrorHandlers` 훅으로 통합
- 예상 감소: ~20줄

---

#### 3. 그룹 관련 핸들러들 (73-116 라인)
**현재 상태:**
- `addSessionToGroup` wrapper
- `handleDisconnectGroup` (18줄)
- `handleDeleteGroup` (3줄)
- `createGroupWithSession` (9줄)

**리팩토링 제안:**
- `useGroupHandlers` 훅으로 통합
- 또는 `useGroups` 훅에 통합
- 예상 감소: ~30줄

---

### 🟡 우선순위 중간 (긴 인라인 로직)

#### 4. 리사이즈 핸들러 (549-586 라인)
**현재 상태:**
- `handleResizeStart` - 37줄의 인라인 로직
- 마우스 이벤트 리스너 관리

**리팩토링 제안:**
- `useResizeHandler` 훅으로 추출
- 예상 감소: ~30줄

---

#### 5. 컨텍스트 메뉴 핸들러들 (988-1040 라인)
**현재 상태:**
- `onCopy` - 23줄 (클립보드 복사 로직)
- `onPaste` - 12줄
- `onSelectAll` - 5줄
- `isSSHSession` - 인라인 IIFE

**리팩토링 제안:**
- `useTerminalContextMenu` 훅으로 추출
- 또는 `utils/clipboard.js` 유틸리티 함수로 추출
- 예상 감소: ~40줄

---

#### 6. SessionDialog onSave 핸들러 (1138-1174 라인)
**현재 상태:**
- 36줄의 복잡한 세션 업데이트 로직
- 세션 업데이트 + connection history 업데이트

**리팩토링 제안:**
- `useSessionUpdate` 훅으로 추출
- 또는 `utils/sessionUpdate.js` 유틸리티 함수로 추출
- 예상 감소: ~30줄

---

### 🟢 우선순위 낮음 (작은 개선)

#### 7. Library export 핸들러 (903-918 라인)
**현재 상태:**
- 15줄의 인라인 async 함수

**리팩토링 제안:**
- `useLibraryExport` 훅으로 추출
- 예상 감소: ~10줄

---

#### 8. CustomTitleBar 핸들러들 (799-844 라인)
**현재 상태:**
- `onCheckForUpdates` - 17줄
- `onAbout` - 13줄
- `onToggleSessionManager` - 8줄

**리팩토링 제안:**
- `useTitleBarHandlers` 훅으로 추출
- 예상 감소: ~30줄

---

#### 9. App Info 로딩 (197-213 라인)
**현재 상태:**
- 16줄의 useEffect

**리팩토링 제안:**
- `useAppInfo` 훅으로 추출
- 예상 감소: ~10줄

---

#### 10. Window Title 업데이트 (696-720 라인)
**현재 상태:**
- 24줄의 useEffect

**리팩토리 제안:**
- `useWindowTitle` 훅으로 추출
- 예상 감소: ~20줄

---

## 우선순위별 정리

### 즉시 진행 가능 (영향 없음, 명확한 중복)
1. ✅ 서버 상태 폴링 통합 (~60줄)
2. ✅ 서버 에러 이벤트 리스너 통합 (~20줄)
3. ✅ 그룹 핸들러 통합 (~30줄)

**총 예상 감소: ~110줄**

### 다음 단계 (긴 인라인 로직)
4. 리사이즈 핸들러 추출 (~30줄)
5. 컨텍스트 메뉴 핸들러 추출 (~40줄)
6. SessionDialog onSave 추출 (~30줄)

**총 예상 감소: ~100줄**

### 추가 개선 (작은 개선)
7-10. 기타 작은 핸들러들 (~70줄)

---

## 전체 예상 효과

- **총 예상 감소: ~280줄**
- **현재 App.jsx: 1,256줄**
- **예상 결과: ~976줄 (약 22% 감소)**

## 추천 진행 순서

1. **서버 상태 폴링 통합** (가장 명확하고 중복이 많음)
2. **서버 에러 이벤트 리스너 통합** (간단하고 명확)
3. **그룹 핸들러 통합** (관련 로직을 한 곳으로)
4. **컨텍스트 메뉴 핸들러 추출** (긴 인라인 로직)
5. **리사이즈 핸들러 추출** (긴 인라인 로직)
6. **SessionDialog onSave 추출** (복잡한 로직)


