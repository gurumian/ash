# Function Result 구조화 및 렌더링 개선

## 문제 상황

AI 응답에서 `[function]: {...}` 형태의 JSON 패턴이 스트리밍 중에 섞여 나와서 못생기게 보였습니다.

### 예시
```
[function]: {"success": false, "output": "○ sysstat.service - Resets System Activity Logs\n Loaded: loaded ...", "error": "", "exitCode": 3}
```

이런 형식이 AI 응답 content에 섞여서 그대로 표시되면 가독성이 매우 떨어집니다.

## 해결 방법

### 1. 백엔드: 구조화된 tool_result 전송

**backend/app.py (라인 312-336):**
- Tool 결과를 JSON으로 파싱하여 구조화
- 성공/실패, exitCode, stdout, stderr를 분리하여 전송

```python
# 구조화된 형태로 전송
{
    'type': 'tool_result',
    'name': 'ash_ssh_execute',
    'success': False,
    'exitCode': 3,
    'stdout': '○ sysstat.service...',
    'stderr': ''
}
```

### 2. 프론트엔드: FunctionResult 컴포넌트

**src/components/FunctionResult.jsx:**
- 성공/실패 상태에 따른 색상 구분 (초록/빨강)
- Exit code 배지 표시
- stdout/stderr를 별도로 표시
- 터미널 스타일의 깔끔한 UI

### 3. Content 파싱

**src/utils/parseFunctionResult.js:**
- Content에서 `[function]: {...}` 패턴을 파싱
- 구조화된 데이터로 변환
- Cleaned content 반환 (패턴 제거된 버전)

**src/components/AIChatSidebar.jsx:**
- Content에서 function 결과 파싱
- Parsed function results를 FunctionResult 컴포넌트로 렌더링
- Cleaned content를 Markdown으로 렌더링

## 결과

✅ **구조화된 데이터**: Tool 결과가 명확한 구조로 전송
✅ **예쁜 UI**: 성공/실패 상태, exit code, stdout/stderr를 깔끔하게 표시
✅ **자동 파싱**: Content에 섞여 있는 function 패턴도 자동으로 파싱하여 표시
✅ **터미널 스타일**: Ash 앱의 터미널 테마와 일관된 디자인

## 사용 예시

### 백엔드에서 구조화된 tool_result 전송
```json
{
  "type": "tool_result",
  "name": "ash_ssh_execute",
  "success": false,
  "exitCode": 3,
  "stdout": "○ sysstat.service - Resets System Activity Logs\n...",
  "stderr": ""
}
```

### 프론트엔드에서 렌더링
- ✓/✗ 아이콘과 함수 이름
- Exit 3 배지
- stdout/stderr를 터미널 스타일 박스에 표시

## 향후 개선

- [ ] Syntax highlighting 적용 (bash 출력에)
- [ ] Collapsible 출력 (긴 출력 접기/펼치기)
- [ ] Command 복사 버튼
- [ ] 출력 검색 기능

