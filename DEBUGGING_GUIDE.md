# 디버깅 가이드

## 현재 구현 상태

큐 기반으로 command를 전달하는 방식이 구현되어 있습니다. 하지만 여전히 "ash_ssh_execute"가 표시된다면:

## 확인해야 할 사항

### 1. 백엔드 로그 확인

백엔드 로그에서 다음을 확인하세요:

```
✅ [QUEUE] Saved command to queue: 'ls -alt' (queue size: 1)
📊 [QUEUE] Tool result for ash_ssh_execute, queue size: 1
✅ [QUEUE] Retrieved command from queue: 'ls -alt' (remaining: 0)
📤 [STREAM] Sending tool_result: name=ash_ssh_execute, command=ls -alt, stdout length=XXX
```

**문제가 있다면:**
- `⚠️ [QUEUE] No command extracted` - command 추출 실패
- `⚠️ [QUEUE] Queue is empty!` - 큐가 비어있음 (순서 문제)

### 2. 프론트엔드 콘솔 로그 확인

브라우저 콘솔에서 다음을 확인하세요:

```
[QwenAgentService] 📊 Tool result received: name=ash_ssh_execute, command=ls -alt, stdout length=XXX
[useAICommand] 📊 Setting streamingToolResult: name=ash_ssh_execute, command=ls -alt
```

**문제가 있다면:**
- `command=null` - 백엔드에서 command를 전달하지 않음
- `command=undefined` - 데이터 구조 문제

### 3. 실제 데이터 확인

브라우저 개발자 도구의 Network 탭에서 SSE 이벤트를 확인하세요:

```
data: {"type":"tool_result","name":"ash_ssh_execute","command":"ls -alt",...}
```

**문제가 있다면:**
- `command` 필드가 없음
- `command` 필드가 null 또는 빈 문자열

## 일반적인 문제

### 문제 1: Command 추출 실패

**원인:** `tool_args` 파싱 실패
**해결:** `tool_args` 형식 확인

### 문제 2: 큐 순서 문제

**원인:** tool_call과 tool_result가 다른 순서로 도착
**해결:** Qwen-Agent가 순차적으로 처리하는지 확인

### 문제 3: Command가 None

**원인:** `args.get('command')`가 None 반환
**해결:** tool_args에서 command 필드 확인

## 다음 단계

로그를 확인한 후, 문제점을 알려주시면 더 구체적인 해결책을 제시하겠습니다.

