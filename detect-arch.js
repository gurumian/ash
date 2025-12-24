// Detect native system architecture on Windows
// This is needed because Node.js running as x64 emulated doesn't see ARM64 env vars
const { execSync } = require('child_process');

function detectNativeArch() {
  if (process.platform !== 'win32') {
    // On non-Windows, use os.arch()
    const os = require('os');
    const arch = os.arch();
    return arch === 'arm64' ? 'arm64' : (arch === 'x64' ? 'x64' : 'x64');
  }

  // Allow override
  if (process.env.TARGET_ARCH) {
    return process.env.TARGET_ARCH;
  }

  try {
    // First try WMI - most reliable
    const wmiResult = execSync('powershell -Command "(Get-WmiObject Win32_Processor).Architecture"', { encoding: 'utf8' }).trim();
    // Architecture 12 = ARM64, 9 = x64
    if (wmiResult === '12') {
      return 'arm64';
    }
    if (wmiResult === '9') {
      return 'x64';
    }
  } catch (e) {
    // Fallback to PowerShell environment variable
    try {
      const result = execSync('powershell -Command "$env:PROCESSOR_ARCHITECTURE"', { encoding: 'utf8' }).trim();
      if (result === 'ARM64') {
        return 'arm64';
      }
      if (result === 'AMD64') {
        return 'x64';
      }
    } catch (e2) {
      // Last resort: check if PROCESSOR_ARCHITECTURE is available in cmd
      try {
        const cmdResult = execSync('cmd /c "echo %PROCESSOR_ARCHITECTURE%"', { encoding: 'utf8' }).trim();
        if (cmdResult === 'ARM64') {
          return 'arm64';
        }
        if (cmdResult === 'AMD64') {
          return 'x64';
        }
      } catch (e3) {
        // Final fallback
        console.warn('Could not detect architecture, defaulting to x64');
        return 'x64';
      }
    }
  }

  return 'x64';
}

const arch = detectNativeArch();
console.log(`Detected native architecture: ${arch}`);
process.env.TARGET_ARCH = arch;

// Always export
module.exports = { detectNativeArch, arch };

// If run directly, output the arch
if (require.main === module) {
  console.log(arch);
  process.exit(0);
}

