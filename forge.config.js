const { FusesPlugin } = require('@electron-forge/plugin-fuses');
const { FuseV1Options, FuseVersion } = require('@electron/fuses');

const path = require('path');
const fs = require('fs');
const packageJson = require('./package.json');

// Platform-specific makers
const makers = [
  // Windows NSIS installer - Build only on Windows
  {
    name: '@felixrieseberg/electron-forge-maker-nsis',
    platforms: ['win32'],
    config: {
      name: 'ash',
      oneClick: false,
      perMachine: false,
      allowToChangeInstallationDirectory: true,
      createDesktopShortcut: true,
      createStartMenuShortcut: true,
      shortcutName: 'ash',
    },
  },
  {
    name: '@electron-forge/maker-squirrel',
    config: {},
  },
  {
    name: '@electron-forge/maker-zip',
    platforms: ['darwin'],
  },
  {
    name: '@electron-forge/maker-dmg',
    platforms: ['darwin'],
    config: {
      name: `ash-${packageJson.version}`,
      // DMG filename includes version for better file management
    },
  },
  {
    name: '@electron-forge/maker-deb',
    config: {},
  },
  {
    name: '@reforged/maker-appimage',
    platforms: ['linux'],
    config: {
      name: 'ash',
    },
  },
];

module.exports = {
  packagerConfig: {
    asar: {
      unpack: '**/{serialport,ssh2,telnet-stream}/**' // Native modules and dynamically required modules that need to be unpacked from asar
    },
    appBundleId: 'com.gurumlab.ash',
    executableName: 'ash',
    icon: path.resolve(__dirname, 'assets/icons/icon'), // Icon path without extension
    extraResource: (() => {
      const resources = [
        path.resolve(__dirname, 'app-update.yml'), // Auto-updater configuration
      ];
      
      // Platform-specific backend executable path
      const backendExe = process.platform === 'win32' 
        ? 'backend/dist/ash-backend.exe'
        : 'backend/dist/ash-backend';
      const backendPath = path.resolve(__dirname, backendExe);
      
      // Check if file exists, if not try alternative paths
      if (fs.existsSync(backendPath)) {
        resources.push(backendPath);
        return resources;
      }
      
      // Fallback: try without extension or with different extensions
      const alternatives = [
        path.resolve(__dirname, 'backend/dist/ash-backend.exe'),
        path.resolve(__dirname, 'backend/dist/ash-backend'),
      ];
      
      for (const altPath of alternatives) {
        if (fs.existsSync(altPath)) {
          resources.push(altPath);
          return resources;
        }
      }
      
      console.warn(`⚠️ Warning: Backend executable not found at ${backendPath}`);
      console.warn('⚠️ Backend will not be included in the package. Run "npm run build-backend" first.');
      return resources;
    })(),
    // macOS entitlements for network permissions (SSH, TFTP)
    // This is required for the built app to access network, especially SSH connections.
    // Entitlements require code signing.
    // 
    // Default: Uses "Apple Development: Sungmin Kim (XM4Q8R9Y2G)" if available
    // Override with APPLE_IDENTITY environment variable:
    //   export APPLE_IDENTITY="Apple Development: Your Name (TEAM_ID)"
    osxSign: {
      identity: process.env.APPLE_IDENTITY || 'Apple Development: Sungmin Kim (XM4Q8R9Y2G)',
      hardenedRuntime: true,
      entitlements: path.resolve(__dirname, 'entitlements.plist'),
      'entitlements-inherit': path.resolve(__dirname, 'entitlements.plist'),
      'gatekeeper-assess': false
    },
    // Electron Forge will automatically find the appropriate format:
    // - Windows: icon.ico (preferred) or icon.png
    // - macOS: icon.icns (preferred) or icon.png
    // - Linux: icon.png
    // If platform-specific files don't exist, it will fall back to icon.png
    // Let Vite plugin handle ignore patterns automatically
    // Only exclude specific problematic packages
    ignore: [
      // Exclude development dependencies that are not needed in production
      /^\/node_modules\/@electron-forge/,
      /^\/node_modules\/@electron\/fuses/,
      /^\/node_modules\/@felixrieseberg/,
      /^\/node_modules\/@vitejs/,
      /^\/node_modules\/vite/,
      /^\/node_modules\/electron/,
      
      // Exclude non-Windows platform binaries
      /^\/node_modules\/.*\/prebuilds\/(?!win32)/,
      
      // Documentation and development files
      /^\/\.git/,
      /^\/\.gitignore/,
      /^\/\.cursorignore/,
      /^\/\.taskmaster/,
      /^\/\.cursor/,
      /^\/\.vscode/,
      /README\.md$/,
      
      // Test files
      /\/test\//,
      /\/tests\//,
      /\.test\./,
      /\.spec\./,
    ],
  },
  rebuildConfig: {
    onlyModules: ['serialport', 'ssh2'] // Native modules that need rebuilding for Electron
  },
  makers,
  plugins: [
    {
      name: '@electron-forge/plugin-auto-unpack-natives',
      config: {},
    },
    {
      name: '@electron-forge/plugin-vite',
      config: {
        // `build` can specify multiple entry builds, which can be Main process, Preload scripts, Worker process, etc.
        // If you are familiar with Vite configuration, it will look really familiar.
        build: [
          {
            // `entry` is just an alias for `build.lib.entry` in the corresponding file of `config`.
            entry: 'src/main.js',
            config: 'vite.main.config.mjs',
            target: 'main',
          },
          {
            entry: 'src/preload.js',
            config: 'vite.preload.config.mjs',
            target: 'preload',
          },
        ],
        renderer: [
          {
            name: 'main_window',
            config: 'vite.renderer.config.mjs',
          },
        ],
      },
    },
    // Fuses are used to enable/disable various Electron functionality
    // at package time, before code signing the application
    new FusesPlugin({
      version: FuseVersion.V1,
      [FuseV1Options.RunAsNode]: false,
      [FuseV1Options.EnableCookieEncryption]: true,
      [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
      [FuseV1Options.EnableNodeCliInspectArguments]: false,
      [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
      [FuseV1Options.OnlyLoadAppFromAsar]: true,
    }),
  ],
};
