#!/usr/bin/env node

/**
 * Build backend for all architectures (x64 and arm64)
 * 
 * On macOS ARM64 (M1/M2/M3), this script builds:
 * - arm64 backend using native Python/uv
 * - x64 backend using Rosetta 2 (arch -x86_64)
 * 
 * On other platforms, only the current architecture is built.
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ARCHS = ['x64', 'arm64'];
const platform = process.platform;
const buildScript = platform === 'win32' ? 'build-backend.bat' : './build-backend.sh';

console.log('Building backend for all architectures...');
console.log(`Platform: ${platform}`);
console.log(`Current architecture: ${process.arch}`);

const isMacOSARM64 = platform === 'darwin' && process.arch === 'arm64';

if (isMacOSARM64) {
  // On macOS ARM64, we can build both architectures
  
  // 1. Build arm64 backend (native)
  console.log(`\n📦 Building backend for arm64 (native)...`);
  try {
    execSync(buildScript, { stdio: 'inherit', cwd: path.resolve(__dirname, '..') });
    console.log(`✅ Backend built successfully for arm64`);
  } catch (error) {
    console.error(`❌ Failed to build backend for arm64`);
    process.exit(1);
  }
  
  // 2. Build x64 backend using Rosetta 2
  console.log(`\n📦 Building backend for x64 (using Rosetta 2)...`);
  try {
    // Check if arch command is available
    try {
      execSync('arch -x86_64 echo test', { stdio: 'ignore' });
    } catch (e) {
      console.warn('⚠️  Rosetta 2 might not be installed. x64 build may fail.');
      console.warn('   Install Rosetta 2: softwareupdate --install-rosetta');
    }
    
    // Use arch -x86_64 to run in x64 mode
    execSync(`arch -x86_64 ${buildScript}`, { 
      stdio: 'inherit', 
      cwd: path.resolve(__dirname, '..'),
      env: { ...process.env, ARCH: 'x64' }
    });
    console.log(`✅ Backend built successfully for x64`);
  } catch (error) {
    console.error(`❌ Failed to build backend for x64`);
    console.error(`   This is expected if Rosetta 2 is not installed or x64 Python is not available.`);
    console.error(`   To install Rosetta 2: softwareupdate --install-rosetta`);
  }
} else {
  // On other platforms, build for current architecture only
  console.log(`\n📦 Building backend for current architecture (${process.arch})...`);
  try {
    execSync(buildScript, { stdio: 'inherit', cwd: path.resolve(__dirname, '..') });
    console.log(`✅ Backend built successfully for ${process.arch}`);
  } catch (error) {
    console.error(`❌ Failed to build backend for ${process.arch}`);
    process.exit(1);
  }
}

// Check which architectures we successfully built
const backendDistDir = path.resolve(__dirname, '..', 'backend', 'dist');
const builtArchs = [];

for (const arch of ARCHS) {
  const archDir = path.join(backendDistDir, arch);
  const exeName = platform === 'win32' ? 'ash-backend.exe' : 'ash-backend';
  const exePath = path.join(archDir, exeName);
  
  if (fs.existsSync(exePath)) {
    builtArchs.push(arch);
    console.log(`✅ Found backend for ${arch}: ${exePath}`);
  } else {
    console.log(`⚠️  Backend not found for ${arch}: ${exePath}`);
    if (process.arch !== 'arm64' && arch === 'arm64') {
      console.log(`   Note: Cannot cross-compile to arm64 on ${process.arch} system.`);
      console.log(`   To build arm64 backend, run this script on an arm64 system.`);
    } else if (process.arch !== 'x64' && arch === 'x64') {
      console.log(`   Note: Cannot cross-compile to x64 on ${process.arch} system.`);
    }
  }
}

console.log(`\n📋 Summary:`);
console.log(`   Built architectures: ${builtArchs.join(', ') || 'none'}`);
console.log(`   Missing architectures: ${ARCHS.filter(a => !builtArchs.includes(a)).join(', ') || 'none'}`);

if (builtArchs.length === 0) {
  console.error('\n❌ No backends were built successfully!');
  process.exit(1);
}

console.log('\n✅ Backend build process completed!');
console.log('   Note: Electron app can still be built for all architectures,');
console.log('   but missing backend architectures will not have backend executables.');

