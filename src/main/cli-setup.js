import { execSync } from 'child_process';
import { existsSync } from 'fs';
import path from 'path';
import { app } from 'electron';

/**
 * Setup CLI wrapper script for ash command
 * Creates a wrapper script that allows running the app from terminal
 * - macOS: /usr/local/bin/ash (symlink to executable)
 * - Windows: PATH is added during installation via NSIS installer script
 * Similar to how VSCode and Cursor work
 */
export function setupCLISymlink() {
  if (process.platform === 'darwin') {
    setupMacOSCLI();
  }
  // Windows: PATH is added during installation, no runtime setup needed
  // Linux support can be added later if needed
}

function setupMacOSCLI() {
  try {
    const symlinkPath = '/usr/local/bin/ash';
    const appBundlePath = app.getAppPath();
    // Get app bundle path (e.g., /Applications/ash.app)
    const appPath = appBundlePath.split('/Contents/')[0];
    // Get executable path (e.g., /Applications/ash.app/Contents/MacOS/ash)
    const executablePath = path.join(appPath, 'Contents', 'MacOS', 'ash');
    
    // Check if executable exists
    if (!existsSync(executablePath)) {
      console.log('[CLI Setup] Executable not found, skipping CLI setup');
      return;
    }

    // Check if symlink already exists and is correct
    if (existsSync(symlinkPath)) {
      try {
        const stats = require('fs').lstatSync(symlinkPath);
        if (stats.isSymbolicLink()) {
          const target = require('fs').readlinkSync(symlinkPath);
          if (target === executablePath || path.resolve(symlinkPath, '..', target) === executablePath) {
            console.log('[CLI Setup] CLI symlink already exists and is correct');
            return;
          }
        }
        // Remove existing file/symlink if incorrect
        execSync(`rm "${symlinkPath}"`, { stdio: 'ignore' });
      } catch (e) {
        // Error checking, will recreate
      }
    }

    // Create symlink to executable (like VSCode/Cursor)
    try {
      // Ensure /usr/local/bin exists
      execSync('mkdir -p /usr/local/bin', { stdio: 'ignore' });
      
      // Create symlink to executable
      execSync(`ln -s "${executablePath}" "${symlinkPath}"`, { stdio: 'ignore' });
      console.log('[CLI Setup] Created CLI symlink: /usr/local/bin/ash ->', executablePath);
    } catch (e) {
      // If permission denied, user needs to run manually or grant permissions
      console.log('[CLI Setup] Could not create CLI symlink automatically. Run manually:');
      console.log(`  sudo ln -s "${executablePath}" "${symlinkPath}"`);
    }
  } catch (error) {
    console.error('[CLI Setup] Error setting up CLI symlink:', error);
  }
}


