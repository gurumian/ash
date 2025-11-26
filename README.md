# Ash - SSH & Serial Terminal Client

A modern, cross-platform terminal client built with Electron that supports both SSH connections and Serial port communication.

🌐 **Homepage**: [https://ash.toktoktalk.com](https://ash.toktoktalk.com)

## Features

### 🔐 SSH Support
- Secure SSH connections with password authentication
- Multiple concurrent SSH sessions
- Tabbed interface for easy session management
- Connection history and favorites

### 📡 Serial Port Support
- Serial port communication with configurable baud rates
- Support for various serial devices
- Real-time data transmission
- Multiple concurrent serial sessions

### 📝 Advanced Logging
- **Buffered Logging System**: Memory-efficient logging with automatic file saving
- **Real-time File Storage**: Logs automatically saved to `~/ash-logs/` directory
- **Smart Buffer Management**: 100 lines or 10KB triggers automatic file flush
- **Session-specific Logs**: Each session maintains its own log file
- **Log Controls**: Start/stop/save/clear logging with intuitive UI

### 🎨 Modern UI/UX
- Dark theme with customizable appearance
- Resizable session manager panel (VSCode-style)
- Toggle session manager visibility via View menu
- Responsive terminal with automatic resizing
- Tab-based session management

### ⚙️ Session Management
- Create, connect, and manage multiple sessions simultaneously
- Session persistence and favorites
- Quick session switching
- Connection status indicators

## Installation

### Prerequisites
- Node.js 16+ 
- npm or yarn

### Build from Source
```bash
git clone https://github.com/gurumian/ash.git
cd ash
npm install
npm run make
```

### Running in Development
```bash
npm start
```

## Usage

### SSH Connections
1. Click "New Session" or use `Cmd/Ctrl + N`
2. Select "SSH" as connection type
3. Enter host, port, username, and password
4. Click "Connect"

### Serial Port Connections
1. Click "New Session" or use `Cmd/Ctrl + N`
2. Select "Serial" as connection type
3. Choose serial port from dropdown
4. Configure baud rate and other settings
5. Click "Connect"

### Logging
1. **Start Logging**: Click the ⏺ (record) button in the terminal header
2. **Stop Logging**: Click the ⏹ (stop) button
3. **Save Log**: Click the 💾 (save) button to manually save current buffer
4. **Clear Log**: Click the 🗑 (trash) button to clear current log data

Logs are automatically saved to `~/Documents/ash/logs/` with filenames in the format: `$GROUP-$SESSION-NAME-$DATE-$TIME.log`.

### Session Manager
- **Resize Panel**: Drag the resize handle to adjust panel width
- **Toggle Visibility**: Use `View > Appearance > Toggle Session Manager`
- **Switch Sessions**: Click on session tabs or use keyboard shortcuts

## Architecture

### Tech Stack
- **Frontend**: React 18, Xterm.js
- **Backend**: Electron (Node.js)
- **SSH**: ssh2 library
- **Serial**: serialport library
- **Styling**: CSS3 with modern features

### Key Components
- `src/main.js`: Electron main process with IPC handlers
- `src/App.jsx`: React frontend with terminal management
- `src/preload.js`: Secure IPC bridge
- `src/App.css`: Modern UI styling

### Logging System
The logging system uses a buffered approach for memory efficiency:

1. **Buffer Management**: Data is collected in memory buffers
2. **Automatic Flushing**: Buffers are flushed when they reach 100 lines or 10KB
3. **File Storage**: Logs are saved to `~/Documents/ash/logs/` with filenames in the format: `$GROUP-$SESSION-NAME-$DATE-$TIME.log`
4. **Real-time Updates**: UI shows current logging status and controls

## File Structure
```
ash/
├── src/
│   ├── main.js          # Electron main process
│   ├── App.jsx          # React frontend
│   ├── App.css          # Styling
│   ├── preload.js       # IPC bridge
│   └── renderer.jsx     # Renderer entry point
├── assets/              # Icons and resources
├── forge.config.js      # Electron Forge configuration
└── package.json         # Dependencies and scripts
```

## Keyboard Shortcuts
- `Cmd/Ctrl + N`: New session
- `Cmd/Ctrl + W`: Close current session
- `Cmd/Ctrl + T`: Toggle session manager
- `Tab`: Switch between sessions

## Log File Format
Logs are saved as plain text files with the following naming convention:
```
~/Documents/ash/logs/
├── Production-Server1-2024-01-15-10-30-45.log
├── Development-Device1-2024-01-15-10-35-20.log
└── ...
```

Format: `$GROUP-$SESSION-NAME-$DATE-$TIME.log`
- **Group**: The group name the session belongs to (or 'default' if no group)
- **Session Name**: The name of the session
- **Date**: YYYY-MM-DD format
- **Time**: HH-MM-SS format

Each log file includes:
- Timestamp markers for session start/stop
- All terminal input and output
- Connection status changes
- Session metadata

## Development

### Project Structure
The application follows a modular architecture:

- **Main Process**: Handles system-level operations (SSH, Serial, file I/O)
- **Renderer Process**: Manages UI and user interactions
- **Preload Script**: Secure communication bridge between processes

### Adding New Features
1. Add IPC handlers in `main.js`
2. Expose APIs in `preload.js`
3. Implement UI in `App.jsx`
4. Add styling in `App.css`

### Debugging
- Use `npm run start` for development mode
- Check browser DevTools for renderer process debugging
- Check main process logs in terminal

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is proprietary software. All rights reserved. See the LICENSE file for details.

## Support

For support, feature requests, or bug reports, please open an issue on GitHub.

---

**Ash** - Modern terminal client for SSH and Serial communications with advanced logging capabilities.
