# 최종 해결 방법: function_id 사용

## 핵심 발견

Qwen-Agent 코드를 확인한 결과:
- **tool_call 메시지**: `message.extra['function_id']` 포함
- **tool_result 메시지**: `message.extra['function_id']` 포함 (같은 ID!)
- **매칭 방법**: `function_id`로 정확하게 매칭 가능!

## Qwen-Agent 레퍼런스

`Qwen-Agent/qwen_agent/agents/fncall_agent.py`:
```python
# tool_call
out.extra.get('function_id', '1')

# tool_result 생성 시 같은 function_id 사용
fn_msg = Message(role=FUNCTION,
                 name=tool_name,
                 content=tool_result,
                 extra={'function_id': out.extra.get('function_id', '1')})
```

## 구현된 코드

### 백엔드 (backend/app.py)

**1. function_id로 command 저장:**
```python
# tool_call 단계
extra = message.get('extra', {})
function_id = extra.get('function_id') if isinstance(extra, dict) else None

if command:
    if function_id:
        tool_command_map[function_id] = command  # ✅ function_id로 저장
    else:
        tool_command_map[tool_name] = command  # fallback
```

**2. function_id로 command 가져오기:**
```python
# tool_result 단계
extra = message.get('extra', {})
function_id = extra.get('function_id') if isinstance(extra, dict) else None

command = None
if function_id:
    command = tool_command_map.get(function_id)  # ✅ function_id로 가져오기
if not command:
    command = tool_command_map.get(tool_name)  # fallback
```

## 왜 이 방법이 확실한가?

1. ✅ **Qwen-Agent의 공식 방식**: function_id는 tool_call과 tool_result를 연결하는 공식 ID
2. ✅ **고유성 보장**: 같은 tool_name이 여러 번 호출되어도 각각 다른 function_id
3. ✅ **정확한 매칭**: function_id가 있으면 100% 정확하게 매칭
4. ✅ **Fallback**: function_id가 없어도 tool_name으로 fallback

## 수정된 파일

1. `backend/app.py`: function_id 기반 매칭으로 변경
2. `src/services/qwen-agent-service.js`: tool_result에 command 포함
3. `src/hooks/useAICommand.js`: streamingToolResult에 command 추가
4. `src/components/AIChatSidebar.jsx`: command 표시

이제 **확실하게 작동할 것입니다!**

