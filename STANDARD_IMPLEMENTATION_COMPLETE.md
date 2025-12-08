# 정석 방식 구현 완료

## 구현 방식

**프론트엔드에서만 처리하는 방식**으로 구현했습니다.

### 원리

1. 백엔드: `tool_call` 이벤트에 `command` 포함 (이미 구현됨)
2. 프론트엔드: `tool_call`에서 `command`를 받아서 FIFO 큐에 저장
3. 프론트엔드: `tool_result`가 올 때 큐에서 `command`를 가져와서 사용
4. 프론트엔드: UI에서 `command` 표시

## 수정된 파일

### 1. `src/services/qwen-agent-service.js`

#### Command 큐 생성
```javascript
async executeTask(...) {
  // Command 큐: tool_call과 tool_result를 순차적으로 매칭하기 위한 FIFO 큐
  const commandQueue = [];
```

#### tool_call에서 command 저장
```javascript
if (data.type === 'tool_call') {
  // Command 추출 및 큐에 저장 (ash_ssh_execute인 경우)
  if (toolName === 'ash_ssh_execute' && data.command) {
    commandQueue.push(data.command);
  }
}
```

#### tool_result에서 command 가져오기
```javascript
if (data.name && (data.stdout !== undefined || data.stderr !== undefined)) {
  // Command 가져오기 (큐에서)
  let command = null;
  if (toolName === 'ash_ssh_execute' && commandQueue.length > 0) {
    command = commandQueue.shift();
  }
  
  const toolResult = {
    name: data.name,
    command: command,  // 큐에서 가져온 command
    ...
  };
}
```

### 2. `src/hooks/useAICommand.js`

```javascript
setStreamingToolResult({
  name: toolName,
  command: toolResultData.command || null,  // command 추가
  stdout: toolResultData.stdout,
  stderr: toolResultData.stderr || ''
});
```

### 3. `src/components/AIChatSidebar.jsx`

```jsx
Executing: {streamingToolResult.command || streamingToolResult.name}
```

## 장점

- ✅ **백엔드 변경 없음**: 백엔드는 이미 `tool_call`에 `command`를 포함하고 있음
- ✅ **프론트엔드에서 완전히 제어**: 모든 로직이 프론트엔드에 있음
- ✅ **순서 보장**: FIFO 큐를 사용하여 순차적으로 매칭
- ✅ **간단하고 명확**: 복잡한 백엔드 로직 없이 프론트엔드에서만 처리

## 작동 방식

1. `tool_call` 이벤트가 오면:
   - `ash_ssh_execute`인 경우 `data.command`를 큐에 저장

2. `tool_result` 이벤트가 오면:
   - 큐에서 가장 오래된 command를 가져와서 `toolResult.command`에 포함
   - `onToolResult` 콜백으로 전달

3. Hook에서:
   - `toolResult.command`를 `streamingToolResult.command`에 저장

4. UI에서:
   - `streamingToolResult.command`가 있으면 표시, 없으면 `name` 표시

## 완료!

이제 "Executing: ls -alt"와 같이 실제 명령어가 표시됩니다!

