# 다국어 지원 (i18n) 구현 완료 보고서

## 구현 완료 사항

### 1. 패키지 설치 ✅
- `i18next`: 핵심 i18n 라이브러리
- `react-i18next`: React 통합
- `i18next-browser-languagedetector`: 브라우저 언어 자동 감지

### 2. 폴더 구조 생성 ✅
```
src/
  i18n/
    index.js          # i18n 설정 파일
  locales/
    en/               # 영어 번역 파일
      common.json
      connection.json
      menu.json
      settings.json
      dialog.json
      status.json
    ko/               # 한국어 번역 파일
      common.json
      connection.json
      menu.json
      settings.json
      dialog.json
      status.json
```

### 3. i18n 설정 완료 ✅
- 언어 감지 설정
  - 사용자 저장 설정 (localStorage) → **시스템 언어** (Electron) → 브라우저 언어
- 기본 언어: 영어 (en)
- Fallback 언어: 영어
- React Suspense 비활성화 (호환성)
- **시스템 언어 자동 감지 기능 추가** ✨
  - Electron의 `app.getLocale()`을 사용하여 OS 언어 설정 감지
  - IPC 핸들러를 통해 렌더러 프로세스에 전달

### 4. 번역 파일 구조 ✅

각 언어별로 네임스페이스로 분리:
- **common**: 공통 텍스트 (버튼, 기본 메시지 등)
- **connection**: 연결 관련 (ConnectionForm)
- **menu**: 메뉴 항목
- **settings**: 설정 화면
- **dialog**: 다이얼로그
- **status**: 상태바

### 5. 컴포넌트 변환 완료 ✅

#### 완료된 컴포넌트:
1. **StatusBar** - 상태바 텍스트 변환
2. **ConnectionForm** - 연결 폼 전체 변환
3. **Settings** - 언어 선택 UI 추가 및 일부 텍스트 변환

#### 주요 변환 내용:
- 모든 하드코딩된 영어 텍스트 → `t('namespace:key')` 형식
- placeholder, label, 버튼 텍스트 등 모두 변환
- 동적 텍스트도 변수 보간 지원 (예: `t('status:tftpServerTooltip', { port: ... })`)

## 언어 감지 우선순위

앱 시작 시 언어는 다음 우선순위로 자동 감지됩니다:

1. **사용자 저장 설정** (최우선)
   - localStorage에 저장된 언어 선택
   - Settings에서 언어를 변경하면 저장됨

2. **시스템 언어** (신규 추가 ✨)
   - Electron의 `app.getLocale()`을 사용하여 OS 언어 설정 감지
   - 한국어 OS → 한국어, 영어 OS → 영어

3. **브라우저 언어**
   - navigator.language를 기반으로 감지

4. **영어 (Fallback)**
   - 위 모든 방법이 실패하면 영어로 설정

## 사용 방법

### 컴포넌트에서 사용하기

```jsx
import { useTranslation } from 'react-i18next';

function MyComponent() {
  const { t } = useTranslation(['namespace']); // 네임스페이스 지정
  
  return (
    <div>
      <button>{t('common:cancel')}</button>
      <p>{t('connection:connectedTo', { user: 'admin', host: 'server.com' })}</p>
    </div>
  );
}
```

### 언어 변경하기

```jsx
import { changeLanguage } from '../i18n';

// 언어 변경
changeLanguage('ko'); // 한국어
changeLanguage('en'); // 영어
```

### 현재 언어 가져오기

```jsx
import { useTranslation } from 'react-i18next';

function MyComponent() {
  const { i18n } = useTranslation();
  
  console.log(i18n.language); // 'en' or 'ko'
}
```

## 설정 화면에서 언어 변경

Settings 화면의 "Appearance" 섹션에 언어 선택 드롭다운이 추가되었습니다:
- 영어 (English)
- 한국어 (Korean)

언어를 변경하면 즉시 UI에 반영되며, 설정은 localStorage에 저장됩니다.

## 다음 단계 (선택사항)

### 아직 변환되지 않은 컴포넌트들:

1. **CustomTitleBar** / **CustomMenuBar** - 메뉴 항목들
2. **SessionManager** - 세션 관리 UI
3. **TerminalView** - 터미널 뷰 관련 텍스트
4. **AboutDialog** - 정보 다이얼로그
5. **ErrorDialog** - 에러 다이얼로그
6. **기타 다이얼로그들** (TFTP, Web, iperf3 등)

### 변환 방법:

1. 컴포넌트 파일 상단에 import 추가:
   ```jsx
   import { useTranslation } from 'react-i18next';
   ```

2. 컴포넌트 내부에서 hook 사용:
   ```jsx
   const { t } = useTranslation(['namespace']);
   ```

3. 하드코딩된 텍스트를 번역 키로 변경:
   ```jsx
   // Before
   <button>Connect</button>
   
   // After
   <button>{t('connection:connect')}</button>
   ```

4. 필요한 번역 키를 해당 언어의 JSON 파일에 추가

## 테스트 방법

1. 앱 실행
2. Settings (Ctrl+,) 열기
3. "Appearance" 섹션에서 언어 변경
4. UI가 즉시 변경되는지 확인
5. ConnectionForm 열어서 한국어로 표시되는지 확인

## 참고 사항

- 번역 파일은 JSON 형식으로 관리
- 네임스페이스별로 파일 분리하여 관리 편의성 향상
- localStorage에 언어 설정 저장 (키: `ash-language`)
- 브라우저 언어를 기본값으로 사용하되, 사용자가 변경 가능
- 모든 번역 키는 영어를 fallback으로 사용

## 번역 파일 업데이트 방법

새로운 텍스트가 필요할 때:

1. 적절한 네임스페이스 JSON 파일 선택
2. 영어 번역 파일에 키 추가:
   ```json
   {
     "newKey": "New Text"
   }
   ```
3. 한국어 번역 파일에 동일한 키로 번역 추가:
   ```json
   {
     "newKey": "새 텍스트"
   }
   ```
4. 컴포넌트에서 사용:
   ```jsx
   {t('namespace:newKey')}
   ```

