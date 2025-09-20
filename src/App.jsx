import React, { useState, useRef, useEffect } from 'react';
import { Terminal } from '@xterm/xterm';
import '@xterm/xterm/css/xterm.css';
import './App.css';

// 실제 SSH 연결을 위한 클래스
class SSHConnection {
  constructor() {
    this.connectionId = null;
    this.isConnected = false;
    this.terminal = null;
  }

  async connect(host, port, user, password) {
    try {
      const result = await window.electronAPI.sshConnect({
        host,
        port: parseInt(port),
        username: user,
        password
      });
      
      if (result.success) {
        this.connectionId = result.connectionId;
        this.isConnected = true;
        return result;
      } else {
        throw new Error('SSH connection failed');
      }
    } catch (error) {
      throw new Error(`SSH connection failed: ${error.message}`);
    }
  }

  async startShell() {
    if (!this.isConnected) {
      throw new Error('Not connected to SSH server');
    }

    try {
      const result = await window.electronAPI.sshStartShell(this.connectionId);
      return result;
    } catch (error) {
      throw new Error(`Failed to start shell: ${error.message}`);
    }
  }

  write(data) {
    if (!this.isConnected) {
      return;
    }
    
    window.electronAPI.sshWrite(this.connectionId, data);
  }

  disconnect() {
    if (this.isConnected && this.connectionId) {
      window.electronAPI.sshDisconnect(this.connectionId);
      this.isConnected = false;
      this.connectionId = null;
    }
  }
}

function App() {
  // 세션 관리 상태
  const [sessions, setSessions] = useState([]);
  const [activeSessionId, setActiveSessionId] = useState(null);
  const [connectionForm, setConnectionForm] = useState({
    host: '',
    port: '22',
    user: '',
    password: '',
    sessionName: ''
  });
  const [isConnecting, setIsConnecting] = useState(false);
  const [showConnectionForm, setShowConnectionForm] = useState(false);
  
  // 터미널 관련 refs
  const terminalRefs = useRef({});
  const terminalInstances = useRef({});
  const sshConnections = useRef({});

  // 연결 히스토리 및 즐겨찾기
  const [connectionHistory, setConnectionHistory] = useState(
    JSON.parse(localStorage.getItem('ssh-connections') || '[]')
  );
  const [favorites, setFavorites] = useState(
    JSON.parse(localStorage.getItem('ssh-favorites') || '[]')
  );

  // 연결 히스토리 저장
  const saveConnectionHistory = (connection) => {
    const newHistory = [connection, ...connectionHistory.filter(c => 
      !(c.host === connection.host && c.user === connection.user)
    )].slice(0, 20); // 최대 20개 저장
    
    setConnectionHistory(newHistory);
    localStorage.setItem('ssh-connections', JSON.stringify(newHistory));
  };

  // 즐겨찾기 토글
  const toggleFavorite = (connection) => {
    const isFavorite = favorites.some(f => 
      f.host === connection.host && f.user === connection.user
    );
    
    if (isFavorite) {
      const newFavorites = favorites.filter(f => 
        !(f.host === connection.host && f.user === connection.user)
      );
      setFavorites(newFavorites);
      localStorage.setItem('ssh-favorites', JSON.stringify(newFavorites));
    } else {
      const newFavorites = [...favorites, { ...connection, name: connection.sessionName || `${connection.user}@${connection.host}` }];
      setFavorites(newFavorites);
      localStorage.setItem('ssh-favorites', JSON.stringify(newFavorites));
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setConnectionForm(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // 새 세션 생성
  const createNewSession = async () => {
    if (!connectionForm.host || !connectionForm.user) {
      alert('Host와 Username은 필수입니다.');
      return;
    }

    setIsConnecting(true);
    
    try {
      const sessionId = Date.now().toString();
      const sessionName = connectionForm.sessionName || `${connectionForm.user}@${connectionForm.host}`;
      
      // SSH 연결 생성
      const sshConnection = new SSHConnection();
      await sshConnection.connect(
        connectionForm.host,
        connectionForm.port,
        connectionForm.user,
        connectionForm.password
      );
      
      // 세션 정보 저장
      const session = {
        id: sessionId,
        name: sessionName,
        host: connectionForm.host,
        port: connectionForm.port,
        user: connectionForm.user,
        isConnected: true,
        createdAt: new Date().toISOString()
      };
      
      setSessions(prev => [...prev, session]);
      setActiveSessionId(sessionId);
      sshConnections.current[sessionId] = sshConnection;
      
      // 연결 히스토리 저장
      saveConnectionHistory({
        host: connectionForm.host,
        port: connectionForm.port,
        user: connectionForm.user,
        sessionName: sessionName
      });
      
      // 폼 초기화
      setConnectionForm({
        host: '',
        port: '22',
        user: '',
        password: '',
        sessionName: ''
      });
      setShowConnectionForm(false);
      setIsConnecting(false);
      
    } catch (error) {
      console.error('Connection failed:', error);
      setIsConnecting(false);
      alert('연결에 실패했습니다: ' + error.message);
    }
  };

  // 터미널 초기화
  const initializeTerminal = async (sessionId) => {
    const terminalRef = terminalRefs.current[sessionId];
    if (!terminalRef) return;

    // 터미널 크기를 동적으로 계산
    const terminalElement = terminalRef;
    const cols = Math.floor(terminalElement.clientWidth / 8); // 대략적인 문자 너비
    const rows = Math.floor(terminalElement.clientHeight / 16); // 대략적인 문자 높이

    const terminal = new Terminal({
      cols: Math.max(cols, 80),
      rows: Math.max(rows, 24),
      cursorBlink: true,
      scrollback: 1000,
      theme: {
        background: '#1e1e1e',
        foreground: '#ffffff',
        cursor: '#ffffff'
      }
    });

    terminal.open(terminalRef);
    terminalInstances.current[sessionId] = terminal;

    // SSH 셸 시작
    try {
      await sshConnections.current[sessionId].startShell();
    } catch (error) {
      terminal.write(`Failed to start shell: ${error.message}\r\n`);
      return;
    }

    // SSH 데이터 수신 이벤트 리스너
    window.electronAPI.onSSHData((event, { connectionId, data }) => {
      // 해당 세션의 터미널에만 데이터 전송
      const session = sessions.find(s => sshConnections.current[s.id]?.connectionId === connectionId);
      if (session && terminalInstances.current[session.id]) {
        terminalInstances.current[session.id].write(data);
      }
    });

    // SSH 연결 종료 이벤트 리스너
    window.electronAPI.onSSHClose((event, { connectionId }) => {
      const session = sessions.find(s => sshConnections.current[s.id]?.connectionId === connectionId);
      if (session && terminalInstances.current[session.id]) {
        terminalInstances.current[session.id].write('\r\nSSH connection closed.\r\n');
        // 세션 상태 업데이트
        setSessions(prev => prev.map(s => 
          s.id === session.id ? { ...s, isConnected: false } : s
        ));
      }
    });

    // 터미널 입력 처리
    terminal.onData((data) => {
      sshConnections.current[sessionId].write(data);
    });
  };

  // 활성 세션 변경
  const switchToSession = (sessionId) => {
    setActiveSessionId(sessionId);
  };

  // 세션 연결 해제
  const disconnectSession = (sessionId) => {
    if (sshConnections.current[sessionId]) {
      sshConnections.current[sessionId].disconnect();
      delete sshConnections.current[sessionId];
    }
    
    if (terminalInstances.current[sessionId]) {
      terminalInstances.current[sessionId].dispose();
      delete terminalInstances.current[sessionId];
    }
    
    setSessions(prev => prev.filter(s => s.id !== sessionId));
    
    if (activeSessionId === sessionId) {
      const remainingSessions = sessions.filter(s => s.id !== sessionId);
      setActiveSessionId(remainingSessions.length > 0 ? remainingSessions[0].id : null);
    }
  };

  // 히스토리에서 연결
  const connectFromHistory = (connection) => {
    setConnectionForm({
      host: connection.host,
      port: connection.port || '22',
      user: connection.user,
      password: '',
      sessionName: connection.sessionName || connection.name || ''
    });
    setShowConnectionForm(true);
  };

  // 터미널 초기화 효과
  useEffect(() => {
    if (activeSessionId && sessions.find(s => s.id === activeSessionId)?.isConnected) {
      // DOM이 완전히 렌더링된 후 터미널 초기화
      const timer = setTimeout(() => {
        initializeTerminal(activeSessionId);
      }, 200);
      
      return () => clearTimeout(timer);
    }
  }, [activeSessionId, sessions]);

  // 윈도우 리사이즈 시 터미널 크기 조정
  useEffect(() => {
    const handleResize = () => {
      if (activeSessionId && terminalInstances.current[activeSessionId]) {
        const terminal = terminalInstances.current[activeSessionId];
        const terminalRef = terminalRefs.current[activeSessionId];
        if (terminalRef) {
          const cols = Math.floor(terminalRef.clientWidth / 8);
          const rows = Math.floor(terminalRef.clientHeight / 16);
          terminal.resize(Math.max(cols, 80), Math.max(rows, 24));
        }
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [activeSessionId]);

  const activeSession = sessions.find(s => s.id === activeSessionId);

  // 창 제목 동적 변경
  useEffect(() => {
    const updateWindowTitle = () => {
      if (activeSession) {
        const title = `${activeSession.user}@${activeSession.host}:${activeSession.port} - ash`;
        window.electronAPI.setWindowTitle(title);
      } else {
        window.electronAPI.setWindowTitle('ash');
      }
    };

    updateWindowTitle();
  }, [activeSession]);

  // 시스템 메뉴 이벤트 처리
  useEffect(() => {
    // 새 세션 메뉴 이벤트
    window.electronAPI.onMenuNewSession(() => {
      setShowConnectionForm(true);
    });

    // 세션 닫기 메뉴 이벤트
    window.electronAPI.onMenuCloseSession(() => {
      if (activeSessionId) {
        disconnectSession(activeSessionId);
      }
    });

    // About 메뉴 이벤트
    window.electronAPI.onMenuAbout(() => {
      alert('ash SSH Client\nVersion 1.0.0\nA modern SSH client built with Electron and React');
    });

    return () => {
      // 이벤트 리스너 정리
      window.electronAPI.removeAllListeners('menu-new-session');
      window.electronAPI.removeAllListeners('menu-close-session');
      window.electronAPI.removeAllListeners('menu-about');
    };
  }, [activeSessionId]);

  return (
    <div className="securecrt-app">
      <div className="main-content">
        {/* 좌측 세션 매니저 */}
        <div className="session-manager">
          <div className="session-manager-header">
            <h3>Sessions</h3>
            <button 
              className="new-session-btn"
              onClick={() => setShowConnectionForm(true)}
              title="New Session"
            >
              +
            </button>
          </div>
          
          {/* 즐겨찾기 */}
          {favorites.length > 0 && (
            <div className="section">
              <div className="section-header">Favorites</div>
              {favorites.map((fav, index) => (
                <div 
                  key={index}
                  className="session-item favorite"
                  onClick={() => connectFromHistory(fav)}
                  title={`${fav.user}@${fav.host}`}
                >
                  <span className="session-name">⭐ {fav.name}</span>
                </div>
              ))}
            </div>
          )}

          {/* 활성 세션 */}
          {sessions.length > 0 && (
            <div className="section">
              <div className="section-header">Active Sessions</div>
              {sessions.map(session => (
                <div 
                  key={session.id}
                  className={`session-item ${activeSessionId === session.id ? 'active' : ''}`}
                  onClick={() => switchToSession(session.id)}
                >
                  <span className="session-name">{session.name}</span>
                  <span className={`connection-status ${session.isConnected ? 'connected' : 'disconnected'}`}>
                    {session.isConnected ? '●' : '○'}
                  </span>
                  <button 
                    className="close-session-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      disconnectSession(session.id);
                    }}
                    title="Close Session"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* 연결 히스토리 */}
          {connectionHistory.length > 0 && (
            <div className="section">
              <div className="section-header">Recent</div>
              {connectionHistory.slice(0, 10).map((conn, index) => (
                <div 
                  key={index}
                  className="session-item history"
                  onClick={() => connectFromHistory(conn)}
                  title={`${conn.user}@${conn.host}`}
                >
                  <span className="session-name">{conn.user}@{conn.host}</span>
                  <button 
                    className="favorite-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleFavorite(conn);
                    }}
                    title="Toggle Favorite"
                  >
                    {favorites.some(f => f.host === conn.host && f.user === conn.user) ? '★' : '☆'}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 우측 터미널 영역 */}
        <div className="terminal-area">
          {activeSession ? (
            <div className="terminal-container">
              <div className="terminal-header">
                <div className="tab-bar">
                  {sessions.map(session => (
                    <div 
                      key={session.id}
                      className={`tab ${activeSessionId === session.id ? 'active' : ''}`}
                      onClick={() => switchToSession(session.id)}
                    >
                      <span className="tab-name">{session.name}</span>
                      <span className={`tab-status ${session.isConnected ? 'connected' : 'disconnected'}`}>
                        {session.isConnected ? '●' : '○'}
                      </span>
                      <button 
                        className="tab-close"
                        onClick={(e) => {
                          e.stopPropagation();
                          disconnectSession(session.id);
                        }}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              </div>
              <div 
                ref={el => terminalRefs.current[activeSessionId] = el}
                className="terminal-content"
              />
            </div>
          ) : (
            <div className="welcome-screen">
              <h2>Welcome to ash SSH Client</h2>
              <p>Create a new session to get started</p>
              <button 
                className="welcome-connect-btn"
                onClick={() => setShowConnectionForm(true)}
              >
                New Session
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 하단 상태바 */}
      <div className="status-bar">
        <div className="status-left">
          {activeSession ? (
            <span>Connected to {activeSession.user}@{activeSession.host}:{activeSession.port}</span>
          ) : (
            <span>Ready</span>
          )}
        </div>
        <div className="status-right">
          <span>Sessions: {sessions.length}</span>
        </div>
      </div>

      {/* 연결 폼 모달 */}
      {showConnectionForm && (
        <div className="modal-overlay">
          <div className="connection-modal">
            <div className="modal-header">
              <h3>New SSH Session</h3>
              <button 
                className="modal-close"
                onClick={() => setShowConnectionForm(false)}
              >
                ×
              </button>
            </div>
            
            <form onSubmit={(e) => { e.preventDefault(); createNewSession(); }}>
              <div className="form-group">
                <label htmlFor="sessionName">Session Name</label>
                <input
                  type="text"
                  id="sessionName"
                  name="sessionName"
                  value={connectionForm.sessionName}
                  onChange={handleInputChange}
                  placeholder="My Server"
                />
              </div>

              <div className="form-group">
                <label htmlFor="host">Host</label>
                <input
                  type="text"
                  id="host"
                  name="host"
                  value={connectionForm.host}
                  onChange={handleInputChange}
                  placeholder="192.168.1.100 or server.example.com"
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="port">Port</label>
                <input
                  type="number"
                  id="port"
                  name="port"
                  value={connectionForm.port}
                  onChange={handleInputChange}
                  placeholder="22"
                  min="1"
                  max="65535"
                />
              </div>

              <div className="form-group">
                <label htmlFor="user">Username</label>
                <input
                  type="text"
                  id="user"
                  name="user"
                  value={connectionForm.user}
                  onChange={handleInputChange}
                  placeholder="root, admin, ubuntu"
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="password">Password</label>
                <input
                  type="password"
                  id="password"
                  name="password"
                  value={connectionForm.password}
                  onChange={handleInputChange}
                  placeholder="Password"
                />
              </div>

              <div className="modal-actions">
                <button 
                  type="button"
                  className="cancel-btn"
                  onClick={() => setShowConnectionForm(false)}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="connect-btn"
                  disabled={isConnecting}
                >
                  {isConnecting ? 'Connecting...' : 'Connect'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;