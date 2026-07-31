import React, { useState, useEffect } from 'react';
import { Shield, Bot, Eye, UserCheck, Home, LogOut, Database, Users, BarChart2, HelpCircle, Sparkles } from 'lucide-react';
import type { UserSession } from '../types/alert';
import { getAuthStatus, type SystemHealthStatus } from '../services/api';

interface HeaderProps {
  activeTab: 'home' | 'no-ai' | 'with-ai' | 'test-results' | 'admin-users' | 'admin-questions' | 'benchmark';
  onTabChange: (tab: 'home' | 'no-ai' | 'with-ai' | 'test-results' | 'admin-users' | 'admin-questions' | 'benchmark') => void;
  userSession: UserSession | null;
  onLogout: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  onTabChange,
  userSession,
  onLogout
}) => {
  const [healthStatus, setHealthStatus] = useState<SystemHealthStatus>({
    isServerOnline: null,
    isConnectedToMongoDB: null,
    databaseProvider: 'Sprawdzanie...'
  });

  useEffect(() => {
    let isMounted = true;
    const checkHealth = async () => {
      const status = await getAuthStatus();
      if (isMounted) {
        setHealthStatus(status);
      }
    };

    checkHealth();
    // Sprawdzaj status co 30 sekund zamiast co 4 sekundy, aby nie spamować konsoli sieciowej (Network)
    const interval = setInterval(checkHealth, 30000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  return (
    <header className="soc-header">
      <div className="soc-header-inner">
        {/* Left: Logo & Dynamic System / DB Status Badges */}
        <div className="soc-logo" style={{ cursor: 'pointer' }} onClick={() => onTabChange('home')}>
          <div className="soc-logo-icon">
            <Shield size={22} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontWeight: 700, letterSpacing: '0.5px', fontSize: '0.95rem' }}>Magisterka SOC</span>
              
              {/* Backend Server Status Badge */}
              <span className="soc-status-badge" style={{
                background: healthStatus.isServerOnline === null ? 'rgba(148, 163, 184, 0.15)' : healthStatus.isServerOnline ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                border: healthStatus.isServerOnline === null ? '1px solid rgba(148, 163, 184, 0.3)' : healthStatus.isServerOnline ? '1px solid rgba(34, 197, 94, 0.3)' : '1px solid rgba(239, 68, 68, 0.3)',
                color: healthStatus.isServerOnline === null ? '#94a3b8' : healthStatus.isServerOnline ? '#4ade80' : '#f87171'
              }}>
                <span className="pulse-dot" style={{
                  background: healthStatus.isServerOnline === null ? '#94a3b8' : healthStatus.isServerOnline ? '#22c55e' : '#ef4444',
                  boxShadow: healthStatus.isServerOnline === true ? '0 0 8px #22c55e' : healthStatus.isServerOnline === false ? '0 0 8px #ef4444' : 'none'
                }}></span>
                SERVER: {healthStatus.isServerOnline === null ? 'SPRAWDZANIE...' : healthStatus.isServerOnline ? 'ONLINE' : 'OFFLINE'}
              </span>

              {/* Database Status Badge */}
              <span className="soc-status-badge" style={{
                background: healthStatus.isConnectedToMongoDB === null ? 'rgba(148, 163, 184, 0.15)' : healthStatus.isConnectedToMongoDB ? 'rgba(56, 189, 248, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                border: healthStatus.isConnectedToMongoDB === null ? '1px solid rgba(148, 163, 184, 0.3)' : healthStatus.isConnectedToMongoDB ? '1px solid rgba(56, 189, 248, 0.3)' : '1px solid rgba(239, 68, 68, 0.3)',
                color: healthStatus.isConnectedToMongoDB === null ? '#94a3b8' : healthStatus.isConnectedToMongoDB ? '#38bdf8' : '#f87171',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px'
              }}>
                <Database size={12} />
                BAZA: {healthStatus.isConnectedToMongoDB === null ? 'SPRAWDZANIE...' : healthStatus.isConnectedToMongoDB ? 'ONLINE' : 'OFFLINE'}
              </span>
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
                className={`soc-tab ${activeTab === 'benchmark' ? 'active-ai' : ''}`}
                onClick={() => onTabChange('benchmark')}
              >
                <Sparkles size={16} color="#a855f7" />
                <span style={{ color: '#a855f7', fontWeight: 700 }}>Ewaluacja AI (Benchmark)</span>
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
          {userSession && (
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
          )}
        </div>
      </div>
    </header>
  );
};
