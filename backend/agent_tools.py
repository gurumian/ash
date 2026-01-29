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
        url = f"{ASH_IPC_URL}/ipc-invoke"
        payload = {
            "channel": channel,
            "args": list(args)
        }
        
        _logger.info(f"[IPC] Calling {channel} with args: {len(args)} arguments")
        _logger.debug(f"[IPC] Target URL: {url}")
        _logger.debug(f"[IPC] Payload: {payload}")
        
        # IPC bridge expects: { "channel": "...", "args": [...] }
        # Use longer timeout for SSH commands that might take time (e.g., long-running commands)
        # 5 minutes should be enough for most commands
        response = requests.post(
            url,
            json=payload,
            timeout=300  # 5 minutes for long-running commands
        )
        
        _logger.info(f"[IPC] Response status: {response.status_code}")
        
        if response.status_code == 200:
            result = response.json()
            _logger.debug(f"[IPC] Response: {result}")
            if result.get("success"):
                return result.get("result", {})
            else:
                error_msg = result.get("error", "Unknown IPC bridge error")
                
                # If user denied, log as info not error
                if "denied by user" in error_msg or "denied permission" in error_msg:
                    _logger.info(f"[IPC] Request denied: {error_msg}")
                else:
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

@register_tool('ash_execute_command')
class UnifiedExecuteTool(BaseTool):
    """Execute a command on ANY connection (SSH, Telnet, Serial, Local)."""
    description = 'Universal command execution tool. Automatically detects the connection type (SSH/Telnet/Serial/Local) and routes the command. ALWAYS use this instead of specific ssh/telnet/serial tools. Returns stdout, stderr, and exit code.'
    parameters = [{
        'name': 'connection_id',
        'type': 'string',
        'description': 'Active connection ID',
        'required': True
    }, {
        'name': 'command',
        'type': 'string',
        'description': 'Command to execute',
        'required': True
    }]
    
    def call(self, params: str, **kwargs) -> str:
        import json5
        
        data = json5.loads(params)
        connection_id = data.get('connection_id')
        command = data.get('command')
        
        _logger.info(f"[ash_execute_command] Processing: id={connection_id}, cmd={command}")

        # 1. Internal Type Lookup (No AI Guessing)
        try:
            list_result = call_ash_ipc('ssh-list-connections')
            connections = list_result.get('connections', [])
            target = next((c for c in connections if c.get('connectionId') == connection_id), None)
            
            if not target:
                return json.dumps({
                    "success": False, 
                    "error": f"Connection ID {connection_id} not found. active connections: {len(connections)}"
                }, ensure_ascii=False)
            
            conn_type = target.get('type', 'ssh') # Default to ssh if missing
            
            # 2. Route to correct internal channel
            channel_map = {
                'ssh': 'ssh-exec-command',
                'telnet': 'telnet-exec-command',
                'serial': 'serial-exec-command',
                'local': 'local-exec-command'
            }
            
            ipc_channel = channel_map.get(conn_type, 'ssh-exec-command')
            _logger.info(f"[ash_execute_command] Routing to {ipc_channel} (type={conn_type})")
            
            # 3. Execute
            result = call_ash_ipc(ipc_channel, connection_id, command)
            result['command'] = command
            return json.dumps(result, ensure_ascii=False)

        except Exception as e:
            error_msg = str(e)
            # If user simply denied the request, it's not a system error - log as info without stack trace
            if "denied by user" in error_msg or "denied permission" in error_msg:
                _logger.info(f"[ash_execute_command] Action denied by user: {error_msg}")
            else:
                _logger.error(f"[ash_execute_command] Error: {error_msg}", exc_info=True)
                
            return json.dumps({"success": False, "error": error_msg}, ensure_ascii=False)


# Legacy Tools (Kept for compatibility but marked deprecated in prompts/docs if needed)
# ... individual tools removed to force usage of Unified Tool ...


@register_tool('ash_list_connections')
class ListConnectionsTool(BaseTool):
    """List all active SSH, Telnet, Serial, and Local connections."""
    description = 'List all active connections in ash (SSH, Telnet, Serial, and Local). Returns connection IDs, types, and their details. ONLY use this if no connection_id was provided in the system prompt. If a connection_id is already provided, use it directly without calling this tool. Each connection has a "type" field indicating "ssh", "telnet", "serial", or "local".'
    parameters = []
    
    def call(self, params: str, **kwargs) -> str:
        _logger.info("[ash_list_connections] Calling...")
        try:
            # Use the correct IPC channel name: 'ssh-list-connections' (now returns all connection types)
            result = call_ash_ipc('ssh-list-connections')
            connections = result.get('connections', [])
            _logger.info(f"[ash_list_connections] Found {len(connections)} connections")
            # Log connection types for debugging
            for conn in connections:
                _logger.debug(f"[ash_list_connections] Connection {conn.get('connectionId')}: type={conn.get('type')}, connected={conn.get('connected')}")
            return json.dumps(result, ensure_ascii=False)
        except Exception as e:
            _logger.error(f"[ash_list_connections] Error: {str(e)}", exc_info=True)
            raise

@register_tool('ash_ask_user')
class AshAskUserTool(BaseTool):
    """Ask the user a question and wait for their input/approval."""
    description = 'Ask the user a question. Use ONLY for: 1) Permissions for destructive actions, 2) Requesting passwords/secrets, 3) Clarifying truly ambiguous input where no safe guess is possible. DO NOT use this to ask what command to run.'
    parameters = [{
        'name': 'question',
        'type': 'string',
        'description': 'The question to ask the user',
        'required': True
    }, {
        'name': 'is_password',
        'type': 'boolean',
        'description': 'Set to true if asking for a password or sensitive information (input will be masked)',
        'required': False
    }]
    
    def call(self, params: str, **kwargs) -> str:
        import json5
        
        data = json5.loads(params)
        question = data.get('question')
        is_password = data.get('is_password', False)
        
        _logger.info(f"[ash_ask_user] Asking user: {question} (is_password={is_password})")
        
        try:
            # Call IPC bridge to show dialog to user
            result = call_ash_ipc('ask-user', question, is_password)
            
            _logger.info(f"[ash_ask_user] User responded: {'(hidden)' if is_password else result}")
            return result
        except Exception as e:
            _logger.error(f"[ash_ask_user] Error: {str(e)}", exc_info=True)
            raise

@register_tool('ash_web_search')
class WebSearchTool(BaseTool):
    """Perform a web search using DuckDuckGo."""
    description = 'Search the web for information using DuckDuckGo. Useful for finding documentation, solutions to errors, or general knowledge. Returns a list of search results with titles, URLs, and snippets.'
    parameters = [{
        'name': 'query',
        'type': 'string',
        'description': 'The search query',
        'required': True
    }, {
        'name': 'max_results',
        'type': 'integer',
        'description': 'Maximum number of results to return (default: 5)',
        'required': False
    }]
    
    def call(self, params: str, **kwargs) -> str:
        import json5
        from duckduckgo_search import DDGS
        
        data = json5.loads(params)
        query = data.get('query')
        max_results = data.get('max_results', 5)
        
        _logger.info(f"[ash_web_search] Searching for: {query} (max={max_results})")
        
        try:
            results = []
            with DDGS() as ddgs:
                # Use 'text' backend for standard web search
                # max_results defaults to 5 if not specified
                search_gen = ddgs.text(query, max_results=max_results)
                for r in search_gen:
                    results.append({
                        'title': r.get('title'),
                        'href': r.get('href'),
                        'body': r.get('body'),
                    })
            
            _logger.info(f"[ash_web_search] Found {len(results)} results")
            return json.dumps(results, ensure_ascii=False)
        except Exception as e:
            _logger.error(f"[ash_web_search] Error: {str(e)}", exc_info=True)
            return json.dumps({
                "error": str(e),
                "message": "Failed to perform web search. Please try again with a different query."
            }, ensure_ascii=False)


