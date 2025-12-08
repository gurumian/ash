# Function Results 섹션에서 Command 표시

## 현재 구현 상태

### 1. FunctionResult 컴포넌트
- ✅ `command` prop을 받아서 표시
- ✅ `command || name || 'Command'` 순서로 표시

### 2. FunctionResultsSection 컴포넌트
- ✅ `toolResult.command`를 FunctionResult에 전달

### 3. 데이터 흐름
- ✅ 백엔드: tool_result에 command 포함
- ✅ 프론트엔드: toolResult에 command 포함
- ✅ useAICommand: toolResultData에 command 포함
- ✅ AIChatSidebar: msg.toolResults에 command 포함

## 확인 사항

toolResult에 command가 포함되어 있다면 자동으로 표시됩니다!

## 테스트

Function Results 섹션을 펼쳐보면:
- `✓ ls -alt` (command가 있으면)
- `✓ ash_ssh_execute` (command가 없으면 name 표시)

처럼 표시됩니다.

