import React, { useEffect, useState } from 'react';
import { Shield, Bot, Eye, Clock, UserCheck, RotateCcw, Home, LogOut, Database, Users, BarChart2 } from 'lucide-react';
import type { UserSession } from '../types/alert';

interface HeaderProps {
  activeTab: 'home' | 'no-ai' | 'with-ai' | 'test-results' | 'admin-users';
  onTabChange: (tab: 'home' | 'no-ai' | 'with-ai' | 'test-results' | 'admin-users') => void;
  handledCount: number;
  userSession: UserSession | null;
  onLogout: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  onTabChange,
  handledCount,
  userSession,
  onLogout
}) => {
  const [timerSeconds, setTimerSeconds] = useState<number>(0);
  const [isTimerRunning, setIsTimerRunning] = useState<boolean>(true);

  useEffect(() => {
    let interval: any = null;
    if (isTimerRunning && (activeTab === 'no-ai' || activeTab === 'with-ai')) {
      interval = setInterval(() => {
        setTimerSeconds(prev => prev + 1);
      }, 1000);
    } else {
      clearInterval(interval);
    }
    return () => clearInterval(interval);
  }, [isTimerRunning, activeTab]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleResetTimer = () => {
    setTimerSeconds(0);
    setIsTimerRunning(true);
  };

  return (
    <header className="soc-header">
      <div className="soc-header-inner">
        {/* Left: Logo & System Status */}
        <div className="soc-logo" style={{ cursor: 'pointer' }} onClick={() => onTabChange('home')}>
          <div className="soc-logo-icon">
            <Shield size={22} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontWeight: 700, letterSpacing: '0.5px', fontSize: '0.95rem' }}>SOC SENTINEL DASHBOARD</span>
              <span className="soc-status-badge">
                <span className="pulse-dot"></span> SYSTEM ONLINE
              </span>
            </div>
            <div style={{ fontSize: '0.725rem', color: 'var(--text-muted)', fontWeight: 400, marginTop: '1px' }}>
              Środowisko Badawcze Operatora SOC (Laboratorium MGR)
            </div>
          </div>
        </div>

        {/* Center: Clean Navigation Tabs */}
        {userSession && (
          <div className="soc-tab-group">
            <button
              className={`soc-tab ${activeTab === 'home' ? 'active-no-ai' : ''}`}
              onClick={() => onTabChange('home')}
            >
              <Home size={16} />
              <span>Strona Główna</span>
            </button>

            <button
              className={`soc-tab ${activeTab === 'no-ai' ? 'active-no-ai' : ''}`}
              onClick={() => {
                onTabChange('no-ai');
                handleResetTimer();
              }}
            >
              <Eye size={16} />
              <span>Test 1: Bez AI</span>
            </button>
            
            <button
              className={`soc-tab ${activeTab === 'with-ai' ? 'active-ai' : ''}`}
              onClick={() => {
                onTabChange('with-ai');
                handleResetTimer();
              }}
            >
              <Bot size={16} />
              <span>Test 2: Z AI</span>
            </button>

            <button
              className={`soc-tab ${activeTab === 'test-results' ? 'active-ai' : ''}`}
              onClick={() => onTabChange('test-results')}
            >
              <BarChart2 size={16} color="#38bdf8" />
              <span>Wyniki Testów</span>
            </button>

            {userSession.role === 'Administrator' && (
              <button
                className={`soc-tab ${activeTab === 'admin-users' ? 'active-ai' : ''}`}
                onClick={() => onTabChange('admin-users')}
                style={{ borderLeft: '1px solid var(--border-color)' }}
              >
                <Users size={16} color="#c084fc" />
                <span style={{ color: '#c084fc' }}>Zarządzanie Użytkownikami</span>
              </button>
            )}
          </div>
        )}

        {/* Right: Timer & Session Meta */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          {userSession && (activeTab === 'no-ai' || activeTab === 'with-ai') && (
            <div style={{
              background: 'rgba(0,0,0,0.4)',
              border: '1px solid var(--border-color)',
              borderRadius: '8px',
              padding: '0.35rem 0.75rem',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontSize: '0.825rem'
            }}>
              <Clock size={15} color="var(--ai-cyan)" />
              <span style={{ color: 'var(--text-muted)' }}>Stoper:</span>
              <span className="mono" style={{ fontWeight: 700, color: '#38bdf8', fontSize: '0.95rem' }}>
                {formatTime(timerSeconds)}
              </span>
              <button
                onClick={handleResetTimer}
                title="Resetuj stoper"
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  padding: '2px'
                }}
              >
                <RotateCcw size={13} />
              </button>
            </div>
          )}

          {userSession && (
            <div style={{
              background: 'rgba(16, 185, 129, 0.1)',
              border: '1px solid rgba(16, 185, 129, 0.25)',
              borderRadius: '8px',
              padding: '0.35rem 0.75rem',
              fontSize: '0.8rem',
              color: '#10b981',
              fontWeight: 600
            }}>
              Obsłużono: {handledCount}
            </div>
          )}

          {userSession ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ display: 'flex', flexShrink: 0, alignItems: 'center', gap: '6px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                <UserCheck size={15} color="#38bdf8" />
                <span>
                  Operator: <strong style={{ color: '#ffffff' }}>{userSession.username}</strong>
                  <span style={{
                    marginLeft: '6px',
                    fontSize: '0.725rem',
                    color: userSession.role === 'Administrator' ? '#c084fc' : 'var(--text-muted)',
                    fontWeight: 600
                  }}>
                    ({userSession.role})
                  </span>
                </span>
              </div>

              <button
                onClick={onLogout}
                className="btn-action btn-danger"
                style={{ padding: '0.35rem 0.65rem', fontSize: '0.775rem' }}
                title="Wyloguj operatora"
              >
                <LogOut size={14} /> Wyloguj
              </button>
            </div>
          ) : (
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Database size={14} color="var(--ai-cyan)" />
              <span>System Wymaga Zalogowania Operatora</span>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
