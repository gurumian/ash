#!/usr/bin/env node

/**
 * CLI entry point for ash terminal client
 * Allows running the app from terminal with: ash
 */

const { spawn } = require('child_process');
const path = require('path');

// Get the path to the Electron executable
function getElectronPath() {
  try {
    // Try to find electron in node_modules
    return require.resolve('electron/cli.js');
  } catch (e) {
    // If not found, try electron command directly
    return 'electron';
  }
}

// Get the path to the main entry point
function getMainPath() {
  // Check if we're in a packaged app
  if (process.env.APP_PATH) {
    // Packaged app - use the built main file
    return path.join(process.env.APP_PATH, '.vite', 'build', 'main.js');
  }
  
  // Development: use source files via electron-forge
  // We'll use electron-forge start instead
  return null;
}

// Check if we're in development mode
const isDev = !process.env.APP_PATH && process.env.NODE_ENV !== 'production';

if (isDev) {
  // Development mode: use electron-forge start
  const projectRoot = path.join(__dirname, '..');
  
  // Try to resolve forge from project root
  let forgePath;
  try {
    forgePath = require.resolve('@electron-forge/cli', { paths: [projectRoot] });
  } catch (e) {
    // If not found, try to use npx
    const electron = spawn('npx', ['-y', '@electron-forge/cli', 'start'], {
      stdio: 'ignore',
      cwd: projectRoot,
      env: { ...process.env, NODE_ENV: 'development' },
      detached: true,
      shell: process.platform === 'win32' // Use shell on Windows
    });
    
    electron.unref();
    process.exit(0);
    return;
  }
  
  const electron = spawn('node', [forgePath, 'start'], {
    stdio: 'ignore', // Suppress all output - just launch the app
    cwd: projectRoot,
    env: { ...process.env, NODE_ENV: 'development' },
    detached: true, // Detach from parent process
    shell: process.platform === 'win32' // Use shell on Windows
  });
  
  electron.unref(); // Allow parent process to exit immediately
  process.exit(0); // Exit immediately, don't wait for child
} else {
  // Production mode: use electron directly
  const electronPath = getElectronPath();
  const mainPath = getMainPath();
  
  if (!mainPath) {
    console.error('Error: Could not find main entry point');
    process.exit(1);
  }
  
  const electron = spawn('node', [electronPath, mainPath], {
    stdio: 'ignore', // Suppress all output - just launch the app
    env: { ...process.env, NODE_ENV: 'production' },
    detached: true // Detach from parent process
  });
  
  electron.unref(); // Allow parent process to exit immediately
  process.exit(0); // Exit immediately, don't wait for child
}

