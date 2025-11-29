import { execSync } from 'child_process';
import { existsSync } from 'fs';
import path from 'path';
import { app } from 'electron';

/**
 * Setup CLI wrapper script for ash command
 * Creates a wrapper script in /usr/local/bin/ash that uses 'open' command
 * This ensures the app runs in proper GUI environment
 * Similar to how VSCode and Cursor work
 */
export function setupCLISymlink() {
  if (process.platform !== 'darwin') {
    return; // Only for macOS
  }

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

