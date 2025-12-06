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
    # Cross-platform support
    if sys.platform == 'darwin':
        qwen_workspace = str(Path.home() / 'Library' / 'Application Support' / 'ash' / 'workspace')
    elif sys.platform == 'win32':
        qwen_workspace = str(Path.home() / 'AppData' / 'Roaming' / 'ash' / 'workspace')
    else:
        # Linux
        qwen_workspace = str(Path.home() / '.config' / 'ash' / 'workspace')
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
        "- Check conversation history FIRST - if OS information is already available from previous commands, DO NOT detect it again\n"
        "- Only detect the OS if it's not already known from conversation history\n"
        "- Use commands like 'uname -a', 'cat /etc/os-release', 'ver' (Windows), or 'systeminfo' to detect OS\n"
        "- Detect OS type: Linux, Windows, macOS, etc.\n"
        "- Detect OS version and distribution (e.g., Ubuntu 22.04, Windows Server 2022, etc.)\n"
        "- Use OS-specific commands based on the detected system (e.g., 'ls' for Linux/Mac, 'dir' for Windows)\n"
        "- Once OS is detected, remember it and do NOT detect it again in the same conversation\n"
        "- Store OS information in your context and use appropriate commands for that OS\n\n"
        
        "EXECUTION BEHAVIOR:\n"
        "- Check conversation history BEFORE executing commands - avoid repeating commands that were already executed\n"
        "- If a command was already executed and the result is in conversation history, use that result instead of re-executing\n"
        "- BEFORE calling any tool, check if the same command was already executed in this conversation\n"
        "- If you see a tool result in conversation history with the same command, DO NOT execute it again - use the existing result\n"
        "- You MUST execute commands to get actual results, not just explain methods\n"
        "- When asked to check, analyze, or find something, EXECUTE the commands and show the results\n"
        "- Do not say 'you can use X command' - instead, USE the command via ash_ssh_execute and show results\n"
        "- Always execute commands first, then provide analysis based on actual output\n"
        "- NEVER just explain what commands would work - YOU MUST ACTUALLY CALL ash_ssh_execute TO RUN THEM\n"
        "- When the user asks you to do something (like 'investigate memory usage for one hour'), you MUST:\n"
        "  1. Check conversation history first to see if relevant data already exists\n"
        "  2. If not, immediately call ash_ssh_execute to run the necessary commands\n"
        "  3. Show the actual results from the commands\n"
        "  4. Then provide analysis based on the real data\n"
        "- DO NOT write explanations without executing commands first\n"
        "- DO NOT say 'I will execute X command' - just execute it immediately using ash_ssh_execute\n"
        "- CRITICAL: DO NOT repeat commands that were already executed - check conversation history first\n"
        "- CRITICAL: If you see tool results in conversation history, those commands have already been executed - do NOT execute them again\n"
        "- CRITICAL: After executing a command and receiving the result, move on to the next step - do NOT execute the same command again\n\n"
        
        "RESPONSE FORMAT:\n"
        "- Present your responses in clear, well-structured Markdown format.\n"
        "- You may include your internal thoughts, analysis, and step-by-step plan in your response when helpful for the user to understand your reasoning.\n"
        "- Format your responses using Markdown\n"
        "- Use code blocks (```) for command output and multi-line content\n"
        "- Use inline code (`) for single values, file names, and paths\n"
        "- Use lists and headers to organize information\n"
        "- Show actual command results in code blocks\n"
        "- NEVER show tool call syntax like 'ash_ssh_execute(...)' to the user - just show the actual command that was executed\n"
        "- When describing what command was executed, show only the command itself (e.g., 'apt list --upgradeable'), not the tool call syntax\n"
        "- Tool calls happen automatically in the background - users only need to see the commands and their results\n\n"
        
        "Important guidelines:\n"
        "1. Plan complex tasks step by step and explain your approach clearly.\n"
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

# Cache for assistant instances
assistant_cache: Dict[str, Assistant] = {
    "default": Assistant(
        llm=model_config,
        system_message=ash_system_prompt,
        function_list=ash_tool_names,
    )
}

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
    Execute a task with streaming response using a manual ReAct loop.
    
    This implementation correctly handles the agent's lifecycle:
    1. It manually manages the `messages` history.
    2. It detects when the agent wants to call a tool.
    3. It executes the tool and captures the output.
    4. It adds the tool's result back to the `messages` history in the correct format.
    5. It continues the loop until the agent provides a final answer.
    
    Returns Server-Sent Events (SSE) stream for real-time updates.
    """
    logger.info(f"Streaming task request: {request.message[:100]}...")
    
    # Generate a cache key based on LLM config and connection ID
    if request.llm_config:
        config_dict = request.llm_config.dict()
        config_dict['connection_id'] = request.connection_id
        # Sort the dictionary to ensure consistent key format
        cache_key = json.dumps(config_dict, sort_keys=True)
    else:
        # Use a key that also depends on the connection_id for the default config
        cache_key = f"default_conn_{request.connection_id}" if request.connection_id else "default"

    assistant = assistant_cache.get(cache_key)

    if not assistant:
        logger.info(f"Creating new assistant for cache key: {cache_key}")
        system_prompt = build_system_prompt(request.connection_id)
        
        if request.llm_config:
            # Build model config from request
            llm_config_data = {
                'model': request.llm_config.model or model_config['model'],
                'model_server': request.llm_config.base_url or model_config['model_server'],
                'api_key': request.llm_config.api_key or model_config['api_key'],
                'generate_cfg': {
                    'temperature': request.llm_config.temperature if request.llm_config.temperature is not None else model_config['generate_cfg']['temperature'],
                    'max_tokens': request.llm_config.max_tokens if request.llm_config.max_tokens is not None else model_config['generate_cfg']['max_tokens'],
                    'top_p': model_config['generate_cfg']['top_p'],
                }
            }
            
            # Convert provider-specific URLs
            if request.llm_config.provider == 'ollama':
                base_url = request.llm_config.base_url or 'http://localhost:11434'
                if not base_url.endswith('/v1'):
                    base_url = base_url.rstrip('/') + '/v1'
                llm_config_data['model_server'] = base_url
                llm_config_data['api_key'] = 'ollama'
            elif request.llm_config.provider == 'openai':
                llm_config_data['model_server'] = request.llm_config.base_url or 'https://api.openai.com/v1'
            elif request.llm_config.provider == 'anthropic':
                base_url = request.llm_config.base_url or 'https://api.anthropic.com'
                if not base_url.endswith('/v1'):
                     if '/v1' not in base_url:
                        base_url = base_url.rstrip('/') + '/v1'
                llm_config_data['model_server'] = base_url

            logger.info(f"Using LLM config: provider={request.llm_config.provider}, model={llm_config_data['model']}, server={llm_config_data['model_server']}")
            
            assistant = Assistant(
                llm=llm_config_data,
                system_message=system_prompt,
                function_list=ash_tool_names,
            )
        else:
            # This branch is for the default assistant with a connection_id
            assistant = Assistant(
                llm=model_config,
                system_message=system_prompt,
                function_list=ash_tool_names,
            )
        
        assistant_cache[cache_key] = assistant
    else:
        logger.info(f"Using cached assistant for key: {cache_key}")

    messages = []
    if request.conversation_history:
        messages.extend(request.conversation_history)
    messages.append({"role": "user", "content": request.message})
    
    def generate():
        try:
            logger.info(f"Running assistant with {len(messages)} messages.")
            if request.conversation_history:
                logger.info(f"Conversation history: {len(request.conversation_history)} previous messages")
            else:
                logger.warning("No conversation history provided - agent will start fresh")
            
            # Track previous content across all turns to send only incremental chunks
            previous_content = ''
            
            # Manual ReAct loop: iterate until agent finishes (no more tool calls)
            while True:
                logger.info(f"Running agent turn with {len(messages)} messages...")
                
                # Run the agent - it will return responses including tool calls
                responses = assistant.run(messages=messages)
                
                has_tool_calls = False
                
                # Process each chunk of responses
                for chunk in responses:
                    # Append agent's thought process to history
                    messages.extend(chunk)
                    
                    for message in chunk:
                        logger.debug(f"Agent message: {json.dumps(message, ensure_ascii=False)}")
                        
                        # Stream assistant content as it arrives (incremental chunks only)
                        if message.get('role') == 'assistant' and message.get('content'):
                            current_content = message['content']
                            # Only send the new part (delta)
                            if current_content.startswith(previous_content):
                                new_chunk = current_content[len(previous_content):]
                                if new_chunk:  # Only send if there's new content
                                    yield f"data: {json.dumps({'type': 'content_chunk', 'content': new_chunk})}\n\n"
                                previous_content = current_content
                            else:
                                # Content doesn't start with previous - send full content (fallback)
                                yield f"data: {json.dumps({'type': 'content_chunk', 'content': current_content})}\n\n"
                                previous_content = current_content

                        # Check for tool calls (Qwen-Agent uses 'tool_calls' field)
                        if message.get('tool_calls'):
                            has_tool_calls = True
                            for tool_call in message['tool_calls']:
                                tool_name = tool_call.get('function', {}).get('name', 'unknown_tool')
                                tool_args = tool_call.get('function', {}).get('arguments', '{}')
                                tool_call_id = tool_call.get('id')
                                
                                logger.info(f"Executing tool '{tool_name}' with ID '{tool_call_id}'")
                                logger.info(f"Args: {tool_args}")
                                
                                # Stream tool call event to frontend
                                yield f"data: {json.dumps({'type': 'tool_call', 'name': tool_name, 'args': tool_args})}\n\n"

                                # Execute the tool
                                try:
                                    tool_result_content = assistant.execute_tool(
                                        (tool_name, tool_args)
                                    )
                                except Exception as e:
                                    logger.error(f"Error executing tool {tool_name}: {str(e)}", exc_info=True)
                                    tool_result_content = f"Error executing tool: {str(e)}"
                                
                                logger.info(f"Tool '{tool_name}' result: {tool_result_content[:200]}...")
                                
                                # Add tool result to history in the correct format
                                tool_result_message = {
                                    'role': 'tool',
                                    'name': tool_name,
                                    'content': tool_result_content,
                                    'tool_call_id': tool_call_id
                                }
                                messages.append(tool_result_message)

                                # Stream tool result to frontend
                                yield f"data: {json.dumps({'type': 'tool_result', 'name': tool_name, 'content': tool_result_content})}\n\n"

                # If there were no tool calls in this turn, the agent is done
                if not has_tool_calls:
                    logger.info("No more tool calls in this turn. Agent has finished.")
                    # Before breaking, check if there's any final assistant content to send
                    # Find the last assistant message in messages
                    for msg in reversed(messages):
                        if msg.get('role') == 'assistant' and msg.get('content'):
                            final_content = msg['content']
                            # If we haven't sent this content yet, send it
                            if final_content != previous_content and final_content.startswith(previous_content):
                                remaining_chunk = final_content[len(previous_content):]
                                if remaining_chunk:
                                    logger.info(f"Sending final content chunk: {len(remaining_chunk)} chars")
                                    yield f"data: {json.dumps({'type': 'content_chunk', 'content': remaining_chunk})}\n\n"
                            break
                    break # Exit the while loop
            
            logger.info("Agent run completed.")
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

