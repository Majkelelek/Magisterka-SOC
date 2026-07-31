import React, { useEffect, useState } from 'react';
import { fetchTestSessions, fetchRegisteredUsers, deleteTestSession, deleteAllTestSessions, fetchTestSet } from '../services/api';
import type { UserSession } from '../types/alert';
import {
  BarChart2,
  User,
  ChevronDown,
  ChevronUp,
  Clock,
  RefreshCw,
  Bot,
  Eye,
  Award,
  Users,
  Activity,
  CheckCircle,
  XCircle,
  TrendingUp,
  Trash2,
  AlertTriangle
} from 'lucide-react';
import '../styles/TestResultsPage.css';

interface TestResultsPageProps {
  userSession: UserSession;
}

interface UserGroup {
  username: string;
  role: string;
  sessions: any[];
  totalSessionsCount: number;
  completedCount: number;
  totalDurationSeconds: number;
  totalDecisionsCount: number;
  totalCorrectDecisionsCount: number;
  overallAccuracy: number;
}

// Pomocnicza dynamiczna weryfikacja trafności decyzji operatora względem wzorca zestawu testowego
const checkDecisionAccuracy = (dOrAlertId: any, actionTakenArg?: string, alertsMap: Record<string, any> = {}) => {
  let alertId = '';
  let actionTaken = '';
  let decisionObj: any = null;

  if (typeof dOrAlertId === 'object' && dOrAlertId !== null) {
    decisionObj = dOrAlertId;
    alertId = dOrAlertId.alertId || dOrAlertId.AlertId || '';
    actionTaken = dOrAlertId.actionTaken || dOrAlertId.ActionTaken || '';
  } else {
    alertId = String(dOrAlertId || '');
    actionTaken = String(actionTakenArg || '');
  }

  const normId = alertId.toUpperCase().trim();
  const numMatch = normId.match(/\d+/);
  const num = numMatch ? parseInt(numMatch[0], 10) : 0;

  let matchedAlert = alertsMap[normId];
  if (!matchedAlert && num > 0) {
    matchedAlert = alertsMap[`ALT-${num.toString().padStart(3, '0')}`] || alertsMap[`ALT-${num}`] || alertsMap[`${num}`];
  }

  let isThreat = false;
  let rawCorrectAction = '';

  if (decisionObj && (decisionObj.isThreat !== undefined || decisionObj.IsThreat !== undefined)) {
    isThreat = decisionObj.isThreat ?? decisionObj.IsThreat;
    rawCorrectAction = decisionObj.correctAction || decisionObj.CorrectAction || '';
  } else if (matchedAlert) {
    isThreat = matchedAlert.isThreat ?? matchedAlert.IsThreat ?? false;
    rawCorrectAction = matchedAlert.correctAction || matchedAlert.CorrectAction || '';
  } else {
    // If not found in map yet, check if num matches
    isThreat = num > 0 ? (alertsMap[`ALT-${num}`]?.isThreat ?? false) : false;
  }

  let correctActionLabel = "Odrzucenie (Fałszywy Alarm)";
  let targetCategory = 'dismiss';

  if (!isThreat || rawCorrectAction.includes('Dismiss') || rawCorrectAction.includes('False')) {
    correctActionLabel = "Odrzucenie (Fałszywy Alarm)";
    targetCategory = 'dismiss';
  } else if (rawCorrectAction.includes('Investigate') || rawCorrectAction.includes('Password') || rawCorrectAction.includes('Hasło')) {
    correctActionLabel = "Badanie / Reset Hasła";
    targetCategory = 'investigate';
  } else if (rawCorrectAction.includes('Escalate') || rawCorrectAction.includes('Tier 2') || rawCorrectAction.includes('L2')) {
    correctActionLabel = "Eskalacja (Tier 2)";
    targetCategory = 'escalate';
  } else {
    correctActionLabel = "Izolacja Hosta / Blokada";
    targetCategory = 'isolate';
  }

  const actLower = (actionTaken || '').toLowerCase();
  let userCategory = 'unknown';

  if (actLower.includes('dismiss') || actLower.includes('odrzuć') || actLower.includes('zignoruj') || actLower.includes('false')) {
    userCategory = 'dismiss';
  } else if (actLower.includes('investigate') || actLower.includes('badaj') || actLower.includes('password') || actLower.includes('hasło') || actLower.includes('reset')) {
    userCategory = 'investigate';
  } else if (actLower.includes('escalate') || actLower.includes('eskaluj') || actLower.includes('tier 2') || actLower.includes('l2')) {
    userCategory = 'escalate';
  } else if (actLower.includes('isolate') || actLower.includes('izoluj') || actLower.includes('block') || actLower.includes('zablokuj')) {
    userCategory = 'isolate';
  }

  const isCorrect = (userCategory === targetCategory);

  return {
    correctActionLabel,
    isCorrect,
    isThreat
  };
};

export const TestResultsPage: React.FC<TestResultsPageProps> = ({ userSession }) => {
  const [rawTestSessions, setRawTestSessions] = useState<Array<any>>([]);
  const [registeredUsers, setRegisteredUsers] = useState<Array<any>>([]);
  const [alertsMap, setAlertsMap] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState<boolean>(true);

  // States for expandable accordions (domyślnie WSZYSTKO zwinięte: {})
  const [expandedUsers, setExpandedUsers] = useState<Record<string, boolean>>({});
  const [expandedSessions, setExpandedSessions] = useState<Record<string, boolean>>({});

  // Deletion state for Administrator
  const [sessionToDelete, setSessionToDelete] = useState<string | null>(null);
  const [showClearAllModal, setShowClearAllModal] = useState<boolean>(false);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

  const isAdmin = userSession?.role === 'Administrator';

  const loadData = async () => {
    setLoading(true);
    try {
      const [sessionsData, usersData, testAlerts] = await Promise.all([
        fetchTestSessions(),
        fetchRegisteredUsers(),
        fetchTestSet()
      ]);
      setRawTestSessions(sessionsData || []);
      setRegisteredUsers(usersData || []);

      if (Array.isArray(testAlerts)) {
        const aMap: Record<string, any> = {};
        testAlerts.forEach((a: any) => {
          if (a.id) {
            const rawId = String(a.id).toUpperCase().trim();
            aMap[rawId] = a;
            const numMatch = rawId.match(/\d+/);
            if (numMatch) {
              const num = parseInt(numMatch[0], 10);
              aMap[`ALT-${num}`] = a;
              aMap[`ALT-${num.toString().padStart(3, '0')}`] = a;
              aMap[`${num}`] = a;
            }
          }
        });
        setAlertsMap(aMap);
      }
    } catch (err) {
      console.error('Błąd podczas ładowania wyników testów:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteSingleSession = async (sessionId: string) => {
    if (!sessionId) return;
    setIsDeleting(true);
    try {
      const success = await deleteTestSession(sessionId);
      if (success) {
        await loadData();
      } else {
        alert('Błąd podczas usuwania sesji testowej.');
      }
    } catch (err) {
      console.error('Błąd podczas usuwania sesji:', err);
    } finally {
      setIsDeleting(false);
      setSessionToDelete(null);
    }
  };

  const handleDeleteAllSessions = async () => {
    setIsDeleting(true);
    try {
      const success = await deleteAllTestSessions();
      if (success) {
        await loadData();
      } else {
        alert('Błąd podczas czyszczenia bazy sesji.');
      }
    } catch (err) {
      console.error('Błąd podczas czyszczenia sesji:', err);
    } finally {
      setIsDeleting(false);
      setShowClearAllModal(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Helper do kondensacji pojedynczych zrzutów sesji (1 wiersz = 1 całe podejście)
  const getCondensedSessions = (sessionsList: Array<any>) => {
    if (!sessionsList || !Array.isArray(sessionsList)) return [];

    const map = new Map<string, any>();

    sessionsList.forEach((s) => {
      const operator = s.operatorName || s.OperatorName || 'Anonim';
      const mode = s.mode || s.Mode || 'NoAI';
      const startTime = s.startTime || s.StartTime || '';
      const sessionId = s.sessionId || s.SessionId;

      let key = sessionId;
      if (!key) {
        const dateKey = startTime ? new Date(startTime).toISOString().substring(0, 16) : 'unknown';
        key = `${operator}_${mode}_${dateKey}`;
      }

      const currentCount = s.alertsHandledCount || s.AlertsHandledCount || (s.decisions?.length || s.Decisions?.length || 0);
      const existing = map.get(key);

      if (!existing) {
        map.set(key, s);
      } else {
        const existingCount = existing.alertsHandledCount || existing.AlertsHandledCount || (existing.decisions?.length || existing.Decisions?.length || 0);
        if (currentCount >= existingCount) {
          map.set(key, s);
        }
      }
    });

    return Array.from(map.values()).sort((a, b) => {
      const tA = new Date(a.startTime || a.StartTime || 0).getTime();
      const tB = new Date(b.startTime || b.StartTime || 0).getTime();
      return tB - tA;
    });
  };

  const condensedAll = getCondensedSessions(rawTestSessions);

  // Tylko użytkownicy, którzy faktycznie ukończyli / wykonali sesje testowe + wyliczenia trafności
  const userGroups: UserGroup[] = React.useMemo(() => {
    const groupMap = new Map<string, UserGroup>();

    const roleLookup = new Map<string, string>();
    registeredUsers.forEach((u) => {
      const uname = u.username || u.Username;
      if (uname) roleLookup.set(uname.toLowerCase(), u.role || 'Użytkownik');
    });

    condensedAll.forEach((s) => {
      const operator = s.operatorName || s.OperatorName || 'Anonim';
      const normKey = operator.toLowerCase();

      if (!groupMap.has(normKey)) {
        groupMap.set(normKey, {
          username: operator,
          role: roleLookup.get(normKey) || 'Operator SOC',
          sessions: [],
          totalSessionsCount: 0,
          completedCount: 0,
          totalDurationSeconds: 0,
          totalDecisionsCount: 0,
          totalCorrectDecisionsCount: 0,
          overallAccuracy: 0
        });
      }

      const group = groupMap.get(normKey)!;
      group.sessions.push(s);
      group.totalSessionsCount += 1;

      const decisionsList = s.decisions || s.Decisions || [];
      const handled = s.alertsHandledCount || s.AlertsHandledCount || decisionsList.length;
      if (handled >= 30) {
        group.completedCount += 1;
      }
      group.totalDurationSeconds += (s.totalDurationSeconds || s.TotalDurationSeconds || 0);

      // Statystyki dokładności decyzji
      decisionsList.forEach((d: any) => {
        group.totalDecisionsCount += 1;
        const acc = checkDecisionAccuracy(d, undefined, alertsMap);
        if (acc.isCorrect) {
          group.totalCorrectDecisionsCount += 1;
        }
      });

      group.overallAccuracy = group.totalDecisionsCount > 0
        ? Math.round((group.totalCorrectDecisionsCount / group.totalDecisionsCount) * 100)
        : 0;
    });

    return Array.from(groupMap.values())
      .filter(g => g.sessions.length > 0)
      .sort((a, b) => b.sessions.length - a.sessions.length);
  }, [condensedAll, registeredUsers, alertsMap]);

  const toggleUserExpanded = (username: string) => {
    setExpandedUsers(prev => ({
      ...prev,
      [username]: !prev[username]
    }));
  };

  const toggleSessionExpanded = (sessionId: string) => {
    setExpandedSessions(prev => ({
      ...prev,
      [sessionId]: !prev[sessionId]
    }));
  };

  const formatDuration = (totalSec: number) => {
    if (!totalSec || totalSec <= 0) return '0 sek';
    if (totalSec < 60) return `${totalSec} sek`;
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    return `${mins} min ${secs} sek`;
  };

  const getActionBadge = (action: string) => {
    const act = (action || '').toLowerCase();
    if (act.includes('investigate') || act.includes('badaj') || act.includes('reset') || act.includes('hasło')) {
      return { label: 'Badanie / Reset Hasła', className: 'badge-action-investigate' };
    }
    if (act.includes('isolate') || act.includes('izoluj') || act.includes('block') || act.includes('zablokuj')) {
      return { label: 'Izolacja Hosta / Blokada', className: 'badge-action-isolate' };
    }
    if (act.includes('escalat') || act.includes('eskaluj') || act.includes('tier 2') || act.includes('l2')) {
      return { label: 'Eskalacja (Tier 2)', className: 'badge-action-escalate' };
    }
    return { label: 'Odrzucenie (Fałszywy Alarm)', className: 'badge-action-dismiss' };
  };

  // Statystyki porównawcze: Test 1 (Bez AI) vs Test 2 (Z AI)
  const statsComparison = React.useMemo(() => {
    const noAiSessions = condensedAll.filter(s => (s.mode || s.Mode) === 'NoAI');
    const withAiSessions = condensedAll.filter(s => (s.mode || s.Mode) === 'WithAI');

    const calcAccuracyAndSpeed = (sessions: any[]) => {
      let totalDecisions = 0;
      let correctDecisions = 0;
      let totalTimeSec = 0;
      let alertCountHandled = 0;

      sessions.forEach(s => {
        const decisions = s.decisions || s.Decisions || [];
        totalDecisions += decisions.length;
        decisions.forEach((d: any) => {
          const acc = checkDecisionAccuracy(d.alertId || d.AlertId, d.actionTaken || d.ActionTaken);
          if (acc.isCorrect) correctDecisions += 1;
        });

        const duration = s.totalDurationSeconds || s.TotalDurationSeconds || 0;
        const handled = s.alertsHandledCount || s.AlertsHandledCount || decisions.length;
        totalTimeSec += duration;
        alertCountHandled += handled;
      });

      const accuracyPct = totalDecisions > 0 ? Math.round((correctDecisions / totalDecisions) * 100) : 0;
      const avgSecPerAlert = alertCountHandled > 0 ? (totalTimeSec / alertCountHandled).toFixed(1) : '0';

      return {
        sessionCount: sessions.length,
        totalDecisions,
        correctDecisions,
        accuracyPct,
        avgSecPerAlert
      };
    };

    const noAiStats = calcAccuracyAndSpeed(noAiSessions);
    const withAiStats = calcAccuracyAndSpeed(withAiSessions);

    const accuracyDiff = withAiStats.accuracyPct - noAiStats.accuracyPct;
    const speedDiff = parseFloat(noAiStats.avgSecPerAlert) - parseFloat(withAiStats.avgSecPerAlert);

    return {
      noAi: noAiStats,
      withAi: withAiStats,
      accuracyDiff,
      speedDiff
    };
  }, [condensedAll]);

  // Statystyki podsumowujące
  const usersWithTestsCount = userGroups.length;
  const totalSessionsCount = condensedAll.length;

  return (
    <div className="test-results-wrapper">
      {/* Kompaktowy Nagłówek */}
      <div className="soc-card test-results-header-card">
        <div className="test-results-header-top">
          <div>
            <div className="test-results-badge-pill">
              <Award size={13} /> RAPORTY & ANALIZA TRAFNOŚCI DECYZJI OPERATORÓW
            </div>
            <h2 className="test-results-header-title">
              Wyniki Testów Badawczych i Trafność Akcji Operatorów ({usersWithTestsCount} Operatorów, {totalSessionsCount} Sesji)
            </h2>
            <p className="test-results-header-subtitle">
              Porównanie akcji operatorów z wzorcowymi odpowiedziami z bazy zdarzeń oraz ocena wpływu asystenta AI.
            </p>
          </div>

          <div className="test-results-header-actions">
            {isAdmin && totalSessionsCount > 0 && (
              <button
                onClick={() => setShowClearAllModal(true)}
                className="test-results-btn-clear"
              >
                <Trash2 size={13} /> Wyczyść Wszystkie Wyniki Testów
              </button>
            )}
            <button
              onClick={loadData}
              className="btn-action test-results-btn-refresh"
            >
              <RefreshCw size={13} /> Odśwież Dane
            </button>
          </div>
        </div>
      </div>

      {/* DEDYKOWANA SEKCJA PORÓWNAWCZA: Test 1 (Bez AI) vs Test 2 (Z AI) */}
      <div className="test-results-comparison-grid">
        {/* Test 1 (Bez AI) Card */}
        <div className="soc-card test-results-card-no-ai">
          <div className="test-results-card-header">
            <span className="test-results-card-title-no-ai">
              <Eye size={15} /> TEST 1: BEZ WSPARCIA AI
            </span>
            <span className="test-results-card-subtitle">{statsComparison.noAi.sessionCount} sesji</span>
          </div>
          <div className="test-results-card-body">
            <div>
              <div className="test-results-stat-value">{statsComparison.noAi.accuracyPct}%</div>
              <div className="test-results-stat-label">Średnia Trafność Decyzji</div>
            </div>
            <div className="test-results-stat-divider-box">
              <div className="test-results-stat-value-sub">~{statsComparison.noAi.avgSecPerAlert}s</div>
              <div className="test-results-stat-label">Śr. Czas / Alert</div>
            </div>
          </div>
        </div>

        {/* Test 2 (Z AI) Card */}
        <div className="soc-card test-results-card-with-ai">
          <div className="test-results-card-header">
            <span className="test-results-card-title-with-ai">
              <Bot size={15} /> TEST 2: Z ASYSTENTEM AI
            </span>
            <span className="test-results-card-subtitle">{statsComparison.withAi.sessionCount} sesji</span>
          </div>
          <div className="test-results-card-body">
            <div>
              <div className="test-results-stat-value-success">{statsComparison.withAi.accuracyPct}%</div>
              <div className="test-results-stat-label">Średnia Trafność Decyzji</div>
            </div>
            <div className="test-results-stat-divider-box">
              <div className="test-results-stat-value-info">~{statsComparison.withAi.avgSecPerAlert}s</div>
              <div className="test-results-stat-label">Śr. Czas / Alert</div>
            </div>
          </div>
        </div>

        {/* Efektywność AI Wpływ Badawczy */}
        <div className="soc-card test-results-impact-card">
          <div className="test-results-impact-title">
            <TrendingUp size={15} /> WPŁYW ASYSTENTA AI
          </div>
          <div className="test-results-impact-body">
            <div>
              <div className={`test-results-impact-value ${statsComparison.accuracyDiff >= 0 ? 'text-success-custom' : 'text-danger-custom'}`}>
                {statsComparison.accuracyDiff >= 0 ? `+${statsComparison.accuracyDiff}%` : `${statsComparison.accuracyDiff}%`}
              </div>
              <div className="test-results-stat-label">Wzrost Trafności</div>
            </div>
            <div className="test-results-impact-divider-box">
              <div className={`test-results-impact-value ${statsComparison.speedDiff >= 0 ? 'text-info-custom' : 'text-danger-custom'}`}>
                {statsComparison.speedDiff >= 0 ? `-${statsComparison.speedDiff.toFixed(1)}s` : `+${Math.abs(statsComparison.speedDiff).toFixed(1)}s`}
              </div>
              <div className="test-results-stat-label">Zmiana Czasu</div>
            </div>
          </div>
        </div>
      </div>

      {/* Lista Użytkowników z Testami */}
      {loading ? (
        <div className="test-results-loading-state">
          <BarChart2 size={32} className="pulse-dot test-results-icon-centered" />
          <p>Ładowanie skondensowanych wyników testów...</p>
        </div>
      ) : userGroups.length === 0 ? (
        <div className="soc-card test-results-empty-state">
          <Users size={36} className="test-results-icon-empty" />
          <h3 className="test-results-empty-title">Brak ukończonych sesji testowych w bazie</h3>
          <p className="test-results-empty-text">Przeprowadź test bez AI lub z AI, aby zapisać pierwsze wyniki.</p>
        </div>
      ) : (
        <div className="test-results-list">
          {userGroups.map((group) => {
            const isUserExpanded = !!expandedUsers[group.username];

            return (
              <div
                key={group.username}
                className={`soc-card test-results-user-card ${isUserExpanded ? 'expanded' : ''}`}
              >
                {/* Kompaktowy Pasek Nagłówkowy Użytkownika */}
                <div
                  onClick={() => toggleUserExpanded(group.username)}
                  className="test-results-user-card-header"
                >
                  <div className="test-results-user-info-left">
                    <div className="test-results-user-avatar">
                      <User size={18} />
                    </div>

                    <div>
                      <div className="test-results-user-title-row">
                        <h3 className="test-results-user-name">
                          Operator: {group.username}
                        </h3>
                        <span className={`test-results-user-role-badge ${group.role === 'Administrator' ? 'admin' : 'user'}`}>
                          {group.role}
                        </span>
                      </div>

                      <div className="test-results-user-summary-row">
                        <span>Sesje: <strong className="test-results-highlight-white">{group.totalSessionsCount}</strong></span>
                        <span>•</span>
                        <span>Ogólna Trafność: <strong className={group.overallAccuracy >= 80 ? 'text-success-custom' : group.overallAccuracy >= 60 ? 'text-warning-custom' : 'text-danger-custom'}>{group.overallAccuracy}% ({group.totalCorrectDecisionsCount}/{group.totalDecisionsCount})</strong></span>
                        <span>•</span>
                        <span>Łączny Czas: <strong className="test-results-highlight-slate">{formatDuration(group.totalDurationSeconds)}</strong></span>
                      </div>
                    </div>
                  </div>

                  <div className="test-results-user-info-right">
                    <button
                      type="button"
                      className={`btn-action test-results-user-expand-btn ${isUserExpanded ? 'expanded' : ''}`}
                    >
                      {isUserExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                      <span>{isUserExpanded ? 'Zwiń' : `Rozwiń (${group.sessions.length} sesji)`}</span>
                    </button>
                  </div>
                </div>

                {/* Rozwijana Tabela Wyników Użytkownika */}
                {isUserExpanded && (
                  <div className="test-results-user-details">
                    <div className="test-results-table-scroll">
                      <table className="test-results-table">
                        <thead>
                          <tr className="test-results-table-header-row">
                            <th className="test-results-th">#</th>
                            <th className="test-results-th">Tryb Testu</th>
                            <th className="test-results-th">Postęp</th>
                            <th className="test-results-th">Trafność Decyzji</th>
                            <th className="test-results-th">Czas Łączny</th>
                            <th className="test-results-th">Śr. Czas / Alert</th>
                            <th className="test-results-th">Data Rozpoczęcia</th>
                            <th className="test-results-th test-results-td-right">Decyzje</th>
                          </tr>
                        </thead>
                        <tbody>
                          {group.sessions.map((s, idx) => {
                            const mode = s.mode || s.Mode || 'NoAI';
                            const decisionsList = s.decisions || s.Decisions || [];
                            const handledCount = s.alertsHandledCount || s.AlertsHandledCount || decisionsList.length;
                            const durationSec = s.totalDurationSeconds || s.TotalDurationSeconds || 0;
                            const startTime = s.startTime || s.StartTime ? new Date(s.startTime || s.StartTime).toLocaleString() : 'N/A';
                            const sessionId = s.sessionId || s.SessionId || `${group.username}_session_${idx}`;
                            const isSessionExpanded = !!expandedSessions[sessionId];
                            const avgSecPerAlert = handledCount > 0 ? (durationSec / handledCount).toFixed(1) : '0';

                            // Obliczanie statystyk trafności dla sesji
                            let sessionCorrectCount = 0;
                            decisionsList.forEach((d: any) => {
                              const acc = checkDecisionAccuracy(d.alertId || d.AlertId, d.actionTaken || d.ActionTaken, alertsMap);
                              if (acc.isCorrect) sessionCorrectCount += 1;
                            });

                            const sessionAccuracyPct = decisionsList.length > 0
                              ? Math.round((sessionCorrectCount / decisionsList.length) * 100)
                              : 0;

                            return (
                              <React.Fragment key={sessionId}>
                                <tr className={`test-results-table-row ${isSessionExpanded ? 'expanded' : ''}`}>
                                  <td className="test-results-td-muted">
                                    {idx + 1}
                                  </td>
                                  <td className="test-results-td">
                                    <span className={`test-results-mode-badge ${mode === 'WithAI' ? 'with-ai' : 'no-ai'}`}>
                                      {mode === 'WithAI' ? <Bot size={12} /> : <Eye size={12} />}
                                      {mode === 'WithAI' ? 'Test 2 (Wsparcie AI)' : 'Test 1 (Bez AI)'}
                                    </span>
                                  </td>
                                  <td className="test-results-td">
                                    <div className="test-results-flex-align">
                                      <span className={`test-results-progress-text ${handledCount >= 75 ? 'text-success-custom' : 'text-primary-custom'}`}>
                                        {handledCount} / 75
                                      </span>
                                      {handledCount >= 75 ? (
                                        <span className="test-results-badge-success-small">
                                          Ukończony
                                        </span>
                                      ) : (
                                        <span className="test-results-badge-primary-small">
                                          W trakcie
                                        </span>
                                      )}
                                    </div>
                                  </td>
                                  <td className="test-results-td">
                                    <div className="test-results-flex-align">
                                      <span className={`test-results-accuracy-badge ${sessionAccuracyPct >= 80 ? 'bg-success-small' : sessionAccuracyPct >= 60 ? 'bg-warning-small' : 'bg-danger-small'}`}>
                                        {sessionAccuracyPct}%
                                      </span>
                                      <span className="test-results-text-muted-small">
                                        ({sessionCorrectCount}/{decisionsList.length})
                                      </span>
                                    </div>
                                  </td>
                                  <td className="test-results-td-highlight">
                                    <div className="test-results-flex-align-small">
                                      <Clock size={12} />
                                      <span>{formatDuration(durationSec)}</span>
                                    </div>
                                  </td>
                                  <td className="test-results-td-muted-small">
                                    ~{avgSecPerAlert}s / alert
                                  </td>
                                  <td className="test-results-td-muted-small">
                                    {startTime}
                                  </td>
                                  <td className="test-results-td-right">
                                    <div className="test-results-flex-right">
                                      <button
                                        onClick={() => toggleSessionExpanded(sessionId)}
                                        className={`btn-action test-results-session-expand-btn ${isSessionExpanded ? 'expanded' : ''}`}
                                      >
                                        {isSessionExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                                        <span>{isSessionExpanded ? 'Ukryj' : `Decyzje (${decisionsList.length})`}</span>
                                      </button>

                                      {isAdmin && (
                                        <button
                                          onClick={() => setSessionToDelete(sessionId)}
                                          title="Usuń tę sesję z bazy danych"
                                          className="test-results-btn-delete-session"
                                        >
                                          <Trash2 size={12} />
                                          <span>Usuń</span>
                                        </button>
                                      )}
                                    </div>
                                  </td>
                                </tr>

                                {/* Sub-Accordion dla Jednostkowych Decyzji z Porównaniem do Wzorca */}
                                {isSessionExpanded && (
                                  <tr>
                                    <td colSpan={8} className="test-results-nested-td">
                                      <div className="test-results-nested-container">
                                        <div className="test-results-nested-header">
                                          <h4 className="test-results-nested-title">
                                            <Activity size={13} /> Podjęte Decyzje Operatora z Porównaniem do Wzorca Odpowiedzi ({decisionsList.length} zdarzeń)
                                          </h4>
                                          <div className="test-results-nested-accuracy">
                                            Trafność sesji: <strong className={sessionAccuracyPct >= 80 ? 'text-success-custom' : 'text-danger-custom'}>{sessionAccuracyPct}%</strong>
                                          </div>
                                        </div>

                                        {decisionsList.length === 0 ? (
                                          <p className="test-results-nested-empty">Brak zarejestrowanych decyzji w tej sesji.</p>
                                        ) : (
                                          <table className="test-results-nested-table">
                                            <thead>
                                              <tr className="test-results-nested-th-row">
                                                <th className="test-results-nested-th">#</th>
                                                <th className="test-results-nested-th">ID Alertu</th>
                                                <th className="test-results-nested-th">Typ Ataku / Zdarzenia</th>
                                                <th className="test-results-nested-th">Podjęta Akcja Operatora</th>
                                                <th className="test-results-nested-th">Prawidłowa Odpowiedź (Wzorzec)</th>
                                                <th className="test-results-nested-th">Ocena Decyzji</th>
                                                <th className="test-results-nested-th">Czas Reakcji</th>
                                                <th className="test-results-nested-th">Znacznik Czasu</th>
                                              </tr>
                                            </thead>
                                            <tbody>
                                              {decisionsList.map((d: any, dIdx: number) => {
                                                const alertId = d.alertId || d.AlertId;
                                                const actionTaken = d.actionTaken || d.ActionTaken;
                                                const badge = getActionBadge(actionTaken);
                                                const evalAccuracy = checkDecisionAccuracy(d, undefined, alertsMap);
                                                const categoryLabel = d.category || d.Category || alertsMap[String(alertId).toUpperCase().trim()]?.category || '–';
                                                const isThreatRow = evalAccuracy.isThreat;

                                                return (
                                                  <tr key={dIdx} className={`test-results-nested-tr ${evalAccuracy.isCorrect ? 'correct' : 'incorrect'}`}>
                                                    <td className="test-results-nested-td-muted">{dIdx + 1}</td>
                                                    <td className="test-results-nested-td-highlight">{alertId}</td>
                                                    <td className="test-results-nested-td-cell">
                                                      <span className={`test-results-category-badge ${isThreatRow ? 'threat' : 'no-threat'}`}>
                                                        {categoryLabel}
                                                      </span>
                                                    </td>
                                                    <td className="test-results-nested-td-cell">
                                                      <span className={badge.className}>
                                                        {badge.label}
                                                      </span>
                                                    </td>
                                                    <td className="test-results-nested-td-cell">
                                                      <span className="test-results-correct-action-badge">
                                                        {evalAccuracy.correctActionLabel}
                                                      </span>
                                                    </td>
                                                    <td className="test-results-nested-td-cell">
                                                      {evalAccuracy.isCorrect ? (
                                                        <span className="test-results-eval-correct-badge">
                                                          <CheckCircle size={11} /> POPRAWNA
                                                        </span>
                                                      ) : (
                                                        <span className="test-results-eval-incorrect-badge">
                                                          <XCircle size={11} /> BŁĘDNA
                                                        </span>
                                                      )}
                                                    </td>
                                                    <td className="test-results-nested-td-highlight-slate">
                                                      {d.decisionTimeSeconds || d.DecisionTimeSeconds || 0}s
                                                    </td>
                                                    <td className="test-results-nested-td-muted-small">
                                                      {d.timestamp || d.Timestamp ? new Date(d.timestamp || d.Timestamp).toLocaleTimeString() : 'N/A'}
                                                    </td>
                                                  </tr>
                                                );
                                              })}
                                            </tbody>
                                          </table>
                                        )}
                                      </div>
                                    </td>
                                  </tr>
                                )}
                              </React.Fragment>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Modal Potwierdzenia Usuwania Pojedynczej Sesji */}
      {sessionToDelete && (
        <div className="test-results-modal-overlay">
          <div className="test-results-modal-content modal-delete">
            <div className="test-results-modal-header">
              <div className="test-results-modal-icon-wrapper-delete">
                <AlertTriangle size={24} color="#f87171" />
              </div>
              <div>
                <h3 className="test-results-modal-title">
                  Potwierdź Usunięcie Sesji Testowej
                </h3>
                <span className="test-results-modal-subtitle-muted">Operacja wymaga uprawnień Administratora</span>
              </div>
            </div>

            <p className="test-results-modal-text">
              Czy na pewno chcesz usunąć wybraną sesję testową z bazy danych? Ta czynność nieodwracalnie usunie podjęte decyzje oraz wynik czasowy tej próby.
            </p>

            <div className="test-results-modal-actions">
              <button
                onClick={() => setSessionToDelete(null)}
                disabled={isDeleting}
                className="test-results-modal-btn-cancel"
              >
                Anuluj
              </button>
              <button
                onClick={() => handleDeleteSingleSession(sessionToDelete)}
                disabled={isDeleting}
                className="test-results-modal-btn-confirm-delete"
              >
                <Trash2 size={16} /> {isDeleting ? 'Usuwanie...' : 'Usuń Sesję'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Potwierdzenia Czyszczenia Wszystkich Sesji */}
      {showClearAllModal && (
        <div className="test-results-modal-overlay">
          <div className="test-results-modal-content modal-clear-all">
            <div className="test-results-modal-header">
              <div className="test-results-modal-icon-wrapper-clear-all">
                <AlertTriangle size={28} color="#ef4444" />
              </div>
              <div>
                <h3 className="test-results-modal-title">
                  Wyczyścić WSZYSTKIE Wyniki Testów?
                </h3>
                <span className="test-results-modal-subtitle-danger">OSTRZEŻENIE: Całkowite czyszczenie bazy wyników</span>
              </div>
            </div>

            <p className="test-results-modal-text">
              Czy na pewno chcesz <strong>usunąć wszystkie wyniki testów ({totalSessionsCount} sesji)</strong> ze wszystkich kont użytkowników z bazy danych? Wszystkie zapamiętane podejścia, wskaźniki dokładności i statystyki czasowe zostaną bezpowrotnie skasowane.
            </p>

            <div className="test-results-modal-actions">
              <button
                onClick={() => setShowClearAllModal(false)}
                disabled={isDeleting}
                className="test-results-modal-btn-cancel"
              >
                Anuluj
              </button>
              <button
                onClick={handleDeleteAllSessions}
                disabled={isDeleting}
                className="test-results-modal-btn-confirm-clear-all"
              >
                <Trash2 size={16} /> {isDeleting ? 'Usuwanie...' : 'Tak, Wyczyść Wszystkie Wyniki'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
