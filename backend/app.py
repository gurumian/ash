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

# Configure logging - use standard format
logging.basicConfig(
    level=logging.INFO,
    format='%(levelname)s:%(name)s: %(message)s'
)
logger = logging.getLogger('app')

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
    'ash_execute_command',  # Unified execution tool
    'ash_list_connections',
    'ash_ask_user',
    'ash_web_search',
]

from prompts.system_prompt import build_system_prompt

# Default system prompt (will be customized per request if connection_id is provided)
ash_system_prompt = build_system_prompt()

# Default system prompt (will be customized per request if connection_id is provided)
ash_system_prompt = build_system_prompt()


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
    logger.info(f"Connection ID provided: {request.connection_id}")
    
    # Get current working directory if connection_id is provided
    current_directory = None
    if request.connection_id:
        try:
            # Use agent_tools.call_ash_ipc to execute pwd command
            from agent_tools import call_ash_ipc
            
            # First, determine connection type to route to correct channel
            list_result = call_ash_ipc('ssh-list-connections')
            connections = list_result.get('connections', [])
            target = next((c for c in connections if c.get('connectionId') == request.connection_id), None)
            
            if target:
                conn_type = target.get('type', 'ssh')
                channel_map = {
                    'ssh': 'ssh-exec-command',
                    'telnet': 'telnet-exec-command',
                    'serial': 'serial-exec-command'
                }
                ipc_channel = channel_map.get(conn_type, 'ssh-exec-command')
                
                # Execute pwd command
                pwd_result = call_ash_ipc(ipc_channel, request.connection_id, 'pwd')
                if pwd_result.get('success') and pwd_result.get('output'):
                    current_directory = pwd_result.get('output', '').strip()
                    logger.info(f"Current directory for {request.connection_id}: {current_directory}")
        except Exception as e:
            # If pwd fails, continue without current directory info
            logger.warning(f"Failed to get current directory: {str(e)}")
            current_directory = None
    
    # Create new assistant for each request to ensure statelessness
    # (Qwen-Agent Assistant might maintain internal state/history if reused)
    logger.info(f"Creating new assistant for task")
    system_prompt = build_system_prompt(request.connection_id, current_directory)
    
    # If connection_id is provided, remove ash_list_connections from available tools
    # because the connection is already bound and listing is unnecessary
    available_tools = ash_tool_names.copy()
    if request.connection_id:
        if 'ash_list_connections' in available_tools:
            available_tools.remove('ash_list_connections')
            logger.info(f"Removed ash_list_connections from available tools (connection_id provided: {request.connection_id})")
    
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
        elif request.llm_config.provider == 'ash':
            # Ash backend proxies to Ollama, so use the same format
            base_url = request.llm_config.base_url or 'https://ash.toktoktalk.com/v1'
            if not base_url.endswith('/v1'):
                base_url = base_url.rstrip('/') + '/v1'
            llm_config_data['model_server'] = base_url
            # Use the API key from request, or default to 'ollama' if not provided
            api_key = request.llm_config.api_key or 'ollama'
            llm_config_data['api_key'] = api_key
            # Qwen-Agent may use api_key as Authorization header, but ash server needs X-API-Key
            # Try to add custom headers if Qwen-Agent supports it
            # Note: This depends on Qwen-Agent's implementation
            if 'headers' not in llm_config_data:
                llm_config_data['headers'] = {}
            llm_config_data['headers']['X-API-Key'] = api_key
        elif request.llm_config.provider == 'openai':
            llm_config_data['model_server'] = request.llm_config.base_url or 'https://api.openai.com/v1'
        elif request.llm_config.provider == 'anthropic':
            base_url = request.llm_config.base_url or 'https://api.anthropic.com'
            if not base_url.endswith('/v1'):
                if '/v1' not in base_url:
                    base_url = base_url.rstrip('/') + '/v1'
            llm_config_data['model_server'] = base_url

        logger.info(f"Using LLM config: provider={request.llm_config.provider}, model={llm_config_data['model']}, server={llm_config_data['model_server']}")
        if request.llm_config.provider == 'ash':
            logger.info(f"Ash API key: {api_key[:10]}... (truncated for security)")
            logger.info(f"Ash LLM config keys: {list(llm_config_data.keys())}")
            if 'headers' in llm_config_data:
                logger.info(f"Ash custom headers: {list(llm_config_data['headers'].keys())}")
        
        assistant = Assistant(
            llm=llm_config_data,
            system_message=system_prompt,
            function_list=available_tools,
        )
    else:
        # This branch is for the default assistant with a connection_id
        assistant = Assistant(
            llm=model_config,
            system_message=system_prompt,
            function_list=available_tools,
        )

    messages = []
    if request.conversation_history:
        # Convert 'tool' role to 'function' role for Qwen-Agent compatibility
        # Qwen-Agent's Pydantic model only accepts: user, assistant, system, function
        for msg in request.conversation_history:
            # Convert tool role to function role
            # (Frontend stores/compacts tool outputs; backend should not try to reinterpret custom fields.)
            converted_msg = msg.copy()
            if converted_msg.get('role') == 'tool':
                converted_msg['role'] = 'function'
            messages.append(converted_msg)
    messages.append({"role": "user", "content": request.message})
    
    def generate():
        # Maximum size per SSE message (to avoid "Payload Too Large" errors)
        # Use 32KB to be very safe (some servers/proxies have very strict limits)
        MAX_CHUNK_SIZE = 32 * 1024  # 32KB - very conservative, safe for all servers
        logger.info(f"Starting SSE stream with MAX_CHUNK_SIZE={MAX_CHUNK_SIZE} bytes")
        
        # Track the latest tool result of THIS run only.
        # This avoids mistakenly using old conversation history data when summarizing after an exception.
        last_tool_ctx = None  # {name, command, total_raw_size, stdout_head, stderr_head}

        def _serialize_sse(obj: dict) -> tuple[str, int]:
            serialized = json.dumps(obj, ensure_ascii=False)
            sse_message = f"data: {serialized}\n\n"
            return sse_message, len(sse_message.encode("utf-8"))

        def _emit(obj: dict):
            """Emit a single SSE event if it fits MAX_CHUNK_SIZE.
            Returns True if emitted, False if too large.
            """
            msg, size = _serialize_sse(obj)
            if size < MAX_CHUNK_SIZE:
                yield msg
                return True
            return False

        def _emit_text_chunks(*, base: dict, text: str, text_key: str, index_key: str, initial_chunk_size: int = 15 * 1024):
            """Emit `text` split into chunks, dynamically shrinking if JSON gets too large."""
            chunk_size = initial_chunk_size
            i = 0
            chunk_index = 0

            while i < len(text):
                chunk = text[i:i + chunk_size]
                payload = dict(base)
                payload[text_key] = chunk
                payload[index_key] = chunk_index

                sent = yield from _emit(payload)
                if not sent:
                    chunk_size = int(chunk_size * 0.7)
                    if chunk_size < 5000:
                        logger.error(f"Chunk size too small ({chunk_size} bytes), cannot send {base.get('type')}")
                        # Last resort: send a small error and stop
                        yield from _emit({'type': 'error', 'content': 'Server response exceeded size limit. The command output was too large to process.'})
                        return False
                    continue

                i += len(chunk)
                chunk_index += 1

            return True

        def _emit_tool_stream_chunks(tool_name: str, stream: str, text: str):
            """Emit stdout/stderr as tool_result_chunk events."""
            if not text:
                return True
            base = {'type': 'tool_result_chunk', 'name': tool_name, 'stream': stream}
            # Use 30KB content as initial size (kept from previous logic)
            return (yield from _emit_text_chunks(base=base, text=text, text_key='chunk', index_key='index', initial_chunk_size=30 * 1024))

        def _generate_summary_text(command: str, stdout_head: str, stderr_head: str, total_size: int) -> str:
            """Generate summary using LLM (functions disabled, streaming)."""
            summary_prompt = f"""Please provide a concise summary of the following command output.

Command: {command or 'unknown'}
STDOUT (first 10000 chars):
{stdout_head or ''}

STDERR (first 2000 chars):
{stderr_head or ''}

Total size: {total_size} bytes ({total_size // 1024} KB)

Provide a brief summary (3-5 sentences) focusing on:
1. What the command did
2. Key findings, errors, or important information
3. Notable patterns or trends

Summary:"""

            # IMPORTANT: Use raw LLM chat with functions disabled to avoid tool recursion
            summary_messages = [{"role": "user", "content": summary_prompt}]
            summary_response = assistant.llm.chat(messages=summary_messages, functions=[], stream=True)

            summary_text = ""
            for chunk in summary_response:
                if chunk and len(chunk) > 0:
                    last_msg = chunk[-1]
                    if last_msg.get('role') == 'assistant':
                        summary_text = last_msg.get('content', '')
            return summary_text or ""
        
        try:
            logger.info(f"Running assistant with {len(messages)} messages.")
            logger.info(f"LLM config: model={request.llm_config.model if request.llm_config else model_config['model']}, server={request.llm_config.base_url if request.llm_config else model_config['model_server']}")
            if request.conversation_history:
                logger.info(f"Conversation history: {len(request.conversation_history)} previous messages")
            else:
                logger.warning("No conversation history provided - agent will start fresh")
            
            # 상태 추적: 이전 response를 추적하여 중복 방지
            previous_response = []  # 이전 response_chunk 저장 (누적된 전체 응답)
            # 각 assistant 메시지별로 content를 추적 (메시지별로 독립적으로 관리)
            assistant_content_map = {}  # {message_index: content} 형태로 각 assistant 메시지의 content 추적
            # Tool call에서 추출한 command를 큐에 저장 (실행 순서대로)
            tool_command_queue = []  # FIFO 큐
            
            # Qwen-Agent automatically includes tool results in the conversation
            # response_chunk는 누적된 전체 응답: [msg1, msg2, msg3, ...]
            for response_chunk in assistant.run(messages=messages):
                # 이전 response와 비교해서 새로운 메시지만 추출
                new_messages = response_chunk[len(previous_response):]
                
                logger.debug(f"Processing {len(new_messages)} new messages (total: {len(response_chunk)}, previous: {len(previous_response)})")
                
                # 핵심 수정: response_chunk 전체를 스캔해서 assistant 메시지의 content 업데이트를 확인
                # (new_messages가 비어있어도, 기존 메시지의 content가 업데이트될 수 있음)
                for idx, message in enumerate(response_chunk):
                    event_type = message.get('role', 'unknown')
                    content = message.get('content', '')
                    
                    # Check for assistant content updates (모든 assistant 메시지 확인)
                    if event_type == 'assistant':
                        # Qwen-Agent의 content는 문자열이거나 None일 수 있음
                        # content가 None이 아닐 때만 처리
                        content_str = str(content) if content is not None else ''
                        
                        if content_str:
                            # 이 메시지의 이전 content 확인
                            previous_content = assistant_content_map.get(idx, '')
                            
                            # Determine what content to send
                            content_to_send = ''
                            if not previous_content:
                                # 첫 번째 content - 전체를 스트리밍
                                content_to_send = content_str
                            elif content_str != previous_content:
                                # Content가 변경됨
                                if content_str.startswith(previous_content):
                                    # Content가 연장됨 - 새로운 부분만 스트리밍 (증분)
                                    content_to_send = content_str[len(previous_content):]
                                else:
                                    # 완전히 다른 content (새로운 assistant 메시지이거나 내용이 완전히 바뀜)
                                    content_to_send = content_str
                            
                            # Send content in chunks if too large
                            if content_to_send:
                                content_size_bytes = len(content_to_send.encode('utf-8'))
                                
                                # Early check: if assistant content is getting extremely large, stop early
                                # This prevents the response from growing unbounded
                                MAX_ASSISTANT_CONTENT_SIZE = 5 * 1024 * 1024  # 5MB max assistant content
                                if len(content_str.encode('utf-8')) > MAX_ASSISTANT_CONTENT_SIZE:
                                    logger.warning(f"⚠️ Assistant content too large ({len(content_str.encode('utf-8'))} bytes), stopping to prevent response bloat")
                                    yield from _emit({'type': 'error', 'content': 'Assistant response too long. Please ask a more specific question.'})
                                    return

                                # Try to emit as a single event; if too large, chunk it.
                                sent = yield from _emit({'type': 'content_chunk', 'content': content_to_send})
                                if sent:
                                    if not previous_content:
                                        logger.info(f"✅ Streaming initial assistant content (idx={idx}): {len(content_to_send)} chars")
                                    else:
                                        logger.info(f"✅ Streaming content chunk (idx={idx}): +{len(content_to_send)} chars (total: {len(content_str)} chars)")
                                    assistant_content_map[idx] = content_str
                                else:
                                    logger.warning(f"⚠️ Assistant content too large (raw={content_size_bytes} bytes), chunking...")
                                    ok = yield from _emit_text_chunks(
                                        base={'type': 'content_chunk'},
                                        text=content_to_send,
                                        text_key='content',
                                        index_key='chunk_index',
                                        initial_chunk_size=15 * 1024,
                                    )
                                    if ok:
                                        assistant_content_map[idx] = content_str
                        
                        # Tool call 실시간 스트리밍 (새로운 메시지에만)
                        if idx >= len(previous_response):
                            function_call = message.get('function_call')
                            if function_call:
                                tool_name = function_call.get('name', 'unknown_tool')
                                tool_args = function_call.get('arguments', '{}')
                                
                                # Command 추출 (ash_ssh_execute / ash_telnet_execute인 경우)
                                command = None
                                if tool_name in ('ash_ssh_execute', 'ash_telnet_execute'):
                                    # tool_args가 빈 문자열이거나 None인 경우 처리
                                    if tool_args and tool_args.strip():
                                        try:
                                            import json5
                                            args = json5.loads(tool_args)
                                            command = args.get('command') or tool_args
                                        except Exception as e:
                                            logger.warning(f"Failed to parse tool_args: {tool_args}, error: {e}")
                                            command = tool_args if tool_args else None
                                    else:
                                        logger.warning(f"tool_args is empty for {tool_name}: {repr(tool_args)}")
                                        command = None
                                
                                # Command를 큐에 추가 (실행 순서대로)
                                if command:
                                    tool_command_queue.append(command)
                                    logger.info(f"✅ Saved command to queue: '{command}' (queue size: {len(tool_command_queue)})")
                                else:
                                    logger.warning(f"⚠️ No command extracted for {tool_name}, tool_args: {repr(tool_args)}")
                                
                                logger.info(f"Tool call request: {tool_name} with args: {repr(tool_args[:200])}, command: {repr(command) if command else 'None'}")
                                
                                # Tool call을 실시간으로 스트리밍 (사용자가 볼 수 있도록!)
                                yield f"data: {json.dumps({
                                    'type': 'tool_call',
                                    'name': tool_name,
                                    'args': tool_args,
                                    'command': command
                                }, ensure_ascii=False)}\n\n"
                    
                    # Check for tool results (Qwen-Agent uses both 'tool' and 'function' roles)
                    # 새로운 메시지만 처리 (중복 방지)
                    elif event_type in ('tool', 'function') and idx >= len(previous_response):
                        tool_name = message.get('name', 'unknown_tool')
                        tool_content = str(content) if content else ''
                        tool_content_size = len(tool_content.encode('utf-8')) if tool_content else 0
                        logger.info(f"Tool {tool_name} result (role={event_type}): {tool_content[:100]}... (size: {tool_content_size} bytes)")
                        
                        # 큐에서 command 가져오기 (실행 순서대로)
                        command = None
                        if tool_command_queue:
                            command = tool_command_queue.pop(0)
                            logger.info(f"✅ Retrieved command from queue: '{command}' (remaining: {len(tool_command_queue)})")
                        
                        # Parse tool result JSON for structured display
                        try:
                            parsed_result = json.loads(tool_content) if isinstance(tool_content, str) and tool_content.strip().startswith('{') else tool_content
                            
                            # Command 추출: tool_result에 포함된 command 우선 사용, 없으면 큐에서 가져오기
                            result_command = None
                            if isinstance(parsed_result, dict):
                                result_command = parsed_result.get('command')
                            
                            # Command 결정: tool_result의 command > 큐의 command
                            final_command = result_command or command
                            
                            # Structure the result for frontend rendering
                            stdout = parsed_result.get('output', '') if isinstance(parsed_result, dict) else ''
                            stderr = parsed_result.get('error', '') if isinstance(parsed_result, dict) else ''
                            
                            # CRITICAL: Check raw size FIRST before any JSON serialization
                            # This prevents memory issues and allows early chunking decision
                            stdout_size_bytes = len(stdout.encode('utf-8')) if stdout else 0
                            stderr_size_bytes = len(stderr.encode('utf-8')) if stderr else 0
                            total_raw_size = stdout_size_bytes + stderr_size_bytes
                            
                            # Update latest tool context (for exception-time auto summary)
                            # Keep only small heads to avoid ballooning memory.
                            last_tool_ctx = {
                                'name': tool_name,
                                'command': final_command,
                                'total_raw_size': total_raw_size,
                                'stdout_head': stdout[:10000] if isinstance(stdout, str) else '',
                                'stderr_head': stderr[:2000] if isinstance(stderr, str) else '',
                            }
                            
                            # If output is extremely large, consider auto-summarization
                            # This prevents "Payload Too Large" errors by summarizing before sending
                            AUTO_SUMMARY_THRESHOLD = 5 * 1024 * 1024  # 5MB - very large output
                            should_auto_summarize = total_raw_size > AUTO_SUMMARY_THRESHOLD
                            
                            # MAX_CHUNK_SIZE is defined at function level above
                            
                            # Estimate JSON overhead (roughly 200 bytes for structure + 20% for encoding)
                            estimated_json_overhead = 500 + int(total_raw_size * 0.2)
                            estimated_total_size = total_raw_size + estimated_json_overhead
                            
                            logger.info(f"Tool result raw size: stdout={stdout_size_bytes} bytes, stderr={stderr_size_bytes} bytes, total={total_raw_size} bytes")
                            logger.info(f"Estimated serialized size: {estimated_total_size} bytes, max={MAX_CHUNK_SIZE} bytes")
                            
                            # Auto-summarize extremely large outputs to prevent errors
                            if should_auto_summarize:
                                logger.warning(f"⚠️ Tool result extremely large ({total_raw_size} bytes > {AUTO_SUMMARY_THRESHOLD} bytes), attempting auto-summarization...")
                                try:
                                    # Send notification to frontend
                                    yield f"data: {json.dumps({'type': 'message', 'content': f'Command output is very large ({total_raw_size // 1024 // 1024}MB). Generating summary...', 'role': 'system'}, ensure_ascii=False)}\n\n"
                                    
                                    summary_text = _generate_summary_text(
                                        final_command or 'unknown',
                                        stdout[:5000] if isinstance(stdout, str) else '',
                                        stderr[:1000] if isinstance(stderr, str) else '',
                                        total_raw_size,
                                    )
                                    
                                    if summary_text:
                                        logger.info(f"✅ Auto-generated summary: {len(summary_text)} chars")
                                        # Replace stdout with summary, keep stderr as-is (usually smaller)
                                        stdout = f"[Auto-summarized from {total_raw_size} bytes]\n\n{summary_text}\n\n[Original output was {total_raw_size} bytes. Use a more specific command to see full details.]"
                                        stdout_size_bytes = len(stdout.encode('utf-8'))
                                        total_raw_size = stdout_size_bytes + stderr_size_bytes
                                        logger.info(f"After summarization: total={total_raw_size} bytes")
                                        
                                        # Recalculate estimated size
                                        estimated_json_overhead = 500 + int(total_raw_size * 0.2)
                                        estimated_total_size = total_raw_size + estimated_json_overhead
                                        
                                        # Send summary notification
                                        yield f"data: {json.dumps({'type': 'message', 'content': 'Summary generated successfully.', 'role': 'system'}, ensure_ascii=False)}\n\n"
                                    else:
                                        logger.warning("⚠️ Failed to generate summary, proceeding with chunking")
                                        should_auto_summarize = False
                                except Exception as summary_error:
                                    logger.error(f"Failed to auto-summarize: {summary_error}", exc_info=True)
                                    logger.warning("⚠️ Proceeding with chunking instead of summary")
                                    should_auto_summarize = False
                            
                            # If estimated size exceeds limit, ALWAYS chunk (don't even try to serialize)
                            if estimated_total_size >= MAX_CHUNK_SIZE or total_raw_size >= (MAX_CHUNK_SIZE - 1000):
                                logger.warning(f"⚠️ Tool result too large (raw={total_raw_size} bytes, estimated={estimated_total_size} bytes > {MAX_CHUNK_SIZE} bytes), FORCING chunking without serialization")
                                # Skip serialization check, go straight to chunking
                                force_chunk = True
                            else:
                                # Build the full result to check actual serialized size
                                structured_result = {
                                    'type': 'tool_result',
                                    'name': tool_name,
                                    'command': final_command,
                                    'success': parsed_result.get('success', True) if isinstance(parsed_result, dict) else True,
                                    'exitCode': parsed_result.get('exitCode', 0) if isinstance(parsed_result, dict) else 0,
                                    'stdout': stdout,
                                    'stderr': stderr,
                                }
                                
                                sent = yield from _emit(structured_result)
                                if sent:
                                    force_chunk = False
                                else:
                                    logger.warning("Serialized tool_result exceeds limit, chunking...")
                                    force_chunk = True
                            
                            # Large output: send in chunks
                            if force_chunk:
                                # First, send metadata with chunked flag
                                metadata_result = {
                                    'type': 'tool_result',
                                    'name': tool_name,
                                    'command': final_command,
                                    'success': parsed_result.get('success', True) if isinstance(parsed_result, dict) else True,
                                    'exitCode': parsed_result.get('exitCode', 0) if isinstance(parsed_result, dict) else 0,
                                    'stdout': '',  # Will be sent in chunks
                                    'stderr': '',  # Will be sent in chunks
                                    'chunked': True,
                                    'total_size': total_raw_size,
                                }
                                yield from _emit(metadata_result)

                                ok_stdout = yield from _emit_tool_stream_chunks(tool_name, 'stdout', stdout)
                                ok_stderr = yield from _emit_tool_stream_chunks(tool_name, 'stderr', stderr)

                                if ok_stdout and ok_stderr:
                                    yield from _emit({'type': 'tool_result_complete', 'name': tool_name})
                        except (json.JSONDecodeError, AttributeError) as e:
                            # Fallback: if parsing fails, send as raw content
                            # But still check size and chunk if needed
                            logger.warning(f"Could not parse tool result as JSON: {e}, sending as raw content")
                            
                            sent = yield from _emit({'type': 'tool_result', 'name': tool_name, 'command': command, 'content': tool_content})
                            if not sent:
                                # Truncate content to fit
                                max_content_size = MAX_CHUNK_SIZE - 500  # Reserve space for JSON
                                truncated_content = tool_content[:max_content_size] if len(tool_content) > max_content_size else tool_content
                                yield from _emit({'type': 'tool_result', 'name': tool_name, 'command': command, 'content': truncated_content, 'truncated': True})
                        except Exception as e:
                            # Catch any other errors in tool result processing
                            logger.error(f"Error processing tool result: {e}", exc_info=True)
                            # Ensure error message fits in MAX_CHUNK_SIZE
                            error_content = f'Error processing tool result: {str(e)}'
                            max_error_content = MAX_CHUNK_SIZE - 200  # Reserve space for JSON structure
                            if len(error_content.encode('utf-8')) > max_error_content:
                                error_content = error_content[:max_error_content]
                            sent = yield from _emit({'type': 'error', 'content': error_content})
                            if not sent:
                                yield from _emit({'type': 'error', 'content': 'Error processing tool result'})
                
                # 이전 response 업데이트 (중복 방지)
                previous_response = response_chunk.copy()
            
            logger.info("Assistant run completed.")
            yield from _emit({'type': 'done', 'timestamp': datetime.now().isoformat()})
            
        except Exception as e:
            error_msg = str(e)
            logger.error(f"Streaming task error: {error_msg}", exc_info=True)
            
            # Check if error is related to payload size
            if 'Payload Too Large' in error_msg or '413' in error_msg or 'too large' in error_msg.lower():
                logger.error("⚠️ PAYLOAD TOO LARGE ERROR DETECTED - This indicates the response exceeded server limits")
                logger.error(f"Error details: {error_msg}")
                logger.error(f"⚠️ This error occurred AFTER tool_result was sent. Likely caused by assistant content_chunk being too large.")
                logger.error(f"⚠️ Check logs above for 'Assistant content too large' or 'Content chunk too large' messages.")
                
                # Try to automatically summarize the last tool output of THIS run, then send it
                try:
                    if last_tool_ctx and (last_tool_ctx.get('total_raw_size') or 0) > 10 * 1024:
                        tool_name_for_summary = last_tool_ctx.get('name') or 'unknown'
                        cmd_for_summary = last_tool_ctx.get('command') or 'unknown'
                        original_size = int(last_tool_ctx.get('total_raw_size') or 0)

                        logger.info(f"🔄 Attempting to summarize last tool output (this run): {tool_name_for_summary} ({original_size} bytes)")
                        yield from _emit({'type': 'message', 'content': 'Large command output detected. Generating summary and retrying...', 'role': 'system'})

                        summary_text = _generate_summary_text(
                            cmd_for_summary,
                            last_tool_ctx.get('stdout_head', ''),
                            last_tool_ctx.get('stderr_head', ''),
                            original_size,
                        )

                        if summary_text:
                            summarized_stdout = (
                                f"[Auto-summarized from {original_size} bytes]\n\n"
                                f"{summary_text}\n\n"
                                f"[Original output was {original_size} bytes ({original_size // 1024} KB). "
                                f"Use a more specific command to see full details.]"
                            )
                            summarized_result = {
                                'type': 'tool_result',
                                'name': tool_name_for_summary,
                                'command': cmd_for_summary,
                                'success': False,
                                'exitCode': 0,
                                'stdout': summarized_stdout,
                                'stderr': '',
                                'summary': True,
                                'originalSize': original_size,
                            }

                            summarized_json = json.dumps(summarized_result, ensure_ascii=False)
                            summarized_sse = f"data: {summarized_json}\n\n"
                            if len(summarized_sse.encode('utf-8')) < MAX_CHUNK_SIZE:
                                yield summarized_sse
                                yield from _emit({'type': 'tool_result_complete', 'name': tool_name_for_summary})
                                yield from _emit({'type': 'message', 'content': 'Summary generated and stored. You can continue with your next command.', 'role': 'system'})
                                return

                    # Fallback: simple error if we couldn't summarize
                    yield from _emit({'type': 'error', 'content': 'Server response exceeded size limit. The command output was too large to process.'})
                except Exception as auto_summary_error:
                    logger.error(f"Failed to auto-summarize: {auto_summary_error}", exc_info=True)
                    try:
                        yield from _emit({'type': 'error', 'content': 'Server response exceeded size limit. The command output was too large to process.'})
                    except Exception as send_error:
                        logger.error(f"Failed to send error message: {send_error}")
            else:
                # Regular error
                try:
                    # Truncate error message to ensure it fits in MAX_CHUNK_SIZE
                    max_error_content = MAX_CHUNK_SIZE - 200  # Reserve space for JSON structure
                    truncated_error = error_msg[:max_error_content] if len(error_msg) > max_error_content else error_msg
                    sent = yield from _emit({'type': 'error', 'content': truncated_error})
                    if not sent:
                        yield from _emit({'type': 'error', 'content': 'An error occurred'})
                except Exception as send_error:
                    logger.error(f"Failed to send error message: {send_error}")
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
            # Disable any potential response size limits at HTTP level
            "X-Accel-Buffering": "no",  # Disable nginx buffering if present
        }
    )

if __name__ == "__main__":
    # Configure uvicorn with increased limits for large SSE responses
    uvicorn.run(
        app, 
        host="127.0.0.1", 
        port=54111,
        limit_max_requests=10000,  # Increase max concurrent requests
        timeout_keep_alive=300,    # 5 minutes keep-alive for long SSE streams
    )

