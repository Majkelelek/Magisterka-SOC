import React from 'react';
import { Shield, Bot, Eye, UserCheck, Home, LogOut, Database, Users, BarChart2, HelpCircle } from 'lucide-react';
import type { UserSession } from '../types/alert';

interface HeaderProps {
  activeTab: 'home' | 'no-ai' | 'with-ai' | 'test-results' | 'admin-users' | 'admin-questions';
  onTabChange: (tab: 'home' | 'no-ai' | 'with-ai' | 'test-results' | 'admin-users' | 'admin-questions') => void;
  userSession: UserSession | null;
  onLogout: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  onTabChange,
  userSession,
  onLogout
}) => {
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
              <span style={{ fontWeight: 700, letterSpacing: '0.5px', fontSize: '0.95rem' }}>Magisterka SOC</span>
              <span className="soc-status-badge">
                <span className="pulse-dot"></span> ONLINE
              </span>
            </div>
            <div style={{ fontSize: '0.725rem', color: 'var(--text-muted)', fontWeight: 400, marginTop: '1px' }}>
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
              onClick={() => onTabChange('no-ai')}
            >
              <Eye size={16} />
              <span>Test 1: Bez AI</span>
            </button>

            <button
              className={`soc-tab ${activeTab === 'with-ai' ? 'active-ai' : ''}`}
              onClick={() => onTabChange('with-ai')}
            >
              <Bot size={16} />
              <span>Test 2: Z AI</span>
            </button>

            {userSession.role === 'Administrator' && (
              <button
                className={`soc-tab ${activeTab === 'test-results' ? 'active-ai' : ''}`}
                onClick={() => onTabChange('test-results')}
              >
                <BarChart2 size={16} color="#38bdf8" />
                <span>Wyniki Testów</span>
              </button>
            )}

            {userSession.role === 'Administrator' && (
              <button
                className={`soc-tab ${activeTab === 'admin-questions' ? 'active-ai' : ''}`}
                onClick={() => onTabChange('admin-questions')}
              >
                <HelpCircle size={16} color="#38bdf8" />
                <span style={{ color: '#38bdf8' }}>Zarządzanie Pytaniami</span>
              </button>
            )}

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

        {/* Right: Session Meta */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
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
