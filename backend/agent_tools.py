"""
Ash Terminal Agent Tools for Qwen-Agent
========================================

This module defines tools that Qwen-Agent can use to interact with
SSH connections and serial devices through the ash terminal client.

Tools communicate with ash's main process via HTTP API (internal IPC bridge).
"""

import json
import requests
from qwen_agent.tools.base import BaseTool, register_tool
from typing import Dict, Any, Optional

# Base URL for ash IPC bridge
ASH_IPC_URL = "http://127.0.0.1:54112"  # Different port from backend API

def call_ash_ipc(channel: str, *args) -> Dict[str, Any]:
    """
    Call ash IPC bridge to execute operations.
    
    Args:
        channel: IPC channel name (e.g., 'ssh-exec-command', 'ssh-list-connections')
        *args: Arguments to pass to the IPC handler
    
    Returns:
        Result from the IPC handler
    """
    import logging
    logger = logging.getLogger(__name__)
    
    try:
        import requests
        
        url = f"{ASH_IPC_URL}/ipc-invoke"
        payload = {
            "channel": channel,
            "args": list(args)
        }
        
        logger.info(f"[IPC] Calling {channel} with args: {len(args)} arguments")
        logger.debug(f"[IPC] URL: {url}, Payload: {payload}")
        
        # IPC bridge expects: { "channel": "...", "args": [...] }
        response = requests.post(
            url,
            json=payload,
            timeout=30
        )
        
        logger.info(f"[IPC] Response status: {response.status_code}")
        
        if response.status_code == 200:
            result = response.json()
            logger.debug(f"[IPC] Response: {result}")
            if result.get("success"):
                return result.get("result", {})
            else:
                error_msg = result.get("error", "Unknown IPC bridge error")
                logger.error(f"[IPC] Error: {error_msg}")
                raise Exception(error_msg)
        else:
            error_text = response.text
            logger.error(f"[IPC] HTTP {response.status_code}: {error_text}")
            raise Exception(f"IPC bridge returned status {response.status_code}: {error_text}")
    except requests.exceptions.ConnectionError as e:
        logger.error(f"[IPC] Connection error: {str(e)}")
        raise Exception(f"Failed to connect to IPC bridge at {ASH_IPC_URL}. Is ash running?")
    except requests.exceptions.RequestException as e:
        logger.error(f"[IPC] Request error: {str(e)}")
        raise Exception(f"Failed to connect to IPC bridge: {str(e)}")
    except Exception as e:
        logger.error(f"[IPC] Unexpected error: {str(e)}")
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
        import logging
        logger = logging.getLogger(__name__)
        
        data = json5.loads(params)
        connection_id = data.get('connection_id')
        command = data.get('command')
        
        logger.info(f"[ash_ssh_execute] connection_id={connection_id}, command={command}")
        
        try:
            # Use the correct IPC channel name: 'ssh-exec-command'
            result = call_ash_ipc('ssh-exec-command', connection_id, command)
            logger.info(f"[ash_ssh_execute] Result: success={result.get('success')}, output length={len(str(result.get('output', '')))}")
            return json.dumps(result, ensure_ascii=False)
        except Exception as e:
            logger.error(f"[ash_ssh_execute] Error: {str(e)}", exc_info=True)
            return json.dumps({"success": False, "error": str(e)}, ensure_ascii=False)

@register_tool('ash_list_connections')
class ListConnectionsTool(BaseTool):
    """List all active SSH and Serial connections."""
    description = 'List all active connections in ash. Returns connection IDs and their details. MUST be called first to get connection_id for other operations.'
    parameters = []
    
    def call(self, params: str, **kwargs) -> str:
        import logging
        logger = logging.getLogger(__name__)
        
        logger.info("[ash_list_connections] Calling...")
        try:
            # Use the correct IPC channel name: 'ssh-list-connections'
            result = call_ash_ipc('ssh-list-connections')
            logger.info(f"[ash_list_connections] Found {len(result.get('connections', []))} connections")
            return json.dumps(result, ensure_ascii=False)
        except Exception as e:
            logger.error(f"[ash_list_connections] Error: {str(e)}", exc_info=True)
            return json.dumps({"success": False, "error": str(e)}, ensure_ascii=False)

