@echo off
setlocal enabledelayedexpansion
echo Building Python backend with PyInstaller...

REM Find or install uv
echo Checking for uv...
set UV_CMD=uv
uv --version >nul 2>&1
if %errorlevel% neq 0 (
    echo uv not found in PATH, checking common installation locations...
    set UV_FOUND=0
    
    REM Check common uv installation locations
    if exist "%USERPROFILE%\.local\bin\uv.exe" (
        set "UV_CMD=%USERPROFILE%\.local\bin\uv.exe"
        set UV_FOUND=1
    ) else if exist "%USERPROFILE%\.cargo\bin\uv.exe" (
        set "UV_CMD=%USERPROFILE%\.cargo\bin\uv.exe"
        set UV_FOUND=1
    ) else if exist "%LOCALAPPDATA%\Programs\uv\uv.exe" (
        set "UV_CMD=%LOCALAPPDATA%\Programs\uv\uv.exe"
        set UV_FOUND=1
    )
    
    if !UV_FOUND! equ 0 (
        echo uv is not installed. Attempting to install...
        python --version >nul 2>&1
        if %errorlevel% equ 0 (
            echo Installing uv via official installer...
            powershell -ExecutionPolicy Bypass -Command "irm https://astral.sh/uv/install.ps1 | iex" >nul 2>&1
            timeout /t 3 /nobreak >nul
            
            REM Check if installation was successful
            if exist "%USERPROFILE%\.local\bin\uv.exe" (
                set "UV_CMD=%USERPROFILE%\.local\bin\uv.exe"
                set "PATH=%USERPROFILE%\.local\bin;%PATH%"
                echo uv installed successfully.
            ) else if exist "%USERPROFILE%\.cargo\bin\uv.exe" (
                set "UV_CMD=%USERPROFILE%\.cargo\bin\uv.exe"
                set "PATH=%USERPROFILE%\.cargo\bin;%PATH%"
                echo uv installed successfully.
            ) else (
                echo ERROR: Failed to install uv automatically.
                echo Please install uv manually: https://astral.sh/uv/
                exit /b 1
            )
        ) else (
            echo ERROR: Python is not installed. Cannot install uv.
            echo Please install Python first: https://www.python.org/downloads/
            exit /b 1
        )
    ) else (
        echo Found uv at: !UV_CMD!
        REM Add to PATH for this session
        for %%p in ("%USERPROFILE%\.local\bin" "%USERPROFILE%\.cargo\bin" "%LOCALAPPDATA%\Programs\uv") do (
            if exist "%%p\uv.exe" set "PATH=%%p;%PATH%"
        )
    )
)

REM Verify uv is working
echo Verifying uv installation...
!UV_CMD! --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: uv is not working properly.
    exit /b 1
)

REM Navigate to backend directory
cd backend

REM Install PyInstaller if not already installed
echo Installing PyInstaller...
!UV_CMD! add pyinstaller

REM Detect architecture (32-bit/ia32 not supported)
if defined ARCH (
    echo Using predefined ARCH: !ARCH!
    goto :arch_done
)
set "ARCH=x64"
if /i "%PROCESSOR_ARCHITECTURE%"=="AMD64" goto :set_x64
if /i "%PROCESSOR_ARCHITECTURE%"=="ARM64" goto :set_arm64
if /i "%PROCESSOR_ARCHITECTURE%"=="x86" goto :error_32bit
goto :set_default

:set_x64
set "ARCH=x64"
goto :arch_done

:set_arm64
set "ARCH=arm64"
goto :arch_done

:error_32bit
echo ERROR: 32-bit ia32 is not supported.
echo Please use a 64-bit system x64 or ARM64.
exit /b 1

:set_default
echo WARNING: Unknown arch, defaulting to x64
set "ARCH=x64"

:arch_done
echo Building backend for arch: !ARCH!

REM Create architecture-specific dist directory
if not exist "dist\!ARCH!" mkdir "dist\!ARCH!"

REM Build the backend executable using existing spec file
echo Building backend executable...
if exist "backend.spec" (
    echo Using existing spec file...
    !UV_CMD! run pyinstaller backend.spec --distpath "dist\!ARCH!"
) else (
    echo Creating new spec file...
    !UV_CMD! run pyinstaller --onefile --name ash-backend --distpath "dist\!ARCH!" app.py
)

REM Check if build was successful
if exist "dist\!ARCH!\ash-backend.exe" (
    echo ✅ Backend build successful!
    echo Executable created at: backend\dist\!ARCH!\ash-backend.exe
    dir "dist\!ARCH!\ash-backend.exe"
) else (
    echo ❌ Backend build failed!
    exit /b 1
)

echo Backend build completed!

