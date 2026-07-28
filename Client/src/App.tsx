import React, { useEffect, useState } from 'react';
import './styles/soc-theme.css';
import type { Alert, TestSession, UserSession } from './types/alert';
import { fetchAlerts, fetchTestSet, updateAlertStatus, submitTestSession, logoutUser, verifyCurrentSession } from './services/api';
import { Header } from './components/Header';
import { HomePage } from './components/HomePage';
import { NoAiTestView } from './components/NoAiTestView';
import { AiTestView } from './components/AiTestView';
import { LoginPage } from './components/LoginPage';
import { AdminUserPanel } from './components/AdminUserPanel';
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

  const [activeTab, setActiveTab] = useState<'home' | 'no-ai' | 'with-ai' | 'admin-users'>('home');
  const [pendingTab, setPendingTab] = useState<'no-ai' | 'with-ai' | null>(null);
  const [isRulesModalOpen, setIsRulesModalOpen] = useState<boolean>(false);
  const [testStartTime, setTestStartTime] = useState<number | null>(null);

  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [handledCount, setHandledCount] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [decisions, setDecisions] = useState<Array<{ alertId: string; actionTaken: string; decisionTimeSeconds: number; timestamp: string }>>([]);

  const loadData = async () => {
    setLoading(true);
    const data = await fetchAlerts();
    setAlerts(data);
    setLoading(false);
  };

  useEffect(() => {
    if (userSession) {
      loadData();
    }
  }, [userSession]);

  // Real-time Session Monitoring
  useEffect(() => {
    const handleUnauthorized = () => {
      setUserSession(null);
      setActiveTab('home');
    };

    window.addEventListener('soc_unauthorized_logout', handleUnauthorized);

    let intervalId: any = null;
    if (userSession) {
      intervalId = setInterval(async () => {
        const isValid = await verifyCurrentSession();
        if (!isValid) {
          setUserSession(null);
          setActiveTab('home');
        }
      }, 3000);
    }

    return () => {
      window.removeEventListener('soc_unauthorized_logout', handleUnauthorized);
      if (intervalId) clearInterval(intervalId);
    };
  }, [userSession]);

  // Przechwytywanie przełączenia zakładki testowej -> pokazanie modala z zasadami
  const handleTabChange = (tab: 'home' | 'no-ai' | 'with-ai' | 'admin-users') => {
    if (tab === 'no-ai' || tab === 'with-ai') {
      setPendingTab(tab);
      setIsRulesModalOpen(true);
    } else {
      setActiveTab(tab);
    }
  };

  // Rozpoczęcie testu z poziomu modala zasady
  const handleStartTest = async () => {
    if (!pendingTab) return;
    setIsRulesModalOpen(false);
    setLoading(true);

    // Pobranie 30 ustandaryzowanych zdarzeń z pliku wls_test_pytania.json
    const testSet = await fetchTestSet();
    setAlerts(testSet);
    setHandledCount(0);
    setDecisions([]);
    setTestStartTime(Date.now());
    setActiveTab(pendingTab);
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

    const newDecision = {
      alertId,
      actionTaken: actionName,
      decisionTimeSeconds: decisionTime,
      timestamp: new Date().toISOString()
    };

    const updatedDecisions = [...decisions, newDecision];
    setDecisions(updatedDecisions);

    await updateAlertStatus(alertId, 'Resolved');

    // Raport sesji zapisywany do MongoDB / AlertStore
    const durationTotal = testStartTime ? Math.round((now - testStartTime) / 1000) : 120;
    const session: TestSession = {
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
        handledCount={handledCount}
        userSession={userSession}
        onLogout={handleLogout}
      />

      {/* Modal z zasadami testu */}
      <TestRulesModal
        isOpen={isRulesModalOpen}
        testMode={pendingTab === 'with-ai' ? 'WithAI' : 'NoAI'}
        onStartTest={handleStartTest}
        onClose={() => setIsRulesModalOpen(false)}
      />

      <main className="soc-container" style={{ flex: 1 }}>
        {!userSession ? (
          <LoginPage onLoginSuccess={handleLoginSuccess} />
        ) : activeTab === 'admin-users' ? (
          <AdminUserPanel userSession={userSession} />
        ) : (
          <>
            {activeTab !== 'home' && (
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
                <p>Ładowanie zestawu pytań testowych z pliku wls_test_pytania.json...</p>
              </div>
            ) : activeTab === 'home' ? (
              <HomePage
                onNavigate={handleTabChange}
                alertCount={totalAlerts}
              />
            ) : activeTab === 'no-ai' ? (
              <NoAiTestView
                alerts={alerts}
                onActionTaken={handleActionTaken}
                onAddSampleAlert={handleCreateSampleAlert}
                onFinishTest={() => console.log('Test 1 Zakończony')}
              />
            ) : (
              <AiTestView
                alerts={alerts}
                onActionTaken={handleActionTaken}
                onAddSampleAlert={handleCreateSampleAlert}
                onFinishTest={() => console.log('Test 2 Zakończony')}
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
        SOC Operator Evaluation System &copy; 2026 | ASP.NET Core + MongoDB Atlas + React | Laboratorium Badawcze MGR
      </footer>
    </div>
  );
};

export default App;
