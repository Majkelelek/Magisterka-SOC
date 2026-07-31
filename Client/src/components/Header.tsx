import React, { useState, useEffect } from 'react';
import { Shield, Bot, Eye, UserCheck, Home, LogOut, Database, Users, BarChart2, HelpCircle, Sparkles } from 'lucide-react';
import type { UserSession } from '../types/alert';
import { getAuthStatus, type SystemHealthStatus } from '../services/api';
import '../styles/Header.css';

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
        <div className="soc-logo soc-logo-clickable" onClick={() => onTabChange('home')}>
          <div className="soc-logo-icon">
            <Shield size={22} />
          </div>
          <div>
            <div className="soc-header-title-box">
              <span className="soc-header-title">Magisterka SOC</span>
              
              {/* Backend Server Status Badge */}
              <span className={`soc-status-badge ${healthStatus.isServerOnline === null ? 'status-badge-checking' : healthStatus.isServerOnline ? 'status-badge-online' : 'status-badge-offline'}`}>
                <span className={`pulse-dot ${healthStatus.isServerOnline === null ? 'checking' : healthStatus.isServerOnline ? 'online' : 'offline'}`}></span>
                SERVER: {healthStatus.isServerOnline === null ? 'SPRAWDZANIE...' : healthStatus.isServerOnline ? 'ONLINE' : 'OFFLINE'}
              </span>

              {/* Database Status Badge */}
              <span className={`soc-status-badge ${healthStatus.isConnectedToMongoDB === null ? 'status-badge-checking' : healthStatus.isConnectedToMongoDB ? 'status-badge-db-online' : 'status-badge-offline'}`}>
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
                <span className="soc-tab-label-benchmark">Ewaluacja AI (Benchmark)</span>
              </button>
            )}

            {userSession.role === 'Administrator' && (
              <button
                className={`soc-tab ${activeTab === 'admin-questions' ? 'active-ai' : ''}`}
                onClick={() => onTabChange('admin-questions')}
              >
                <HelpCircle size={16} color="#38bdf8" />
                <span className="soc-tab-label-questions">Zarządzanie Pytaniami</span>
              </button>
            )}

            {userSession.role === 'Administrator' && (
              <button
                className={`soc-tab soc-tab-users-btn ${activeTab === 'admin-users' ? 'active-ai' : ''}`}
                onClick={() => onTabChange('admin-users')}
              >
                <Users size={16} color="#c084fc" />
                <span className="soc-tab-label-users">Zarządzanie Użytkownikami</span>
              </button>
            )}
          </div>
        )}

        {/* Right: Session Meta */}
        <div className="soc-user-session-box">
          {userSession && (
            <div className="soc-user-session-info">
              <div className="soc-user-meta">
                <UserCheck size={15} color="#38bdf8" />
                <span>
                  Operator: <strong className="soc-username-strong">{userSession.username}</strong>
                  <span className={`soc-user-role-badge ${userSession.role === 'Administrator' ? 'admin' : ''}`}>
                    ({userSession.role})
                  </span>
                </span>
              </div>

              <button
                onClick={onLogout}
                className="btn-action btn-danger soc-btn-logout-small"
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
