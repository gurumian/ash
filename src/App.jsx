import React, { useState } from 'react';
import './App.css';

function App() {
  const [connectionForm, setConnectionForm] = useState({
    host: '',
    port: '22',
    user: '',
    password: ''
  });
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setConnectionForm(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleConnect = async () => {
    if (!connectionForm.host || !connectionForm.user) {
      alert('Host와 Username은 필수입니다.');
      return;
    }

    setIsConnecting(true);
    
    try {
      // TODO: SSH 연결 로직 구현
      console.log('Connecting to:', connectionForm);
      
      // 임시로 2초 후 연결 성공으로 처리
      setTimeout(() => {
        setIsConnected(true);
        setIsConnecting(false);
      }, 2000);
      
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
            <div className="terminal-content">
              <p>터미널이 여기에 표시됩니다.</p>
              <p>SSH 연결이 성공했습니다!</p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
