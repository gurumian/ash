const { FusesPlugin } = require('@electron-forge/plugin-fuses');
const { FuseV1Options, FuseVersion } = require('@electron/fuses');

const path = require('path');

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
      icon: path.resolve(__dirname, 'assets/icons/icon.ico'),
    },
  },
  {
    name: '@electron-forge/maker-squirrel',
    config: {
      iconUrl: path.resolve(__dirname, 'assets/icons/icon.ico'),
      setupIcon: path.resolve(__dirname, 'assets/icons/icon.ico'),
    },
  },
  {
    name: '@electron-forge/maker-zip',
    platforms: ['darwin', 'win32', 'linux'],
  },
  {
    name: '@electron-forge/maker-dmg',
    platforms: ['darwin'],
    config: {
      name: 'ash',
      icon: path.resolve(__dirname, 'assets/icons/icon.icns'),
      background: undefined, // Optional: path to background image
      format: 'UDZO', // UDZO (compressed), UDBZ (bzip2), UDRO (read-only), UDRW (read-write)
      additionalDMGOptions: {
        window: {
          size: {
            width: 600,
            height: 400,
          },
        },
        contents: [
          {
            x: 200, // Center horizontally (600/2 - 100)
            y: 100, // Top area
            type: 'file',
            path: 'ash.app',
          },
          {
            x: 200, // Center horizontally
            y: 250, // Below the app icon
            type: 'link',
            path: '/Applications',
          },
        ],
      },
    },
  },
  {
    name: '@electron-forge/maker-deb',
    config: {
      options: {
        icon: path.resolve(__dirname, 'assets/icons/icon.png'),
      },
    },
  },
  {
    name: '@electron-forge/maker-rpm',
    config: {
      options: {
        icon: path.resolve(__dirname, 'assets/icons/icon.png'),
      },
    },
  },
];

module.exports = {
  packagerConfig: {
    asar: {
      unpack: '**/{serialport,ssh2}/**' // Native modules that need to be unpacked from asar
    },
    appBundleId: 'com.gurumlab.ash',
    executableName: 'ash',
    icon: path.resolve(__dirname, 'assets/icons/icon'), // Icon path without extension
    // Electron Forge will automatically find the appropriate format:
    // - Windows: icon.ico (preferred) or icon.png
    // - macOS: icon.icns (preferred) or icon.png
    // - Linux: icon.png
    // If platform-specific files don't exist, it will fall back to icon.png
    ignore: [
      // Documentation and development files only
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
