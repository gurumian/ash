#!/usr/bin/env python3
"""
Ash Provider API 서버 구현 예시
Ollama API를 프록시하여 /v1/... 형식의 인터페이스를 제공합니다.
"""

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
import httpx
import json
import os
from typing import Dict, Any, Optional

app = FastAPI(title="Ash Provider API", version="1.0.0")

# CORS 설정
# 브라우저에서 직접 호출하는 경우 필수
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # 프로덕션에서는 특정 origin만 허용하는 것을 권장
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],  # OPTIONS는 preflight 요청에 필요
    allow_headers=["Content-Type", "X-API-Key", "Authorization"],  # 필요한 헤더 명시
)

# Ollama 서버 URL (환경 변수 또는 기본값)
OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")


@app.options("/v1/tags")
async def options_tags():
    """CORS preflight 요청 처리"""
    return {"status": "ok"}

@app.get("/v1/tags")
async def get_tags(request: Request):
    """
    모델 목록 조회
    Ollama의 /api/tags를 호출하고 OpenAI 형식으로 변환
    """
    # API 키 확인: X-API-Key, Authorization Bearer, 또는 쿼리 파라미터 지원
    api_key = request.headers.get("X-API-Key")
    if not api_key:
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            api_key = auth_header[7:]  # Remove "Bearer " prefix
    if not api_key:
        # 쿼리 파라미터에서 확인 (api_key 또는 api-key)
        api_key = request.query_params.get("api_key") or request.query_params.get("api-key")
    
    if api_key:
        # API 키 검증 로직 (필요시 구현)
        pass
    
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(f"{OLLAMA_BASE_URL}/api/tags")
            response.raise_for_status()
            
            data = response.json()
            
            # Ollama 네이티브 형식을 OpenAI 형식으로 변환
            if "models" in data:
                return {
                    "object": "list",
                    "data": [
                        {
                            "id": model.get("name", ""),
                            "object": "model",
                            "created": 0,  # Ollama에서 제공하지 않음
                            "owned_by": "library"
                        }
                        for model in data.get("models", [])
                    ]
                }
            
            # 이미 OpenAI 형식인 경우 그대로 반환
            return data
            
    except httpx.HTTPStatusError as e:
        raise HTTPException(status_code=e.response.status_code, detail=e.response.text)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.options("/v1/generate")
async def options_generate():
    """CORS preflight 요청 처리"""
    return {"status": "ok"}

@app.post("/v1/generate")
async def generate(request: Request):
    """
    텍스트 생성 (Ollama 네이티브 형식)
    Ollama의 /api/generate로 프록시
    """
    # API 키 확인: X-API-Key, Authorization Bearer, 또는 쿼리 파라미터 지원
    api_key = request.headers.get("X-API-Key")
    if not api_key:
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            api_key = auth_header[7:]  # Remove "Bearer " prefix
    if not api_key:
        # 쿼리 파라미터에서 확인 (api_key 또는 api-key)
        api_key = request.query_params.get("api_key") or request.query_params.get("api-key")
    
    if api_key:
        # API 키 검증 로직 (필요시 구현)
        pass
    
    try:
        body = await request.json()
        stream = body.get("stream", False)
        
        async with httpx.AsyncClient(timeout=300.0) as client:
            response = await client.post(
                f"{OLLAMA_BASE_URL}/api/generate",
                json=body,
                timeout=300.0
            )
            response.raise_for_status()
            
            if stream:
                # 스트리밍 모드: 각 JSON 객체를 개행으로 구분하여 전송
                async def stream_response():
                    async for line in response.aiter_lines():
                        if line.strip():
                            yield line + "\n"
                
                return StreamingResponse(
                    stream_response(),
                    media_type="application/json"
                )
            else:
                # Non-streaming 모드
                return response.json()
                
    except httpx.HTTPStatusError as e:
        raise HTTPException(status_code=e.response.status_code, detail=e.response.text)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.options("/v1/chat/completions")
async def options_chat_completions():
    """CORS preflight 요청 처리"""
    return {"status": "ok"}

@app.post("/v1/chat/completions")
async def chat_completions(request: Request):
    """
    채팅 완성 (OpenAI 호환 형식)
    Ollama의 /v1/chat/completions로 프록시
    """
    # API 키 확인: X-API-Key, Authorization Bearer, 또는 쿼리 파라미터 지원
    api_key = request.headers.get("X-API-Key")
    if not api_key:
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            api_key = auth_header[7:]  # Remove "Bearer " prefix
    if not api_key:
        # 쿼리 파라미터에서 확인 (api_key 또는 api-key)
        api_key = request.query_params.get("api_key") or request.query_params.get("api-key")
    
    if api_key:
        # API 키 검증 로직 (필요시 구현)
        pass
    
    try:
        body = await request.json()
        stream = body.get("stream", False)
        
        async with httpx.AsyncClient(timeout=300.0) as client:
            response = await client.post(
                f"{OLLAMA_BASE_URL}/v1/chat/completions",
                json=body,
                timeout=300.0
            )
            response.raise_for_status()
            
            if stream:
                # SSE 형식으로 스트리밍
                async def stream_sse():
                    async for chunk in response.aiter_text():
                        yield chunk
                
                return StreamingResponse(
                    stream_sse(),
                    media_type="text/event-stream",
                    headers={
                        "Cache-Control": "no-cache",
                        "Connection": "keep-alive",
                    }
                )
            else:
                # Non-streaming 모드
                return response.json()
                
    except httpx.HTTPStatusError as e:
        raise HTTPException(status_code=e.response.status_code, detail=e.response.text)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/health")
async def health():
    """헬스 체크"""
    return {"status": "healthy", "ollama_url": OLLAMA_BASE_URL}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
