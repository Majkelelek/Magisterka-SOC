import React, { useEffect, useState } from 'react';
import { fetchTestSessions, fetchRegisteredUsers } from '../services/api';
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
  TrendingUp
} from 'lucide-react';

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

// Baza wiedzy - Wzorce poprawnych odpowiedzi dla 30 alertów badawczych z wls_test_pytania.json
const GROUND_TRUTH: Record<string, { isThreat: boolean; correctActionLabel: string; allowedKeywords: string[] }> = {
  "TEST-ALT-001": { isThreat: true, correctActionLabel: "Izolacja Hosta / Blokada", allowedKeywords: ["isolate", "izoluj", "block", "zablokuj"] },
  "TEST-ALT-002": { isThreat: false, correctActionLabel: "Odrzucenie (Fałszywy Alarm)", allowedKeywords: ["dismiss", "odrzuć", "odrzucenie"] },
  "TEST-ALT-003": { isThreat: false, correctActionLabel: "Odrzucenie (Fałszywy Alarm)", allowedKeywords: ["dismiss", "odrzuć", "odrzucenie"] },
  "TEST-ALT-004": { isThreat: false, correctActionLabel: "Odrzucenie (Fałszywy Alarm)", allowedKeywords: ["dismiss", "odrzuć", "odrzucenie"] },
  "TEST-ALT-005": { isThreat: true, correctActionLabel: "Eskalacja / Analiza", allowedKeywords: ["escalat", "eskaluj", "isolate", "izoluj"] },
  "TEST-ALT-006": { isThreat: true, correctActionLabel: "Izolacja Hosta / Blokada", allowedKeywords: ["isolate", "izoluj", "block", "zablokuj"] },
  "TEST-ALT-007": { isThreat: true, correctActionLabel: "Eskalacja / Analiza", allowedKeywords: ["escalat", "eskaluj", "block", "zablokuj"] },
  "TEST-ALT-008": { isThreat: false, correctActionLabel: "Odrzucenie (Fałszywy Alarm)", allowedKeywords: ["dismiss", "odrzuć", "odrzucenie"] },
  "TEST-ALT-009": { isThreat: true, correctActionLabel: "Izolacja Hosta / Blokada", allowedKeywords: ["isolate", "izoluj", "block", "zablokuj"] },
  "TEST-ALT-010": { isThreat: false, correctActionLabel: "Odrzucenie (Fałszywy Alarm)", allowedKeywords: ["dismiss", "odrzuć", "odrzucenie"] },
  "TEST-ALT-011": { isThreat: true, correctActionLabel: "Eskalacja / Blokada", allowedKeywords: ["escalat", "eskaluj", "block", "zablokuj"] },
  "TEST-ALT-012": { isThreat: false, correctActionLabel: "Odrzucenie (Fałszywy Alarm)", allowedKeywords: ["dismiss", "odrzuć", "odrzucenie"] },
  "TEST-ALT-013": { isThreat: true, correctActionLabel: "Izolacja Hosta / Blokada", allowedKeywords: ["isolate", "izoluj", "block", "zablokuj"] },
  "TEST-ALT-014": { isThreat: false, correctActionLabel: "Odrzucenie (Fałszywy Alarm)", allowedKeywords: ["dismiss", "odrzuć", "odrzucenie"] },
  "TEST-ALT-015": { isThreat: true, correctActionLabel: "Izolacja Hosta / Blokada", allowedKeywords: ["isolate", "izoluj", "block", "zablokuj"] },
  "TEST-ALT-016": { isThreat: false, correctActionLabel: "Odrzucenie (Fałszywy Alarm)", allowedKeywords: ["dismiss", "odrzuć", "odrzucenie"] },
  "TEST-ALT-017": { isThreat: true, correctActionLabel: "Izolacja Hosta / Blokada", allowedKeywords: ["isolate", "izoluj", "block", "zablokuj"] },
  "TEST-ALT-018": { isThreat: false, correctActionLabel: "Odrzucenie (Fałszywy Alarm)", allowedKeywords: ["dismiss", "odrzuć", "odrzucenie"] },
  "TEST-ALT-019": { isThreat: true, correctActionLabel: "Eskalacja / Izolacja", allowedKeywords: ["escalat", "eskaluj", "isolate", "izoluj"] },
  "TEST-ALT-020": { isThreat: false, correctActionLabel: "Odrzucenie (Fałszywy Alarm)", allowedKeywords: ["dismiss", "odrzuć", "odrzucenie"] },
  "TEST-ALT-021": { isThreat: true, correctActionLabel: "Izolacja Hosta / Blokada", allowedKeywords: ["isolate", "izoluj", "block", "zablokuj"] },
  "TEST-ALT-022": { isThreat: false, correctActionLabel: "Odrzucenie (Fałszywy Alarm)", allowedKeywords: ["dismiss", "odrzuć", "odrzucenie"] },
  "TEST-ALT-023": { isThreat: true, correctActionLabel: "Izolacja Hosta / Blokada", allowedKeywords: ["isolate", "izoluj", "block", "zablokuj"] },
  "TEST-ALT-024": { isThreat: false, correctActionLabel: "Odrzucenie (Fałszywy Alarm)", allowedKeywords: ["dismiss", "odrzuć", "odrzucenie"] },
  "TEST-ALT-025": { isThreat: true, correctActionLabel: "Izolacja Hosta / Blokada", allowedKeywords: ["isolate", "izoluj", "block", "zablokuj"] },
  "TEST-ALT-026": { isThreat: false, correctActionLabel: "Odrzucenie (Fałszywy Alarm)", allowedKeywords: ["dismiss", "odrzuć", "odrzucenie"] },
  "TEST-ALT-027": { isThreat: true, correctActionLabel: "Izolacja Hosta / Blokada", allowedKeywords: ["isolate", "izoluj", "block", "zablokuj"] },
  "TEST-ALT-028": { isThreat: false, correctActionLabel: "Odrzucenie (Fałszywy Alarm)", allowedKeywords: ["dismiss", "odrzuć", "odrzucenie"] },
  "TEST-ALT-029": { isThreat: true, correctActionLabel: "Izolacja Hosta / Blokada", allowedKeywords: ["isolate", "izoluj", "block", "zablokuj"] },
  "TEST-ALT-030": { isThreat: false, correctActionLabel: "Odrzucenie (Fałszywy Alarm)", allowedKeywords: ["dismiss", "odrzuć", "odrzucenie"] }
};

// Pomocnicza weryfikacja trafności decyzji operatora względem wzorca
const checkDecisionAccuracy = (alertId: string, actionTaken: string) => {
  const normId = (alertId || '').toUpperCase().trim();
  let matchKey = normId;

  if (/^\d+$/.test(normId)) {
    const num = parseInt(normId, 10);
    matchKey = `TEST-ALT-${num.toString().padStart(3, '0')}`;
  } else if (!normId.startsWith('TEST-ALT-')) {
    const numMatch = normId.match(/\d+/);
    if (numMatch) {
      const num = parseInt(numMatch[0], 10);
      matchKey = `TEST-ALT-${num.toString().padStart(3, '0')}`;
    }
  }

  const truth = GROUND_TRUTH[matchKey];
  if (!truth) {
    return {
      correctActionLabel: 'N/A',
      isCorrect: true,
      isThreat: false
    };
  }

  const actionLower = (actionTaken || '').toLowerCase();
  const isCorrect = truth.allowedKeywords.some(kw => actionLower.includes(kw));

  return {
    correctActionLabel: truth.correctActionLabel,
    isCorrect,
    isThreat: truth.isThreat
  };
};

export const TestResultsPage: React.FC<TestResultsPageProps> = () => {
  const [rawTestSessions, setRawTestSessions] = useState<Array<any>>([]);
  const [registeredUsers, setRegisteredUsers] = useState<Array<any>>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // States for expandable accordions (domyślnie WSZYSTKO zwinięte: {})
  const [expandedUsers, setExpandedUsers] = useState<Record<string, boolean>>({});
  const [expandedSessions, setExpandedSessions] = useState<Record<string, boolean>>({});

  const loadData = async () => {
    setLoading(true);
    try {
      const [sessionsData, usersData] = await Promise.all([
        fetchTestSessions(),
        fetchRegisteredUsers()
      ]);
      setRawTestSessions(sessionsData || []);
      setRegisteredUsers(usersData || []);
    } catch (err) {
      console.error('Błąd podczas ładowania wyników testów:', err);
    } finally {
      setLoading(false);
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
        const acc = checkDecisionAccuracy(d.alertId || d.AlertId, d.actionTaken || d.ActionTaken);
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
  }, [condensedAll, registeredUsers]);

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
    if (act.includes('isolate') || act.includes('izoluj')) {
      return { label: 'Izolacja Hosta', bg: 'rgba(239, 68, 68, 0.2)', color: '#f87171' };
    }
    if (act.includes('block') || act.includes('zablokuj')) {
      return { label: 'Blokada IP', bg: 'rgba(245, 158, 11, 0.2)', color: '#fbbf24' };
    }
    if (act.includes('escalat') || act.includes('eskaluj')) {
      return { label: 'Eskalacja', bg: 'rgba(168, 85, 247, 0.2)', color: '#c084fc' };
    }
    return { label: 'Odrzucenie (Dismiss)', bg: 'rgba(100, 116, 139, 0.2)', color: '#94a3b8' };
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
    <div style={{ width: '100%', maxWidth: '1400px', margin: '0 auto', padding: '1rem 0' }}>
      {/* Kompaktowy Nagłówek */}
      <div className="soc-card" style={{
        padding: '1.1rem 1.5rem',
        marginBottom: '1.25rem',
        background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.95), rgba(7, 10, 18, 0.98))',
        border: '1px solid rgba(168, 85, 247, 0.3)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', background: 'rgba(168, 85, 247, 0.12)', color: '#c084fc', padding: '0.15rem 0.6rem', borderRadius: '12px', fontSize: '0.7rem', fontWeight: 600, marginBottom: '0.3rem' }}>
              <Award size={13} /> RAPORTY & ANALIZA TRAFNOŚCI DECYZJI OPERATORÓW
            </div>
            <h2 style={{ fontSize: '1.35rem', fontWeight: 800, color: '#ffffff', margin: 0 }}>
              Wyniki Testów Badawczych i Trafność Akcji Operatorów ({usersWithTestsCount} Operatorów, {totalSessionsCount} Sesji)
            </h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: '0.2rem', margin: 0 }}>
              Porównanie akcji operatorów z wzorcowymi odpowiedziami z pliku wls_test_pytania.json oraz ocena wpływu asystenta AI.
            </p>
          </div>

          <button
            onClick={loadData}
            className="btn-action"
            style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.775rem', padding: '0.35rem 0.75rem' }}
          >
            <RefreshCw size={13} /> Odśwież Dane
          </button>
        </div>
      </div>

      {/* DEDYKOWANA SEKCJA PORÓWNAWCZA: Test 1 (Bez AI) vs Test 2 (Z AI) */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', 
        gap: '1rem', 
        marginBottom: '1.25rem' 
      }}>
        {/* Test 1 (Bez AI) Card */}
        <div className="soc-card" style={{ padding: '1rem 1.25rem', border: '1px solid rgba(59, 130, 246, 0.3)', background: 'rgba(15, 23, 42, 0.6)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#60a5fa', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Eye size={15} /> TEST 1: BEZ WSPARCIA AI
            </span>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{statsComparison.noAi.sessionCount} sesji</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '12px' }}>
            <div>
              <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#ffffff' }}>{statsComparison.noAi.accuracyPct}%</div>
              <div style={{ fontSize: '0.725rem', color: 'var(--text-muted)' }}>Średnia Trafność Decyzji</div>
            </div>
            <div style={{ borderLeft: '1px solid var(--border-color)', paddingLeft: '12px' }}>
              <div style={{ fontSize: '1.2rem', fontWeight: 700, color: '#cbd5e1' }}>~{statsComparison.noAi.avgSecPerAlert}s</div>
              <div style={{ fontSize: '0.725rem', color: 'var(--text-muted)' }}>Śr. Czas / Alert</div>
            </div>
          </div>
        </div>

        {/* Test 2 (Z AI) Card */}
        <div className="soc-card" style={{ padding: '1rem 1.25rem', border: '1px solid rgba(168, 85, 247, 0.3)', background: 'rgba(15, 23, 42, 0.6)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#c084fc', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Bot size={15} /> TEST 2: Z ASYSTENTEM AI
            </span>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{statsComparison.withAi.sessionCount} sesji</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '12px' }}>
            <div>
              <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#34d399' }}>{statsComparison.withAi.accuracyPct}%</div>
              <div style={{ fontSize: '0.725rem', color: 'var(--text-muted)' }}>Średnia Trafność Decyzji</div>
            </div>
            <div style={{ borderLeft: '1px solid var(--border-color)', paddingLeft: '12px' }}>
              <div style={{ fontSize: '1.2rem', fontWeight: 700, color: '#38bdf8' }}>~{statsComparison.withAi.avgSecPerAlert}s</div>
              <div style={{ fontSize: '0.725rem', color: 'var(--text-muted)' }}>Śr. Czas / Alert</div>
            </div>
          </div>
        </div>

        {/* Efektywność AI Wpływ Badawczy */}
        <div className="soc-card" style={{ padding: '1rem 1.25rem', border: '1px solid rgba(56, 189, 248, 0.4)', background: 'linear-gradient(135deg, rgba(14, 165, 233, 0.1), rgba(168, 85, 247, 0.1))' }}>
          <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--ai-cyan)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <TrendingUp size={15} /> WPŁYW ASYSTENTA AI
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div>
              <div style={{ 
                fontSize: '1.2rem', 
                fontWeight: 800, 
                color: statsComparison.accuracyDiff >= 0 ? '#34d399' : '#f87171' 
              }}>
                {statsComparison.accuracyDiff >= 0 ? `+${statsComparison.accuracyDiff}%` : `${statsComparison.accuracyDiff}%`}
              </div>
              <div style={{ fontSize: '0.725rem', color: 'var(--text-muted)' }}>Wzrost Trafności</div>
            </div>
            <div style={{ borderLeft: '1px solid var(--border-color)', paddingLeft: '16px' }}>
              <div style={{ 
                fontSize: '1.2rem', 
                fontWeight: 800, 
                color: statsComparison.speedDiff >= 0 ? '#38bdf8' : '#f87171' 
              }}>
                {statsComparison.speedDiff >= 0 ? `-${statsComparison.speedDiff.toFixed(1)}s` : `+${Math.abs(statsComparison.speedDiff).toFixed(1)}s`}
              </div>
              <div style={{ fontSize: '0.725rem', color: 'var(--text-muted)' }}>Zmiana Czasu</div>
            </div>
          </div>
        </div>
      </div>

      {/* Lista Użytkowników z Testami */}
      {loading ? (
        <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
          <BarChart2 size={32} className="pulse-dot" style={{ margin: '0 auto 0.75rem auto' }} />
          <p style={{ fontSize: '0.85rem' }}>Ładowanie skondensowanych wyników testów...</p>
        </div>
      ) : userGroups.length === 0 ? (
        <div className="soc-card" style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--text-muted)' }}>
          <Users size={36} style={{ margin: '0 auto 0.75rem auto', opacity: 0.5 }} />
          <h3 style={{ fontSize: '1rem' }}>Brak ukończonych sesji testowych w bazie</h3>
          <p style={{ fontSize: '0.825rem', marginTop: '0.35rem' }}>Przeprowadź test bez AI lub z AI, aby zapisać pierwsze wyniki.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {userGroups.map((group) => {
            const isUserExpanded = !!expandedUsers[group.username];

            return (
              <div 
                key={group.username} 
                className="soc-card" 
                style={{ 
                  padding: '0.85rem 1.25rem',
                  border: isUserExpanded ? '1px solid rgba(56, 189, 248, 0.4)' : '1px solid var(--border-color)',
                  transition: 'all 0.15s ease'
                }}
              >
                {/* Kompaktowy Pasek Nagłówkowy Użytkownika */}
                <div 
                  onClick={() => toggleUserExpanded(group.username)}
                  style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'space-between', 
                    cursor: 'pointer',
                    userSelect: 'none'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ 
                      width: '36px', 
                      height: '36px', 
                      borderRadius: '8px', 
                      background: 'rgba(56, 189, 248, 0.15)', 
                      border: '1px solid rgba(56, 189, 248, 0.3)',
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'center',
                      color: 'var(--ai-cyan)'
                    }}>
                      <User size={18} />
                    </div>

                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <h3 style={{ fontSize: '0.975rem', fontWeight: 800, color: '#ffffff', margin: 0 }}>
                          Operator: {group.username}
                        </h3>
                        <span style={{
                          padding: '0.1rem 0.45rem',
                          borderRadius: '8px',
                          fontSize: '0.65rem',
                          fontWeight: 700,
                          background: group.role === 'Administrator' ? 'rgba(139, 92, 246, 0.18)' : 'rgba(59, 130, 246, 0.18)',
                          color: group.role === 'Administrator' ? '#c084fc' : '#60a5fa',
                          border: group.role === 'Administrator' ? '1px solid rgba(139, 92, 246, 0.35)' : '1px solid rgba(59, 130, 246, 0.35)'
                        }}>
                          {group.role}
                        </span>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
                        <span>Sesje: <strong style={{ color: '#ffffff' }}>{group.totalSessionsCount}</strong></span>
                        <span>•</span>
                        <span>Ogólna Trafność: <strong style={{ color: group.overallAccuracy >= 80 ? '#34d399' : group.overallAccuracy >= 60 ? '#fbbf24' : '#f87171' }}>{group.overallAccuracy}% ({group.totalCorrectDecisionsCount}/{group.totalDecisionsCount})</strong></span>
                        <span>•</span>
                        <span>Łączny Czas: <strong style={{ color: '#cbd5e1' }}>{formatDuration(group.totalDurationSeconds)}</strong></span>
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <button
                      type="button"
                      className="btn-action"
                      style={{
                        padding: '0.3rem 0.65rem',
                        fontSize: '0.75rem',
                        background: isUserExpanded ? 'rgba(56, 189, 248, 0.2)' : 'rgba(30, 41, 59, 0.8)',
                        color: isUserExpanded ? 'var(--ai-cyan)' : 'var(--text-muted)',
                        border: '1px solid var(--border-color)',
                        pointerEvents: 'none',
                        borderRadius: '6px'
                      }}
                    >
                      {isUserExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                      <span>{isUserExpanded ? 'Zwiń' : `Rozwiń (${group.sessions.length} sesji)`}</span>
                    </button>
                  </div>
                </div>

                {/* Rozwijana Tabela Wyników Użytkownika */}
                {isUserExpanded && (
                  <div style={{ marginTop: '0.85rem', paddingTop: '0.85rem', borderTop: '1px solid var(--border-color)' }}>
                    <div style={{ overflowX: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.775rem', textAlign: 'left' }}>
                        <thead>
                          <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>
                            <th style={{ padding: '0.45rem 0.65rem' }}>#</th>
                            <th style={{ padding: '0.45rem 0.65rem' }}>Tryb Testu</th>
                            <th style={{ padding: '0.45rem 0.65rem' }}>Postęp</th>
                            <th style={{ padding: '0.45rem 0.65rem' }}>Trafność Decyzji</th>
                            <th style={{ padding: '0.45rem 0.65rem' }}>Czas Łączny</th>
                            <th style={{ padding: '0.45rem 0.65rem' }}>Śr. Czas / Alert</th>
                            <th style={{ padding: '0.45rem 0.65rem' }}>Data Rozpoczęcia</th>
                            <th style={{ padding: '0.45rem 0.65rem', textAlign: 'right' }}>Decyzje</th>
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
                              const acc = checkDecisionAccuracy(d.alertId || d.AlertId, d.actionTaken || d.ActionTaken);
                              if (acc.isCorrect) sessionCorrectCount += 1;
                            });

                            const sessionAccuracyPct = decisionsList.length > 0
                              ? Math.round((sessionCorrectCount / decisionsList.length) * 100)
                              : 0;

                            return (
                              <React.Fragment key={sessionId}>
                                <tr style={{ 
                                  borderBottom: '1px solid var(--border-color)', 
                                  background: isSessionExpanded ? 'rgba(30, 41, 59, 0.5)' : 'transparent'
                                }}>
                                  <td style={{ padding: '0.55rem 0.65rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                                    {idx + 1}
                                  </td>
                                  <td style={{ padding: '0.55rem 0.65rem' }}>
                                    <span style={{
                                      padding: '0.15rem 0.5rem',
                                      borderRadius: '8px',
                                      fontSize: '0.675rem',
                                      fontWeight: 700,
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: '4px',
                                      background: mode === 'WithAI' ? 'rgba(168, 85, 247, 0.15)' : 'rgba(59, 130, 246, 0.15)',
                                      color: mode === 'WithAI' ? '#c084fc' : '#60a5fa',
                                      border: mode === 'WithAI' ? '1px solid rgba(168, 85, 247, 0.3)' : '1px solid rgba(59, 130, 246, 0.3)'
                                    }}>
                                      {mode === 'WithAI' ? <Bot size={12} /> : <Eye size={12} />}
                                      {mode === 'WithAI' ? 'Test 2 (Wsparcie AI)' : 'Test 1 (Bez AI)'}
                                    </span>
                                  </td>
                                  <td style={{ padding: '0.55rem 0.65rem' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                      <span style={{ fontWeight: 700, fontSize: '0.825rem', color: handledCount >= 30 ? '#34d399' : '#60a5fa' }}>
                                        {handledCount} / 30
                                      </span>
                                      {handledCount >= 30 ? (
                                        <span style={{ fontSize: '0.625rem', padding: '0.08rem 0.35rem', borderRadius: '4px', background: 'rgba(16, 185, 129, 0.2)', color: '#34d399', fontWeight: 600 }}>
                                          Ukończony
                                        </span>
                                      ) : (
                                        <span style={{ fontSize: '0.625rem', padding: '0.08rem 0.35rem', borderRadius: '4px', background: 'rgba(59, 130, 246, 0.2)', color: '#60a5fa', fontWeight: 600 }}>
                                          W trakcie
                                        </span>
                                      )}
                                    </div>
                                  </td>
                                  <td style={{ padding: '0.55rem 0.65rem' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                      <span style={{
                                        padding: '0.12rem 0.45rem',
                                        borderRadius: '6px',
                                        fontSize: '0.725rem',
                                        fontWeight: 700,
                                        background: sessionAccuracyPct >= 80 ? 'rgba(16, 185, 129, 0.2)' : sessionAccuracyPct >= 60 ? 'rgba(245, 158, 11, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                                        color: sessionAccuracyPct >= 80 ? '#34d399' : sessionAccuracyPct >= 60 ? '#fbbf24' : '#f87171'
                                      }}>
                                        {sessionAccuracyPct}%
                                      </span>
                                      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                                        ({sessionCorrectCount}/{decisionsList.length})
                                      </span>
                                    </div>
                                  </td>
                                  <td style={{ padding: '0.55rem 0.65rem', color: '#f3f4f6', fontWeight: 500 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                      <Clock size={12} color="var(--text-muted)" />
                                      <span>{formatDuration(durationSec)}</span>
                                    </div>
                                  </td>
                                  <td style={{ padding: '0.55rem 0.65rem', color: 'var(--text-muted)', fontSize: '0.725rem' }}>
                                    ~{avgSecPerAlert}s / alert
                                  </td>
                                  <td style={{ padding: '0.55rem 0.65rem', color: 'var(--text-muted)', fontSize: '0.725rem' }}>
                                    {startTime}
                                  </td>
                                  <td style={{ padding: '0.55rem 0.65rem', textAlign: 'right' }}>
                                    <button
                                      onClick={() => toggleSessionExpanded(sessionId)}
                                      className="btn-action"
                                      style={{
                                        padding: '0.2rem 0.5rem',
                                        fontSize: '0.7rem',
                                        background: isSessionExpanded ? 'rgba(6, 182, 212, 0.2)' : 'rgba(30, 41, 59, 0.8)',
                                        color: isSessionExpanded ? 'var(--ai-cyan)' : 'var(--text-muted)',
                                        border: '1px solid var(--border-color)',
                                        borderRadius: '5px'
                                      }}
                                    >
                                      {isSessionExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                                      <span>{isSessionExpanded ? 'Ukryj' : `Decyzje (${decisionsList.length})`}</span>
                                    </button>
                                  </td>
                                </tr>

                                {/* Sub-Accordion dla Jednostkowych Decyzji z Porównaniem do Wzorca */}
                                {isSessionExpanded && (
                                  <tr>
                                    <td colSpan={8} style={{ padding: '0.5rem 0.75rem 0.85rem 0.75rem', background: 'rgba(11, 15, 25, 0.85)', borderBottom: '1px solid var(--border-color)' }}>
                                      <div style={{ background: '#070a12', border: '1px solid var(--border-color)', borderRadius: '6px', padding: '0.75rem' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                                          <h4 style={{ fontSize: '0.775rem', fontWeight: 700, color: 'var(--ai-cyan)', margin: 0, display: 'flex', alignItems: 'center', gap: '5px' }}>
                                            <Activity size={13} /> Podjęte Decyzje Operatora z Porównaniem do Wzorca Odpowiedzi ({decisionsList.length} zdarzeń)
                                          </h4>
                                          <div style={{ fontSize: '0.725rem', color: 'var(--text-muted)' }}>
                                            Trafność sesji: <strong style={{ color: sessionAccuracyPct >= 80 ? '#34d399' : '#f87171' }}>{sessionAccuracyPct}%</strong>
                                          </div>
                                        </div>

                                        {decisionsList.length === 0 ? (
                                          <p style={{ fontSize: '0.725rem', color: 'var(--text-muted)' }}>Brak zarejestrowanych decyzji w tej sesji.</p>
                                        ) : (
                                          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.725rem' }}>
                                            <thead>
                                              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', color: 'var(--text-muted)', textAlign: 'left' }}>
                                                <th style={{ padding: '0.35rem 0.5rem' }}>#</th>
                                                <th style={{ padding: '0.35rem 0.5rem' }}>ID Alertu</th>
                                                <th style={{ padding: '0.35rem 0.5rem' }}>Podjęta Akcja Operatora</th>
                                                <th style={{ padding: '0.35rem 0.5rem' }}>Prawidłowa Odpowiedź (Wzorzec)</th>
                                                <th style={{ padding: '0.35rem 0.5rem' }}>Ocena Decyzji</th>
                                                <th style={{ padding: '0.35rem 0.5rem' }}>Czas Reakcji</th>
                                                <th style={{ padding: '0.35rem 0.5rem' }}>Znacznik Czasu</th>
                                              </tr>
                                            </thead>
                                            <tbody>
                                              {decisionsList.map((d: any, dIdx: number) => {
                                                const alertId = d.alertId || d.AlertId;
                                                const actionTaken = d.actionTaken || d.ActionTaken;
                                                const badge = getActionBadge(actionTaken);
                                                const evalAccuracy = checkDecisionAccuracy(alertId, actionTaken);

                                                return (
                                                  <tr key={dIdx} style={{ 
                                                    borderBottom: '1px solid rgba(255,255,255,0.04)',
                                                    background: evalAccuracy.isCorrect ? 'transparent' : 'rgba(239, 68, 68, 0.04)'
                                                  }}>
                                                    <td style={{ padding: '0.35rem 0.5rem', color: 'var(--text-muted)' }}>{dIdx + 1}</td>
                                                    <td style={{ padding: '0.35rem 0.5rem', fontWeight: 600, color: '#e2e8f0' }}>{alertId}</td>
                                                    <td style={{ padding: '0.35rem 0.5rem' }}>
                                                      <span style={{ padding: '0.08rem 0.4rem', borderRadius: '5px', fontSize: '0.65rem', fontWeight: 600, background: badge.bg, color: badge.color }}>
                                                        {badge.label}
                                                      </span>
                                                    </td>
                                                    <td style={{ padding: '0.35rem 0.5rem', fontWeight: 600, color: '#94a3b8' }}>
                                                      <span style={{ padding: '0.08rem 0.4rem', borderRadius: '5px', fontSize: '0.65rem', background: 'rgba(255,255,255,0.06)', color: '#e2e8f0' }}>
                                                        {evalAccuracy.correctActionLabel}
                                                      </span>
                                                    </td>
                                                    <td style={{ padding: '0.35rem 0.5rem' }}>
                                                      {evalAccuracy.isCorrect ? (
                                                        <span style={{ padding: '0.08rem 0.45rem', borderRadius: '5px', fontSize: '0.65rem', fontWeight: 700, background: 'rgba(16, 185, 129, 0.2)', color: '#34d399', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                                                          <CheckCircle size={11} /> POPRAWNA
                                                        </span>
                                                      ) : (
                                                        <span style={{ padding: '0.08rem 0.45rem', borderRadius: '5px', fontSize: '0.65rem', fontWeight: 700, background: 'rgba(239, 68, 68, 0.2)', color: '#f87171', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                                                          <XCircle size={11} /> BŁĘDNA
                                                        </span>
                                                      )}
                                                    </td>
                                                    <td style={{ padding: '0.35rem 0.5rem', color: '#cbd5e1', fontWeight: 500 }}>
                                                      {d.decisionTimeSeconds || d.DecisionTimeSeconds || 0}s
                                                    </td>
                                                    <td style={{ padding: '0.35rem 0.5rem', color: 'var(--text-muted)', fontSize: '0.675rem' }}>
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
    </div>
  );
};
