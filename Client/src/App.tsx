import React, { useEffect, useState } from 'react';
import './styles/soc-theme.css';
import type { Alert, TestSession, UserSession } from './types/alert';
import { fetchAlerts, fetchTestSet, updateAlertStatus, submitTestSession, logoutUser, verifyCurrentSession, cleanAlertStrings } from './services/api';
import { Header } from './components/Header';
import { HomePage } from './components/HomePage';
import { NoAiTestView } from './components/NoAiTestView';
import { AiTestView } from './components/AiTestView';
import { LoginPage } from './components/LoginPage';
import { AdminUserPanel } from './components/AdminUserPanel';
import { TestResultsPage } from './components/TestResultsPage';
import { AdminQuestionsPage } from './components/AdminQuestionsPage';
import { TestRulesModal } from './components/TestRulesModal';
import { ShieldAlert, AlertTriangle, CheckCircle, Activity, BarChart2 } from 'lucide-react';

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

  const [activeTab, setActiveTab] = useState<'home' | 'no-ai' | 'with-ai' | 'test-results' | 'admin-users' | 'admin-questions'>(() => {
    const saved = sessionStorage.getItem('soc_active_tab');
    if (saved && ['home', 'no-ai', 'with-ai', 'test-results', 'admin-users', 'admin-questions'].includes(saved)) {
      return saved as any;
    }
    return 'home';
  });

  const [pendingTab, setPendingTab] = useState<'no-ai' | 'with-ai' | null>(null);
  const [isRulesModalOpen, setIsRulesModalOpen] = useState<boolean>(false);

  const [testStartTime, setTestStartTime] = useState<number | null>(() => {
    const saved = sessionStorage.getItem('soc_test_start_time');
    return saved ? Number(saved) : null;
  });

  const [testSessionId, setTestSessionId] = useState<string | null>(() => {
    return sessionStorage.getItem('soc_test_session_id') || null;
  });

  const [alerts, setAlerts] = useState<Alert[]>([]);

  const [handledCount, setHandledCount] = useState<number>(() => {
    const saved = sessionStorage.getItem('soc_test_handled_count');
    return saved ? Number(saved) : 0;
  });

  const [loading, setLoading] = useState<boolean>(true);

  const [decisions, setDecisions] = useState<Array<{ alertId: string; actionTaken: string; decisionTimeSeconds: number; timestamp: string }>>(() => {
    const saved = sessionStorage.getItem('soc_test_decisions');
    if (saved) {
      try { return JSON.parse(saved); } catch { return []; }
    }
    return [];
  });

  // Utrwalanie stanu w sessionStorage przy F5 / odświeżaniu
  useEffect(() => {
    sessionStorage.setItem('soc_active_tab', activeTab);
  }, [activeTab]);

  useEffect(() => {
    if (testStartTime) {
      sessionStorage.setItem('soc_test_start_time', String(testStartTime));
    } else {
      sessionStorage.removeItem('soc_test_start_time');
    }
  }, [testStartTime]);

  useEffect(() => {
    if (testSessionId) {
      sessionStorage.setItem('soc_test_session_id', testSessionId);
    } else {
      sessionStorage.removeItem('soc_test_session_id');
    }
  }, [testSessionId]);

  useEffect(() => {
    sessionStorage.setItem('soc_test_decisions', JSON.stringify(decisions));
  }, [decisions]);

  useEffect(() => {
    sessionStorage.setItem('soc_test_handled_count', String(handledCount));
  }, [handledCount]);

  // Ochrona przed przypadkowym wyjściem/odświeżeniem F5 podczas aktywnego testu
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (activeTab === 'no-ai' || activeTab === 'with-ai') {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [activeTab]);

  const loadData = async () => {
    setLoading(true);
    const savedTestAlerts = sessionStorage.getItem('soc_test_alerts');

    if (savedTestAlerts) {
      try {
        const parsed = JSON.parse(savedTestAlerts);
        if (Array.isArray(parsed) && parsed.length >= 10) {
          setAlerts(cleanAlertStrings(parsed));
          setLoading(false);
          return;
        }
      } catch { }
    }

    const testSet = await fetchTestSet();
    const cleaned = cleanAlertStrings(testSet);
    setAlerts(cleaned);
    if (cleaned && cleaned.length > 0) {
      sessionStorage.setItem('soc_test_alerts', JSON.stringify(cleaned));
    }
    setLoading(false);
  };

  useEffect(() => {
    if (userSession) {
      loadData();
    }
  }, [userSession]);

  // Real-time Session Monitoring — sprawdzamy ważność sesji co 5 minut
  useEffect(() => {
    const handleUnauthorized = () => {
      setUserSession(null);
      setActiveTab('home');
    };

    window.addEventListener('soc_unauthorized_logout', handleUnauthorized);

    // Weryfikacja przy powrocie do zakładki (widoczność okna)
    const handleVisibilityChange = async () => {
      if (document.visibilityState === 'visible' && userSession) {
        const isValid = await verifyCurrentSession();
        if (!isValid) {
          setUserSession(null);
          setActiveTab('home');
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
          setActiveTab('home');
        }
      }, 5 * 60 * 1000);
    }

    return () => {
      window.removeEventListener('soc_unauthorized_logout', handleUnauthorized);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (intervalId) clearInterval(intervalId);
    };
  }, [userSession]);

  // Przechwytywanie przełączenia zakładki testowej -> pokazanie modala z zasadami tylko jeśli test nie trwał
  const handleTabChange = (tab: 'home' | 'no-ai' | 'with-ai' | 'test-results' | 'admin-users') => {
    if (tab === 'test-results' && userSession?.role !== 'Administrator') {
      setActiveTab('home');
      return;
    }
    if ((tab === 'no-ai' || tab === 'with-ai') && !testStartTime) {
      setPendingTab(tab);
      setIsRulesModalOpen(true);
    } else {
      if ((tab === 'no-ai' || tab === 'with-ai') && alerts.length < 10) {
        fetchTestSet().then(data => {
          if (data && data.length > 0) {
            const cleaned = cleanAlertStrings(data);
            setAlerts(cleaned);
            sessionStorage.setItem('soc_test_alerts', JSON.stringify(cleaned));
          }
        });
      }
      setActiveTab(tab);
    }
  };

  // Rozpoczęcie testu z poziomu modala zasad
  const handleStartTest = async () => {
    if (!pendingTab) return;
    setIsRulesModalOpen(false);
    setLoading(true);

    sessionStorage.removeItem('soc_test_alerts');
    sessionStorage.removeItem('soc_ai_auto_analysis_map');
    sessionStorage.removeItem('soc_ai_chat_messages_map');
    const testSet = await fetchTestSet();
    const cleaned = cleanAlertStrings(testSet);
    setAlerts(cleaned);
    sessionStorage.setItem('soc_test_alerts', JSON.stringify(cleaned));

    setHandledCount(0);
    sessionStorage.setItem('soc_test_handled_count', '0');

    setDecisions([]);
    sessionStorage.setItem('soc_test_decisions', JSON.stringify([]));

    const startTime = Date.now();
    setTestStartTime(startTime);
    sessionStorage.setItem('soc_test_start_time', String(startTime));

    const newSessionId = crypto.randomUUID();
    setTestSessionId(newSessionId);
    sessionStorage.setItem('soc_test_session_id', newSessionId);

    setActiveTab(pendingTab);
    sessionStorage.setItem('soc_active_tab', pendingTab);

    setLoading(false);
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
    sessionStorage.removeItem('soc_test_start_time');
    sessionStorage.removeItem('soc_test_session_id');
    sessionStorage.removeItem('soc_test_decisions');
    sessionStorage.removeItem('soc_test_handled_count');
    sessionStorage.removeItem('soc_ai_auto_analysis_map');
    sessionStorage.removeItem('soc_ai_chat_messages_map');
    setDecisions([]);
    setHandledCount(0);
    setTestStartTime(null);
    setTestSessionId(null);
    setActiveTab('home');
  };

  const handleCreateSampleAlert = async () => {
    const testSet = await fetchTestSet();
    setAlerts(testSet);
  };

  const handleActionTaken = async (alertId: string, actionName: string) => {
    setHandledCount(prev => prev + 1);

    const now = Date.now();
    const decisionTime = testStartTime ? Math.max(1, Math.round((now - testStartTime) / 1000)) : 10;

    const currentAlert = alerts.find(a => a.id === alertId);
    const newDecision = {
      alertId,
      actionTaken: actionName,
      decisionTimeSeconds: decisionTime,
      timestamp: new Date().toISOString(),
      isThreat: currentAlert?.isThreat ?? false,
      correctAction: currentAlert?.correctAction || '',
      category: currentAlert?.category || ''
    };

    const updatedDecisions = [...decisions, newDecision];
    setDecisions(updatedDecisions);

    await updateAlertStatus(alertId, 'Resolved');

    // Raport sesji zapisywany do MongoDB / AlertStore
    const durationTotal = testStartTime ? Math.round((now - testStartTime) / 1000) : 120;
    const currentSessionId = testSessionId || crypto.randomUUID();
    if (!testSessionId) {
      setTestSessionId(currentSessionId);
    }

    const session: TestSession = {
      sessionId: currentSessionId,
      operatorName: userSession?.username || 'SOC_Operator',
      mode: activeTab === 'no-ai' ? 'NoAI' : 'WithAI',
      startTime: testStartTime ? new Date(testStartTime).toISOString() : new Date().toISOString(),
      alertsHandledCount: updatedDecisions.length,
      totalDurationSeconds: durationTotal,
      decisions: updatedDecisions
    };
    await submitTestSession(session);
  };

  // Metrics calculation
  const totalAlerts = alerts.length;
  const criticalCount = alerts.filter(a => a.severity?.toLowerCase() === 'critical').length;
  const highCount = alerts.filter(a => a.severity?.toLowerCase() === 'high').length;
  const resolvedCount = handledCount;

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Header
        activeTab={activeTab}
        onTabChange={handleTabChange}
        userSession={userSession}
        onLogout={handleLogout}
      />

      {/* Modal z zasadami testu */}
      <TestRulesModal
        isOpen={isRulesModalOpen}
        testMode={pendingTab === 'with-ai' ? 'WithAI' : 'NoAI'}
        alertCount={totalAlerts}
        onStartTest={handleStartTest}
        onClose={() => setIsRulesModalOpen(false)}
      />

      <main className="soc-container" style={{ flex: 1 }}>
        {!userSession ? (
          <LoginPage onLoginSuccess={handleLoginSuccess} />
        ) : activeTab === 'admin-users' ? (
          <AdminUserPanel userSession={userSession} />
        ) : (activeTab === 'admin-questions' && userSession.role === 'Administrator') ? (
          <AdminQuestionsPage />
        ) : (activeTab === 'test-results' && userSession.role === 'Administrator') ? (
          <TestResultsPage userSession={userSession} />
        ) : (
          <>
            {activeTab !== 'home' && activeTab !== 'no-ai' && activeTab !== 'with-ai' && (
              <div className="stats-grid">
                <div className="stat-card">
                  <div>
                    <div className="stat-lbl">Wszystkie Alerty W Zestawie</div>
                    <div className="stat-val" style={{ color: '#ffffff' }}>{totalAlerts}</div>
                  </div>
                  <ShieldAlert size={28} color="#3b82f6" style={{ opacity: 0.8 }} />
                </div>

                <div className="stat-card">
                  <div>
                    <div className="stat-lbl">Krytyczne (Critical)</div>
                    <div className="stat-val" style={{ color: 'var(--severity-critical)' }}>{criticalCount}</div>
                  </div>
                  <AlertTriangle size={28} color="var(--severity-critical)" style={{ opacity: 0.8 }} />
                </div>

                <div className="stat-card">
                  <div>
                    <div className="stat-lbl">Wysokie (High)</div>
                    <div className="stat-val" style={{ color: 'var(--severity-high)' }}>{highCount}</div>
                  </div>
                  <Activity size={28} color="var(--severity-high)" style={{ opacity: 0.8 }} />
                </div>

                <div className="stat-card">
                  <div>
                    <div className="stat-lbl">Przeanalizowane Przez Operatora</div>
                    <div className="stat-val" style={{ color: 'var(--severity-low)' }}>{resolvedCount}</div>
                  </div>
                  <CheckCircle size={28} color="var(--severity-low)" style={{ opacity: 0.8 }} />
                </div>
              </div>
            )}

            {loading ? (
              <div style={{ padding: '4rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                <BarChart2 size={40} className="pulse-dot" style={{ margin: '0 auto 1rem auto' }} />
                <p>Ładowanie zestawu pytań testowych z bazy danych MongoDB...</p>
              </div>
            ) : activeTab === 'home' ? (
              <HomePage
                onNavigate={handleTabChange}
                alertCount={totalAlerts}
              />
            ) : activeTab === 'no-ai' ? (
              <NoAiTestView
                alerts={alerts}
                handledIds={decisions.map(d => d.alertId)}
                onAction={handleActionTaken}
                onNavigate={handleTabChange}
                userSession={userSession}
              />
            ) : (
              <AiTestView
                alerts={alerts}
                handledIds={decisions.map(d => d.alertId)}
                onAction={handleActionTaken}
                onNavigate={handleTabChange}
                userSession={userSession}
              />
            )}
          </>
        )}
      </main>

      <footer style={{
        background: 'rgba(15, 23, 42, 0.8)',
        borderTop: '1px solid var(--border-color)',
        padding: '1rem',
        textAlign: 'center',
        fontSize: '0.775rem',
        color: 'var(--text-dim)',
        marginTop: '2rem'
      }}>
        Magisterka SOC
      </footer>
    </div>
  );
};

export default App;
