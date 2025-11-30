#!/usr/bin/env python3
"""
Ash Terminal Backend with Qwen-Agent
====================================

This backend provides Qwen-Agent integration for ash terminal client.
It exposes SSH/Serial tools that Qwen-Agent can use to execute commands
on remote servers or serial devices.

Usage:
    Development: uv run uvicorn app:app --host 127.0.0.1 --port 54111 --reload
    Production: uvicorn app:app --host 127.0.0.1 --port 54111
"""

import os
import sys
from pathlib import Path

# Set Qwen-Agent workspace to use our data directory BEFORE any imports
if getattr(sys, 'frozen', False):
    # Running as a packaged app (PyInstaller) - use Application Support directory
    qwen_workspace = str(Path.home() / 'Library' / 'Application Support' / 'ash' / 'workspace')
else:
    # Running as a script (development)
    qwen_workspace = str(Path(os.environ.get('ASH_DATA_DIR', '.')) / 'workspace')

os.environ['QWEN_AGENT_DEFAULT_WORKSPACE'] = qwen_workspace

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from qwen_agent.agents import Assistant
import uvicorn
import json
import logging
from typing import Dict, Any, List, Optional
from datetime import datetime

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Import agent tools to register them
import agent_tools

app = FastAPI(title="Ash Terminal Backend", version="1.0.0")

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Agent Configuration ---

# LLM configuration (can be overridden via environment variables)
model_config = {
    'model': os.getenv('QWEN_MODEL', 'qwen3:14b'),
    'model_server': os.getenv('QWEN_MODEL_SERVER', 'http://127.0.0.1:11434/v1'),
    'api_key': os.getenv('QWEN_API_KEY', 'ollama'),
    'generate_cfg': {
        'temperature': float(os.getenv('QWEN_TEMPERATURE', '0.2')),
        'max_tokens': int(os.getenv('QWEN_MAX_TOKENS', '4000')),
        'top_p': float(os.getenv('QWEN_TOP_P', '0.9')),
    }
}

# Tool names that will be registered with Qwen-Agent
ash_tool_names = [
    'ash_ssh_execute',
    'ash_list_connections',
]

def build_system_prompt(connection_id: Optional[str] = None) -> str:
    """
    Build system prompt for the agent.
    If connection_id is provided, include it in the prompt to avoid unnecessary ash_list_connections calls.
    """
    base_prompt = (
        "You are an intelligent terminal assistant for the ash terminal client. "
        "You help users execute complex multi-step tasks on remote servers via SSH or serial devices.\n\n"
        
        "CRITICAL: ALL COMMANDS RUN ON SSH-CONNECTED REMOTE SERVER\n"
        "- The user has already established an SSH connection to a remote server through ash terminal client\n"
        "- You are NOT running commands on the local machine - ALL commands execute on the REMOTE SSH server\n"
        "- Every command you execute via ash_ssh_execute runs on the remote server, not locally\n"
        "- File paths, directories, processes, and system information are all from the REMOTE server\n"
        "- All file paths, directory operations, and commands MUST be executed on the remote server via ash_ssh_execute\n"
        "- NEVER execute commands directly without using ash_ssh_execute tool\n\n"
        
        "CRITICAL EXECUTION RULES:\n"
        "1. ALL commands MUST be executed on the remote SSH/Serial connection, NOT on the local machine\n"
        "2. When you execute 'ls', 'df', 'free', 'ps', etc. - these run on the REMOTE server, showing REMOTE server information\n"
        "3. ALWAYS use ash_ssh_execute with a valid connection_id for EVERY command execution\n"
        "4. NEVER execute commands directly - you MUST use ash_ssh_execute tool\n"
        "5. Never include shell prompt symbols ($, >, #) in generated commands\n"
        "6. YOU MUST ACTUALLY EXECUTE COMMANDS - do not just explain how to do it\n"
        "7. When the user asks for information or analysis, EXECUTE the necessary commands on the REMOTE server and provide results\n"
        "8. Do not just describe what commands would work - actually call ash_ssh_execute to run them on the remote server\n\n"
    )
    
    if connection_id:
        # If connection_id is provided, tell the agent to use it directly
        base_prompt += (
            f"ACTIVE CONNECTION:\n"
            f"- The active SSH/Serial connection ID is: {connection_id}\n"
            f"- You MUST use this connection_id directly with ash_ssh_execute\n"
            f"- DO NOT call ash_list_connections - the connection_id is already provided: {connection_id}\n"
            f"- Example: ash_ssh_execute(connection_id='{connection_id}', command='your_command')\n\n"
        )
    else:
        # If no connection_id, tell the agent to find it first
        base_prompt += (
            "CONNECTION DISCOVERY:\n"
            "- You MUST call ash_list_connections FIRST to find active connections\n"
            "- The connection_id from ash_list_connections is REQUIRED for all operations\n\n"
        )
    
    base_prompt += (
        "SYSTEM DETECTION:\n"
        "- You MUST detect the operating system (OS) of the remote server by executing commands\n"
        "- Use commands like 'uname -a', 'cat /etc/os-release', 'ver' (Windows), or 'systeminfo' to detect OS\n"
        "- Detect OS type: Linux, Windows, macOS, etc.\n"
        "- Detect OS version and distribution (e.g., Ubuntu 22.04, Windows Server 2022, etc.)\n"
        "- Use OS-specific commands based on the detected system (e.g., 'ls' for Linux/Mac, 'dir' for Windows)\n"
        "- Always detect the OS first when starting a new session or when OS information is needed\n"
        "- Store OS information in your context and use appropriate commands for that OS\n\n"
        
        "EXECUTION BEHAVIOR:\n"
        "- You MUST execute commands to get actual results, not just explain methods\n"
        "- When asked to check, analyze, or find something, EXECUTE the commands and show the results\n"
        "- Do not say 'you can use X command' - instead, USE the command via ash_ssh_execute and show results\n"
        "- Always execute commands first, then provide analysis based on actual output\n\n"
        
        "RESPONSE FORMAT:\n"
        "- Always format your responses using Markdown for better readability\n"
        "- Use code blocks (```) for command examples and terminal output\n"
        "- Use lists, headers, and formatting to organize information clearly\n"
        "- Use inline code (`) for file names, paths, and technical terms\n"
        "- Show actual command output in code blocks after executing commands\n\n"
        
        "Important guidelines:\n"
        "1. Plan complex tasks step by step\n"
        "2. EXECUTE commands to get real data, don't just explain\n"
        "3. If a command fails, analyze the error and try alternative approaches\n"
        "4. Detect the OS first, then use appropriate commands for the detected OS/environment\n"
        "5. Complete ALL requirements in the user's request before finishing\n"
        "6. Format all responses in Markdown for clarity and readability\n"
        "7. Remember previous context and conversation history - all previous messages are available to you\n"
    )
    
    return base_prompt

# Default system prompt (will be customized per request if connection_id is provided)
ash_system_prompt = build_system_prompt()

# Initialize Qwen-Agent (will be recreated with custom LLM config per request)
ash_assistant = Assistant(
    llm=model_config,
    system_message=ash_system_prompt,
    function_list=ash_tool_names,
)

# --- Pydantic Models ---

class LLMConfig(BaseModel):
    provider: str = 'ollama'
    api_key: Optional[str] = None
    base_url: Optional[str] = None
    model: Optional[str] = None
    temperature: Optional[float] = None
    max_tokens: Optional[int] = None

class TaskRequest(BaseModel):
    message: str
    conversation_history: Optional[List[Dict[str, str]]] = None
    connection_id: Optional[str] = None  # Active SSH/Serial connection ID
    llm_config: Optional[LLMConfig] = None  # LLM configuration from frontend

class HealthResponse(BaseModel):
    status: str
    backend_version: str
    timestamp: str

# --- API Endpoints ---

@app.get("/health", response_model=HealthResponse)
async def health_check():
    """Health check endpoint."""
    return HealthResponse(
        status="healthy",
        backend_version="1.0.0",
        timestamp=datetime.now().isoformat()
    )

@app.post("/agent/execute/stream")
async def execute_task_stream(request: TaskRequest):
    """
    Execute a task with streaming response.
    
    Returns Server-Sent Events (SSE) stream for real-time updates.
    """
    logger.info(f"Streaming task request: {request.message[:100]}...")
    
    # Build system prompt with connection_id if provided
    system_prompt = build_system_prompt(request.connection_id)
    
    # Use LLM config from request if provided, otherwise use default
    if request.llm_config:
        # Build model config from request
        llm_config = {
            'model': request.llm_config.model or model_config['model'],
            'model_server': request.llm_config.base_url or model_config['model_server'],
            'api_key': request.llm_config.api_key or model_config['api_key'],
            'generate_cfg': {
                'temperature': request.llm_config.temperature if request.llm_config.temperature is not None else model_config['generate_cfg']['temperature'],
                'max_tokens': request.llm_config.max_tokens if request.llm_config.max_tokens is not None else model_config['generate_cfg']['max_tokens'],
                'top_p': model_config['generate_cfg']['top_p'],
            }
        }
        
        # Convert Ollama base URL to OpenAI-compatible format
        if request.llm_config.provider == 'ollama':
            base_url = request.llm_config.base_url or 'http://localhost:11434'
            if not base_url.endswith('/v1'):
                base_url = base_url.rstrip('/') + '/v1'
            llm_config['model_server'] = base_url
            llm_config['api_key'] = 'ollama'
        elif request.llm_config.provider == 'openai':
            llm_config['model_server'] = request.llm_config.base_url or 'https://api.openai.com/v1'
            llm_config['api_key'] = request.llm_config.api_key or ''
        elif request.llm_config.provider == 'anthropic':
            # Anthropic uses OpenAI-compatible endpoint via proxy or direct API
            # For Qwen-Agent compatibility, use the base URL (Qwen-Agent will append /chat/completions)
            base_url = request.llm_config.base_url or 'https://api.anthropic.com'
            if not base_url.endswith('/v1'):
                # Anthropic might need /v1, but check if it's already there
                if '/v1' not in base_url:
                    base_url = base_url.rstrip('/') + '/v1'
            llm_config['model_server'] = base_url
            llm_config['api_key'] = request.llm_config.api_key or ''
        
        logger.info(f"Using LLM config: provider={request.llm_config.provider}, model={llm_config['model']}, server={llm_config['model_server']}")
        if request.connection_id:
            logger.info(f"Using active connection_id: {request.connection_id}")
        
        # Create assistant with custom LLM config and connection_id-aware system prompt
        assistant = Assistant(
            llm=llm_config,
            system_message=system_prompt,
            function_list=ash_tool_names,
        )
    else:
        # Use default assistant but with connection_id-aware system prompt
        if request.connection_id:
            logger.info(f"Using default LLM config with active connection_id: {request.connection_id}")
            assistant = Assistant(
                llm=model_config,
                system_message=system_prompt,
                function_list=ash_tool_names,
            )
        else:
            assistant = ash_assistant
            logger.info(f"Using default LLM config: model={model_config['model']}, server={model_config['model_server']}")
    
    messages = []
    if request.conversation_history:
        messages.extend(request.conversation_history)
    messages.append({"role": "user", "content": request.message})
    
    def generate():
        try:
            logger.info(f"Running assistant with {len(messages)} messages.")
            
            # Qwen-Agent automatically includes tool results in the conversation
            for response_chunk in assistant.run(messages=messages):
                for message in response_chunk:
                    # Log all message details for debugging
                    logger.debug(f"Message from Qwen-Agent: {json.dumps(message, ensure_ascii=False, indent=2)}")
                    
                    event_type = message.get('role', 'unknown')
                    content = message.get('content', '')
                    
                    # Check for assistant content (thinking/reasoning)
                    if event_type == 'assistant':
                        if content:
                            # Extract reasoning/thinking from content
                            # Qwen models often include reasoning in <think>, <reasoning>, or similar tags
                            reasoning_content = None
                            display_content = content
                            
                            # Try to extract reasoning from various tag formats
                            import re
                            reasoning_patterns = [
                                r'<think>(.*?)</think>',
                                r'<reasoning>(.*?)</reasoning>',
                                r'<think>(.*?)</think>',
                                r'<thought>(.*?)</thought>',
                            ]
                            
                            for pattern in reasoning_patterns:
                                match = re.search(pattern, content, re.DOTALL | re.IGNORECASE)
                                if match:
                                    reasoning_content = match.group(1).strip()
                                    # Remove reasoning from display content
                                    display_content = re.sub(pattern, '', content, flags=re.DOTALL | re.IGNORECASE).strip()
                                    break
                            
                            # If no reasoning tags found, check if content itself is reasoning
                            # (sometimes Qwen sends reasoning without tags before tool calls)
                            if not reasoning_content and content and not message.get('function_call'):
                                # If content is substantial and no tool call, treat as reasoning
                                reasoning_content = content
                                display_content = ''
                            
                            # Stream reasoning separately if found
                            if reasoning_content:
                                yield f"data: {json.dumps({'type': 'reasoning', 'content': reasoning_content})}\n\n"
                            
                            # Stream display content (if any remains after extracting reasoning)
                            if display_content:
                                yield f"data: {json.dumps({'type': 'content', 'content': display_content})}\n\n"
                        
                        # Check for function_call (tool call request) - don't show to user, just log
                        function_call = message.get('function_call')
                        if function_call:
                            # LLM is requesting to call a tool
                            tool_name = function_call.get('name', 'unknown_tool')
                            tool_args = function_call.get('arguments', '{}')
                            logger.info(f"Tool call request: {tool_name} with args: {tool_args[:200]}...")
                            # Don't stream tool call to client - user doesn't need to see this
                    
                    # Check for tool results
                    elif event_type == 'tool':
                        tool_name = message.get('name', 'unknown_tool')
                        tool_content = str(content)
                        logger.info(f"Tool {tool_name} result: {tool_content[:100]}...")
                        # Stream tool result to client for visibility
                        yield f"data: {json.dumps({'type': 'tool_result', 'tool_name': tool_name, 'content': tool_content})}\n\n"
                    
                    # Handle any other message types
                    else:
                        # Stream any other message types for visibility
                        logger.info(f"Unknown message type: {event_type}, content: {str(content)[:100]}...")
                        yield f"data: {json.dumps({'type': 'message', 'role': event_type, 'content': str(content)})}\n\n"
            
            logger.info("Assistant run completed.")
            yield f"data: {json.dumps({'type': 'done', 'timestamp': datetime.now().isoformat()})}\n\n"
            
        except Exception as e:
            logger.error(f"Streaming task error: {e}", exc_info=True)
            yield f"data: {json.dumps({'type': 'error', 'content': str(e)})}\n\n"
        finally:
            yield "data: [DONE]\n\n"
            logger.info("Sent final DONE signal")
    
    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "Access-Control-Allow-Origin": "*",
        }
    )

if __name__ == "__main__":
    uvicorn.run(app, host="127.0.0.1", port=54111)

