# Markdown Hydration Error 분석 및 해결 시도 기록

## 문제 상황

`react-markdown`을 사용하여 AI 응답을 렌더링할 때, 코드 블록이 `<p>` 태그 안에 중첩되어 React hydration 에러가 발생합니다.

### 에러 메시지
```
In HTML, <pre> cannot be a descendant of <p>.
In HTML, <div> cannot be a descendant of <p>.
```

### 발생 위치
- `AIChatSidebar.jsx`의 `ReactMarkdown` 컴포넌트
- 코드 블록(`<pre>`)이 `<p>` 태그 안에 렌더링됨
- `code` 컴포넌트가 반환하는 `<div>`도 `<p>` 안에 들어감

## 시도한 해결 방법들

### 1. `p` 컴포넌트에서 block element 감지하여 `div`로 렌더링

**시도 내용:**
- `p` 컴포넌트에서 `pre`, `div`, `code` 등의 block element를 재귀적으로 감지
- 감지되면 `<p>` 대신 `<div>`로 렌더링

**코드:**
```jsx
p: ({ children, ...props }) => {
  const checkForBlockElements = (node) => {
    // pre, div, code 등 block element 감지
    // ...
  };
  
  if (hasBlock) {
    return <div style={{ margin: '0 0 8px 0' }}>{children}</div>;
  }
  return <p style={{ margin: '0 0 8px 0' }}>{children}</p>;
}
```

**결과:** ❌ 실패 - `react-markdown`이 이미 `<p>` 태그를 생성한 후에 컴포넌트가 호출되므로, 감지가 늦음

### 2. `code` 컴포넌트에서 `div`로 감싸기

**시도 내용:**
- 코드 블록을 `<div>`로 감싸서 `<p>` 안에 들어가지 않도록 시도

**코드:**
```jsx
code: ({ inline, className, children, ...props }) => {
  if (inline) {
    return <code>...</code>;
  }
  return (
    <div style={{ margin: '8px 0' }}>
      <pre>...</pre>
    </div>
  );
}
```

**결과:** ❌ 실패 - `react-markdown`이 이미 `<p>` 안에 `<code>`를 넣은 상태에서 `div`로 감싸도 여전히 `<p>` 안에 있음

### 3. `rehypePlugins`를 사용하여 AST 레벨에서 처리

**시도 내용:**
- `rehypePlugins`를 사용하여 HTML AST 단계에서 코드 블록을 포함한 `<p>` 태그를 제거하고 자식 요소들을 상위로 이동

**코드:**
```jsx
<ReactMarkdown
  rehypePlugins={[
    () => {
      return (tree) => {
        const processNode = (node, parent, index) => {
          if (node.tagName === 'p' && parent) {
            const hasCodeBlock = node.children?.some(child => {
              // pre, code with language-*, div containing pre 감지
            });
            
            if (hasCodeBlock) {
              // Unwrap: replace paragraph with its children
              parent.children.splice(index, 1, ...(node.children || []));
            }
          }
          // Recursively process children
        };
      };
    }
  ]}
/>
```

**결과:** ❌ 실패 - 플러그인이 제대로 작동하지 않거나, `react-markdown`의 내부 처리 순서 문제

## 근본 원인 분석

1. **`react-markdown`의 파싱 순서:**
   - Markdown → AST → HTML AST → React Components
   - 코드 블록이 이미 `<p>` 안에 들어간 상태로 AST가 생성됨

2. **컴포넌트 레벨 처리의 한계:**
   - `p` 컴포넌트나 `code` 컴포넌트는 이미 생성된 DOM 구조를 변경할 수 없음
   - 단지 렌더링만 할 뿐, 구조를 바꿀 수 없음

3. **`rehypePlugins`의 문제:**
   - 플러그인이 실행되는 시점이 적절하지 않을 수 있음
   - 또는 플러그인 로직에 버그가 있을 수 있음

## 가능한 해결 방법들

### 방법 1: `remarkPlugins` 사용 (Markdown AST 단계)

`rehypePlugins` 대신 `remarkPlugins`를 사용하여 Markdown AST 단계에서 처리:

```jsx
import { visit } from 'unist-util-visit';

<ReactMarkdown
  remarkPlugins={[
    () => {
      return (tree) => {
        visit(tree, 'paragraph', (node, index, parent) => {
          // paragraph 안에 code block이 있는지 확인
          const hasCodeBlock = node.children?.some(child => 
            child.type === 'code'
          );
          
          if (hasCodeBlock && parent) {
            // paragraph를 제거하고 children을 직접 parent에 추가
            parent.children.splice(index, 1, ...node.children);
          }
        });
      };
    }
  ]}
/>
```

**필요한 패키지:** `unist-util-visit` (npm install 필요)

### 방법 2: `react-markdown` 대신 다른 라이브러리 사용

- `markdown-to-jsx`
- `marked` + 직접 렌더링
- 커스텀 마크다운 파서

### 방법 3: 마크다운 전처리

AI 응답을 받은 후, 마크다운을 파싱하기 전에 전처리:

```jsx
const preprocessMarkdown = (markdown) => {
  // 코드 블록 앞뒤의 빈 줄 제거
  // 또는 코드 블록을 별도로 추출하여 처리
  return markdown.replace(/```[\s\S]*?```/g, (match) => {
    return '\n\n' + match + '\n\n';
  });
};
```

### 방법 4: `p` 컴포넌트를 완전히 비활성화하고 `div`로 대체

```jsx
components={{
  p: ({ children }) => <div style={{ margin: '0 0 8px 0' }}>{children}</div>,
  // ...
}}
```

**주의:** 이 방법은 시맨틱 HTML을 깨뜨릴 수 있음

### 방법 5: CSS로 숨기기 (임시방편)

```css
p > pre,
p > div {
  display: block;
  margin: 0;
}
```

**주의:** 이것은 hydration 에러를 해결하지 않음, 단지 시각적으로만 처리

## 최종 해결 방법 (구현됨)

**`remarkPlugins` 사용 - Markdown AST 단계에서 처리**

1. `unist-util-visit` 패키지 사용 (이미 `react-markdown` 의존성으로 설치됨)
2. Markdown AST 단계에서 paragraph 안의 code block을 감지
3. paragraph를 제거하고 code block을 직접 상위로 이동

**구현 코드:**
```jsx
import { visit } from 'unist-util-visit';

<ReactMarkdown
  remarkPlugins={[
    () => {
      return (tree) => {
        const paragraphsToUnwrap = [];
        
        visit(tree, 'paragraph', (node, index, parent) => {
          if (!parent || !parent.children) return;
          
          // Check if paragraph contains a code block
          const hasCodeBlock = node.children?.some(child => 
            child.type === 'code'
          );
          
          if (hasCodeBlock) {
            paragraphsToUnwrap.push({ node, index, parent });
          }
        });
        
        // Unwrap paragraphs in reverse order to maintain indices
        for (let i = paragraphsToUnwrap.length - 1; i >= 0; i--) {
          const { node, index, parent } = paragraphsToUnwrap[i];
          // Replace paragraph with its children
          parent.children.splice(index, 1, ...(node.children || []));
        }
      };
    }
  ]}
/>
```

**왜 이 방법이 효과적인가:**
- Markdown AST 단계에서 처리하므로 HTML AST로 변환되기 전에 문제를 해결
- `rehypePlugins`보다 더 이른 단계에서 처리하여 근본 원인 해결
- `unist-util-visit`의 `visit` 함수를 사용하여 안전하게 AST를 순회하고 수정

## 참고 자료

- [react-markdown 공식 문서](https://github.com/remarkjs/react-markdown)
- [unist-util-visit 문서](https://github.com/syntax-tree/unist-util-visit)
- [remark 플러그인 작성 가이드](https://github.com/remarkjs/remark/blob/main/doc/plugins.md)

