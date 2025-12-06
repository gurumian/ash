# On-Demand Backend Loading 구현 계획

## 문제점 분석

### 현재 상황
1. **앱 시작 시 백엔드 자동 시작** (`src/main.js` line 40-46)
   - AI 기능을 사용하지 않는 사용자에게도 불필요한 백엔드 시작 시도
   - 백엔드 시작 실패 시 앱 시작이 지연되거나 에러 발생 가능
   - PyInstaller 실행 파일 경로 문제 등으로 인한 시작 실패 가능성

2. **AI 명령 실행 시점** (`src/hooks/useAICommand.js` line 159)
   - `qwenAgent.checkHealth()`로 백엔드 상태 확인만 수행
   - 백엔드가 없으면 에러 메시지 표시 후 종료
   - 사용자가 백엔드를 수동으로 시작해야 함

### 개선 목표
- **On-Demand Loading**: AI 기능이 실제로 활성화될 때만 백엔드 시작
- **자동 복구**: 백엔드가 없으면 자동으로 시작 시도
- **사용자 경험 개선**: 앱 시작이 빠르고, AI 사용 시에만 백엔드 리소스 사용

---

## 구현 계획

### 1. IPC 핸들러 추가 (Main Process → Renderer Process)

#### 1.1 `src/main/backend-handler.js` 수정
- 기존 `startBackend()`, `stopBackend()` 함수는 그대로 유지
- IPC 핸들러 함수 추가:
  ```javascript
  export function initializeBackendHandlers() {
    ipcMain.handle('backend-start', async () => {
      try {
        const result = await startBackend();
        return { success: true, url: result.url };
      } catch (error) {
        return { success: false, error: error.message };
      }
    });

    ipcMain.handle('backend-stop', async () => {
      try {
        await stopBackend();
        return { success: true };
      } catch (error) {
        return { success: false, error: error.message };
      }
    });

    ipcMain.handle('backend-check-health', async () => {
      try {
        const response = await fetch('http://127.0.0.1:54111/health');
        return { success: response.ok, status: response.status };
      } catch (error) {
        return { success: false, error: error.message };
      }
    });
  }
  ```

#### 1.2 `src/main.js` 수정
- `startBackend()` 호출 제거 (line 40-46)
- `initializeBackendHandlers()` 호출 추가:
  ```javascript
  import { initializeBackendHandlers } from './main/backend-handler.js';
  
  // Initialize all IPC handlers
  initializeSSHHandlers();
  initializeSerialHandlers();
  initializeWindowHandlers();
  initializeBackendHandlers(); // 추가
  // ...
  
  app.whenReady().then(async () => {
    startIPCBridge();
    // startBackend() 제거
    createMenu();
    const mainWindow = createWindow();
    // ...
  });
  ```

### 2. Preload API 추가 (Renderer Process 접근)

#### 2.1 `src/preload.js` 수정
```javascript
// Backend management APIs
startBackend: () => ipcRenderer.invoke('backend-start'),
stopBackend: () => ipcRenderer.invoke('backend-stop'),
checkBackendHealth: () => ipcRenderer.invoke('backend-check-health'),
```

### 3. AI 명령 실행 로직 수정 (On-Demand Loading)

#### 3.1 `src/hooks/useAICommand.js` 수정
```javascript
// Check backend health
let isHealthy = await qwenAgent.checkHealth();
if (!isHealthy) {
  // 백엔드가 없으면 자동으로 시작 시도
  console.log('Backend not available, starting on-demand...');
  const startResult = await window.electronAPI.startBackend();
  
  if (!startResult.success) {
    throw new Error(`Failed to start backend: ${startResult.error || 'Unknown error'}`);
  }
  
  // 백엔드가 준비될 때까지 대기 (health check)
  let retries = 30; // 30초 timeout
  while (retries > 0) {
    await new Promise(resolve => setTimeout(resolve, 1000)); // 1초 대기
    isHealthy = await qwenAgent.checkHealth();
    if (isHealthy) {
      console.log('✅ Backend started successfully');
      break;
    }
    retries--;
  }
  
  if (!isHealthy) {
    throw new Error('Backend started but health check failed. Please check backend logs.');
  }
}
```

### 4. QwenAgentService 개선

#### 4.1 `src/services/qwen-agent-service.js` 수정
- `checkHealth()` 메서드가 더 명확한 에러 정보 반환:
  ```javascript
  async checkHealth() {
    try {
      const response = await fetch(`${this.backendUrl}/health`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000) // 5초 timeout
      });
      return response.ok;
    } catch (error) {
      if (error.name === 'AbortError') {
        console.warn('[QwenAgentService] Health check timeout');
      } else {
        console.warn('[QwenAgentService] Health check failed:', error.message);
      }
      return false;
    }
  }
  ```

---

## 구현 순서

1. ✅ **IPC 핸들러 추가** (`src/main/backend-handler.js`)
2. ✅ **Main process 초기화** (`src/main.js`)
3. ✅ **Preload API 추가** (`src/preload.js`)
4. ✅ **On-demand 로딩 로직** (`src/hooks/useAICommand.js`)
5. ✅ **Health check 개선** (`src/services/qwen-agent-service.js`)

---

## 장점

1. **앱 시작 속도 향상**: 백엔드 시작 없이 앱이 즉시 시작됨
2. **리소스 효율성**: AI 기능을 사용하지 않는 경우 백엔드 프로세스가 실행되지 않음
3. **에러 처리 개선**: 백엔드 시작 실패가 앱 시작을 방해하지 않음
4. **자동 복구**: AI 기능 사용 시 백엔드가 자동으로 시작되어 사용자 편의성 향상
5. **명확한 책임 분리**: 
   - Main process: 백엔드 프로세스 관리
   - Renderer process: 백엔드 상태 확인 및 필요 시 시작 요청

---

## 주의사항

1. **IPC Bridge 의존성**: 
   - IPC Bridge는 여전히 앱 시작 시 시작되어야 함 (`src/main.js` line 37)
   - 백엔드는 IPC Bridge에 의존하므로, IPC Bridge가 먼저 시작되어야 함

2. **백엔드 시작 타임아웃**: 
   - AI 명령 실행 시 백엔드 시작 대기 시간 (기본 30초)
   - 사용자에게 로딩 상태 표시 필요

3. **에러 메시지**: 
   - 백엔드 시작 실패 시 명확한 에러 메시지 표시
   - 개발 모드와 프로덕션 모드에서 다른 에러 메시지 (uv/python 없음 vs 실행 파일 없음)

4. **백엔드 중지**: 
   - 앱 종료 시 백엔드 자동 중지 (이미 구현됨, `src/main.js` line 76-77)
   - 필요시 사용자가 수동으로 중지할 수 있는 기능 추가 가능

---

## 테스트 시나리오

1. ✅ **앱 시작**: 백엔드 없이 빠르게 시작됨
2. ✅ **AI 명령 실행 (백엔드 없음)**: 자동으로 백엔드 시작 후 명령 실행
3. ✅ **AI 명령 실행 (백엔드 있음)**: 즉시 명령 실행
4. ✅ **백엔드 시작 실패**: 명확한 에러 메시지 표시
5. ✅ **앱 종료**: 백엔드 자동 중지

