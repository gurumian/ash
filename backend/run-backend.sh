#!/bin/bash

# Run ash-backend from terminal
# This script allows running the backend directly from terminal

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Check if running in development or production mode
if [ -f "dist/ash-backend" ] || [ -f "dist/ash-backend.exe" ]; then
    # Production mode: use built executable
    echo "Starting ash-backend in production mode..."
    
    if [ -f "dist/ash-backend" ]; then
        ./dist/ash-backend
    elif [ -f "dist/ash-backend.exe" ]; then
        ./dist/ash-backend.exe
    else
        echo "Error: Backend executable not found. Run 'npm run build-backend' first."
        exit 1
    fi
else
    # Development mode: use uv or python
    echo "Starting ash-backend in development mode..."
    
    # Try uv first
    if command -v uv &> /dev/null; then
        echo "Using uv to run backend..."
        uv run uvicorn app:app --host 127.0.0.1 --port 54111 --reload --limit-max-requests 10000 --timeout-keep-alive 300
    elif command -v python3 &> /dev/null; then
        echo "Using python3 to run backend..."
        python3 -m uvicorn app:app --host 127.0.0.1 --port 54111 --reload --limit-max-requests 10000 --timeout-keep-alive 300
    elif command -v python &> /dev/null; then
        echo "Using python to run backend..."
        python -m uvicorn app:app --host 127.0.0.1 --port 54111 --reload --limit-max-requests 10000 --timeout-keep-alive 300
    else
        echo "Error: Neither uv nor python found. Please install uv or python."
        exit 1
    fi
fi


