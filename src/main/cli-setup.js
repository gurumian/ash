import { execSync } from 'child_process';
import { existsSync } from 'fs';
import path from 'path';
import { app } from 'electron';

/**
 * Setup CLI wrapper script for ash command
 * Creates a wrapper script that allows running the app from terminal
 * - macOS: /usr/local/bin/ash (uses 'open' command)
 * - Windows: %LOCALAPPDATA%\Programs\ash\ash.bat (batch file)
 * Similar to how VSCode and Cursor work
 */
export function setupCLISymlink() {
  if (process.platform === 'darwin') {
    setupMacOSCLI();
  } else if (process.platform === 'win32') {
    setupWindowsCLI();
  }
  // Linux support can be added later if needed
}

function setupMacOSCLI() {

  try {
    const symlinkPath = '/usr/local/bin/ash';
    const appBundlePath = app.getAppPath();
    // Get app bundle path (e.g., /Applications/ash.app)
    const appPath = appBundlePath.split('/Contents/')[0];
    
    // Check if app bundle exists
    if (!existsSync(appPath)) {
      console.log('[CLI Setup] App bundle not found, skipping CLI setup');
      return;
    }

    // Check if symlink already exists and is correct
    if (existsSync(symlinkPath)) {
      try {
        // Check if it's a file (wrapper script) or symlink
        const stats = require('fs').lstatSync(symlinkPath);
        if (stats.isFile()) {
          // It's a wrapper script, check if it points to correct app
          const content = require('fs').readFileSync(symlinkPath, 'utf8');
          if (content.includes(appPath)) {
            console.log('[CLI Setup] CLI wrapper already exists and is correct');
            return;
          }
        } else if (stats.isSymbolicLink()) {
          // It's a symlink, we'll replace it with wrapper script
          execSync(`rm "${symlinkPath}"`, { stdio: 'ignore' });
        }
      } catch (e) {
        // Error checking, will recreate
      }
    }

    // Create wrapper script that uses 'open' command
    const wrapperScript = `#!/bin/bash
# CLI wrapper for ash app
# Uses 'open' command to launch the app in proper GUI environment
exec open -a "${appPath}" "$@"
`;

    // Create symlink (requires user to enter password if /usr/local/bin doesn't exist)
    try {
      // Ensure /usr/local/bin exists
      execSync('mkdir -p /usr/local/bin', { stdio: 'ignore' });
      
      // Write wrapper script
      require('fs').writeFileSync(symlinkPath, wrapperScript, { mode: 0o755 });
      console.log('[CLI Setup] Created CLI wrapper: /usr/local/bin/ash');
    } catch (e) {
      // If permission denied, user needs to run manually or grant permissions
      console.log('[CLI Setup] Could not create CLI wrapper automatically. Run manually:');
      console.log(`  echo '#!/bin/bash' | sudo tee "${symlinkPath}"`);
      console.log(`  echo 'exec open -a "${appPath}" "$@"' | sudo tee -a "${symlinkPath}"`);
      console.log(`  sudo chmod +x "${symlinkPath}"`);
    }
  } catch (error) {
    console.error('[CLI Setup] Error setting up CLI wrapper:', error);
  }
}

function setupWindowsCLI() {
  try {
    const appPath = app.getAppPath();
    // Get installation directory (e.g., C:\Users\...\AppData\Local\Programs\ash)
    const installDir = path.dirname(appPath);
    const exePath = path.join(installDir, 'ash.exe');
    
    // Check if executable exists
    if (!existsSync(exePath)) {
      console.log('[CLI Setup] Executable not found, skipping CLI setup');
      return;
    }

    // Just add the installation directory to PATH
    // This is the simplest approach - just like VSCode and Cursor
    // The executable itself will be in PATH, no wrapper needed
    console.log('[CLI Setup] Adding installation directory to PATH:', installDir);
    addToWindowsPath(installDir);
  } catch (error) {
    console.error('[CLI Setup] Error setting up Windows CLI:', error);
  }
}

function addToWindowsPath(binDir) {
  try {
    // Get current user PATH
    const currentPath = process.env.PATH || '';
    
    // Check if already in PATH
    if (currentPath.includes(binDir)) {
      console.log('[CLI Setup] Already in PATH');
      return;
    }

    // Try to add to user PATH using setx
    // Note: setx requires new terminal session to take effect
    try {
      execSync(`setx PATH "${currentPath};${binDir}"`, { stdio: 'ignore' });
      console.log('[CLI Setup] Added to PATH. Please restart your terminal.');
    } catch (e) {
      // If setx fails, try using PowerShell
      try {
        const psCommand = `[Environment]::SetEnvironmentVariable("Path", [Environment]::GetEnvironmentVariable("Path", "User") + ";${binDir}", "User")`;
        execSync(`powershell -Command "${psCommand}"`, { stdio: 'ignore' });
        console.log('[CLI Setup] Added to PATH. Please restart your terminal.');
      } catch (psError) {
        console.log('[CLI Setup] Could not automatically add to PATH. Please add manually:');
        console.log(`  setx PATH "%PATH%;${binDir}"`);
      }
    }
  } catch (error) {
    console.error('[CLI Setup] Error adding to PATH:', error);
  }
}

