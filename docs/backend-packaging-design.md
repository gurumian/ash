# Backend Packaging Design - Qwen-Agent PyInstaller 번들링

## 개요

qwen-agent를 PyInstaller로 번들링할 때 필요한 구체적인 설정과 주의사항을 정리합니다.

**핵심 문제**: qwen-agent는 Python 패키지뿐만 아니라 파일 시스템 리소스(utils 폴더 등)도 포함하므로, PyInstaller에서 이를 명시적으로 포함해야 합니다.

---

## 현재 상태

### ash-agent-ex의 backend.spec (불완전)
- `datas=[]` - qwen-agent 리소스가 포함되지 않음
- `hiddenimports`에 `qwen_agent`, `qwen_agent.agents`만 있음
- qwen-agent 경로 자동 탐지 로직 없음

### log-chat의 log-chat-backend.spec (완전)
- qwen-agent 경로 자동 탐지 함수 포함
- `datas`에 qwen-agent 패키지 및 utils 폴더 포함
- `hiddenimports`에 필요한 모든 모듈 포함

---

## qwen-agent 번들링에 필요한 것

### 1. qwen-agent 경로 자동 탐지

qwen-agent는 설치 위치가 다양할 수 있으므로, 동적으로 경로를 찾아야 합니다:

```python
def find_qwen_agent_path():
    """Find qwen_agent package installation path"""
    try:
        import qwen_agent
        qwen_agent_path = Path(qwen_agent.__file__).parent
        return str(qwen_agent_path)
    except ImportError:
        # Fallback: search in common locations
        venv_path = Path(__file__).parent / '.venv'
        if venv_path.exists():
            site_packages = venv_path / 'Lib' / 'site-packages'
            if site_packages.exists():
                qwen_agent_path = site_packages / 'qwen_agent'
                if qwen_agent_path.exists():
                    return str(qwen_agent_path)
        return None
```

### 2. datas에 qwen-agent 리소스 포함

qwen-agent는 파일 시스템 리소스(utils 폴더 등)를 사용하므로 `datas`에 명시적으로 포함해야 합니다:

```python
qwen_agent_path = find_qwen_agent_path()
datas = []

if qwen_agent_path:
    qwen_agent_path = Path(qwen_agent_path)
    # Add qwen_agent utils folder if it exists
    utils_path = qwen_agent_path / 'utils'
    if utils_path.exists():
        datas.append((str(utils_path), 'qwen_agent/utils/'))
    # Add qwen_agent package
    if qwen_agent_path.exists():
        datas.append((str(qwen_agent_path), 'qwen_agent/'))
```

### 3. hiddenimports에 필요한 모듈 포함

qwen-agent의 모든 하위 모듈을 명시적으로 포함:

```python
hiddenimports=[
    'qwen_agent',
    'qwen_agent.agent',
    'qwen_agent.llm',
    'qwen_agent.tools',
    'qwen_agent.utils',
    'qwen_agent.utils.tokenization_qwen',
    'appdirs',  # qwen-agent가 사용하는 의존성
]
```

---

## ash 프로젝트에 적용할 backend.spec

log-chat의 `log-chat-backend.spec`을 참고하여 ash용으로 수정:

```python
# -*- mode: python ; coding: utf-8 -*-
import os
import sys
from pathlib import Path

# Find qwen_agent package location dynamically
def find_qwen_agent_path():
    """Find qwen_agent package installation path"""
    try:
        import qwen_agent
        qwen_agent_path = Path(qwen_agent.__file__).parent
        return str(qwen_agent_path)
    except ImportError:
        # Fallback: search in common locations
        venv_path = Path(__file__).parent / '.venv'
        if venv_path.exists():
            site_packages = venv_path / 'Lib' / 'site-packages'
            if site_packages.exists():
                qwen_agent_path = site_packages / 'qwen_agent'
                if qwen_agent_path.exists():
                    return str(qwen_agent_path)
        return None

qwen_agent_path = find_qwen_agent_path()
datas = []

if qwen_agent_path:
    qwen_agent_path = Path(qwen_agent_path)
    # Add qwen_agent utils folder if it exists
    utils_path = qwen_agent_path / 'utils'
    if utils_path.exists():
        datas.append((str(utils_path), 'qwen_agent/utils/'))
    # Add qwen_agent package
    if qwen_agent_path.exists():
        datas.append((str(qwen_agent_path), 'qwen_agent/'))
else:
    print("WARNING: qwen_agent path not found, trying to auto-detect...")

a = Analysis(
    ['app.py'],
    pathex=[],
    binaries=[],
    datas=datas,  # ✅ qwen-agent 리소스 포함
    hiddenimports=[
        # FastAPI/Uvicorn
        'uvicorn',
        'uvicorn.lifespan',
        'uvicorn.lifespan.on',
        'uvicorn.protocols',
        'uvicorn.protocols.http',
        'uvicorn.protocols.http.auto',
        'fastapi',
        'fastapi.middleware',
        'fastapi.middleware.cors',
        'fastapi.responses',
        'pydantic',
        
        # Qwen-Agent (필수)
        'qwen_agent',
        'qwen_agent.agent',
        'qwen_agent.agents',
        'qwen_agent.agents.assistant',  # ✅ ash에서 사용하는 Assistant
        'qwen_agent.llm',
        'qwen_agent.tools',
        'qwen_agent.tools.base',  # ✅ agent_tools.py에서 사용
        'qwen_agent.utils',
        'qwen_agent.utils.tokenization_qwen',
        
        # 기타
        'appdirs',
        'requests',
        'agent_tools',  # ✅ ash의 커스텀 tools
        'json5',
    ],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    noarchive=False,
    optimize=0,
)
pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.datas,
    [],
    name='ash-backend',  # ✅ ash 프로젝트 이름
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=True,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)
```

---

## 주요 변경사항 (현재 → 개선)

### 1. datas 추가
```python
# 현재 (ash-agent-ex)
datas=[]

# 개선 (log-chat 참고)
datas=[
    (qwen_agent_utils_path, 'qwen_agent/utils/'),
    (qwen_agent_path, 'qwen_agent/')
]
```

### 2. hiddenimports 확장
```python
# 현재 (ash-agent-ex)
hiddenimports=[
    'qwen_agent',
    'qwen_agent.agents',
]

# 개선
hiddenimports=[
    'qwen_agent',
    'qwen_agent.agent',
    'qwen_agent.agents',
    'qwen_agent.agents.assistant',  # ✅ ash에서 사용
    'qwen_agent.llm',
    'qwen_agent.tools',
    'qwen_agent.tools.base',  # ✅ agent_tools.py에서 사용
    'qwen_agent.utils',
    'qwen_agent.utils.tokenization_qwen',
    'appdirs',
]
```

### 3. 경로 자동 탐지 함수 추가
- qwen-agent 설치 위치를 동적으로 찾는 로직 추가
- 개발/프로덕션 환경 모두에서 작동

---

## 빌드 및 통합

### 1. 빌드 스크립트
log-chat의 `build-backend.sh` / `build-backend.bat` 참고:
- `log-chat-backend` → `ash-backend`로 변경
- 나머지 로직 동일

### 2. forge.config.js
log-chat의 `forge.config.js` (라인 83-110) 참고:
- `extraResource`에 `backend/dist/ash-backend` 추가
- 플랫폼별 확장자 처리 (`.exe`)

### 3. backend-handler.js
log-chat의 `main.js` (라인 222-395) 참고:
- 프로덕션 모드에서 실행 파일 찾기
- 여러 경로 탐색 로직

---

## 검증 방법

빌드 후 다음을 확인:

1. **실행 파일 생성 확인**
   ```bash
   ls -la backend/dist/ash-backend  # 또는 ash-backend.exe
   ```

2. **qwen-agent 포함 확인**
   ```bash
   # 실행 파일 내부에 qwen_agent가 포함되어 있는지 확인
   # (PyInstaller는 임시 디렉토리에 압축 해제)
   ```

3. **실행 테스트**
   ```bash
   ./backend/dist/ash-backend
   # 또는 Windows: backend\dist\ash-backend.exe
   ```

---

## 참고 파일

- `../log-chat/backend/log-chat-backend.spec` - 완전한 spec 파일 (라인 1-82)
- `../ash-agent-ex/backend/backend.spec` - 현재 불완전한 spec (개선 필요)
- `../log-chat/build-backend.sh` - Unix 빌드 스크립트
- `../log-chat/build-backend.bat` - Windows 빌드 스크립트
- `../log-chat/forge.config.js` - extraResource 설정 (라인 83-110)
- `../log-chat/src/main.js` - 프로덕션 모드 실행 파일 찾기 (라인 222-395)
