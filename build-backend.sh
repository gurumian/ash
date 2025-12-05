#!/bin/bash

# Build Python backend with PyInstaller
echo "Building Python backend with PyInstaller..."

# Navigate to backend directory
cd backend

# Install PyInstaller if not already installed
echo "Installing PyInstaller..."
uv add pyinstaller

# Build the backend executable using existing spec file
echo "Building backend executable..."
if [ -f "backend.spec" ]; then
    echo "Using existing spec file..."
    uv run pyinstaller backend.spec
else
    echo "Creating new spec file..."
    uv run pyinstaller --onefile --name ash-backend app.py
fi

# Check if build was successful
if [ -f "dist/ash-backend" ]; then
    echo "✅ Backend build successful!"
    echo "Executable created at: backend/dist/ash-backend"
    ls -la dist/ash-backend
elif [ -f "dist/ash-backend.exe" ]; then
    echo "✅ Backend build successful!"
    echo "Executable created at: backend/dist/ash-backend.exe"
    ls -la dist/ash-backend.exe
else
    echo "❌ Backend build failed!"
    exit 1
fi

echo "Backend build completed!"

