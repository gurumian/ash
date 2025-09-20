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
      // Electron API를 통해 main 프로세스의 SSH 연결 호출
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
  const [connectionForm, setConnectionForm] = useState({
    host: '',
    port: '22',
    user: '',
    password: ''
  });
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const terminalRef = useRef(null);
  const terminalInstanceRef = useRef(null);
  const sshConnectionRef = useRef(null);
  const currentCommandRef = useRef('');

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setConnectionForm(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // 터미널 초기화
  useEffect(() => {
    const initializeTerminal = async () => {
      if (isConnected && terminalRef.current) {
        const terminal = new Terminal({
          cols: 80,
          rows: 24,
          cursorBlink: true,
          theme: {
            background: '#1e1e1e',
            foreground: '#ffffff',
            cursor: '#ffffff'
          }
        });

        terminal.open(terminalRef.current);
        terminalInstanceRef.current = terminal;

        // SSH 셸 시작 (연결은 이미 handleConnect에서 완료됨)
        try {
          await sshConnectionRef.current.startShell();
        } catch (error) {
          terminal.write(`Failed to start shell: ${error.message}\r\n`);
          return;
        }

        // SSH 데이터 수신 이벤트 리스너
        window.electronAPI.onSSHData((event, { connectionId, data }) => {
          terminal.write(data);
        });

        // SSH 연결 종료 이벤트 리스너
        window.electronAPI.onSSHClose((event, { connectionId }) => {
          terminal.write('\r\nSSH connection closed.\r\n');
        });

        // 터미널 입력 처리 - SSH로 직접 전송
        terminal.onData((data) => {
          sshConnectionRef.current.write(data);
        });

        return () => {
          // 이벤트 리스너 제거
          window.electronAPI.removeAllListeners('ssh-data');
          window.electronAPI.removeAllListeners('ssh-close');
          
          terminal.dispose();
          if (sshConnectionRef.current) {
            sshConnectionRef.current.disconnect();
          }
        };
      }
    };

    initializeTerminal();
  }, [isConnected, connectionForm]);

  // 프롬프트 표시 함수 (실제 SSH에서는 서버에서 프롬프트를 보내므로 불필요)
  const displayPrompt = (terminal) => {
    // 실제 SSH에서는 서버가 프롬프트를 보내므로 여기서는 아무것도 하지 않음
  };

  const handleConnect = async () => {
    if (!connectionForm.host || !connectionForm.user) {
      alert('Host와 Username은 필수입니다.');
      return;
    }

    setIsConnecting(true);
    
    try {
      // SSH 연결 생성 및 연결
      const sshConnection = new SSHConnection();
      await sshConnection.connect(
        connectionForm.host,
        connectionForm.port,
        connectionForm.user,
        connectionForm.password
      );
      
      // 연결 성공 후 SSH 연결 인스턴스를 저장
      sshConnectionRef.current = sshConnection;
      setIsConnected(true);
      setIsConnecting(false);
      
    } catch (error) {
      console.error('Connection failed:', error);
      setIsConnecting(false);
      alert('연결에 실패했습니다: ' + error.message);
    }
  };

  const handleDisconnect = () => {
    setIsConnected(false);
    // TODO: SSH 연결 해제 로직 구현
  };

  return (
    <div className="app">
      <header className="app-header">
        <h1>🔐 ash - SSH Client</h1>
        <p>Personal SSH + AI Assistant</p>
      </header>

      <main className="app-main">
        {!isConnected ? (
          <div className="connection-form">
            <h2>SSH 연결</h2>
            <form onSubmit={(e) => { e.preventDefault(); handleConnect(); }}>
              <div className="form-group">
                <label htmlFor="host">Host</label>
                <input
                  type="text"
                  id="host"
                  name="host"
                  value={connectionForm.host}
                  onChange={handleInputChange}
                  placeholder="예: 192.168.1.100 또는 server.example.com"
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
                  placeholder="예: root, admin, ubuntu"
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
                  placeholder="비밀번호 입력"
                />
              </div>

              <button 
                type="submit" 
                className="connect-button"
                disabled={isConnecting}
              >
                {isConnecting ? '연결 중...' : '연결'}
              </button>
            </form>
          </div>
        ) : (
          <div className="terminal-container">
            <div className="terminal-header">
              <span>Connected to {connectionForm.user}@{connectionForm.host}:{connectionForm.port}</span>
              <button onClick={handleDisconnect} className="disconnect-button">
                연결 해제
              </button>
            </div>
            <div 
              ref={terminalRef} 
              className="terminal-content"
              style={{ width: '100%', height: '400px' }}
            />
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
