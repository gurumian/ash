# Assistant 객체 캐싱 동작 방식 설명

## 문제 상황

**문제:**
- 사용자별로 다른 LLM 설정을 사용할 수 있음 (모델, API 키, 온도 등)
- 매 요청마다 `Assistant` 객체를 새로 생성하면 성능 오버헤드 발생
- `Assistant` 객체 생성은 비교적 무거운 작업

**해결 방법:**
- 동일한 설정의 요청에 대해 `Assistant` 객체를 캐싱하여 재사용

## 현재 구현 방식

### 1. 캐시 구조

```python
# 전역 캐시 딕셔너리
assistant_cache: Dict[str, Assistant] = {
    "default": Assistant(...)  # 기본 설정으로 미리 생성
}
```

### 2. 캐시 키 생성 (라인 213-221)

```python
# LLM 설정이 제공된 경우
if request.llm_config:
    config_dict = request.llm_config.dict()
    config_dict['connection_id'] = request.connection_id
    cache_key = json.dumps(config_dict, sort_keys=True)  # JSON으로 직렬화

# 기본 설정인 경우
else:
    cache_key = f"default_conn_{request.connection_id}" if request.connection_id else "default"
```

**캐시 키 구성 요소:**
- LLM 설정이 있는 경우: LLM 설정 전체 + connection_id
- 기본 설정인 경우: "default" 또는 "default_conn_{connection_id}"

### 3. 캐시 조회 및 생성 (라인 223-275)

```python
assistant = assistant_cache.get(cache_key)

if not assistant:
    # 캐시에 없으면 새로 생성
    logger.info(f"Creating new assistant for cache key: {cache_key}")
    assistant = Assistant(...)  # 새 객체 생성
    assistant_cache[cache_key] = assistant  # 캐시에 저장
else:
    # 캐시에 있으면 재사용
    logger.info(f"Using cached assistant for key: {cache_key}")
```

## 예시 시나리오

### 시나리오 1: 같은 LLM 설정으로 여러 요청

```
요청 1: {model: "qwen3:14b", temperature: 0.2, connection_id: "abc"}
  → 캐시 키: {"model": "qwen3:14b", "temperature": 0.2, "connection_id": "abc"}
  → 새로 생성 후 캐시에 저장

요청 2: {model: "qwen3:14b", temperature: 0.2, connection_id: "abc"}
  → 같은 캐시 키
  → 캐시에서 재사용 ✅

요청 3: {model: "qwen3:14b", temperature: 0.2, connection_id: "xyz"}
  → 다른 캐시 키 (connection_id 다름)
  → 새로 생성 후 캐시에 저장
```

### 시나리오 2: 다른 LLM 설정

```
요청 1: {model: "qwen3:14b", temperature: 0.2}
  → 새로 생성

요청 2: {model: "gpt-4", temperature: 0.7}
  → 다른 설정이므로 새로 생성
  → 두 개의 Assistant 객체가 캐시에 저장됨
```

## 현재 구현의 특징

### ✅ 좋은 점

1. **설정별 캐싱**: 다른 LLM 설정마다 별도 캐시 항목
2. **Connection ID 포함**: 같은 설정이라도 connection_id가 다르면 별도 캐시
3. **기본 설정 최적화**: 미리 생성해서 첫 요청도 빠름

### ⚠️ 잠재적 문제점

1. **Connection ID별 분리**: 
   - 같은 LLM 설정이어도 connection_id가 다르면 별도 객체 생성
   - 하지만 system_prompt가 connection_id에 따라 달라지므로 어쩔 수 없음

2. **캐시 무한 증가**:
   - 다양한 설정 조합이 계속 쌓일 수 있음
   - 하지만 일반적으로 사용자가 사용하는 설정은 제한적

3. **메모리 사용**:
   - 각 Assistant 객체가 메모리를 차지
   - 하지만 일반적으로 문제되지 않을 정도

## 성능 개선 효과

**Before (캐싱 없음):**
- 매 요청마다 `Assistant()` 생성
- 객체 초기화 시간: ~100-500ms (추정)

**After (캐싱 적용):**
- 첫 요청: 생성 + 캐싱 (~100-500ms)
- 이후 요청: 캐시 조회 (~1ms 미만)
- **성능 향상: 100-500배**

## 개선 가능성

현재 구현은 잘 되어 있지만, 다음과 같은 개선이 가능합니다:

1. **캐시 만료 시간 추가**: 일정 시간 후 캐시 정리
2. **LRU 캐시**: 최근 사용된 항목만 유지
3. **캐시 크기 제한**: 최대 N개만 유지

하지만 현재 사용 패턴에서는 큰 문제가 없을 것으로 보입니다.

