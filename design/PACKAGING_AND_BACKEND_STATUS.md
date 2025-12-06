# Packaging 및 Backend Status Indicator 구현 계획

## 목표

1. **Packaging 개선**: log-chat의 경험을 바탕으로 backend.spec 및 build 스크립트 최적화
2. **Backend Status Indicator**: AI Chat 헤더에 원형 램프로 백엔드 상태 표시

---

## 1. Packaging 개선

### 1.1 backend.spec 비교

#### log-chat (참고)
- `qwen_agent`, `qwen_agent.agent`, `qwen_agent.llm`, `qwen_agent.tools`, `qwen_agent.utils` 포함
- 동적 경로 탐지 함수 사용
- datas에 qwen_agent utils 폴더 포함

#### ash (현재)
- `qwen_agent.agents`, `qwen_agent.agents.assistant` 추가로 포함 (더 많은 submodule)
- 동적 경로 탐지 함수 사용
- datas에 qwen_agent utils 폴더 포함

**결론**: ash의 backend.spec이 더 완전함 (agents submodule 포함). 유지.

### 1.2 build-backend.sh

#### 현재 상태
- `uv add pyinstaller` 사용 ✅
- `uv run pyinstaller backend.spec` 사용 ✅
- 플랫폼별 실행 파일 확인 (ash-backend / ash-backend.exe) ✅

**개선 필요사항**: 없음 (이미 올바르게 구현됨)

### 1.3 forge.config.js

#### 현재 상태
- `extraResource`에 `backend/dist/ash-backend` 포함 ✅
- 플랫폼별 확장자 처리 (`.exe`) ✅
- Fallback 경로 처리 ✅

**개선 필요사항**: 없음 (log-chat과 동일한 패턴)

---

## 2. Backend Status Indicator

### 2.1 요구사항

- **위치**: AIChatSidebar 헤더 (AI Chat 제목 옆)
- **형태**: 원형 램프 (Circle indicator)
- **색상**:
  - 🟢 녹색 (#00ff41): Backend Ready
  - 🟡 노란색 (#ffaa00): Backend Starting
  - ⚫ 회색 (#666): Backend Not Ready
- **텍스트**: 없음 (아이콘만)

### 2.2 구현 계획

#### 2.2.1 Backend Status Hook (`src/hooks/useBackendStatus.js`)

```javascript
// 주기적으로 백엔드 상태 체크 (5초마다)
// 상태: 'ready' | 'starting' | 'not-ready'
// AIChatSidebar가 보일 때만 체크
```

**기능**:
- `QwenAgentService.checkHealth()` 사용
- AIChatSidebar가 visible일 때만 polling 시작
- 상태 변화 추적 (debounce 처리)

#### 2.2.2 AIChatSidebar 수정

**변경사항**:
- 헤더에 원형 램프 indicator 추가
- `useBackendStatus` hook 사용
- 상태에 따른 색상 변경

**UI 구조**:
```
[AI Chat] [●] [×]
           ↑
      원형 램프
```

#### 2.2.3 스타일

```css
.backend-status-indicator {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  display: inline-block;
  margin-left: 8px;
  transition: background-color 0.3s;
}

.backend-status-indicator.ready {
  background-color: #00ff41;
  box-shadow: 0 0 4px rgba(0, 255, 65, 0.5);
}

.backend-status-indicator.starting {
  background-color: #ffaa00;
  box-shadow: 0 0 4px rgba(255, 170, 0, 0.5);
}

.backend-status-indicator.not-ready {
  background-color: #666;
}
```

---

## 3. 구현 순서

1. ✅ **useBackendStatus Hook 생성**
   - 주기적 health check
   - 상태 관리 ('ready', 'starting', 'not-ready')

2. ✅ **AIChatSidebar 수정**
   - Hook 사용
   - 원형 램프 indicator 추가
   - 스타일 적용

3. ✅ **테스트**
   - Backend 없을 때: 회색
   - Backend 시작 중: 노란색
   - Backend 준비됨: 녹색

---

## 4. 주의사항

1. **Performance**: 
   - AIChatSidebar가 보일 때만 polling
   - cleanup 시 interval 제거

2. **Starting 상태**:
   - On-demand loading 시 starting 상태 표시 필요
   - `window.electronAPI.startBackend()` 호출 시 starting 상태로 변경

3. **Error Handling**:
   - Network error 시 not-ready로 처리
   - Timeout 설정 (5초)

---

## 5. 파일 변경 목록

- `src/hooks/useBackendStatus.js` (신규)
- `src/components/AIChatSidebar.jsx` (수정)
- `src/App.jsx` (선택적: backend status 전달)

