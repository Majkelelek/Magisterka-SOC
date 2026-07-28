import React, { useEffect, useState } from 'react';
import { fetchTestSessions, fetchRegisteredUsers } from '../services/api';
import type { UserSession } from '../types/alert';
import { 
  BarChart2, 
  User, 
  ChevronDown, 
  ChevronUp, 
  Clock, 
  CheckCircle2, 
  RefreshCw, 
  ShieldCheck, 
  Bot, 
  Eye, 
  Award,
  Users,
  Activity
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
}

export const TestResultsPage: React.FC<TestResultsPageProps> = () => {
  const [rawTestSessions, setRawTestSessions] = useState<Array<any>>([]);
  const [registeredUsers, setRegisteredUsers] = useState<Array<any>>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // States for expandable accordions
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

  // Grupowanie skondensowanych sesji według Użytkowników
  const condensedAll = getCondensedSessions(rawTestSessions);

  const userGroups: UserGroup[] = React.useMemo(() => {
    const groupMap = new Map<string, UserGroup>();

    // Najpierw dodajemy zarejestrowanych użytkowników
    registeredUsers.forEach((u) => {
      const uname = u.username || u.Username || 'Anonim';
      const normKey = uname.toLowerCase();
      groupMap.set(normKey, {
        username: uname,
        role: u.role || 'Użytkownik',
        sessions: [],
        totalSessionsCount: 0,
        completedCount: 0,
        totalDurationSeconds: 0
      });
    });

    // Przypisujemy sesje do użytkowników
    condensedAll.forEach((s) => {
      const operator = s.operatorName || s.OperatorName || 'Anonim';
      const normKey = operator.toLowerCase();

      if (!groupMap.has(normKey)) {
        groupMap.set(normKey, {
          username: operator,
          role: 'Operator SOC',
          sessions: [],
          totalSessionsCount: 0,
          completedCount: 0,
          totalDurationSeconds: 0
        });
      }

      const group = groupMap.get(normKey)!;
      group.sessions.push(s);
      group.totalSessionsCount += 1;
      
      const handled = s.alertsHandledCount || s.AlertsHandledCount || (s.decisions?.length || s.Decisions?.length || 0);
      if (handled >= 30) {
        group.completedCount += 1;
      }
      group.totalDurationSeconds += (s.totalDurationSeconds || s.TotalDurationSeconds || 0);
    });

    // Domyślnie automatycznie rozwijamy pierwszego użytkownika lub użytkowników, którzy mają sesje
    return Array.from(groupMap.values()).sort((a, b) => b.sessions.length - a.sessions.length);
  }, [condensedAll, registeredUsers]);

  // Rozwijanie / zwijanie karty użytkownika
  const toggleUserExpanded = (username: string) => {
    setExpandedUsers(prev => ({
      ...prev,
      [username]: !prev[username]
    }));
  };

  // Rozwijanie / zwijanie jednostkowych decyzji sesji
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

  // Globalne statystyki
  const totalUsersCount = userGroups.length;
  const usersWithTestsCount = userGroups.filter(g => g.sessions.length > 0).length;
  const totalSessionsCount = condensedAll.length;
  const completedSessionsCount = condensedAll.filter(s => {
    const handled = s.alertsHandledCount || s.AlertsHandledCount || (s.decisions?.length || s.Decisions?.length || 0);
    return handled >= 30;
  }).length;

  return (
    <div style={{ width: '100%', maxWidth: '1400px', margin: '0 auto', padding: '1.5rem 0' }}>
      {/* Banner nagłówka */}
      <div className="soc-card" style={{
        padding: '1.75rem 2rem',
        marginBottom: '2rem',
        background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.95), rgba(7, 10, 18, 0.98))',
        border: '1px solid rgba(168, 85, 247, 0.3)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'rgba(168, 85, 247, 0.12)', color: '#c084fc', padding: '0.25rem 0.75rem', borderRadius: '15px', fontSize: '0.75rem', fontWeight: 600, marginBottom: '0.5rem' }}>
              <Award size={14} /> RAPORTY & WYNIKI TESTÓW OPERATORÓW SOC
            </div>
            <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: '#ffffff' }}>
              Wyniki Testów Operatorów z Rozbiciem na Użytkowników
            </h1>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginTop: '0.25rem' }}>
              Poniżej znajduje się zagregowany podgląd wyników testów badawczych. Rozwiń kartę wybranego użytkownika, aby zobaczyć jego podejścia.
            </p>
          </div>

          <button
            onClick={loadData}
            className="btn-action"
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <RefreshCw size={14} /> Odśwież Wyniki
          </button>
        </div>
      </div>

      {/* Karty podsumowujące statystyki */}
      <div className="stats-grid" style={{ marginBottom: '2rem' }}>
        <div className="stat-card">
          <div>
            <div className="stat-lbl">Zarejestrowani Użytkownicy</div>
            <div className="stat-val" style={{ color: '#ffffff' }}>{totalUsersCount}</div>
          </div>
          <Users size={28} color="#3b82f6" style={{ opacity: 0.8 }} />
        </div>

        <div className="stat-card">
          <div>
            <div className="stat-lbl">Aktywni Operatorzy w Testach</div>
            <div className="stat-val" style={{ color: 'var(--ai-cyan)' }}>{usersWithTestsCount}</div>
          </div>
          <ShieldCheck size={28} color="var(--ai-cyan)" style={{ opacity: 0.8 }} />
        </div>

        <div className="stat-card">
          <div>
            <div className="stat-lbl">Łączna Liczba Podejść (Sesji)</div>
            <div className="stat-val" style={{ color: '#c084fc' }}>{totalSessionsCount}</div>
          </div>
          <BarChart2 size={28} color="#c084fc" style={{ opacity: 0.8 }} />
        </div>

        <div className="stat-card">
          <div>
            <div className="stat-lbl">Ukończone Testy 30/30 Zdarzeń</div>
            <div className="stat-val" style={{ color: 'var(--severity-low)' }}>{completedSessionsCount}</div>
          </div>
          <CheckCircle2 size={28} color="var(--severity-low)" style={{ opacity: 0.8 }} />
        </div>
      </div>

      {/* Główna lista użytkowników i ich wyników testowych */}
      {loading ? (
        <div style={{ padding: '4rem', textAlign: 'center', color: 'var(--text-muted)' }}>
          <BarChart2 size={40} className="pulse-dot" style={{ margin: '0 auto 1rem auto' }} />
          <p>Ładowanie skondensowanych wyników testów z bazy...</p>
        </div>
      ) : userGroups.length === 0 ? (
        <div className="soc-card" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
          <Users size={40} style={{ margin: '0 auto 1rem auto', opacity: 0.5 }} />
          <h3>Brak użytkowników i zarejestrowanych podejść testowych</h3>
          <p style={{ fontSize: '0.875rem', marginTop: '0.5rem' }}>Przeprowadź test bez AI lub z AI, aby zapisać pierwsze wyniki.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {userGroups.map((group) => {
            const isUserExpanded = expandedUsers[group.username] ?? (group.sessions.length > 0);

            return (
              <div 
                key={group.username} 
                className="soc-card" 
                style={{ 
                  padding: '1.5rem',
                  border: isUserExpanded ? '1px solid rgba(56, 189, 248, 0.4)' : '1px solid var(--border-color)',
                  transition: 'all 0.2s ease'
                }}
              >
                {/* User Header Accordion Bar */}
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
                  <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                    <div style={{ 
                      width: '46px', 
                      height: '46px', 
                      borderRadius: '12px', 
                      background: group.sessions.length > 0 ? 'rgba(56, 189, 248, 0.15)' : 'rgba(100, 116, 139, 0.15)', 
                      border: group.sessions.length > 0 ? '1px solid rgba(56, 189, 248, 0.3)' : '1px solid rgba(100, 116, 139, 0.3)',
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'center',
                      color: group.sessions.length > 0 ? 'var(--ai-cyan)' : 'var(--text-muted)'
                    }}>
                      <User size={24} />
                    </div>

                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#ffffff', margin: 0 }}>
                          Operator: {group.username}
                        </h3>
                        <span style={{
                          padding: '0.15rem 0.55rem',
                          borderRadius: '10px',
                          fontSize: '0.7rem',
                          fontWeight: 700,
                          background: group.role === 'Administrator' ? 'rgba(139, 92, 246, 0.18)' : 'rgba(59, 130, 246, 0.18)',
                          color: group.role === 'Administrator' ? '#c084fc' : '#60a5fa',
                          border: group.role === 'Administrator' ? '1px solid rgba(139, 92, 246, 0.35)' : '1px solid rgba(59, 130, 246, 0.35)'
                        }}>
                          {group.role}
                        </span>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.3rem' }}>
                        <span>Liczba Sesji: <strong style={{ color: '#ffffff' }}>{group.totalSessionsCount}</strong></span>
                        <span>•</span>
                        <span>Ukończone 30/30: <strong style={{ color: group.completedCount > 0 ? '#34d399' : 'var(--text-muted)' }}>{group.completedCount}</strong></span>
                        <span>•</span>
                        <span>Łączny Czas: <strong style={{ color: '#cbd5e1' }}>{formatDuration(group.totalDurationSeconds)}</strong></span>
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <button
                      type="button"
                      className="btn-action"
                      style={{
                        padding: '0.4rem 0.85rem',
                        fontSize: '0.8rem',
                        background: isUserExpanded ? 'rgba(56, 189, 248, 0.2)' : 'rgba(30, 41, 59, 0.8)',
                        color: isUserExpanded ? 'var(--ai-cyan)' : 'var(--text-muted)',
                        border: '1px solid var(--border-color)',
                        pointerEvents: 'none'
                      }}
                    >
                      {isUserExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                      <span>{isUserExpanded ? 'Zwiń Wyniki Operatora' : `Rozwiń Wyniki (${group.sessions.length})`}</span>
                    </button>
                  </div>
                </div>

                {/* Body Accordion dla Użytkownika */}
                {isUserExpanded && (
                  <div style={{ marginTop: '1.25rem', paddingTop: '1.25rem', borderTop: '1px solid var(--border-color)' }}>
                    {group.sessions.length === 0 ? (
                      <div style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--text-muted)', background: 'rgba(15, 23, 42, 0.4)', borderRadius: '8px', fontSize: '0.85rem' }}>
                        Ten użytkownik nie przeprowadził jeszcze żadnej sesji testowej.
                      </div>
                    ) : (
                      <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.825rem', textAlign: 'left' }}>
                          <thead>
                            <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>
                              <th style={{ padding: '0.65rem 0.85rem' }}>#</th>
                              <th style={{ padding: '0.65rem 0.85rem' }}>Tryb Testu</th>
                              <th style={{ padding: '0.65rem 0.85rem' }}>Przeanalizowano Zdarzenia</th>
                              <th style={{ padding: '0.65rem 0.85rem' }}>Czas Łączny</th>
                              <th style={{ padding: '0.65rem 0.85rem' }}>Śr. Czas / Zdarzenie</th>
                              <th style={{ padding: '0.65rem 0.85rem' }}>Data Rozpoczęcia</th>
                              <th style={{ padding: '0.65rem 0.85rem', textAlign: 'right' }}>Decyzje</th>
                            </tr>
                          </thead>
                          <tbody>
                            {group.sessions.map((s, idx) => {
                              const mode = s.mode || s.Mode || 'NoAI';
                              const handledCount = s.alertsHandledCount || s.AlertsHandledCount || (s.decisions?.length || s.Decisions?.length || 0);
                              const durationSec = s.totalDurationSeconds || s.TotalDurationSeconds || 0;
                              const startTime = s.startTime || s.StartTime ? new Date(s.startTime || s.StartTime).toLocaleString() : 'N/A';
                              const decisionsList = s.decisions || s.Decisions || [];
                              const sessionId = s.sessionId || s.SessionId || `${group.username}_session_${idx}`;
                              const isSessionExpanded = !!expandedSessions[sessionId];
                              const avgSecPerAlert = handledCount > 0 ? (durationSec / handledCount).toFixed(1) : '0';

                              return (
                                <React.Fragment key={sessionId}>
                                  <tr style={{ 
                                    borderBottom: '1px solid var(--border-color)', 
                                    background: isSessionExpanded ? 'rgba(30, 41, 59, 0.5)' : 'transparent'
                                  }}>
                                    <td style={{ padding: '0.75rem 0.85rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                                      {idx + 1}
                                    </td>
                                    <td style={{ padding: '0.75rem 0.85rem' }}>
                                      <span style={{
                                        padding: '0.2rem 0.65rem',
                                        borderRadius: '10px',
                                        fontSize: '0.725rem',
                                        fontWeight: 700,
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '5px',
                                        background: mode === 'WithAI' ? 'rgba(168, 85, 247, 0.15)' : 'rgba(59, 130, 246, 0.15)',
                                        color: mode === 'WithAI' ? '#c084fc' : '#60a5fa',
                                        border: mode === 'WithAI' ? '1px solid rgba(168, 85, 247, 0.3)' : '1px solid rgba(59, 130, 246, 0.3)'
                                      }}>
                                        {mode === 'WithAI' ? <Bot size={13} /> : <Eye size={13} />}
                                        {mode === 'WithAI' ? 'Test 2 (Wsparcie AI)' : 'Test 1 (Bez AI)'}
                                      </span>
                                    </td>
                                    <td style={{ padding: '0.75rem 0.85rem' }}>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <span style={{ fontWeight: 700, fontSize: '0.9rem', color: handledCount >= 30 ? '#34d399' : '#60a5fa' }}>
                                          {handledCount} / 30 zdarzeń
                                        </span>
                                        {handledCount >= 30 ? (
                                          <span style={{ fontSize: '0.675rem', padding: '0.1rem 0.4rem', borderRadius: '4px', background: 'rgba(16, 185, 129, 0.2)', color: '#34d399', fontWeight: 600 }}>
                                            Ukończony
                                          </span>
                                        ) : (
                                          <span style={{ fontSize: '0.675rem', padding: '0.1rem 0.4rem', borderRadius: '4px', background: 'rgba(59, 130, 246, 0.2)', color: '#60a5fa', fontWeight: 600 }}>
                                            W trakcie
                                          </span>
                                        )}
                                      </div>
                                    </td>
                                    <td style={{ padding: '0.75rem 0.85rem', color: '#f3f4f6', fontWeight: 500 }}>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                        <Clock size={13} color="var(--text-muted)" />
                                        <span>{formatDuration(durationSec)}</span>
                                      </div>
                                    </td>
                                    <td style={{ padding: '0.75rem 0.85rem', color: 'var(--text-muted)', fontSize: '0.775rem' }}>
                                      ~{avgSecPerAlert}s / alert
                                    </td>
                                    <td style={{ padding: '0.75rem 0.85rem', color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                                      {startTime}
                                    </td>
                                    <td style={{ padding: '0.75rem 0.85rem', textAlign: 'right' }}>
                                      <button
                                        onClick={() => toggleSessionExpanded(sessionId)}
                                        className="btn-action"
                                        style={{
                                          padding: '0.25rem 0.65rem',
                                          fontSize: '0.725rem',
                                          background: isSessionExpanded ? 'rgba(6, 182, 212, 0.2)' : 'rgba(30, 41, 59, 0.8)',
                                          color: isSessionExpanded ? 'var(--ai-cyan)' : 'var(--text-muted)',
                                          border: '1px solid var(--border-color)'
                                        }}
                                      >
                                        {isSessionExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                                        <span>{isSessionExpanded ? 'Ukryj Decyzje' : `Decyzje (${decisionsList.length})`}</span>
                                      </button>
                                    </td>
                                  </tr>

                                  {/* Drugi poziom rozwinięcia - Tabela Jednostkowych Decyzji */}
                                  {isSessionExpanded && (
                                    <tr>
                                      <td colSpan={7} style={{ padding: '0.75rem 1rem 1.25rem 1rem', background: 'rgba(11, 15, 25, 0.85)', borderBottom: '1px solid var(--border-color)' }}>
                                        <div style={{ background: '#070a12', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '1rem' }}>
                                          <h4 style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--ai-cyan)', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                            <Activity size={15} /> Szegółowe Decyzje Operatora ({decisionsList.length} zdarzeń)
                                          </h4>

                                          {decisionsList.length === 0 ? (
                                            <p style={{ fontSize: '0.775rem', color: 'var(--text-muted)' }}>Brak zarejestrowanych jednostkowych decyzji dla tej sesji.</p>
                                          ) : (
                                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.775rem' }}>
                                              <thead>
                                                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', color: 'var(--text-muted)', textAlign: 'left' }}>
                                                  <th style={{ padding: '0.4rem 0.6rem' }}>#</th>
                                                  <th style={{ padding: '0.4rem 0.6rem' }}>ID Alertu</th>
                                                  <th style={{ padding: '0.4rem 0.6rem' }}>Podjęta Akcja Operatora</th>
                                                  <th style={{ padding: '0.4rem 0.6rem' }}>Czas Reakcji</th>
                                                  <th style={{ padding: '0.4rem 0.6rem' }}>Znacznik Czasu</th>
                                                </tr>
                                              </thead>
                                              <tbody>
                                                {decisionsList.map((d: any, dIdx: number) => {
                                                  const badge = getActionBadge(d.actionTaken || d.ActionTaken);
                                                  return (
                                                    <tr key={dIdx} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                                                      <td style={{ padding: '0.4rem 0.6rem', color: 'var(--text-muted)' }}>{dIdx + 1}</td>
                                                      <td style={{ padding: '0.4rem 0.6rem', fontWeight: 600, color: '#e2e8f0' }}>{d.alertId || d.AlertId}</td>
                                                      <td style={{ padding: '0.4rem 0.6rem' }}>
                                                        <span style={{ padding: '0.12rem 0.5rem', borderRadius: '6px', fontSize: '0.675rem', fontWeight: 600, background: badge.bg, color: badge.color }}>
                                                          {badge.label}
                                                        </span>
                                                      </td>
                                                      <td style={{ padding: '0.4rem 0.6rem', color: '#cbd5e1', fontWeight: 500 }}>
                                                        {d.decisionTimeSeconds || d.DecisionTimeSeconds || 0}s
                                                      </td>
                                                      <td style={{ padding: '0.4rem 0.6rem', color: 'var(--text-muted)', fontSize: '0.725rem' }}>
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
                    )}
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
