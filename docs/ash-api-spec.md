# Ash Provider API 명세

## 개요
Ash Provider는 Ollama API를 프록시하는 서버로, `/v1/...` 형식의 인터페이스를 제공합니다.
기본 baseURL: `https://ash.toktoktalk.com/v1`

## 인증

Ash API는 다음 세 가지 인증 방식을 지원합니다:

1. **X-API-Key 헤더** (권장)
   ```http
   X-API-Key: ash-00000000-0000-0000-0000-000000000001
   ```

2. **Authorization Bearer 헤더** (Qwen-Agent 호환)
   ```http
   Authorization: Bearer ash-00000000-0000-0000-0000-000000000001
   ```

3. **쿼리 파라미터** (브라우저에서 직접 호출 시 유용)
   ```
   ?api_key=ash-00000000-0000-0000-0000-000000000001
   또는
   ?api-key=ash-00000000-0000-0000-0000-000000000001
   ```

세 가지 방식 모두 동일하게 작동하며, 하나만 제공하면 됩니다. 우선순위는 헤더 > 쿼리 파라미터입니다.

## CORS 설정

브라우저에서 직접 호출하는 경우 CORS 설정이 필요합니다. 서버는 다음 CORS 헤더를 포함해야 합니다:

```http
Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: GET, POST, OPTIONS
Access-Control-Allow-Headers: Content-Type, X-API-Key, Authorization
Access-Control-Allow-Credentials: true
```

또는 특정 origin만 허용:
```http
Access-Control-Allow-Origin: http://localhost:5173
```

**중요**: OPTIONS 요청(Preflight)에 대해서도 적절한 CORS 헤더를 반환해야 합니다.

## 엔드포인트

### 1. GET /v1/tags
모델 목록을 조회합니다.

**Request:**
```http
GET /v1/tags
Content-Type: application/json
X-API-Key: ash-00000000-0000-0000-0000-000000000001
```

또는:
```http
GET /v1/tags
Content-Type: application/json
Authorization: Bearer ash-00000000-0000-0000-0000-000000000001
```

또는 쿼리 파라미터:
```http
GET /v1/tags?api_key=ash-00000000-0000-0000-0000-000000000001
Content-Type: application/json
```

**Response:**
```json
{
  "data": [
    {
      "id": "llama3.2",
      "object": "model",
      "created": 1234567890,
      "owned_by": "library"
    }
  ]
}
```

또는 Ollama 네이티브 형식:
```json
{
  "models": [
    {
      "name": "llama3.2",
      "modified_at": "2024-01-01T00:00:00Z",
      "size": 1234567890
    }
  ]
}
```

**구현 참고:**
- 클라이언트는 `data` 배열 또는 `models` 배열 모두 지원
- 모델 이름은 `id` 또는 `name` 필드에서 추출

---

### 2. POST /v1/generate
텍스트 생성을 수행합니다. (Ollama 네이티브 형식)

**Request:**
```http
POST /v1/generate
Content-Type: application/json
X-API-Key: ash-00000000-0000-0000-0000-000000000001
```

또는:
```http
POST /v1/generate
Content-Type: application/json
Authorization: Bearer ash-00000000-0000-0000-0000-000000000001
```

또는 쿼리 파라미터:
```http
POST /v1/generate?api_key=ash-00000000-0000-0000-0000-000000000001
Content-Type: application/json
```

**Request Body:**
```json
{
  "model": "llama3.2",
  "prompt": "system prompt\n\nuser prompt",
  "stream": true,
  "options": {
    "temperature": 0.7,
    "num_predict": 1000
  }
}
```

**Streaming Response:**
각 줄은 JSON 객체:
```json
{"response": "텍스트", "done": false}
{"response": " 계속", "done": false}
{"response": "", "done": true}
```

**Non-streaming Response:**
```json
{
  "response": "전체 응답 텍스트",
  "done": true
}
```

**구현 참고:**
- 서버는 내부적으로 Ollama의 `/api/generate`로 프록시
- 스트리밍 모드: 각 JSON 객체를 개행 문자(`\n`)로 구분하여 전송
- `done: true`가 오면 스트리밍 종료

---

### 3. POST /v1/chat/completions
채팅 완성을 수행합니다. (OpenAI 호환 형식)

**Request:**
```http
POST /v1/chat/completions
Content-Type: application/json
X-API-Key: ash-00000000-0000-0000-0000-000000000001
```

또는:
```http
POST /v1/chat/completions
Content-Type: application/json
Authorization: Bearer ash-00000000-0000-0000-0000-000000000001
```

또는 쿼리 파라미터:
```http
POST /v1/chat/completions?api_key=ash-00000000-0000-0000-0000-000000000001
Content-Type: application/json
```

**Request Body:**
```json
{
  "model": "llama3.2",
  "messages": [
    {
      "role": "system",
      "content": "system prompt"
    },
    {
      "role": "user",
      "content": "user message"
    }
  ],
  "stream": true,
  "temperature": 0.7,
  "max_tokens": 1000
}
```

**Streaming Response (SSE 형식):**
```
data: {"choices":[{"delta":{"content":"텍스트"}}]}
data: {"choices":[{"delta":{"content":" 계속"}}]}
data: [DONE]
```

**Non-streaming Response:**
```json
{
  "choices": [
    {
      "message": {
        "role": "assistant",
        "content": "전체 응답 텍스트"
      }
    }
  ]
}
```

**구현 참고:**
- 서버는 내부적으로 Ollama의 `/v1/chat/completions`로 프록시하거나
- `/api/generate`로 변환하여 호출 후 OpenAI 형식으로 변환

---

## 서버 구현 가이드

### 프록시 로직
Ash 서버는 Ollama API를 프록시하므로:

1. **`/v1/generate`** → Ollama의 `/api/generate`로 프록시
2. **`/v1/tags`** → Ollama의 `/api/tags`로 프록시 (응답을 OpenAI 형식으로 변환 가능)
3. **`/v1/chat/completions`** → Ollama의 `/v1/chat/completions`로 프록시

### 예시 구현 (Python/FastAPI)

```python
from fastapi import FastAPI, HTTPException
from fastapi.responses import StreamingResponse
import httpx
import json

app = FastAPI()

OLLAMA_BASE_URL = "http://localhost:11434"  # 또는 환경 변수로 설정

@app.get("/v1/tags")
async def get_tags():
    async with httpx.AsyncClient() as client:
        response = await client.get(f"{OLLAMA_BASE_URL}/api/tags")
        if response.status_code != 200:
            raise HTTPException(status_code=response.status_code, detail=response.text)
        
        data = response.json()
        # Ollama 형식을 OpenAI 형식으로 변환
        if "models" in data:
            return {
                "data": [
                    {
                        "id": model.get("name", ""),
                        "object": "model",
                        "created": 0,
                        "owned_by": "library"
                    }
                    for model in data.get("models", [])
                ]
            }
        return data

@app.post("/v1/generate")
async def generate(request: dict):
    async with httpx.AsyncClient() as client:
        response = await client.post(
            f"{OLLAMA_BASE_URL}/api/generate",
            json=request,
            timeout=300.0
        )
        if response.status_code != 200:
            raise HTTPException(status_code=response.status_code, detail=response.text)
        
        if request.get("stream", False):
            async def stream():
                async for line in response.aiter_lines():
                    if line:
                        yield line + "\n"
            return StreamingResponse(stream(), media_type="application/json")
        else:
            return response.json()

@app.post("/v1/chat/completions")
async def chat_completions(request: dict):
    async with httpx.AsyncClient() as client:
        response = await client.post(
            f"{OLLAMA_BASE_URL}/v1/chat/completions",
            json=request,
            timeout=300.0
        )
        if response.status_code != 200:
            raise HTTPException(status_code=response.status_code, detail=response.text)
        
        if request.get("stream", False):
            async def stream():
                async for chunk in response.aiter_text():
                    yield chunk
            return StreamingResponse(stream(), media_type="text/event-stream")
        else:
            return response.json()
```

---

## 클라이언트 사용 예시

### JavaScript/TypeScript

```javascript
// 모델 목록 조회
// 방법 1: X-API-Key 헤더
const response = await fetch('https://ash.toktoktalk.com/v1/tags', {
  headers: {
    'X-API-Key': 'ash-00000000-0000-0000-0000-000000000001'
  }
});

// 방법 2: Authorization 헤더
const response2 = await fetch('https://ash.toktoktalk.com/v1/tags', {
  headers: {
    'Authorization': 'Bearer ash-00000000-0000-0000-0000-000000000001'
  }
});

// 방법 3: 쿼리 파라미터
const response3 = await fetch('https://ash.toktoktalk.com/v1/tags?api_key=ash-00000000-0000-0000-0000-000000000001');

const data = await response.json();
const models = data.data || data.models || [];

// 텍스트 생성 (스트리밍)
const response = await fetch('https://ash.toktoktalk.com/v1/generate', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    model: 'llama3.2',
    prompt: 'Hello, how are you?',
    stream: true,
    options: {
      temperature: 0.7,
      num_predict: 1000
    }
  })
});

const reader = response.body.getReader();
const decoder = new TextDecoder();

while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  
  const lines = decoder.decode(value).split('\n');
  for (const line of lines) {
    if (line.trim()) {
      const data = JSON.parse(line);
      if (data.response) {
        console.log(data.response);
      }
      if (data.done) break;
    }
  }
}
```

---

## 에러 처리

모든 엔드포인트는 표준 HTTP 상태 코드를 반환합니다:

- `200 OK`: 성공
- `400 Bad Request`: 잘못된 요청
- `404 Not Found`: 리소스를 찾을 수 없음
- `500 Internal Server Error`: 서버 내부 오류

에러 응답 형식:
```json
{
  "error": "에러 메시지"
}
```

---

## 참고사항

1. **baseURL 처리**: 클라이언트는 baseURL이 `/v1`로 끝나지 않으면 자동으로 추가합니다.
2. **스트리밍**: 스트리밍 모드에서는 각 JSON 객체를 개행 문자로 구분하여 전송합니다.
3. **호환성**: `/v1/generate`는 Ollama 네이티브 형식, `/v1/chat/completions`는 OpenAI 호환 형식을 사용합니다.

## Qwen-Agent 호환성

Qwen-Agent는 `api_key`를 `Authorization: Bearer` 헤더로 전송합니다. ash 서버는 이를 지원해야 합니다:

```python
# API 키 확인: X-API-Key, Authorization Bearer, 또는 쿼리 파라미터 지원
api_key = request.headers.get("X-API-Key")
if not api_key:
    auth_header = request.headers.get("Authorization", "")
    if auth_header.startswith("Bearer "):
        api_key = auth_header[7:]  # Remove "Bearer " prefix
if not api_key:
    # 쿼리 파라미터에서 확인 (api_key 또는 api-key)
    api_key = request.query_params.get("api_key") or request.query_params.get("api-key")

if not api_key:
    raise HTTPException(status_code=401, detail="API key required. Include X-API-Key header, Authorization Bearer header, or api_key query parameter.")
```

**중요**: 
- Qwen-Agent는 `headers` 필드를 지원하지 않을 수 있으므로, ash 서버는 반드시 `Authorization: Bearer` 헤더를 지원해야 합니다.
- 쿼리 파라미터 방식은 브라우저에서 직접 호출하거나 CORS 문제가 있을 때 유용합니다.
