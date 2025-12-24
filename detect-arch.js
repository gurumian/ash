// Detect native system architecture on Windows
// On Windows on ARM, Node.js may run as x64 emulated, so we prefer Node.js arch
// unless explicitly overridden
const { execSync } = require('child_process');

function detectNativeArch() {
  // Allow explicit override
  if (process.env.TARGET_ARCH) {
    return process.env.TARGET_ARCH;
  }

  // On Windows, prefer Node.js architecture (which may be x64 emulated on ARM)
  // This ensures the build matches the Node.js runtime architecture
  if (process.platform === 'win32') {
    const nodeArch = process.arch;
    if (nodeArch === 'x64' || nodeArch === 'arm64') {
      return nodeArch;
    }
  }

  // On non-Windows, use os.arch()
  const os = require('os');
  const arch = os.arch();
  return arch === 'arm64' ? 'arm64' : (arch === 'x64' ? 'x64' : 'x64');
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

