# 다이얼로그 관리 방식 분석

## 현재 구현 (하나의 훅)

### 장점
1. **중앙 집중식 관리**: 모든 다이얼로그 상태가 한 곳에서 관리됨
2. **코드 중복 감소**: 11개의 `useState` → 1개의 훅
3. **일괄 제어**: `closeAllDialogs()` 같은 기능 제공
4. **일관성**: 모든 다이얼로그가 동일한 방식으로 관리됨

### 단점
1. **불필요한 리렌더링 가능성**: 
   - 하나의 다이얼로그가 열리면 전체 `dialogs` 객체가 변경됨
   - `dialogs` 객체를 참조하는 모든 컴포넌트가 리렌더링될 수 있음
   - 하지만 실제로는 개별 getter를 사용하므로 문제가 덜함

2. **과도한 추상화**:
   - 단순한 boolean 상태를 복잡한 객체로 관리
   - 각 다이얼로그가 독립적이라면 분리하는 것이 더 나을 수 있음

3. **타입 안정성**:
   - 문자열 기반 dialogName 사용 (오타 가능성)
   - TypeScript를 사용한다면 enum이나 union type이 더 나음

## 대안 1: 개별 훅 (useBoolean 패턴)

```javascript
// hooks/useBoolean.js
export function useBoolean(initialValue = false) {
  const [value, setValue] = useState(initialValue);
  const setTrue = useCallback(() => setValue(true), []);
  const setFalse = useCallback(() => setValue(false), []);
  const toggle = useCallback(() => setValue(prev => !prev), []);
  return [value, setValue, setTrue, setFalse, toggle];
}

// App.jsx
const [showSettings, setShowSettings, openSettings, closeSettings] = useBoolean();
const [showAboutDialog, setShowAboutDialog, openAbout, closeAbout] = useBoolean();
// ... 각 다이얼로그마다 독립적으로
```

**장점:**
- 각 다이얼로그가 완전히 독립적
- 불필요한 리렌더링 없음
- 단순하고 명확함

**단점:**
- 코드 중복 (11번 반복)
- 일괄 제어 불가능

## 대안 2: useReducer 사용

```javascript
const dialogReducer = (state, action) => {
  switch (action.type) {
    case 'OPEN':
      return { ...state, [action.dialog]: true };
    case 'CLOSE':
      return { ...state, [action.dialog]: false };
    case 'CLOSE_ALL':
      return Object.keys(state).reduce((acc, key) => ({ ...acc, [key]: false }), {});
    default:
      return state;
  }
};

const [dialogs, dispatch] = useReducer(dialogReducer, initialDialogs);
```

**장점:**
- 더 명확한 상태 변경 로직
- 복잡한 상태 변경에 유리
- Redux 패턴과 유사

**단점:**
- 현재 사용 사례에는 과도할 수 있음
- 여전히 하나의 객체로 관리됨

## 대안 3: 하이브리드 (관련 다이얼로그만 그룹화)

```javascript
// 관련된 다이얼로그만 그룹화
const useServerDialogs = () => {
  const [tftp, setTftp] = useState(false);
  const [web, setWeb] = useState(false);
  const [iperf, setIperf] = useState(false);
  return { tftp, web, iperf, setTftp, setWeb, setIperf };
};

const useLibraryDialogs = () => {
  const [library, setLibrary] = useState(false);
  const [libraryImport, setLibraryImport] = useState(false);
  return { library, libraryImport, setLibrary, setLibraryImport };
};
```

**장점:**
- 관련된 다이얼로그만 그룹화
- 불필요한 리렌더링 최소화
- 논리적 그룹화

**단점:**
- 여러 훅을 사용해야 함
- 복잡도 증가

## 실제 성능 영향 분석

### 현재 구현의 실제 영향
1. **리렌더링**: 
   - `dialogs` 객체가 변경되지만, 개별 getter를 사용하므로 실제로는 문제가 적음
   - React.memo로 최적화된 컴포넌트는 영향 없음

2. **메모리**: 
   - 객체 하나 vs 11개의 boolean - 차이 미미

3. **코드 복잡도**:
   - 현재: 중간 복잡도 (훅 하나, 많은 getter/setter)
   - 개별: 낮은 복잡도 (11개 훅, 각각 단순)

## 권장 사항

### 현재 상황에서는 현재 구현이 적절함
1. **실제 성능 문제 없음**: 각 다이얼로그 컴포넌트가 독립적으로 렌더링됨
2. **코드 중복 감소**: 11개의 useState 제거
3. **유지보수성**: 새로운 다이얼로그 추가가 쉬움
4. **일괄 제어**: `closeAllDialogs()` 같은 기능 제공

### 개선 가능한 점
1. **TypeScript 도입 시**: enum이나 union type으로 타입 안정성 향상
2. **성능 최적화**: 필요시 useMemo로 개별 getter 최적화
3. **코드 간소화**: 개별 setter를 제거하고 openDialog/closeDialog만 사용

## 결론

**현재 구현이 적절한 이유:**
- 실제 성능 문제 없음
- 코드 중복 감소
- 유지보수성 향상
- 일괄 제어 기능 제공

**개선 고려사항:**
- TypeScript 도입 시 타입 안정성 향상
- 필요시 useMemo로 최적화
- 개별 setter 제거 고려 (openDialog/closeDialog만 사용)

