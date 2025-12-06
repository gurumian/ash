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
    datas=datas,
    hiddenimports=[
        'qwen_agent',
        'qwen_agent.agent',
        'qwen_agent.agents',
        'qwen_agent.agents.assistant',
        'qwen_agent.llm',
        'qwen_agent.tools',
        'qwen_agent.tools.base',
        'qwen_agent.utils',
        'qwen_agent.utils.tokenization_qwen',
        'appdirs',
        'fastapi',
        'uvicorn',
        'pydantic',
        'json5',
        'agent_tools',
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
    name='ash-backend',
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
    codesign_identity=os.environ.get('APPLE_IDENTITY') or 'Apple Development: Sungmin Kim (XM4Q8R9Y2G)',
    entitlements_file=None,
)

