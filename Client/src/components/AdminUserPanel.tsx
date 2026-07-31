import React, { useEffect, useState } from 'react';
import { registerUserByAdmin, fetchRegisteredUsers, fetchActiveSessions, changeUserPasswordByAdmin, deleteAllTestAlerts, importAttackSamples } from '../services/api';
import type { UserSession } from '../types/alert';
import { UserPlus, ShieldAlert, Users, Lock, User, CheckCircle2, AlertCircle, RefreshCw, ShieldCheck, UserCheck, KeyRound, Key, ChevronDown, ChevronUp, Clock, BarChart2, Trash2, Upload } from 'lucide-react';
import '../styles/AdminUserPanel.css';

interface AdminUserPanelProps {
  userSession: UserSession;
}

export const AdminUserPanel: React.FC<AdminUserPanelProps> = ({ userSession }) => {
  const [usersList, setUsersList] = useState<Array<{ id: string; username: string; email: string; role: string }>>([]);
  const [activeSessions, setActiveSessions] = useState<Array<{ id: string; username: string; role: string; createdAt: string; expiresAt: string }>>([]);
  const [testSessions, setTestSessions] = useState<Array<any>>([]);
  const [expandedSessionId, setExpandedSessionId] = useState<string | null>(null);
  const [loadingUsers, setLoadingUsers] = useState<boolean>(true);
  const [loadingSessions, setLoadingSessions] = useState<boolean>(true);

  // Dataset management state
  const [deletingAllQuestions, setDeletingAllQuestions] = useState<boolean>(false);
  const [importingSamples, setImportingSamples] = useState<boolean>(false);
  const [datasetMsg, setDatasetMsg] = useState<{ isError: boolean; text: string } | null>(null);

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

  // Helper do kondensacji sesji testowych (grupowanie pojedynczych prób testowych)
  const getCondensedTestSessions = (rawSessions: Array<any>) => {
    if (!rawSessions || !Array.isArray(rawSessions)) return [];

    const map = new Map<string, any>();

    rawSessions.forEach((s) => {
      const operator = s.operatorName || s.OperatorName || 'Anonim';
      const mode = s.mode || s.Mode || 'NoAI';
      const startTime = s.startTime || s.StartTime || '';
      const sessionId = s.sessionId || s.SessionId;
      
      // Klucz grupowania: sessionId jeśli istnieje, w przeciwnym razie kombinacja z minutą
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

  const condensedSessions = getCondensedTestSessions(testSessions);

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
      return { label: 'Izolacja Hosta', className: 'badge-action-isolate' };
    }
    if (act.includes('block') || act.includes('zablokuj')) {
      return { label: 'Blokada IP', className: 'badge-action-block' };
    }
    if (act.includes('escalat') || act.includes('eskaluj')) {
      return { label: 'Eskalacja', className: 'badge-action-escalate' };
    }
    return { label: 'Odrzucenie (Dismiss)', className: 'badge-action-dismiss' };
  };

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

  const handleDeleteAllQuestions = async () => {
    if (!window.confirm("CZY NA PEWNO chcesz usunąć WSZYSTKIE pytania testowe z bazy danych MongoDB Atlas oraz pliku lokalnego?\n\nTa operacja usunie wszystkie rekordy pytań i jest NIEODWRACALNA!")) {
      return;
    }
    setDeletingAllQuestions(true);
    setDatasetMsg(null);
    const res = await deleteAllTestAlerts();
    setDeletingAllQuestions(false);

    if (res.success) {
      setDatasetMsg({ isError: false, text: res.message });
      // Odśwież widok pytań
      setTimeout(() => window.location.reload(), 1500);
    } else {
      setDatasetMsg({ isError: true, text: res.message });
    }
  };

  const handleImportSamples = async () => {
    setImportingSamples(true);
    setDatasetMsg(null);
    const res = await importAttackSamples();
    setImportingSamples(false);

    if (res.success) {
      setDatasetMsg({ isError: false, text: res.message });
      setTimeout(() => window.location.reload(), 1500);
    } else {
      setDatasetMsg({ isError: true, text: res.message });
    }
  };

  if (userSession.role !== 'Administrator') {
    return (
      <div className="admin-blocked-view">
        <ShieldAlert size={48} className="admin-blocked-icon" />
        <h2>Dostęp Zablokowany</h2>
        <p className="admin-blocked-text">
          Tylko zalogowany Administrator posiada uprawnienia do rejestrowania i zarządzania kontami oraz sesjami.
        </p>
      </div>
    );
  }

  return (
    <div className="admin-panel-wrapper">
      {/* Header Banner */}
      <div className="soc-card admin-header-card">
        <div className="admin-header-top">
          <div>
            <div className="admin-header-pill">
              <ShieldCheck size={14} /> PANEL KONTROLI ADMINISTRATORA & SESSIONS
            </div>
            <h1 className="admin-header-title">
              Zarządzanie Kontami i Aktywnymi Sesjami
            </h1>
            <p className="admin-header-subtitle">
              Rejestruj nowych operatorów w MongoDB oraz zarządzaj aktywnymi tokenami sesji i zbiorami danych.
            </p>
          </div>

          <div className="admin-header-actions">
            <button
              onClick={() => { loadUsers(); loadSessions(); }}
              className="btn-action admin-btn-refresh"
            >
              <RefreshCw size={14} /> Odśwież Baze
            </button>

            <button
              onClick={handleImportSamples}
              disabled={importingSamples}
              className="btn-action admin-btn-import"
            >
              <Upload size={14} /> {importingSamples ? 'Importowanie...' : 'Importuj Próbki Ataków'}
            </button>

            <button
              onClick={handleDeleteAllQuestions}
              disabled={deletingAllQuestions}
              className="btn-action admin-btn-delete-all"
            >
              <Trash2 size={14} /> {deletingAllQuestions ? 'Usuwanie...' : 'Usuń Wszystkie Pytania z Bazy'}
            </button>
          </div>
        </div>

        {datasetMsg && (
          <div className={`admin-feedback-msg ${datasetMsg.isError ? 'error' : 'success'}`}>
            {datasetMsg.isError ? <AlertCircle size={16} /> : <CheckCircle2 size={16} />}
            <span>{datasetMsg.text}</span>
          </div>
        )}
      </div>

      <div className="admin-layout-grid">
        {/* Left Column: Registration Form */}
        <div className="soc-card admin-form-card">
          <div className="admin-card-header">
            <div className="admin-icon-box-cyan">
              <UserPlus size={20} />
            </div>
            <div>
              <h3 className="admin-card-title">
                Rejestracja Nowego Użytkownika
              </h3>
              <p className="admin-card-subtitle">
                Dostępne tylko dla Administratora
              </p>
            </div>
          </div>

          {errorMsg && (
            <div className="admin-error-msg">
              <AlertCircle size={16} />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="admin-success-msg">
              <CheckCircle2 size={16} />
              <span>{successMsg}</span>
            </div>
          )}

          <form onSubmit={handleRegisterSubmit}>
            <div className="admin-form-group">
              <label className="admin-form-label">
                Nazwa Użytkownika / Operatora *
              </label>
              <div className="admin-input-wrapper">
                <User size={16} className="admin-input-icon" />
                <input
                  type="text"
                  required
                  placeholder="np. Analityk_Jan"
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  className="admin-input-field"
                />
              </div>
            </div>

            <div className="admin-form-group">
              <label className="admin-form-label">
                Hasło *
              </label>
              <div className="admin-input-wrapper">
                <Lock size={16} className="admin-input-icon" />
                <input
                  type="password"
                  required
                  placeholder="Wpisz bezpieczne hasło..."
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="admin-input-field"
                />
              </div>
            </div>

            <div className="admin-form-group">
              <label className="admin-form-label">
                Powtórz Hasło *
              </label>
              <div className="admin-input-wrapper">
                <Lock size={16} className="admin-input-icon" />
                <input
                  type="password"
                  required
                  placeholder="Powtórz hasło..."
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="admin-input-field"
                />
              </div>
            </div>

            <div className="admin-form-group last">
              <label className="admin-form-label">
                Rola w Systemie *
              </label>
              <select
                value={newRole}
                onChange={(e) => setNewRole(e.target.value)}
                className="admin-select-field"
              >
                <option value="Użytkownik">Użytkownik (Operator SOC)</option>
                <option value="Administrator">Administrator Systemu</option>
              </select>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="btn-action btn-ai-primary admin-submit-btn"
            >
              {submitting ? 'Rejestrowanie...' : 'Zarejestruj Użytkownika w Bazie'}
            </button>
          </form>
        </div>

        {/* Right Column: Active Sessions & Users Tables */}
        <div className="admin-right-column">
          {/* Active Sessions Table */}
          <div className="soc-card admin-table-card">
            <div className="admin-table-card-header">
              <div className="admin-table-title-box">
                <div className="admin-icon-box-green">
                  <KeyRound size={20} />
                </div>
                <div>
                  <h3 className="admin-table-title">
                    Aktywne Sesje w Bazię MongoDB (`Sessions`) ({activeSessions.length})
                  </h3>
                  <p className="admin-table-subtitle">
                    Możliwość zdalnego unieważnienia (wylogowania) dowolnej aktywnej sesji
                  </p>
                </div>
              </div>
            </div>

            {loadingSessions ? (
              <div className="admin-table-empty">Ładowanie sesji...</div>
            ) : activeSessions.length === 0 ? (
              <div className="admin-table-empty">Brak aktywnych sesji w bazie.</div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table className="admin-table">
                  <thead>
                    <tr className="admin-table-header-row">
                      <th>Operator</th>
                      <th>Rola</th>
                      <th>Zalogowano</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeSessions.map((s) => (
                      <tr key={s.id} className="admin-table-row">
                        <td className="admin-td-highlight">
                          <div className="admin-flex-align">
                            <UserCheck size={15} color="var(--ai-cyan)" />
                            <span>{s.username}</span>
                          </div>
                        </td>
                        <td>
                          <span className={`admin-role-badge ${s.role === 'Administrator' ? 'admin' : 'user'}`}>
                            {s.role}
                          </span>
                        </td>
                        <td className="admin-td-muted-small">
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
          <div className="soc-card admin-table-card">
            <div className="admin-table-card-header">
              <div className="admin-table-title-box">
                <div className="admin-icon-box-purple">
                  <ShieldCheck size={20} />
                </div>
                <div>
                  <h3 className="admin-table-title">
                    Skondensowane Wyniki Testów Operatorów ({condensedSessions.length} sesji)
                  </h3>
                  <p className="admin-table-subtitle">
                    Zagregowany podgląd zakończonych podejść badawczych i statystyk czasowych
                  </p>
                </div>
              </div>
              <button onClick={loadTestResults} className="btn-action admin-btn-action-small">
                <RefreshCw size={14} /> Odśwież Wyniki
              </button>
            </div>

            {condensedSessions.length === 0 ? (
              <div className="admin-table-empty">
                Brak zarejestrowanych sesji testowych w bazie.
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table className="admin-table">
                  <thead>
                    <tr className="admin-table-header-row">
                      <th>Operator</th>
                      <th>Tryb Testu</th>
                      <th>Postęp / Zdarzenia</th>
                      <th>Czas Łączny</th>
                      <th>Śr. Czas / Zdarzenie</th>
                      <th>Data Rozpoczęcia</th>
                      <th style={{ textAlign: 'right' }}>Szczegóły</th>
                    </tr>
                  </thead>
                  <tbody>
                    {condensedSessions.map((ts, idx) => {
                      const operator = ts.operatorName || ts.OperatorName || 'Anonim';
                      const mode = ts.mode || ts.Mode || 'NoAI';
                      const handledCount = ts.alertsHandledCount || ts.AlertsHandledCount || (ts.decisions?.length || ts.Decisions?.length || 0);
                      const durationSec = ts.totalDurationSeconds || ts.TotalDurationSeconds || 0;
                      const startTime = ts.startTime || ts.StartTime ? new Date(ts.startTime || ts.StartTime).toLocaleString() : 'N/A';
                      const decisionsList = ts.decisions || ts.Decisions || [];
                      const keyId = ts.sessionId || ts.SessionId || `${operator}_${idx}`;
                      const isExpanded = expandedSessionId === keyId;
                      const avgSecPerAlert = handledCount > 0 ? (durationSec / handledCount).toFixed(1) : '0';

                      return (
                        <React.Fragment key={keyId}>
                          <tr className={`admin-table-row ${isExpanded ? 'expanded' : ''}`}>
                            <td className="admin-td-highlight">
                              <div className="admin-flex-align">
                                <User size={14} color="var(--ai-cyan)" />
                                <span>{operator}</span>
                              </div>
                            </td>
                            <td>
                              <span className={`admin-mode-badge ${mode === 'WithAI' ? 'with-ai' : 'no-ai'}`}>
                                {mode === 'WithAI' ? 'Test 2 (Wsparcie AI)' : 'Test 1 (Bez AI)'}
                              </span>
                            </td>
                            <td>
                              <div className="admin-flex-align">
                                <span className={`admin-progress-text ${handledCount >= 75 ? 'success' : 'primary'}`}>
                                  {handledCount} / 75
                                </span>
                                {handledCount >= 75 ? (
                                  <span className="admin-badge-success-small">
                                    Ukończony
                                  </span>
                                ) : (
                                  <span className="admin-badge-primary-small">
                                    W trakcie
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="admin-td-highlight-bold">
                              <div className="admin-flex-align">
                                <Clock size={13} color="var(--text-muted)" />
                                <span>{formatDuration(durationSec)}</span>
                              </div>
                            </td>
                            <td className="admin-td-muted-medium">
                              ~{avgSecPerAlert}s / alert
                            </td>
                            <td className="admin-td-muted-small">
                              {startTime}
                            </td>
                            <td style={{ textAlign: 'right' }}>
                              <button
                                onClick={() => setExpandedSessionId(isExpanded ? null : keyId)}
                                className={`btn-action admin-expand-btn ${isExpanded ? 'expanded' : ''}`}
                              >
                                {isExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                                <span>{isExpanded ? 'Ukryj' : `Decyzje (${decisionsList.length})`}</span>
                              </button>
                            </td>
                          </tr>

                          {/* Accordion Row z rozbiciem na pojedyncze decyzje */}
                          {isExpanded && (
                            <tr>
                              <td colSpan={7} className="admin-nested-td">
                                <div className="admin-nested-container">
                                  <h4 className="admin-nested-title">
                                    <BarChart2 size={15} /> Podjęte Decyzje w Sesji (Łącznie: {decisionsList.length})
                                  </h4>

                                  {decisionsList.length === 0 ? (
                                    <p className="admin-nested-empty">Brak zarejestrowanych jednostkowych decyzji w tej sesji.</p>
                                  ) : (
                                    <table className="admin-nested-table">
                                      <thead>
                                        <tr className="admin-nested-th-row">
                                          <th className="admin-nested-th">#</th>
                                          <th className="admin-nested-th">ID Alertu</th>
                                          <th className="admin-nested-th">Podjęta Akcja</th>
                                          <th className="admin-nested-th">Czas Decyzji</th>
                                          <th className="admin-nested-th">Znacznik Czasu</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {decisionsList.map((d: any, dIdx: number) => {
                                          const badge = getActionBadge(d.actionTaken || d.ActionTaken);
                                          return (
                                            <tr key={dIdx} className="admin-nested-tr">
                                              <td className="admin-nested-td-muted">{dIdx + 1}</td>
                                              <td className="admin-nested-td-highlight">{d.alertId || d.AlertId}</td>
                                              <td className="admin-nested-td">
                                                <span className={badge.className}>
                                                  {badge.label}
                                                </span>
                                              </td>
                                              <td className="admin-nested-td-highlight-slate">
                                                {d.decisionTimeSeconds || d.DecisionTimeSeconds || 0}s
                                              </td>
                                              <td className="admin-nested-td-muted">
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

          {/* Registered Users Table */}
          <div className="soc-card admin-table-card">
            <div className="admin-table-card-header">
              <div className="admin-table-title-box">
                <div className="admin-icon-box-blue">
                  <Users size={20} />
                </div>
                <div>
                  <h3 className="admin-table-title">
                    Wszyscy Zarejestrowani Użytkownicy (`Users`) ({usersList.length})
                  </h3>
                </div>
              </div>
            </div>

            {loadingUsers ? (
              <div className="admin-table-empty">Ładowanie kont...</div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table className="admin-table">
                  <thead>
                    <tr className="admin-table-header-row">
                      <th>Nazwa Użytkownika</th>
                      <th>Rola</th>
                      <th>Status</th>
                      <th>Akcje</th>
                    </tr>
                  </thead>
                  <tbody>
                    {usersList.map((u) => (
                      <tr key={u.id || u.username} className="admin-table-row">
                        <td className="admin-td-highlight">
                          {u.username}
                        </td>
                        <td>
                          <span className={`admin-role-badge ${u.role === 'Administrator' ? 'admin' : 'user'}`}>
                            {u.role}
                          </span>
                        </td>
                        <td className="admin-td-active-status">
                          Konto Aktywne
                        </td>
                        <td>
                          <button
                            onClick={() => {
                              setTargetUserForPassword({ id: u.id, username: u.username });
                              setChangePasswordVal('');
                              setChangePasswordMsg(null);
                            }}
                            className="admin-btn-change-password"
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
        <div className="admin-modal-overlay">
          <div className="soc-card admin-modal-content">
            <div className="admin-modal-header">
              <div className="admin-modal-icon-wrapper">
                <Key size={22} />
              </div>
              <div>
                <h3 className="admin-modal-title">Zmiana Hasła Użytkownika</h3>
                <p className="admin-modal-subtitle">Konto: <span className="admin-modal-cyan-bold">{targetUserForPassword.username}</span></p>
              </div>
            </div>

            {changePasswordMsg && (
              <div className={`admin-feedback-msg ${changePasswordMsg.isError ? 'error' : 'success'}`}>
                {changePasswordMsg.text}
              </div>
            )}

            <form onSubmit={handleChangePasswordSubmit}>
              <div className="admin-form-group">
                <label className="admin-form-label">
                  Wpisz Nowe Hasło *
                </label>
                <div className="admin-input-wrapper">
                  <Lock size={16} className="admin-input-icon" />
                  <input
                    type="password"
                    required
                    autoFocus
                    placeholder="Nowe bezpieczne hasło..."
                    value={changePasswordVal}
                    onChange={(e) => setChangePasswordVal(e.target.value)}
                    className="admin-input-field"
                  />
                </div>
              </div>

              <div className="admin-modal-actions">
                <button
                  type="button"
                  onClick={() => setTargetUserForPassword(null)}
                  className="btn-action admin-modal-btn-cancel"
                >
                  Anuluj
                </button>
                <button
                  type="submit"
                  disabled={changingPassword}
                  className="btn-action btn-ai-primary admin-modal-btn-confirm"
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
