# i18n 남은 작업 정리

## ✅ 완료된 컴포넌트

1. **기본 인프라**
   - i18n 설정 및 구조
   - 번역 파일 (en/ko) 기본 네임스페이스

2. **주요 UI 컴포넌트**
   - CustomTitleBar / CustomMenuBar ✅
   - SessionManager ✅
   - ConnectionForm ✅
   - StatusBar ✅
   - Settings ✅
   - AboutDialog ✅
   - ErrorDialog ✅

## ⏳ 남은 작업

### 간단한 다이얼로그 (우선순위 높음)
1. **ConfirmDialog** - 확인 다이얼로그 (3개 텍스트)
2. **GroupNameDialog** - 그룹 이름 입력 (3-4개 텍스트)

### 터미널 관련 컴포넌트
3. **TerminalView** - 터미널 뷰 (버튼, 툴팁 등)
4. **TerminalSearchBar** - 검색바 (검색 관련 텍스트)
5. **TerminalAICommandInput** - AI 명령 입력
6. **TabItem** - 탭 아이템 (Close 툴팁)

### 서버 다이얼로그
7. **TftpServerDialog** - TFTP 서버 설정
8. **WebServerDialog** - 웹 서버 설정
9. **IperfServerDialog** - iperf3 서버 설정

### 세션/라이브러리 다이얼로그
10. **SessionDialog** - 세션 설정
11. **LibraryDialog** - 라이브러리 편집
12. **LibraryImportDialog** - 라이브러리 임포트
13. **FileUploadDialog** - 파일 업로드

### 기타
14. **LicensesDialog** - 라이선스 정보
15. **TerminalContextMenu** - 컨텍스트 메뉴
16. 기타 작은 컴포넌트들

## 작업량 추정

- 간단한 다이얼로그 (2개): ~30분
- 터미널 관련 (4개): ~1-2시간
- 서버 다이얼로그 (3개): ~1-2시간
- 세션/라이브러리 (4개): ~1-2시간
- 기타: ~30분

**총 예상 시간**: 4-7시간

## 권장 진행 순서

1. ConfirmDialog, GroupNameDialog (빠름, 자주 사용)
2. TerminalView 관련 (주요 UI)
3. 서버 다이얼로그들
4. 나머지

