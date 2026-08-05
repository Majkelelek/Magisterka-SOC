import React, { useEffect, useState } from 'react';
import './styles/soc-theme.css';
import type { UserSession } from './types/alert';
import { logoutUser, verifyCurrentSession } from './services/api';
import { Header } from './components/Header';
import { HomePage } from './components/HomePage';
import { LoginPage } from './components/LoginPage';
import { AdminUserPanel } from './components/AdminUserPanel';
import { AdminQuestionsPage } from './components/AdminQuestionsPage';
import { EvaluationBenchmarkPage } from './components/EvaluationBenchmarkPage';

export const App: React.FC = () => {
  const [userSession, setUserSession] = useState<UserSession | null>(() => {
    const saved = sessionStorage.getItem('soc_user_session');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return null;
      }
    }
    return null;
  });

  const [activeTab, setActiveTab] = useState<'home' | 'admin-users' | 'admin-questions' | 'benchmark'>(() => {
    const saved = sessionStorage.getItem('soc_active_tab');
    if (saved && ['home', 'admin-users', 'admin-questions', 'benchmark'].includes(saved)) {
      return saved as any;
    }
    return 'benchmark';
  });

  // Utrwalanie stanu w sessionStorage przy F5 / odświeżaniu
  useEffect(() => {
    sessionStorage.setItem('soc_active_tab', activeTab);
  }, [activeTab]);

  // Real-time Session Monitoring — sprawdzamy ważność sesji co 5 minut
  useEffect(() => {
    const handleUnauthorized = () => {
      setUserSession(null);
      setActiveTab('benchmark');
    };

    window.addEventListener('soc_unauthorized_logout', handleUnauthorized);

    const handleVisibilityChange = async () => {
      if (document.visibilityState === 'visible' && userSession) {
        const isValid = await verifyCurrentSession();
        if (!isValid) {
          setUserSession(null);
          setActiveTab('benchmark');
        }
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    let intervalId: any = null;
    if (userSession) {
      intervalId = setInterval(async () => {
        const isValid = await verifyCurrentSession();
        if (!isValid) {
          setUserSession(null);
          setActiveTab('benchmark');
        }
      }, 5 * 60 * 1000);
    }

    return () => {
      window.removeEventListener('soc_unauthorized_logout', handleUnauthorized);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (intervalId) clearInterval(intervalId);
    };
  }, [userSession]);

  const handleTabChange = (tab: 'home' | 'admin-users' | 'admin-questions' | 'benchmark') => {
    if ((tab === 'admin-questions' || tab === 'benchmark' || tab === 'admin-users') && userSession?.role !== 'Administrator') {
      setActiveTab('home');
      return;
    }
    setActiveTab(tab);
  };

  const handleLoginSuccess = (session: UserSession) => {
    setUserSession(session);
    sessionStorage.setItem('soc_user_session', JSON.stringify(session));
  };

  const handleLogout = async () => {
    await logoutUser();
    setUserSession(null);
    sessionStorage.removeItem('soc_user_session');
    sessionStorage.removeItem('soc_active_tab');
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Header
        activeTab={activeTab}
        onTabChange={handleTabChange}
        userSession={userSession}
        onLogout={handleLogout}
      />

      <main className="soc-container" style={{ flex: 1 }}>
        {!userSession ? (
          <LoginPage onLoginSuccess={handleLoginSuccess} />
        ) : activeTab === 'home' ? (
          <HomePage onNavigate={handleTabChange} />
        ) : activeTab === 'admin-users' ? (
          <AdminUserPanel userSession={userSession} />
        ) : activeTab === 'admin-questions' ? (
          <AdminQuestionsPage />
        ) : (
          <EvaluationBenchmarkPage />
        )}
      </main>

      <footer className="soc-footer">
        Magisterka SOC - Moduł Ewaluacji AI Benchmark
      </footer>
    </div>
  );
};

export default App;
