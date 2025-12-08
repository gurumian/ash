# 다음 단계: 디버깅

## 추가된 기능

1. ✅ 디버깅 로그 추가
2. ✅ toolArgs에서 직접 추출하는 fallback 로직 추가
3. ✅ 더 상세한 콘솔 로그

## 확인해야 할 사항

### 1. 브라우저 콘솔 확인

다음 로그들이 나오는지 확인하세요:

```
[QwenAgentService] 🔧 Tool call: name=ash_ssh_execute, command=..., hasCommand=...
[QwenAgentService] ✅ Saved command to queue: '...' (queue size: 1)
[QwenAgentService] 📊 Tool result: name=ash_ssh_execute, queue size=1
[QwenAgentService] ✅ Retrieved command from queue: '...' (remaining: 0)
[QwenAgentService] 📤 Sending toolResult: name=..., command=...
[useAICommand] 📊 Setting streamingToolResult: name=..., command=...
```

### 2. 문제 진단

#### 케이스 1: command가 null인 경우
```
[QwenAgentService] ⚠️ No command found for ash_ssh_execute, toolArgs: ...
```
→ 백엔드에서 command 추출 실패 또는 toolArgs 형식 문제

#### 케이스 2: 큐가 비어있는 경우
```
[QwenAgentService] ⚠️ Queue is empty! No command available for ash_ssh_execute
```
→ tool_call 이벤트를 받지 못했거나, 순서 문제

### 3. 백엔드 로그 확인

백엔드 로그에서 다음을 확인하세요:
```
Tool call request: ash_ssh_execute with args: ...
```

## 다음 액션

1. 실제 테스트 실행
2. 브라우저 콘솔 로그 확인
3. 백엔드 로그 확인
4. 문제점 공유

문제가 계속되면 로그를 공유해주시면 더 정확한 진단이 가능합니다.

