# 대화 히스토리 유지 수정

## 문제

새로운 입력이 들어갈 때 이전 대화가 화면에서 사라지는 문제가 있었습니다.

### 원인

`useAICommand.js`에서:
1. `collectedMessages = [userMessage]` - 새 배열로 시작하여 기존 메시지가 포함되지 않음
2. `setAiMessages(updatedMessages)` - 기존 메시지를 덮어씀

## 해결

### 수정 전
```javascript
const collectedMessages = [userMessage]; // 기존 메시지 없음!
const updatedMessages = [...collectedMessages];
setAiMessages(updatedMessages); // 기존 메시지 덮어씀!
```

### 수정 후
```javascript
// 함수형 업데이트로 기존 메시지 유지
setAiMessages(prev => {
  const updatedMessages = [...prev]; // 기존 메시지 모두 포함
  // 새 메시지 추가/업데이트
  return updatedMessages;
});
```

## 변경 사항

1. **User 메시지 추가**: 기존 메시지에 추가
2. **Assistant 메시지 업데이트**: 함수형 업데이트로 기존 메시지 유지
3. **Tool result 추가**: 기존 메시지 뒤에 추가
4. **Final 메시지**: 함수형 업데이트로 기존 메시지 유지

## 결과

✅ 이제 모든 대화가 화면에 누적되어 표시됨
✅ 스크롤하여 이전 대화를 볼 수 있음
✅ 백엔드에도 히스토리가 전달되어 컨텍스트 유지됨

## 남은 작업

- [ ] 영구 저장 (DB 또는 localStorage) - 앱 재시작 후에도 대화 복원

