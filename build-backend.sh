#!/bin/bash

# Build Python backend with PyInstaller
echo "Building Python backend with PyInstaller..."

# Navigate to backend directory
cd backend

# Install PyInstaller if not already installed
echo "Installing PyInstaller..."
uv add pyinstaller

# Detect architecture (32-bit/ia32 not supported)
# Allow ARCH to be set via environment variable (for cross-compilation scenarios)
if [ -z "$ARCH" ]; then
    ARCH=$(uname -m)
fi
case "$ARCH" in
    x86_64|x64)
        ARCH="x64"
        ;;
    arm64|aarch64)
        ARCH="arm64"
        ;;
    i386|i686)
        echo "ERROR: 32-bit (ia32) architecture is not supported."
        echo "Please use a 64-bit system (x64) or ARM64."
        exit 1
        ;;
    *)
        echo "WARNING: Unknown architecture $ARCH, defaulting to x64"
        ARCH="x64"
        ;;
esac
echo "Building backend for architecture: $ARCH"

# Create architecture-specific dist directory
mkdir -p "dist/$ARCH"

# Build the backend executable using existing spec file
echo "Building backend executable..."
if [ -f "backend.spec" ]; then
    echo "Using existing spec file..."
    uv run pyinstaller backend.spec --distpath "dist/$ARCH"
else
    echo "Creating new spec file..."
    uv run pyinstaller --onefile --name ash-backend --distpath "dist/$ARCH" app.py
fi

# Check if build was successful
if [ -f "dist/$ARCH/ash-backend" ]; then
    echo "✅ Backend build successful!"
    echo "Executable created at: backend/dist/$ARCH/ash-backend"
    ls -la "dist/$ARCH/ash-backend"
    
    # Code sign on macOS (if on macOS and identity is set)
    if [[ "$OSTYPE" == "darwin"* ]]; then
        IDENTITY="${APPLE_IDENTITY:-Apple Development: Sungmin Kim (XM4Q8R9Y2G)}"
        echo "Code signing backend executable with identity: $IDENTITY"
        codesign --force --deep --sign "$IDENTITY" --options runtime --entitlements ../entitlements.plist "dist/$ARCH/ash-backend" 2>&1 || {
            echo "⚠️ Warning: Code signing failed, but continuing..."
        }
    fi
elif [ -f "dist/$ARCH/ash-backend.exe" ]; then
    echo "✅ Backend build successful!"
    echo "Executable created at: backend/dist/$ARCH/ash-backend.exe"
    ls -la "dist/$ARCH/ash-backend.exe"
else
    echo "❌ Backend build failed!"
    exit 1
fi

echo "Backend build completed!"

