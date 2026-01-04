const { spawn } = require('child_process');
const path = require('path');
const os = require('os');

// Helper to spawn a command and stream output
function runCommand(command, args, options = {}) {
    return new Promise((resolve, reject) => {
        console.log(`> Executing: ${command} ${args.join(' ')}`);
        const child = spawn(command, args, {
            stdio: 'inherit',
            shell: true,
            ...options,
            env: { ...process.env, ...options.env },
        });

        child.on('close', (code) => {
            if (code === 0) {
                resolve();
            } else {
                reject(new Error(`Command failed with code ${code}`));
            }
        });

        child.on('error', (err) => {
            reject(err);
        });
    });
}

async function main() {
    // Detect target architecture
    let targetArch = process.arch; // Default to current node arch (usually x64 or arm64)

    // Special handling for Windows
    if (process.platform === 'win32') {
        // Check for WOW64 (x64 Node on ARM64 Windows)
        // PROCESSOR_ARCHITEW6432 is set when running 32-bit or x64 emulator on ARM64
        if (process.env.PROCESSOR_ARCHITEW6432 === 'ARM64') {
            console.log('Detected Windows ARM64 (running via emulation). Forcing ARM64 build.');
            targetArch = 'arm64';
        }
    }

    // Allow manual override via command line args
    const args = process.argv.slice(2);
    const archArg = args.find(arg => arg.startsWith('--arch='));
    if (archArg) {
        targetArch = archArg.split('=')[1];
        console.log(`Using explicit target architecture from arguments: ${targetArch}`);
    }

    // Allow manual override via env var
    if (process.env.ASH_TARGET_ARCH) {
        targetArch = process.env.ASH_TARGET_ARCH;
        console.log(`Using explicit target architecture from environment: ${targetArch}`);
    }

    console.log(`Debug Info: Platform=${process.platform}, NodeArch=${process.arch}, WOW64=${process.env.PROCESSOR_ARCHITEW6432}`);

    console.log(`\n=== Building Ash for ${process.platform} / ${targetArch} ===\n`);

    try {
        // 1. Build Backend
        console.log('--- Step 1: Building Backend ---');
        // Pass ASH_TARGET_ARCH to the backend build script
        await runCommand('npm', ['run', 'build-backend'], {
            env: { ASH_TARGET_ARCH: targetArch }
        });

        // 2. Make Electron App
        console.log('\n--- Step 2: Packaging Electron App ---');
        // Pass --arch flag to electron-forge make
        await runCommand('electron-forge', ['make', '--arch', targetArch]);

        console.log('\n✅ Build pipeline completed successfully!');
    } catch (error) {
        console.error('\n❌ Build failed:', error.message);
        process.exit(1);
    }
}

main();
