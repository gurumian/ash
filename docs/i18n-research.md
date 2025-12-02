# 다국어 지원 (i18n) 조사 보고서

## 현재 상황 분석

### 프로젝트 구조
- **프레임워크**: React 19.1.1
- **플랫폼**: Electron 앱
- **현재 상태**: 모든 텍스트가 하드코딩된 영어로 작성됨
- **다국어 라이브러리**: 없음

### 텍스트 사용 범위
다음 영역에서 하드코딩된 텍스트가 발견됨:

1. **UI 컴포넌트**
   - 버튼 라벨 (Connect, Cancel, Settings 등)
   - 폼 라벨 (Host, Port, Username, Password 등)
   - 상태 메시지 (Ready, Connected, Connecting... 등)
   - 에러 메시지

2. **메뉴 항목**
   - File, View, Tools, Help 메뉴
   - 서브메뉴 항목들

3. **다이얼로그**
   - About Dialog
   - Error Dialog
   - Settings Dialog
   - Connection Form
   - 기타 다이얼로그들

4. **상태바**
   - 연결 상태 텍스트
   - 세션 카운트

## 다국어 지원 옵션 비교

### 1. react-i18next

**개요**: i18next를 React에 통합한 가장 인기 있는 i18n 솔루션

**장점**:
- ✅ 매우 인기 있고 활발히 유지보수됨
- ✅ 풍부한 기능 (복수형, 보간법, 네임스페이스, 컨텍스트 등)
- ✅ 동적 언어 변경 지원
- ✅ 플러그인 생태계가 넓음
- ✅ React 19와 호환
- ✅ Electron 앱에서 널리 사용됨
- ✅ 리소스 로딩 옵션이 다양함 (JSON, 동적 import 등)
- ✅ TypeScript 지원 우수

**단점**:
- ❌ 번들 크기가 약간 큼 (i18next + react-i18next)
- ❌ 초기 설정이 복잡할 수 있음

**설치**:
```bash
npm install i18next react-i18next i18next-browser-languagedetector
```

**예시 사용법**:
```jsx
import { useTranslation } from 'react-i18next';

function ConnectionForm() {
  const { t } = useTranslation();
  
  return (
    <button>{t('connection.connect')}</button>
  );
}
```

**추천도**: ⭐⭐⭐⭐⭐ (가장 추천)

---

### 2. react-intl (Format.js)

**개요**: Format.js 기반의 React i18n 솔루션

**장점**:
- ✅ 국제화 표준(ICU Message Format) 준수
- ✅ 날짜, 시간, 숫자 포맷팅 강력
- ✅ 복잡한 메시지 포맷팅 지원
- ✅ TypeScript 지원
- ✅ 큰 커뮤니티

**단점**:
- ❌ react-i18next보다 덜 인기
- ❌ 번들 크기가 큼
- ❌ 학습 곡선이 가파름
- ❌ Electron 앱 예제가 상대적으로 적음

**설치**:
```bash
npm install react-intl
```

**예시 사용법**:
```jsx
import { useIntl } from 'react-intl';

function ConnectionForm() {
  const intl = useIntl();
  
  return (
    <button>{intl.formatMessage({ id: 'connection.connect' })}</button>
  );
}
```

**추천도**: ⭐⭐⭐ (복잡한 포맷팅이 필요한 경우)

---

### 3. 간단한 커스텀 솔루션

**개요**: 직접 구현한 간단한 번역 시스템

**장점**:
- ✅ 의존성 없음
- ✅ 가벼움
- ✅ 완전한 제어 가능
- ✅ 간단한 구조

**단점**:
- ❌ 모든 기능을 직접 구현해야 함
- ❌ 복수형, 포맷팅 등 고급 기능 구현 복잡
- ❌ 유지보수 부담

**예시 구조**:
```javascript
// i18n.js
const translations = {
  en: {
    connection: { connect: 'Connect', cancel: 'Cancel' }
  },
  ko: {
    connection: { connect: '연결', cancel: '취소' }
  }
};

export function t(key, lang = 'en') {
  return key.split('.').reduce((obj, k) => obj?.[k], translations[lang]);
}
```

**추천도**: ⭐⭐ (간단한 프로젝트나 빠른 프로토타입)

---

## Electron 앱 고려사항

### 1. 언어 감지
- OS 언어 설정 감지 필요
- 사용자 설정 저장 (localStorage 또는 설정 파일)
- 런타임 언어 변경 지원

### 2. 리소스 파일 위치
```
src/
  locales/
    en/
      common.json
      connection.json
      settings.json
    ko/
      common.json
      connection.json
      settings.json
```

### 3. 언어 변경 시
- 즉시 UI 업데이트
- 저장된 설정 반영
- 메뉴도 업데이트 (Electron 메뉴는 별도 처리 필요)

### 4. 번들 최적화
- 사용하지 않는 언어 파일은 로드하지 않음
- 동적 import 활용

## 추천 구현 방안

### Phase 1: react-i18next 도입

1. **설치 및 기본 설정**
   ```bash
   npm install i18next react-i18next i18next-browser-languagedetector
   ```

2. **폴더 구조 생성**
   ```
   src/
     locales/
       en/
         common.json
         connection.json
         menu.json
         settings.json
         dialog.json
       ko/
         common.json
         connection.json
         menu.json
         settings.json
         dialog.json
     i18n/
       index.js
   ```

3. **기본 설정 파일**
   - 언어 감지 설정
   - 기본 언어 설정
   - 리소스 로더 설정

4. **점진적 마이그레이션**
   - 한 컴포넌트씩 변환
   - 새로운 컴포넌트는 처음부터 i18n 사용

### Phase 2: 텍스트 추출 및 번역

1. **텍스트 추출 도구 사용** (선택사항)
   - i18next-parser로 자동 추출

2. **번역 파일 작성**
   - JSON 파일로 구조화
   - 네임스페이스별 분리

3. **번역 품질 검증**
   - 누락된 키 확인
   - 잘못된 키 경로 확인

### Phase 3: UI 통합

1. **언어 선택 UI**
   - Settings에 언어 선택 추가
   - 즉시 반영

2. **Electron 메뉴 번역**
   - 메인 프로세스에서도 언어 처리

3. **동적 언어 변경**
   - 설정 변경 시 즉시 UI 업데이트

## 지원할 언어 우선순위

1. **영어 (en)** - 기본 언어, 이미 모든 텍스트 존재
2. **한국어 (ko)** - 주요 사용자층 고려

추후 추가 가능:
- 일본어 (ja)
- 중국어 간체 (zh-CN)
- 기타 유럽 언어들

## 작업량 추정

### 초기 설정: 2-3시간
- 라이브러리 설치
- 기본 설정 파일 작성
- 폴더 구조 생성

### 텍스트 마이그레이션: 10-15시간
- 모든 하드코딩된 텍스트 찾기 및 추출
- 번역 키 구조 설계
- 컴포넌트별 변환 작업

### 번역 작업: 5-10시간 (한국어 기준)
- JSON 파일 작성
- 컨텍스트 고려한 번역
- 검토 및 수정

### 테스트 및 디버깅: 3-5시간
- 모든 화면 확인
- 언어 변경 테스트
- 엣지 케이스 처리

**총 예상 시간**: 20-33시간

## 참고 자료

### 라이브러리 문서
- [react-i18next 공식 문서](https://react.i18next.com/)
- [i18next 공식 문서](https://www.i18next.com/)
- [react-intl 공식 문서](https://formatjs.io/docs/react-intl/)

### Electron + i18n 예제
- [Electron i18n 가이드](https://www.electronjs.org/docs/latest/tutorial/internationalization)
- [react-i18next + Electron 예제](https://github.com/reactivestack/react-i18next/tree/master/example/react)

### 도구
- [i18next-parser](https://github.com/i18next/i18next-parser) - 자동 번역 키 추출
- [i18next-scanner](https://github.com/i18next/i18next-scanner) - 번역 키 스캔

## 결론 및 권장사항

**추천**: **react-i18next** 사용

**이유**:
1. 가장 인기 있고 안정적인 솔루션
2. Electron 앱에서 검증된 사용 사례 많음
3. React 19와 완벽 호환
4. 풍부한 기능으로 확장성 좋음
5. TypeScript 지원 우수
6. 활발한 커뮤니티와 문서

**다음 단계**:
1. react-i18next 설치 및 기본 설정
2. 샘플 컴포넌트 1-2개로 프로토타입 구현
3. 전체 마이그레이션 계획 수립
4. 점진적 변환 시작

