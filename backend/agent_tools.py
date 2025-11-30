"""
Ash Terminal Agent Tools for Qwen-Agent
========================================

This module defines tools that Qwen-Agent can use to interact with
SSH connections and serial devices through the ash terminal client.

Tools communicate with ash's main process via HTTP API (internal IPC bridge).

IPC Bridge URL Configuration:
    The IPC bridge URL can be configured via environment variables:
    
    Option 1 (Full URL):
        ASH_IPC_URL=http://127.0.0.1:54112
        
    Option 2 (Host and Port separately):
        ASH_IPC_HOST=127.0.0.1
        ASH_IPC_PORT=54112
        
    If ASH_IPC_URL is set, it takes precedence. Otherwise, ASH_IPC_HOST and
    ASH_IPC_PORT are used to construct the URL. Default values are
    127.0.0.1:54112.
"""

import json
import logging
import os
import requests
from qwen_agent.tools.base import BaseTool, register_tool
from typing import Dict, Any, Optional

# Module-level logger
_logger = logging.getLogger(__name__)

# Base URL for ash IPC bridge - configurable via environment variables
# Option 1: Set ASH_IPC_URL to full URL (e.g., "http://127.0.0.1:54112")
# Option 2: Set ASH_IPC_HOST (default: "127.0.0.1") and ASH_IPC_PORT (default: 54112)
_IPC_HOST = os.getenv('ASH_IPC_HOST', '127.0.0.1')
_IPC_PORT = os.getenv('ASH_IPC_PORT', '54112')
_IPC_URL_FULL = os.getenv('ASH_IPC_URL', None)

if _IPC_URL_FULL:
    # Use full URL if provided
    ASH_IPC_URL = _IPC_URL_FULL
else:
    # Construct URL from host and port
    ASH_IPC_URL = f"http://{_IPC_HOST}:{_IPC_PORT}"

# Log IPC configuration on module load
_logger.info(f"[IPC] Configured IPC bridge URL: {ASH_IPC_URL} (configure via ASH_IPC_URL, ASH_IPC_HOST, or ASH_IPC_PORT env vars)")

def call_ash_ipc(channel: str, *args) -> Dict[str, Any]:
    """
    Call ash IPC bridge to execute operations.
    
    Args:
        channel: IPC channel name (e.g., 'ssh-exec-command', 'ssh-list-connections')
        *args: Arguments to pass to the IPC handler
    
    Returns:
        Result from the IPC handler
    """
    try:
        import requests
        
        url = f"{ASH_IPC_URL}/ipc-invoke"
        payload = {
            "channel": channel,
            "args": list(args)
        }
        
        _logger.info(f"[IPC] Calling {channel} with args: {len(args)} arguments")
        _logger.info(f"[IPC] Target URL: {url}")
        _logger.debug(f"[IPC] Payload: {payload}")
        
        # IPC bridge expects: { "channel": "...", "args": [...] }
        response = requests.post(
            url,
            json=payload,
            timeout=30
        )
        
        _logger.info(f"[IPC] Response status: {response.status_code}")
        
        if response.status_code == 200:
            result = response.json()
            _logger.debug(f"[IPC] Response: {result}")
            if result.get("success"):
                return result.get("result", {})
            else:
                error_msg = result.get("error", "Unknown IPC bridge error")
                _logger.error(f"[IPC] Error: {error_msg}")
                raise Exception(error_msg)
        else:
            error_text = response.text
            _logger.error(f"[IPC] HTTP {response.status_code}: {error_text}")
            raise Exception(f"IPC bridge returned status {response.status_code}: {error_text}")
    except requests.exceptions.ConnectionError as e:
        _logger.error(f"[IPC] Connection error: {str(e)}")
        _logger.error(f"[IPC] Failed to connect to IPC bridge at {ASH_IPC_URL}")
        _logger.error(f"[IPC] Make sure ash application is running and IPC bridge is accessible")
        raise Exception(f"Failed to connect to IPC bridge at {ASH_IPC_URL}. Is ash running? You can configure the URL via ASH_IPC_URL environment variable.")
    except requests.exceptions.RequestException as e:
        _logger.error(f"[IPC] Request error: {str(e)}")
        raise Exception(f"Failed to connect to IPC bridge: {str(e)}")
    except Exception as e:
        _logger.error(f"[IPC] Unexpected error: {str(e)}")
        raise Exception(f"IPC bridge error: {str(e)}")

# --- SSH Tools ---

@register_tool('ash_ssh_execute')
class SSHExecuteTool(BaseTool):
    """Execute a command on an SSH connection and return the output."""
    description = 'Execute a shell command on an SSH connection. Returns stdout, stderr, and exit code.'
    parameters = [{
        'name': 'connection_id',
        'type': 'string',
        'description': 'SSH connection ID from ash_list_connections',
        'required': True
    }, {
        'name': 'command',
        'type': 'string',
        'description': 'Command to execute (without shell prompt symbols like $, >, #)',
        'required': True
    }]
    
    def call(self, params: str, **kwargs) -> str:
        import json5
        
        data = json5.loads(params)
        connection_id = data.get('connection_id')
        command = data.get('command')
        
        _logger.info(f"[ash_ssh_execute] connection_id={connection_id}, command={command}")
        
        try:
            # Use the correct IPC channel name: 'ssh-exec-command'
            result = call_ash_ipc('ssh-exec-command', connection_id, command)
            _logger.info(f"[ash_ssh_execute] Result: success={result.get('success')}, output length={len(str(result.get('output', '')))}")
            return json.dumps(result, ensure_ascii=False)
        except Exception as e:
            _logger.error(f"[ash_ssh_execute] Error: {str(e)}", exc_info=True)
            raise

@register_tool('ash_list_connections')
class ListConnectionsTool(BaseTool):
    """List all active SSH and Serial connections."""
    description = 'List all active connections in ash. Returns connection IDs and their details. MUST be called first to get connection_id for other operations.'
    parameters = []
    
    def call(self, params: str, **kwargs) -> str:
        _logger.info("[ash_list_connections] Calling...")
        try:
            # Use the correct IPC channel name: 'ssh-list-connections'
            result = call_ash_ipc('ssh-list-connections')
            _logger.info(f"[ash_list_connections] Found {len(result.get('connections', []))} connections")
            return json.dumps(result, ensure_ascii=False)
        except Exception as e:
            _logger.error(f"[ash_list_connections] Error: {str(e)}", exc_info=True)
            raise

