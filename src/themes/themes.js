/**
 * Theme definitions for the application
 */
export const themes = {
  terminus: {
    name: 'Terminus',
    // UI colors
    background: '#000000',
    surface: '#000000',
    text: '#00ff41',
    border: '#1a1a1a',
    accent: '#00ff41',
    // Terminal colors - pure black background with bright green text
    terminal: {
      background: '#000000',
      foreground: '#00ff41',
      cursor: '#00ff41',
      cursorAccent: '#000000',
      selection: '#1a3a1a',
      black: '#000000',
      red: '#ff0000',
      green: '#00ff41',
      yellow: '#ffff00',
      blue: '#0000ff',
      magenta: '#ff00ff',
      cyan: '#00ffff',
      white: '#00ff41',
      brightBlack: '#555555',
      brightRed: '#ff5555',
      brightGreen: '#00ff41',
      brightYellow: '#ffff55',
      brightBlue: '#5555ff',
      brightMagenta: '#ff55ff',
      brightCyan: '#55ffff',
      brightWhite: '#00ff41'
    }
  },
  dark: {
    name: 'Dark',
    // UI colors
    background: '#1e1e1e',
    surface: '#2c3e50',
    text: '#ffffff',
    border: '#34495e',
    accent: '#4a90e2',
    // Terminal colors
    terminal: {
      background: '#1e1e1e',
      foreground: '#ffffff',
      cursor: '#ffffff',
      selection: '#264f78'
    }
  },
  light: {
    name: 'Light',
    // UI colors
    background: '#f8f9fa',
    surface: '#ffffff',
    text: '#333333',
    border: '#e0e0e0',
    accent: '#4a90e2',
    // Terminal colors
    terminal: {
      background: '#ffffff',
      foreground: '#000000',
      cursor: '#000000',
      selection: '#add6ff'
    }
  },
  solarized_dark: {
    name: 'Solarized Dark',
    // UI colors
    background: '#002b36',
    surface: '#073642',
    text: '#839496',
    border: '#586e75',
    accent: '#268bd2',
    // Terminal colors
    terminal: {
      background: '#002b36',
      foreground: '#839496',
      cursor: '#839496',
      selection: '#073642'
    }
  },
  solarized_light: {
    name: 'Solarized Light',
    // UI colors
    background: '#fdf6e3',
    surface: '#eee8d5',
    text: '#657b83',
    border: '#93a1a1',
    accent: '#268bd2',
    // Terminal colors
    terminal: {
      background: '#fdf6e3',
      foreground: '#657b83',
      cursor: '#657b83',
      selection: '#eee8d5'
    }
  },
  monokai: {
    name: 'Monokai',
    // UI colors
    background: '#272822',
    surface: '#3e3d32',
    text: '#f8f8f2',
    border: '#49483e',
    accent: '#a6e22e',
    // Terminal colors
    terminal: {
      background: '#272822',
      foreground: '#f8f8f2',
      cursor: '#f8f8f2',
      selection: '#49483e'
    }
  },
  matrix: {
    name: 'Matrix',
    // UI colors
    background: '#000000',
    surface: '#000000',
    text: '#00ff00',
    border: '#003300',
    accent: '#00ff00',
    // Terminal colors - Matrix style with various green shades
    terminal: {
      background: '#000000',
      foreground: '#00ff00',
      cursor: '#00ff00',
      cursorAccent: '#000000',
      selection: '#003300',
      black: '#000000',
      red: '#ff0000',
      green: '#00ff00',
      yellow: '#ffff00',
      blue: '#0000ff',
      magenta: '#ff00ff',
      cyan: '#00ffff',
      white: '#00ff00',
      brightBlack: '#333333',
      brightRed: '#ff3333',
      brightGreen: '#33ff33',
      brightYellow: '#ffff33',
      brightBlue: '#3333ff',
      brightMagenta: '#ff33ff',
      brightCyan: '#33ffff',
      brightWhite: '#ffffff'
    }
  },
  hack: {
    name: 'Hack',
    // UI colors
    background: '#1d1f21',
    surface: '#282a2e',
    text: '#00ff00',
    border: '#373b41',
    accent: '#00ff00',
    // Terminal colors - Hack terminal style
    terminal: {
      background: '#1d1f21',
      foreground: '#00ff00',
      cursor: '#00ff00',
      cursorAccent: '#1d1f21',
      selection: '#373b41',
      black: '#1d1f21',
      red: '#cc6666',
      green: '#00ff00',
      yellow: '#de935f',
      blue: '#81a2be',
      magenta: '#b294bb',
      cyan: '#8abeb7',
      white: '#c5c8c6',
      brightBlack: '#969896',
      brightRed: '#cc6666',
      brightGreen: '#00ff00',
      brightYellow: '#f0c674',
      brightBlue: '#81a2be',
      brightMagenta: '#b294bb',
      brightCyan: '#8abeb7',
      brightWhite: '#ffffff'
    }
  },
  green_on_black: {
    name: 'Green on Black',
    // UI colors
    background: '#000000',
    surface: '#0a0a0a',
    text: '#00ff41',
    border: '#1a1a1a',
    accent: '#00ff41',
    // Terminal colors - Classic green on black
    terminal: {
      background: '#000000',
      foreground: '#00ff41',
      cursor: '#00ff41',
      cursorAccent: '#000000',
      selection: '#1a3a1a',
      black: '#000000',
      red: '#ff0000',
      green: '#00ff41',
      yellow: '#ffff00',
      blue: '#0000ff',
      magenta: '#ff00ff',
      cyan: '#00ffff',
      white: '#00ff41',
      brightBlack: '#555555',
      brightRed: '#ff5555',
      brightGreen: '#00ff41',
      brightYellow: '#ffff55',
      brightBlue: '#5555ff',
      brightMagenta: '#ff55ff',
      brightCyan: '#55ffff',
      brightWhite: '#ffffff'
    }
  },
  retro_green: {
    name: 'Retro Green',
    // UI colors
    background: '#0c0c0c',
    surface: '#1a1a1a',
    text: '#39ff14',
    border: '#2a2a2a',
    accent: '#39ff14',
    // Terminal colors - Retro green terminal
    terminal: {
      background: '#0c0c0c',
      foreground: '#39ff14',
      cursor: '#39ff14',
      cursorAccent: '#0c0c0c',
      selection: '#1a3a1a',
      black: '#0c0c0c',
      red: '#ff0000',
      green: '#39ff14',
      yellow: '#ffff00',
      blue: '#0000ff',
      magenta: '#ff00ff',
      cyan: '#00ffff',
      white: '#39ff14',
      brightBlack: '#666666',
      brightRed: '#ff6666',
      brightGreen: '#66ff66',
      brightYellow: '#ffff66',
      brightBlue: '#6666ff',
      brightMagenta: '#ff66ff',
      brightCyan: '#66ffff',
      brightWhite: '#ffffff'
    }
  },
  tokyo_storm_night: {
    name: 'Tokyo Storm Night',
    // UI colors
    background: '#24283b',
    surface: '#1f2335',
    text: '#c0caf5',
    border: '#414868',
    accent: '#7aa2f7',
    // Terminal colors - Tokyo Night Storm
    terminal: {
      background: '#24283b',
      foreground: '#c0caf5',
      cursor: '#7aa2f7',
      cursorAccent: '#24283b',
      selection: '#364a82',
      black: '#32344a',
      red: '#f7768e',
      green: '#9ece6a',
      yellow: '#e0af68',
      blue: '#7aa2f7',
      magenta: '#ad8ee6',
      cyan: '#449dab',
      white: '#787c99',
      brightBlack: '#444b6a',
      brightRed: '#ff7a93',
      brightGreen: '#b9f27c',
      brightYellow: '#ff9e64',
      brightBlue: '#7da6ff',
      brightMagenta: '#bb9af7',
      brightCyan: '#0db9d7',
      brightWhite: '#acb0d0'
    }
  }
};

