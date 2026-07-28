import React, { useEffect, useState } from 'react';
import { registerUserByAdmin, fetchRegisteredUsers, fetchActiveSessions, changeUserPasswordByAdmin } from '../services/api';
import type { UserSession } from '../types/alert';
import { UserPlus, ShieldAlert, Users, Lock, User, CheckCircle2, AlertCircle, RefreshCw, ShieldCheck, UserCheck, KeyRound, Key } from 'lucide-react';

interface AdminUserPanelProps {
  userSession: UserSession;
}

export const AdminUserPanel: React.FC<AdminUserPanelProps> = ({ userSession }) => {
  const [usersList, setUsersList] = useState<Array<{ id: string; username: string; email: string; role: string }>>([]);
  const [activeSessions, setActiveSessions] = useState<Array<{ id: string; username: string; role: string; createdAt: string; expiresAt: string }>>([]);
  const [testSessions, setTestSessions] = useState<Array<any>>([]);
  const [loadingUsers, setLoadingUsers] = useState<boolean>(true);
  const [loadingSessions, setLoadingSessions] = useState<boolean>(true);

  // Form state
  const [newUsername, setNewUsername] = useState<string>('');
  const [newPassword, setNewPassword] = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState<string>('');
  const [newRole, setNewRole] = useState<string>('Użytkownik');

  // Change password modal state
  const [targetUserForPassword, setTargetUserForPassword] = useState<{ id: string; username: string } | null>(null);
  const [changePasswordVal, setChangePasswordVal] = useState<string>('');
  const [changePasswordMsg, setChangePasswordMsg] = useState<{ isError: boolean; text: string } | null>(null);
  const [changingPassword, setChangingPassword] = useState<boolean>(false);

  // Feedback UI
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState<boolean>(false);

  const loadUsers = async () => {
    setLoadingUsers(true);
    const data = await fetchRegisteredUsers();
    setUsersList(data);
    setLoadingUsers(false);
  };

  const loadSessions = async () => {
    setLoadingSessions(true);
    const data = await fetchActiveSessions();
    setActiveSessions(data);
    setLoadingSessions(false);
  };

  const loadTestResults = async () => {
    const { fetchTestSessions } = await import('../services/api');
    const data = await fetchTestSessions();
    setTestSessions(data);
  };

  useEffect(() => {
    loadUsers();
    loadSessions();
    loadTestResults();
  }, []);

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!newUsername.trim() || !newPassword.trim()) {
      setErrorMsg('Wypełnij nazwę użytkownika i hasło.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorMsg('Wpisane hasła nie są takie same.');
      return;
    }

    setSubmitting(true);
    const res = await registerUserByAdmin(newUsername, newPassword, newRole);
    setSubmitting(false);

    if (!res.success) {
      setErrorMsg(res.message);
    } else {
      setSuccessMsg(res.message);
      setNewUsername('');
      setNewPassword('');
      setConfirmPassword('');
      setNewRole('Użytkownik');
      await loadUsers();
    }
  };

  const handleChangePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetUserForPassword || !changePasswordVal.trim()) return;

    setChangingPassword(true);
    setChangePasswordMsg(null);

    const res = await changeUserPasswordByAdmin(targetUserForPassword.id, changePasswordVal.trim());
    setChangingPassword(false);

    if (res.success) {
      setChangePasswordMsg({ isError: false, text: `Hasło użytkownika '${targetUserForPassword.username}' zostało zmienione.` });
      setTimeout(() => {
        setTargetUserForPassword(null);
        setChangePasswordVal('');
        setChangePasswordMsg(null);
      }, 1800);
    } else {
      setChangePasswordMsg({ isError: true, text: res.message });
    }
  };

  if (userSession.role !== 'Administrator') {
    return (
      <div style={{ padding: '3rem', textAlign: 'center', color: '#f87171' }}>
        <ShieldAlert size={48} style={{ margin: '0 auto 1rem auto' }} />
        <h2>Dostęp Zablokowany</h2>
        <p style={{ color: 'var(--text-muted)', marginTop: '0.5rem' }}>
          Tylko zalogowany Administrator posiada uprawnienia do rejestrowania i zarządzania kontami oraz sesjami.
        </p>
      </div>
    );
  }

  return (
    <div style={{ width: '100%', maxWidth: '1400px', margin: '0 auto', padding: '1.5rem 0' }}>
      {/* Header Banner */}
      <div className="soc-card" style={{
        padding: '1.75rem 2rem',
        marginBottom: '2rem',
        background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.95), rgba(7, 10, 18, 0.98))',
        border: '1px solid rgba(56, 189, 248, 0.25)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'rgba(6, 182, 212, 0.1)', color: 'var(--ai-cyan)', padding: '0.25rem 0.75rem', borderRadius: '15px', fontSize: '0.75rem', fontWeight: 600, marginBottom: '0.5rem' }}>
              <ShieldCheck size={14} /> PANEL KONTROLI ADMINISTRATORA & SESSIONS
            </div>
            <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: '#ffffff' }}>
              Zarządzanie Kontami i Aktywnymi Sesjami
            </h1>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginTop: '0.25rem' }}>
              Rejestruj nowych operatorów w MongoDB oraz zarządzaj aktywnymi tokenami sesji (Revocation / Logout).
            </p>
          </div>

          <button
            onClick={() => { loadUsers(); loadSessions(); }}
            className="btn-action"
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <RefreshCw size={14} /> Odśwież Dane Bazy
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '400px 1fr', gap: '1.75rem' }}>
        {/* Left Column: Registration Form */}
        <div className="soc-card" style={{ padding: '1.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '1.25rem', paddingBottom: '0.85rem', borderBottom: '1px solid var(--border-color)' }}>
            <div style={{ background: 'rgba(6, 182, 212, 0.12)', color: 'var(--ai-cyan)', padding: '0.5rem', borderRadius: '8px' }}>
              <UserPlus size={20} />
            </div>
            <div>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#ffffff' }}>
                Rejestracja Nowego Użytkownika
              </h3>
              <p style={{ fontSize: '0.775rem', color: 'var(--text-muted)' }}>
                Dostępne tylko dla Administratora
              </p>
            </div>
          </div>

          {errorMsg && (
            <div style={{ background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#f87171', padding: '0.65rem 0.85rem', borderRadius: '8px', marginBottom: '1.25rem', fontSize: '0.825rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <AlertCircle size={16} />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div style={{ background: 'rgba(16, 185, 129, 0.15)', border: '1px solid rgba(16, 185, 129, 0.3)', color: '#34d399', padding: '0.65rem 0.85rem', borderRadius: '8px', marginBottom: '1.25rem', fontSize: '0.825rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <CheckCircle2 size={16} />
              <span>{successMsg}</span>
            </div>
          )}

          <form onSubmit={handleRegisterSubmit}>
            <div style={{ marginBottom: '1.1rem' }}>
              <label style={{ display: 'block', fontSize: '0.775rem', color: 'var(--text-muted)', marginBottom: '0.4rem', fontWeight: 500 }}>
                Nazwa Użytkownika / Operatora *
              </label>
              <div style={{ position: 'relative' }}>
                <User size={16} style={{ position: 'absolute', left: '12px', top: '12px', color: 'var(--text-muted)' }} />
                <input
                  type="text"
                  required
                  placeholder="np. Analityk_Jan"
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  style={{ width: '100%', background: '#161e2e', border: '1px solid var(--border-color)', color: 'white', padding: '0.65rem 0.75rem 0.65rem 2.4rem', borderRadius: '8px', fontSize: '0.875rem' }}
                />
              </div>
            </div>

            <div style={{ marginBottom: '1.1rem' }}>
              <label style={{ display: 'block', fontSize: '0.775rem', color: 'var(--text-muted)', marginBottom: '0.4rem', fontWeight: 500 }}>
                Hasło *
              </label>
              <div style={{ position: 'relative' }}>
                <Lock size={16} style={{ position: 'absolute', left: '12px', top: '12px', color: 'var(--text-muted)' }} />
                <input
                  type="password"
                  required
                  placeholder="Wpisz bezpieczne hasło..."
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  style={{ width: '100%', background: '#161e2e', border: '1px solid var(--border-color)', color: 'white', padding: '0.65rem 0.75rem 0.65rem 2.4rem', borderRadius: '8px', fontSize: '0.875rem' }}
                />
              </div>
            </div>

            <div style={{ marginBottom: '1.1rem' }}>
              <label style={{ display: 'block', fontSize: '0.775rem', color: 'var(--text-muted)', marginBottom: '0.4rem', fontWeight: 500 }}>
                Powtórz Hasło *
              </label>
              <div style={{ position: 'relative' }}>
                <Lock size={16} style={{ position: 'absolute', left: '12px', top: '12px', color: 'var(--text-muted)' }} />
                <input
                  type="password"
                  required
                  placeholder="Powtórz hasło..."
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  style={{ width: '100%', background: '#161e2e', border: '1px solid var(--border-color)', color: 'white', padding: '0.65rem 0.75rem 0.65rem 2.4rem', borderRadius: '8px', fontSize: '0.875rem' }}
                />
              </div>
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', fontSize: '0.775rem', color: 'var(--text-muted)', marginBottom: '0.4rem', fontWeight: 500 }}>
                Rola w Systemie *
              </label>
              <select
                value={newRole}
                onChange={(e) => setNewRole(e.target.value)}
                style={{ width: '100%', background: '#161e2e', border: '1px solid var(--border-color)', color: 'white', padding: '0.65rem 0.75rem', borderRadius: '8px', fontSize: '0.875rem' }}
              >
                <option value="Użytkownik">Użytkownik (Operator SOC)</option>
                <option value="Administrator">Administrator Systemu</option>
              </select>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="btn-action btn-ai-primary"
              style={{ width: '100%', justifyContent: 'center', padding: '0.8rem', fontSize: '0.9rem', fontWeight: 600 }}
            >
              {submitting ? 'Rejestrowanie...' : 'Zarejestruj Użytkownika w Bazie'}
            </button>
          </form>
        </div>

        {/* Right Column: Active Sessions & Users Tables */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
          {/* Active Sessions Table */}
          <div className="soc-card" style={{ padding: '1.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', paddingBottom: '0.75rem', borderBottom: '1px solid var(--border-color)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ background: 'rgba(16, 185, 129, 0.12)', color: '#34d399', padding: '0.5rem', borderRadius: '8px' }}>
                  <KeyRound size={20} />
                </div>
                <div>
                  <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#ffffff' }}>
                    Aktywne Sesje w Bazię MongoDB (`Sessions`) ({activeSessions.length})
                  </h3>
                  <p style={{ fontSize: '0.775rem', color: 'var(--text-muted)' }}>
                    Możliwość zdalnego unieważnienia (wylogowania) dowolnej aktywnej sesji
                  </p>
                </div>
              </div>
            </div>

            {loadingSessions ? (
              <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>Ładowanie sesji...</div>
            ) : activeSessions.length === 0 ? (
              <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>Brak aktywnych sesji w bazie.</div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.825rem', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>
                      <th style={{ padding: '0.65rem 0.85rem' }}>Operator</th>
                      <th style={{ padding: '0.65rem 0.85rem' }}>Rola</th>
                      <th style={{ padding: '0.65rem 0.85rem' }}>Zalogowano</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeSessions.map((s) => (
                      <tr key={s.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                        <td style={{ padding: '0.75rem 0.85rem', fontWeight: 600, color: '#ffffff' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <UserCheck size={15} color="var(--ai-cyan)" />
                            <span>{s.username}</span>
                          </div>
                        </td>
                        <td style={{ padding: '0.75rem 0.85rem' }}>
                          <span style={{
                            padding: '0.15rem 0.5rem',
                            borderRadius: '10px',
                            fontSize: '0.7rem',
                            fontWeight: 700,
                            background: s.role === 'Administrator' ? 'rgba(139, 92, 246, 0.15)' : 'rgba(59, 130, 246, 0.15)',
                            color: s.role === 'Administrator' ? '#c084fc' : '#60a5fa'
                          }}>
                            {s.role}
                          </span>
                        </td>
                        <td style={{ padding: '0.75rem 0.85rem', color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                          {new Date(s.createdAt).toLocaleTimeString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Wyniki Testów Operatorów */}
          <div className="soc-card" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', paddingBottom: '0.75rem', borderBottom: '1px solid var(--border-color)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ background: 'rgba(168, 85, 247, 0.12)', color: '#c084fc', padding: '0.5rem', borderRadius: '8px' }}>
                  <ShieldCheck size={20} />
                </div>
                <div>
                  <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#ffffff' }}>
                    Wyniki Testów Operatorów (Zestaw 30 Zdarzeń) ({testSessions.length})
                  </h3>
                  <p style={{ fontSize: '0.775rem', color: 'var(--text-muted)' }}>
                    Administracyjny podgląd zarejestrowanych podejść użytkowników i podjętych decyzji
                  </p>
                </div>
              </div>
              <button onClick={loadTestResults} className="btn-action" style={{ fontSize: '0.775rem', padding: '0.35rem 0.75rem' }}>
                <RefreshCw size={14} /> Odśwież Wyniki
              </button>
            </div>

            {testSessions.length === 0 ? (
              <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                Brak zarejestrowanych sesji testowych w bazie.
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.825rem', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>
                      <th style={{ padding: '0.65rem 0.85rem' }}>Operator</th>
                      <th style={{ padding: '0.65rem 0.85rem' }}>Tryb Testu</th>
                      <th style={{ padding: '0.65rem 0.85rem' }}>Przeanalizowano</th>
                      <th style={{ padding: '0.65rem 0.85rem' }}>Czas Trwania</th>
                      <th style={{ padding: '0.65rem 0.85rem' }}>Data Rozpoczęcia</th>
                    </tr>
                  </thead>
                  <tbody>
                    {testSessions.map((ts, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid var(--border-color)' }}>
                        <td style={{ padding: '0.75rem 0.85rem', fontWeight: 600, color: '#ffffff' }}>
                          {ts.operatorName || ts.OperatorName}
                        </td>
                        <td style={{ padding: '0.75rem 0.85rem' }}>
                          <span style={{
                            padding: '0.15rem 0.5rem',
                            borderRadius: '10px',
                            fontSize: '0.7rem',
                            fontWeight: 700,
                            background: (ts.mode || ts.Mode) === 'WithAI' ? 'rgba(168, 85, 247, 0.15)' : 'rgba(59, 130, 246, 0.15)',
                            color: (ts.mode || ts.Mode) === 'WithAI' ? '#c084fc' : '#60a5fa'
                          }}>
                            {(ts.mode || ts.Mode) === 'WithAI' ? 'Test 2 (Wsparcie AI)' : 'Test 1 (Bez AI)'}
                          </span>
                        </td>
                        <td style={{ padding: '0.75rem 0.85rem', fontWeight: 600, color: '#34d399' }}>
                          {ts.alertsHandledCount || ts.AlertsHandledCount || (ts.decisions?.length || ts.Decisions?.length || 0)} zdarzeń
                        </td>
                        <td style={{ padding: '0.75rem 0.85rem', color: '#f3f4f6' }}>
                          {ts.totalDurationSeconds || ts.TotalDurationSeconds || 0} sek
                        </td>
                        <td style={{ padding: '0.75rem 0.85rem', color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                          {ts.startTime || ts.StartTime ? new Date(ts.startTime || ts.StartTime).toLocaleString() : 'N/A'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Registered Users Table */}
          <div className="soc-card" style={{ padding: '1.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '1rem', paddingBottom: '0.75rem', borderBottom: '1px solid var(--border-color)' }}>
              <div style={{ background: 'rgba(59, 130, 246, 0.12)', color: '#60a5fa', padding: '0.5rem', borderRadius: '8px' }}>
                <Users size={20} />
              </div>
              <div>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#ffffff' }}>
                  Wszyscy Zarejestrowani Użytkownicy (`Users`) ({usersList.length})
                </h3>
              </div>
            </div>

            {loadingUsers ? (
              <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>Ładowanie kont...</div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.825rem', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>
                      <th style={{ padding: '0.65rem 0.85rem' }}>Nazwa Użytkownika</th>
                      <th style={{ padding: '0.65rem 0.85rem' }}>Rola</th>
                      <th style={{ padding: '0.65rem 0.85rem' }}>Status</th>
                      <th style={{ padding: '0.65rem 0.85rem' }}>Akcje</th>
                    </tr>
                  </thead>
                  <tbody>
                    {usersList.map((u) => (
                      <tr key={u.id || u.username} style={{ borderBottom: '1px solid var(--border-color)' }}>
                        <td style={{ padding: '0.75rem 0.85rem', fontWeight: 600, color: '#ffffff' }}>
                          {u.username}
                        </td>
                        <td style={{ padding: '0.75rem 0.85rem' }}>
                          <span style={{
                            padding: '0.15rem 0.5rem',
                            borderRadius: '10px',
                            fontSize: '0.7rem',
                            fontWeight: 700,
                            background: u.role === 'Administrator' ? 'rgba(139, 92, 246, 0.15)' : 'rgba(59, 130, 246, 0.15)',
                            color: u.role === 'Administrator' ? '#c084fc' : '#60a5fa'
                          }}>
                            {u.role}
                          </span>
                        </td>
                        <td style={{ padding: '0.75rem 0.85rem', color: '#10b981', fontSize: '0.75rem' }}>
                          Konto Aktywne
                        </td>
                        <td style={{ padding: '0.75rem 0.85rem' }}>
                          <button
                            onClick={() => {
                              setTargetUserForPassword({ id: u.id, username: u.username });
                              setChangePasswordVal('');
                              setChangePasswordMsg(null);
                            }}
                            className="btn-action"
                            style={{ padding: '0.25rem 0.6rem', fontSize: '0.725rem', background: 'rgba(59, 130, 246, 0.15)', color: '#60a5fa', border: '1px solid rgba(59, 130, 246, 0.3)', borderRadius: '6px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                          >
                            <Key size={13} /> Zmień Hasło
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modal Zmiany Hasła Użytkownika przez Administratora */}
      {targetUserForPassword && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(15, 23, 42, 0.85)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '1rem'
        }}>
          <div className="soc-card" style={{ width: '100%', maxWidth: '420px', padding: '1.75rem', position: 'relative' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '1.25rem' }}>
              <div style={{ background: 'rgba(59, 130, 246, 0.15)', color: '#60a5fa', padding: '0.6rem', borderRadius: '8px' }}>
                <Key size={22} />
              </div>
              <div>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#ffffff' }}>Zmiana Hasła Użytkownika</h3>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Konto: <span style={{ color: 'var(--ai-cyan)', fontWeight: 600 }}>{targetUserForPassword.username}</span></p>
              </div>
            </div>

            {changePasswordMsg && (
              <div style={{
                background: changePasswordMsg.isError ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                border: `1px solid ${changePasswordMsg.isError ? 'rgba(239, 68, 68, 0.3)' : 'rgba(16, 185, 129, 0.3)'}`,
                color: changePasswordMsg.isError ? '#f87171' : '#34d399',
                padding: '0.65rem 0.85rem',
                borderRadius: '8px',
                marginBottom: '1.25rem',
                fontSize: '0.825rem'
              }}>
                {changePasswordMsg.text}
              </div>
            )}

            <form onSubmit={handleChangePasswordSubmit}>
              <div style={{ marginBottom: '1.25rem' }}>
                <label style={{ display: 'block', fontSize: '0.775rem', color: 'var(--text-muted)', marginBottom: '0.4rem', fontWeight: 500 }}>
                  Wpisz Nowe Hasło *
                </label>
                <div style={{ position: 'relative' }}>
                  <Lock size={16} style={{ position: 'absolute', left: '12px', top: '12px', color: 'var(--text-muted)' }} />
                  <input
                    type="password"
                    required
                    autoFocus
                    placeholder="Nowe bezpieczne hasło..."
                    value={changePasswordVal}
                    onChange={(e) => setChangePasswordVal(e.target.value)}
                    style={{ width: '100%', background: '#161e2e', border: '1px solid var(--border-color)', color: 'white', padding: '0.65rem 0.75rem 0.65rem 2.4rem', borderRadius: '8px', fontSize: '0.875rem' }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button
                  type="button"
                  onClick={() => setTargetUserForPassword(null)}
                  className="btn-action"
                  style={{ flex: 1, justifyContent: 'center', background: '#1e293b', color: 'var(--text-muted)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '0.7rem' }}
                >
                  Anuluj
                </button>
                <button
                  type="submit"
                  disabled={changingPassword}
                  className="btn-action btn-ai-primary"
                  style={{ flex: 1, justifyContent: 'center', borderRadius: '8px', padding: '0.7rem' }}
                >
                  {changingPassword ? 'Zapisywanie...' : 'Zapisz Hasło'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
