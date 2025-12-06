# 중복 Content 스트리밍 문제 분석

## 문제 상황

AI가 같은 내용을 반복적으로 출력하고 있습니다. 예를 들어:
- "시스템 메시지 사용량을 조사하기 위해 시스템 로그 파일을 확인해 보겠습니다..."
- 같은 텍스트가 여러 번 반복되어 출력됨

## 원인 분석

### 1. Assistant가 같은 응답을 반복 생성
- Tool result를 받고도 같은 응답을 계속 생성
- Conversation history에 이전 응답이 제대로 반영되지 않음
- System prompt가 중복 생성을 막지 못함

### 2. Content Chunk 중복 스트리밍
- 같은 assistant message가 여러 번 처리됨
- Content chunk가 중복으로 스트리밍됨

### 3. ReAct Loop 문제
- Tool call → Tool execution → Tool result → Assistant response 사이클에서 문제 발생
- Assistant가 tool result를 보고도 같은 응답을 생성

## 해결 방안

### 이미 구현된 것:
1. ✅ Content hash 기반 중복 체크 (`sent_content_hashes`)
2. ✅ Turn limit (최대 20턴) 추가
3. ✅ 상세한 로깅 추가

### 추가로 필요한 것:
1. **System Prompt 개선**
   - "DO NOT repeat the same response" 강화
   - "Check if you've already provided this information" 추가

2. **Conversation History 관리 개선**
   - Tool result가 제대로 history에 추가되는지 확인
   - Assistant가 history를 제대로 참조하는지 확인

3. **Safety Checks**
   - 같은 tool을 같은 args로 3번 이상 호출하면 중단
   - 같은 content를 3번 이상 생성하면 중단

## 디버깅 방법

1. Backend 로그 확인:
   ```bash
   # Backend 로그에서 다음을 확인:
   - "[Backend] ⏭️ Skipping duplicate content" 메시지
   - "[Backend] 📤 Streaming new content chunk" 메시지
   - Turn count가 증가하는지 확인
   ```

2. Frontend 콘솔 확인:
   - `[QwenAgentService]` 로그
   - `[useAICommand]` 로그
   - Content chunk가 중복으로 수신되는지 확인

3. Conversation History 확인:
   - Tool result가 history에 제대로 추가되는지
   - Assistant가 history를 참조하는지

## 다음 단계

1. 사용자가 다시 테스트해보고 로그를 확인
2. 로그를 분석해서 어디서 중복이 발생하는지 파악
3. System prompt 개선 또는 Conversation history 관리 개선

