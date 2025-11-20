# PRD: Ash Mobile (Flutter)

**Version:** 1.0  
**Date:** 2025-01-XX  
**Platform:** iOS & Android  
**Framework:** Flutter

---

## 1. Vision

Ash Mobile is a native mobile SSH terminal client that brings the power of desktop SSH management to iOS and Android devices. It provides a seamless, touch-optimized experience for managing multiple SSH connections on the go.

**Core Value Proposition:**
- Access servers from anywhere with your mobile device
- Manage multiple SSH sessions with an intuitive mobile interface
- Sync connection history and favorites across devices (future)
- Native performance and smooth user experience

---

## 2. Scope

### In-Scope (v1.0)

**Core SSH Features:**
- SSH connections with password authentication
- Multiple concurrent SSH sessions
- Terminal emulator with full ANSI support
- Connection history and favorites
- Session groups management
- Terminal logging (start/stop/save/clear)
- Settings (theme, font, scrollback)

**Mobile-Specific Features:**
- Touch-optimized terminal interface
- Mobile keyboard with terminal-specific keys (Ctrl, Alt, Tab, etc.)
- Swipe gestures for session switching
- Pull-to-refresh for connection list
- Biometric authentication for saved passwords (future)
- Background connection handling

**UI/UX:**
- Material Design 3 (Android) / Cupertino (iOS)
- Dark theme (default) with customizable colors
- Responsive layout for various screen sizes
- Tablet-optimized split view (future)

### Out-of-Scope (v1.0)

- Serial port support (mobile hardware limitations)
- SFTP file browser (future)
- Port forwarding (future)
- AI assistant integration (future)
- Desktop sync (future)
- SSH key management UI (basic support only)
- Multi-window support (tablet only, future)

---

## 3. Core Features

### 3.1 SSH Connection Management

**Quick Connect:**
- Simple form: Host, Port, Username, Password
- One-tap connect button
- Connection status indicator
- Error handling with user-friendly messages

**Connection Profiles:**
- Save connection details (password optional)
- Edit/delete saved connections
- Quick connect from saved profiles
- Connection validation before saving

**Connection History:**
- Automatic history of recent connections
- Quick access to recent connections
- Clear history option
- History persistence across app restarts

**Favorites:**
- Mark connections as favorites
- Quick access from favorites list
- Reorder favorites
- Favorite badge indicator

**Groups:**
- Organize connections into groups
- Create/edit/delete groups
- Expandable group list
- Drag-and-drop group organization (future)
- Group-based connection filtering

### 3.2 Terminal Interface

**Terminal Emulator:**
- Full ANSI color support
- TrueColor support (24-bit)
- Terminal resizing (automatic on orientation change)
- Scrollback buffer (configurable, default 5000 lines)
- Copy/paste support
- Text selection with handles
- Terminal font customization

**Terminal Controls:**
- Recording button (start/stop logging)
- Save log button
- Clear terminal button
- Search in terminal (future)
- Terminal settings quick access

**Mobile Keyboard:**
- Custom terminal keyboard overlay
- Essential keys: Ctrl, Alt, Tab, Esc, Arrow keys
- Function keys (F1-F12) in secondary view
- Keyboard shortcuts bar
- Auto-hide keyboard option

**Touch Interactions:**
- Tap to focus terminal
- Long press for context menu
- Pinch to zoom (font size)
- Swipe left/right to switch sessions
- Pull down to show session list

### 3.3 Session Management

**Multi-Session Support:**
- Multiple concurrent SSH sessions
- Session tabs (swipeable)
- Active session indicator
- Session status (connected/disconnected/connecting)
- Quick session switching

**Session Actions:**
- Connect/disconnect
- Rename session
- Close session
- Duplicate session
- Session info/details

**Session Persistence:**
- Restore sessions on app restart (optional)
- Background connection handling
- Connection timeout handling
- Auto-reconnect on network change (optional)

### 3.4 Logging System

**Log Management:**
- Start/stop terminal logging
- Manual log save
- Clear log buffer
- Log file naming: `GROUP-SESSION-NAME-DATE-TIME.log`
- Log storage location: App documents directory
- Share log files

**Log Features:**
- Buffered logging (memory efficient)
- Automatic flush (100 lines or 10KB)
- Timestamp markers
- Session metadata in logs

### 3.5 Settings

**Appearance:**
- Theme selection (Dark/Light/Auto)
- Terminal font family
- Terminal font size (8-32px)
- UI font family
- Color scheme customization (future)

**Terminal:**
- Scrollback lines (100-50000)
- Terminal bell sound (on/off)
- Cursor style (block/underline/bar)
- Cursor blink (on/off)

**Connection:**
- Default SSH port
- Connection timeout
- Keep-alive interval
- Auto-reconnect on network change

**Security:**
- Save passwords (with warning)
- Biometric authentication (future)
- Keychain/Keystore integration (future)

**About:**
- App version
- License information
- Credits

### 3.6 Mobile-Specific Features

**Notifications:**
- Connection status notifications
- Background connection alerts
- Error notifications

**Background Handling:**
- Keep connections alive in background
- Background connection limits
- Battery optimization

**Offline Support:**
- View saved connections offline
- Connection history access
- Settings access

---

## 4. User Stories

### 4.1 Primary User Personas

**DevOps Engineer (Primary):**
- Needs quick server access from mobile
- Manages multiple production servers
- Requires reliable connection handling
- Values speed and efficiency

**System Administrator:**
- Monitors servers on the go
- Needs to check logs quickly
- Requires session management
- Values organization (groups)

**Developer:**
- Debugs issues remotely
- Needs terminal access
- Requires logging capabilities
- Values customization

### 4.2 Key User Flows

**Flow 1: Quick Connect to Server**
1. User opens app
2. Taps "New Connection" button
3. Enters host, port, username, password
4. Taps "Connect"
5. Terminal opens with SSH session
6. User can immediately start typing commands

**Flow 2: Connect from Saved Connection**
1. User opens app
2. Views connection list (history/favorites/groups)
3. Taps on saved connection
4. If password saved: connects immediately
5. If password not saved: prompts for password
6. Terminal opens with SSH session

**Flow 3: Switch Between Sessions**
1. User has multiple active sessions
2. Swipes left/right on terminal area
3. Or taps session tab at top
4. Terminal switches to selected session
5. Previous session remains connected in background

**Flow 4: Start Terminal Logging**
1. User is in active SSH session
2. Taps recording button in terminal header
3. Logging starts (button changes to stop icon)
4. User performs terminal operations
5. Taps stop button when done
6. Taps save button to save log file
7. Log file saved to app documents

**Flow 5: Organize Connections into Groups**
1. User views connection list
2. Taps "New Group" button
3. Enters group name
4. Drags connections into group (or selects from list)
5. Group appears as expandable section
6. User can collapse/expand groups

---

## 5. Technical Architecture

### 5.1 Technology Stack

**Framework:**
- Flutter 3.x (latest stable)
- Dart 3.x

**SSH Library:**
- `dartssh2` - Pure Dart SSH client
- Alternative: `ssh` package (wraps native libraries)

**Terminal Emulator:**
- `xterm.dart` - Flutter terminal emulator
- ANSI/TrueColor support
- Customizable rendering

**State Management:**
- Provider or Riverpod (recommended)
- Local state with setState for simple components

**Storage:**
- `shared_preferences` - Settings and simple data
- `sqflite` or `hive` - Connection history and favorites
- `path_provider` - Log file storage

**UI Components:**
- Material Design 3 (Android)
- Cupertino (iOS)
- Custom terminal widgets

**Networking:**
- Native Dart networking
- Connection pooling
- Background task handling

### 5.2 Project Structure

```
ash-mobile/
├── lib/
│   ├── main.dart
│   ├── app.dart
│   ├── models/
│   │   ├── connection.dart
│   │   ├── session.dart
│   │   ├── group.dart
│   │   └── log.dart
│   ├── services/
│   │   ├── ssh_service.dart
│   │   ├── storage_service.dart
│   │   ├── logging_service.dart
│   │   └── settings_service.dart
│   ├── providers/
│   │   ├── connection_provider.dart
│   │   ├── session_provider.dart
│   │   ├── theme_provider.dart
│   │   └── settings_provider.dart
│   ├── screens/
│   │   ├── home_screen.dart
│   │   ├── connection_list_screen.dart
│   │   ├── connection_form_screen.dart
│   │   ├── terminal_screen.dart
│   │   ├── settings_screen.dart
│   │   └── groups_screen.dart
│   ├── widgets/
│   │   ├── terminal_widget.dart
│   │   ├── connection_card.dart
│   │   ├── session_tab.dart
│   │   ├── mobile_keyboard.dart
│   │   └── log_controls.dart
│   └── utils/
│       ├── theme.dart
│       ├── constants.dart
│       └── validators.dart
├── android/
├── ios/
├── test/
└── pubspec.yaml
```

### 5.3 Data Models

**Connection:**
```dart
class Connection {
  String id;
  String name;
  String host;
  int port;
  String username;
  String? password; // Optional, encrypted
  bool savePassword;
  bool isFavorite;
  String? groupId;
  DateTime lastConnected;
  ConnectionStatus status;
}
```

**Session:**
```dart
class Session {
  String id;
  String connectionId;
  String name;
  Terminal terminal;
  bool isActive;
  bool isConnected;
  DateTime createdAt;
  DateTime? lastActivity;
  List<String> logBuffer;
  bool isLogging;
}
```

**Group:**
```dart
class Group {
  String id;
  String name;
  List<String> connectionIds;
  bool isExpanded;
  int order;
}
```

**Settings:**
```dart
class AppSettings {
  String theme; // 'dark', 'light', 'auto'
  String terminalFontFamily;
  int terminalFontSize;
  String uiFontFamily;
  int scrollbackLines;
  bool savePasswords;
  int connectionTimeout;
  bool autoReconnect;
}
```

### 5.4 Key Services

**SSHService:**
- Handle SSH connections
- Manage multiple concurrent sessions
- Terminal data streaming
- Connection lifecycle management

**StorageService:**
- Save/load connections
- Save/load groups
- Save/load settings
- Encrypt sensitive data

**LoggingService:**
- Buffer management
- File I/O
- Log file naming
- Share functionality

**SettingsService:**
- Load/save settings
- Apply theme changes
- Font management
- Preference persistence

### 5.5 Platform-Specific Considerations

**iOS:**
- Keychain for password storage
- Background modes for SSH connections
- App Transport Security (ATS) configuration
- Info.plist permissions

**Android:**
- Keystore for password storage
- Foreground service for background connections
- Network security configuration
- Permissions (INTERNET, etc.)

---

## 6. Development Roadmap

### Phase 1: Foundation (MVP Core)
**Goal:** Basic SSH connection and terminal display

**Tasks:**
1. Flutter project setup
2. Basic app structure and navigation
3. SSH connection form UI
4. SSH service implementation (dartssh2 integration)
5. Basic terminal widget (xterm.dart integration)
6. Simple connection list
7. Settings screen (basic)

**Deliverable:** Can connect to SSH server and display terminal

**Success Criteria:**
- User can enter connection details and connect
- Terminal displays SSH output correctly
- Basic commands work (ls, cd, etc.)

---

### Phase 2: Session Management
**Goal:** Multiple sessions and session switching

**Tasks:**
1. Session model and state management
2. Multi-session support in SSH service
3. Session tabs UI
4. Session switching (swipe/tap)
5. Session persistence
6. Connection/disconnection handling

**Deliverable:** Can manage multiple SSH sessions simultaneously

**Success Criteria:**
- User can have 3+ concurrent sessions
- Can switch between sessions smoothly
- Sessions remain connected when switching

---

### Phase 3: Connection Management
**Goal:** Save, organize, and manage connections

**Tasks:**
1. Connection storage (database)
2. Connection history
3. Favorites functionality
4. Connection form (save/edit)
5. Connection list UI
6. Quick connect from saved connections

**Deliverable:** Can save and quickly access connections

**Success Criteria:**
- User can save connection details
- Can access saved connections quickly
- Connection history works
- Favorites work

---

### Phase 4: Groups and Organization
**Goal:** Organize connections into groups

**Tasks:**
1. Group model and storage
2. Group creation/editing UI
3. Group list with expand/collapse
4. Assign connections to groups
5. Group-based filtering

**Deliverable:** Can organize connections into groups

**Success Criteria:**
- User can create groups
- Can assign connections to groups
- Groups display correctly in list
- Can expand/collapse groups

---

### Phase 5: Logging System
**Goal:** Terminal logging functionality

**Tasks:**
1. Log buffer management
2. Log controls UI (start/stop/save/clear)
3. File I/O for logs
4. Log file naming
5. Share log files
6. Log storage management

**Deliverable:** Can log terminal sessions to files

**Success Criteria:**
- User can start/stop logging
- Logs save correctly to files
- Can share log files
- Log file names are correct

---

### Phase 6: Mobile Optimization
**Goal:** Touch-optimized interface and mobile features

**Tasks:**
1. Mobile keyboard widget
2. Touch gestures (swipe, pinch, long press)
3. Responsive layout
4. Background connection handling
5. Notifications
6. Orientation handling
7. Tablet layout (optional)

**Deliverable:** Fully mobile-optimized experience

**Success Criteria:**
- Terminal is easy to use on mobile
- Mobile keyboard works well
- Gestures are intuitive
- App works in background

---

### Phase 7: Polish and Settings
**Goal:** Complete settings and UI polish

**Tasks:**
1. Complete settings screen
2. Theme implementation
3. Font customization
4. Scrollback configuration
5. Connection settings
6. About screen
7. Error handling improvements
8. Loading states
9. Empty states

**Deliverable:** Polished, production-ready app

**Success Criteria:**
- All settings work correctly
- UI is polished and consistent
- Error messages are helpful
- App feels complete

---

## 7. Logical Dependency Chain

### Foundation First
1. **SSH Connection** → Must work before anything else
2. **Terminal Display** → Core functionality
3. **Basic Navigation** → User needs to move between screens

### Core Features
4. **Session Management** → Builds on SSH connection
5. **Connection Storage** → Enables saved connections
6. **Connection List** → Uses stored connections

### Organization
7. **Groups** → Organizes stored connections
8. **Favorites** → Quick access to important connections

### Advanced Features
9. **Logging** → Adds value to terminal sessions
10. **Mobile Optimization** → Makes it usable on mobile
11. **Settings** → Customization and polish

### Order of Implementation:
```
Phase 1 (Foundation)
  ↓
Phase 2 (Sessions) ← Can start after Phase 1 core works
  ↓
Phase 3 (Connections) ← Needs Phase 2
  ↓
Phase 4 (Groups) ← Needs Phase 3
  ↓
Phase 5 (Logging) ← Can parallel with Phase 4
  ↓
Phase 6 (Mobile UX) ← Can parallel with Phase 5
  ↓
Phase 7 (Polish) ← Final phase
```

---

## 8. Risks and Mitigations

### 8.1 Technical Risks

**Risk: SSH Library Stability**
- **Issue:** dartssh2 or alternative may have bugs or limitations
- **Mitigation:** 
  - Research and test libraries early
  - Have fallback options (native plugins)
  - Test with various SSH servers
  - Community support check

**Risk: Terminal Performance on Mobile**
- **Issue:** Terminal rendering may be slow on older devices
- **Mitigation:**
  - Optimize terminal rendering
  - Limit scrollback on low-end devices
  - Test on various device specs
  - Use efficient rendering techniques

**Risk: Background Connection Handling**
- **Issue:** iOS/Android may kill background connections
- **Mitigation:**
  - Use foreground services (Android)
  - Implement background modes (iOS)
  - Handle connection restoration
  - Clear user expectations

**Risk: Keyboard Implementation**
- **Issue:** Custom mobile keyboard may be complex
- **Mitigation:**
  - Use existing Flutter keyboard packages
  - Start with basic keys, expand later
  - Test on various screen sizes
  - Consider third-party solutions

### 8.2 Product Risks

**Risk: Feature Scope Creep**
- **Issue:** Trying to match desktop version exactly
- **Mitigation:**
  - Focus on MVP first
  - Mobile-first feature set
  - Defer advanced features
  - User feedback before adding features

**Risk: User Adoption**
- **Issue:** Users may prefer desktop version
- **Mitigation:**
  - Mobile-specific value proposition
  - On-the-go use cases
  - Quick access benefits
  - Mobile-optimized UX

### 8.3 Resource Risks

**Risk: Development Time**
- **Issue:** Flutter learning curve and full rewrite
- **Mitigation:**
  - Phased approach
  - MVP first, iterate
  - Reuse design patterns from desktop
  - Leverage Flutter community

**Risk: Maintenance Burden**
- **Issue:** Two codebases (desktop + mobile)
- **Mitigation:**
  - Shared design system
  - Documented architecture
  - Feature parity not required
  - Mobile-specific features are OK

---

## 9. Success Criteria

### MVP Success (Phase 1-3)
- ✅ User can connect to SSH server
- ✅ Terminal displays correctly
- ✅ Can save and access connections
- ✅ Basic session management works
- ✅ App is stable (no crashes in 1-hour session)

### Full Success (All Phases)
- ✅ All core features work reliably
- ✅ Mobile UX is intuitive and smooth
- ✅ Performance is acceptable on mid-range devices
- ✅ App receives positive user feedback
- ✅ Can replace other mobile SSH clients for daily use

### Metrics
- Connection success rate: >95%
- App crash rate: <1%
- Average connection time: <3 seconds
- User retention: >60% after 1 week
- App store rating: >4.0 stars

---

## 10. Future Enhancements (Post-v1.0)

### v1.1
- SFTP file browser
- Port forwarding
- SSH key management UI
- Biometric authentication

### v1.2
- Desktop sync (cloud backup)
- Multi-window support (tablets)
- Custom themes
- Advanced keyboard shortcuts

### v2.0
- AI assistant integration
- Collaboration features
- Advanced SSH features (ProxyJump, etc.)
- Widget support (iOS/Android)

---

## 11. Appendix

### 11.1 Design References
- Material Design 3 guidelines
- iOS Human Interface Guidelines
- Popular SSH clients: Termius, JuiceSSH, Prompt

### 11.2 Technical References
- Flutter documentation
- dartssh2 documentation
- xterm.dart documentation
- SSH protocol specifications

### 11.3 Competitive Analysis
- **Termius:** Feature-rich, subscription model
- **JuiceSSH:** Free, ad-supported
- **Prompt:** iOS-only, premium
- **Our Advantage:** Open source, desktop sync potential, modern UI

---

**Document Status:** Draft  
**Last Updated:** 2025-01-XX  
**Next Review:** After Phase 1 completion



