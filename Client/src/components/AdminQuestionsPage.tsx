import React, { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Search, Filter, HelpCircle, CheckCircle, AlertTriangle, RefreshCw } from 'lucide-react';
import type { Alert } from '../types/alert';
import { fetchTestSet, addTestAlertItem, updateTestAlertItem, deleteTestAlertItem } from '../services/api';

export const AdminQuestionsPage: React.FC = () => {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterSeverity, setFilterSeverity] = useState('ALL');
  const [filterThreat, setFilterThreat] = useState('ALL');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAlert, setEditingAlert] = useState<Alert | null>(null);
  const [statusMsg, setStatusMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Form State
  const [formData, setFormData] = useState<Partial<Alert>>({
    title: '',
    severity: 'High',
    category: 'Attack',
    sourceIp: '185.220.101.10',
    destinationHost: 'Web Server 16 Public (192.168.10.50) (Port 80)',
    userAccount: 'EXTERNAL_ATTACKER\\node_01',
    mitreTechnique: 'T1190 - Exploitation of Vulnerability',
    description: '',
    isThreat: true,
    correctAction: 'Isolate Host / Block',
    rawLogs: ['{\n  "Destination Port": "80",\n  "Flow Duration": "500"\n}']
  });

  const loadQuestions = async () => {
    setLoading(true);
    try {
      const data = await fetchTestSet();
      setAlerts(data);
    } catch (err) {
      console.error('Błąd ładowania zestawu pytań:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadQuestions();
  }, []);

  const handleOpenAddModal = () => {
    setEditingAlert(null);
    setFormData({
      id: `ALT-${(alerts.length + 1).toString().padStart(3, '0')}`,
      title: 'Zdarzenie #' + (alerts.length + 1) + ': Wykryto Nową Anomalię Sieciową',
      severity: 'High',
      category: 'Network Exploit',
      sourceIp: '185.220.101.50',
      destinationHost: 'Web Server 16 (192.168.10.50) (Port 80)',
      userAccount: 'EXTERNAL_ATTACKER\\node_50',
      mitreTechnique: 'T1190 - Exploitation of Vulnerability',
      description: 'Opis nowo wygenerowanego zdarzenia testowego.',
      isThreat: true,
      correctAction: 'Isolate Host / Block',
      rawLogs: ['{\n  "Destination Port": "80",\n  "Flow Duration": "1000"\n}']
    });
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (alert: Alert) => {
    setEditingAlert(alert);
    setFormData({ ...alert });
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm(`Czy na pewno chcesz usunąć pytanie/alert ${id} z bazy pytań testowych?`)) return;

    const res = await deleteTestAlertItem(id);
    if (res.success) {
      setStatusMsg({ text: res.message, type: 'success' });
      loadQuestions();
    } else {
      setStatusMsg({ text: res.message, type: 'error' });
    }
  };

  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title || !formData.description) {
      alert('Wypełnij tytuł oraz opis pytania.');
      return;
    }

    if (editingAlert) {
      const res = await updateTestAlertItem(editingAlert.id, formData);
      if (res.success) {
        setStatusMsg({ text: res.message, type: 'success' });
        setIsModalOpen(false);
        loadQuestions();
      } else {
        setStatusMsg({ text: res.message, type: 'error' });
      }
    } else {
      const res = await addTestAlertItem(formData);
      if (res.success) {
        setStatusMsg({ text: res.message, type: 'success' });
        setIsModalOpen(false);
        loadQuestions();
      } else {
        setStatusMsg({ text: res.message, type: 'error' });
      }
    }
  };

  const filteredAlerts = alerts.filter(a => {
    const matchesSearch =
      a.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.sourceIp.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesSeverity = filterSeverity === 'ALL' || a.severity.toUpperCase() === filterSeverity;
    const matchesThreat =
      filterThreat === 'ALL' ||
      (filterThreat === 'THREAT' && a.isThreat) ||
      (filterThreat === 'BENIGN' && !a.isThreat);

    return matchesSearch && matchesSeverity && matchesThreat;
  });

  return (
    <div style={{ width: '100%', maxWidth: '1400px', margin: '0 auto', padding: '1rem 0' }}>
      {/* Header Banner */}
      <div className="soc-card" style={{
        padding: '1.25rem 1.5rem',
        marginBottom: '1.25rem',
        background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.95), rgba(7, 10, 18, 0.98))',
        border: '1px solid rgba(56, 189, 248, 0.3)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'rgba(56, 189, 248, 0.12)', color: '#38bdf8', padding: '0.15rem 0.6rem', borderRadius: '12px', fontSize: '0.7rem', fontWeight: 600, marginBottom: '0.4rem' }}>
              <HelpCircle size={13} /> PANEL ADMINISTRATORA: ZARZĄDZANIE ZESTAWEM PYTAŃ (TEST_PYTANIA.JSON)
            </div>
            <h2 style={{ fontSize: '1.35rem', fontWeight: 800, color: '#ffffff', margin: 0 }}>
              Baza Zdarzeń i Pytań Testowych ({alerts.length} Incydentów)
            </h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: '0.2rem', margin: 0 }}>
              Możesz tu dodawać nowe pytania, modyfikować parametry (IP, techniki MITRE, flagę isThreat) oraz uaktualniać wzorcowe odpowiedzi operatora.
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button
              onClick={loadQuestions}
              className="btn-action"
              style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', padding: '0.4rem 0.85rem' }}
            >
              <RefreshCw size={14} /> Odśwież
            </button>
            <button
              onClick={handleOpenAddModal}
              className="btn-action btn-primary"
              style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', padding: '0.4rem 0.9rem', background: 'linear-gradient(135deg, #0284c7, #2563eb)' }}
            >
              <Plus size={15} /> Dodaj Nowe Pytanie / Alert
            </button>
          </div>
        </div>
      </div>

      {statusMsg && (
        <div style={{
          padding: '0.75rem 1rem',
          borderRadius: '8px',
          marginBottom: '1rem',
          background: statusMsg.type === 'success' ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)',
          border: statusMsg.type === 'success' ? '1px solid rgba(34, 197, 94, 0.3)' : '1px solid rgba(239, 68, 68, 0.3)',
          color: statusMsg.type === 'success' ? '#4ade80' : '#f87171',
          fontSize: '0.85rem',
          fontWeight: 600
        }}>
          {statusMsg.text}
        </div>
      )}

      {/* Metrics Bar */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginBottom: '1.25rem' }}>
        <div className="soc-card" style={{ padding: '1rem' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>ŁĄCZNIE PYTAŃ W BAZIE</div>
          <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#ffffff', marginTop: '0.2rem' }}>{alerts.length}</div>
        </div>
        <div className="soc-card" style={{ padding: '1rem' }}>
          <div style={{ fontSize: '0.75rem', color: '#f87171', fontWeight: 600 }}>INCYDENTY ZAGROŻEŃ (ATAKI)</div>
          <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#f87171', marginTop: '0.2rem' }}>{alerts.filter(a => a.isThreat).length}</div>
        </div>
        <div className="soc-card" style={{ padding: '1rem' }}>
          <div style={{ fontSize: '0.75rem', color: '#4ade80', fontWeight: 600 }}>RUCH PRAWIDŁOWY (FALSE POSITIVE)</div>
          <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#4ade80', marginTop: '0.2rem' }}>{alerts.filter(a => !a.isThreat).length}</div>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="soc-card" style={{ padding: '0.85rem 1.1rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.85rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, minWidth: '260px' }}>
          <Search size={16} color="var(--text-muted)" />
          <input
            type="text"
            placeholder="Szukaj po ID (ALT-001), tytule, IP lub kategorii..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              background: 'rgba(15, 23, 42, 0.6)',
              border: '1px solid var(--border-color)',
              color: '#ffffff',
              borderRadius: '6px',
              padding: '0.4rem 0.75rem',
              fontSize: '0.825rem'
            }}
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            <Filter size={14} /> Severność:
            <select
              value={filterSeverity}
              onChange={e => setFilterSeverity(e.target.value)}
              style={{
                background: 'rgba(15, 23, 42, 0.8)',
                border: '1px solid var(--border-color)',
                color: '#ffffff',
                borderRadius: '6px',
                padding: '0.35rem 0.6rem',
                fontSize: '0.8rem'
              }}
            >
              <option value="ALL">Wszystkie</option>
              <option value="CRITICAL">Critical</option>
              <option value="HIGH">High</option>
              <option value="MEDIUM">Medium</option>
              <option value="LOW">Low</option>
            </select>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            Typ Zdarzenia:
            <select
              value={filterThreat}
              onChange={e => setFilterThreat(e.target.value)}
              style={{
                background: 'rgba(15, 23, 42, 0.8)',
                border: '1px solid var(--border-color)',
                color: '#ffffff',
                borderRadius: '6px',
                padding: '0.35rem 0.6rem',
                fontSize: '0.8rem'
              }}
            >
              <option value="ALL">Wszystkie</option>
              <option value="THREAT">Tylko Ataki (Threat = True)</option>
              <option value="BENIGN">Tylko Ruch Prawidłowy (Benign = False)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Table of Alerts */}
      <div className="soc-card" style={{ padding: 0, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            Ładowanie bazy pytań testowych...
          </div>
        ) : filteredAlerts.length === 0 ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            Brak pytań spełniających podane kryteria wyszukiwania.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.8rem' }}>
              <thead>
                <tr style={{ background: 'rgba(15, 23, 42, 0.8)', borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>
                  <th style={{ padding: '0.75rem 1rem' }}>ID</th>
                  <th style={{ padding: '0.75rem 1rem' }}>TYTUŁ / OPIS INCYDENTU</th>
                  <th style={{ padding: '0.75rem 1rem' }}>KATEGORIA</th>
                  <th style={{ padding: '0.75rem 1rem' }}>SEVERITY</th>
                  <th style={{ padding: '0.75rem 1rem' }}>TYP (IS THREAT)</th>
                  <th style={{ padding: '0.75rem 1rem' }}>WZORCOWA ODPOWIEDŹ (CORRECT ACTION)</th>
                  <th style={{ padding: '0.75rem 1rem' }}>ŹRÓDŁO IP</th>
                  <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>AKCJE</th>
                </tr>
              </thead>
              <tbody>
                {filteredAlerts.map(alert => {
                  let correctLabelColor = '#94a3b8';
                  let correctLabelBg = 'rgba(100, 116, 139, 0.15)';
                  const act = (alert.correctAction || '').toLowerCase();
                  if (act.includes('isolate') || act.includes('block')) {
                    correctLabelColor = '#f87171';
                    correctLabelBg = 'rgba(239, 68, 68, 0.15)';
                  } else if (act.includes('investigate') || act.includes('password')) {
                    correctLabelColor = '#facc15';
                    correctLabelBg = 'rgba(234, 179, 8, 0.15)';
                  } else if (act.includes('escalate') || act.includes('tier')) {
                    correctLabelColor = '#c084fc';
                    correctLabelBg = 'rgba(168, 85, 247, 0.15)';
                  }

                  return (
                    <tr key={alert.id} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)', transition: 'background 0.15s' }}>
                      <td style={{ padding: '0.75rem 1rem', fontWeight: 700, color: '#38bdf8' }}>{alert.id}</td>
                      <td style={{ padding: '0.75rem 1rem', maxWidth: '340px' }}>
                        <div style={{ fontWeight: 600, color: '#ffffff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {alert.title}
                        </div>
                        <div style={{ fontSize: '0.725rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginTop: '2px' }}>
                          {alert.description}
                        </div>
                      </td>
                      <td style={{ padding: '0.75rem 1rem', color: 'var(--text-muted)' }}>{alert.category}</td>
                      <td style={{ padding: '0.75rem 1rem' }}>
                        <span style={{
                          padding: '0.15rem 0.5rem',
                          borderRadius: '4px',
                          fontSize: '0.725rem',
                          fontWeight: 700,
                          background: alert.severity === 'Critical' ? 'rgba(239, 68, 68, 0.2)' : alert.severity === 'High' ? 'rgba(249, 115, 22, 0.2)' : alert.severity === 'Medium' ? 'rgba(234, 179, 8, 0.2)' : 'rgba(100, 116, 139, 0.2)',
                          color: alert.severity === 'Critical' ? '#f87171' : alert.severity === 'High' ? '#fb923c' : alert.severity === 'Medium' ? '#facc15' : '#94a3b8'
                        }}>
                          {alert.severity}
                        </span>
                      </td>
                      <td style={{ padding: '0.75rem 1rem' }}>
                        {alert.isThreat ? (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: '#f87171', fontWeight: 600, fontSize: '0.75rem' }}>
                            <AlertTriangle size={13} /> Atak (Zagrożenie)
                          </span>
                        ) : (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: '#4ade80', fontWeight: 600, fontSize: '0.75rem' }}>
                            <CheckCircle size={13} /> Ruch Prawidłowy
                          </span>
                        )}
                      </td>
                      <td style={{ padding: '0.75rem 1rem' }}>
                        <span style={{
                          padding: '0.2rem 0.55rem',
                          borderRadius: '6px',
                          fontSize: '0.725rem',
                          fontWeight: 600,
                          background: correctLabelBg,
                          color: correctLabelColor
                        }}>
                          {alert.correctAction || (alert.isThreat ? 'Isolate Host / Block' : 'Dismiss / False Positive')}
                        </span>
                      </td>
                      <td style={{ padding: '0.75rem 1rem', fontFamily: 'monospace', color: 'var(--text-muted)' }}>{alert.sourceIp}</td>
                      <td style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '6px' }}>
                          <button
                            onClick={() => handleOpenEditModal(alert)}
                            style={{
                              background: 'rgba(56, 189, 248, 0.15)',
                              border: '1px solid rgba(56, 189, 248, 0.3)',
                              color: '#38bdf8',
                              padding: '0.3rem 0.5rem',
                              borderRadius: '4px',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px',
                              fontSize: '0.725rem'
                            }}
                            title="Edytuj parametry pytania"
                          >
                            <Edit2 size={12} /> Edytuj
                          </button>
                          <button
                            onClick={() => handleDelete(alert.id)}
                            style={{
                              background: 'rgba(239, 68, 68, 0.15)',
                              border: '1px solid rgba(239, 68, 68, 0.3)',
                              color: '#f87171',
                              padding: '0.3rem 0.5rem',
                              borderRadius: '4px',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px',
                              fontSize: '0.725rem'
                            }}
                            title="Usuń pytanie"
                          >
                            <Trash2 size={12} /> Usuń
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal Dodawania / Edycji Pytania */}
      {isModalOpen && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.75)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '1rem'
        }}>
          <div className="soc-card" style={{ width: '100%', maxWidth: '720px', maxHeight: '90vh', overflowY: 'auto', padding: '1.5rem', border: '1px solid rgba(56, 189, 248, 0.4)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.15rem', color: '#ffffff', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Shield size={18} color="#38bdf8" />
                {editingAlert ? `Edycja Pytania / Alertu (${editingAlert.id})` : 'Dodaj Nowe Pytanie do Bazy Testowej'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '1.2rem', cursor: 'pointer' }}>✕</button>
            </div>

            <form onSubmit={handleSubmitForm} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.775rem', color: 'var(--text-muted)', marginBottom: '0.3rem' }}>ID Alertu / Pytania</label>
                  <input
                    type="text"
                    value={formData.id || ''}
                    onChange={e => setFormData({ ...formData, id: e.target.value })}
                    disabled={!!editingAlert}
                    style={{ width: '100%', background: 'rgba(15, 23, 42, 0.6)', border: '1px solid var(--border-color)', color: '#ffffff', padding: '0.45rem', borderRadius: '6px', fontSize: '0.825rem' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.775rem', color: 'var(--text-muted)', marginBottom: '0.3rem' }}>Poziom Zagrożenia (Severity)</label>
                  <select
                    value={formData.severity || 'High'}
                    onChange={e => setFormData({ ...formData, severity: e.target.value as Alert['severity'] })}
                    style={{ width: '100%', background: 'rgba(15, 23, 42, 0.8)', border: '1px solid var(--border-color)', color: '#ffffff', padding: '0.45rem', borderRadius: '6px', fontSize: '0.825rem' }}
                  >
                    <option value="Critical">Critical</option>
                    <option value="High">High</option>
                    <option value="Medium">Medium</option>
                    <option value="Low">Low</option>
                  </select>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.775rem', color: 'var(--text-muted)', marginBottom: '0.3rem' }}>Tytuł Pytania / Zdarzenia</label>
                <input
                  type="text"
                  value={formData.title || ''}
                  onChange={e => setFormData({ ...formData, title: e.target.value })}
                  style={{ width: '100%', background: 'rgba(15, 23, 42, 0.6)', border: '1px solid var(--border-color)', color: '#ffffff', padding: '0.45rem', borderRadius: '6px', fontSize: '0.825rem' }}
                  placeholder="np. Zdarzenie #76: Wykryto Atak SQL Injection"
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.775rem', color: 'var(--text-muted)', marginBottom: '0.3rem' }}>Czy to jest Atak (IsThreat)?</label>
                  <select
                    value={formData.isThreat ? 'true' : 'false'}
                    onChange={e => {
                      const isT = e.target.value === 'true';
                      setFormData({
                        ...formData,
                        isThreat: isT,
                        correctAction: isT ? (formData.correctAction === 'Dismiss / False Positive' ? 'Isolate Host / Block' : formData.correctAction) : 'Dismiss / False Positive'
                      });
                    }}
                    style={{ width: '100%', background: 'rgba(15, 23, 42, 0.8)', border: '1px solid var(--border-color)', color: '#ffffff', padding: '0.45rem', borderRadius: '6px', fontSize: '0.825rem' }}
                  >
                    <option value="true">TAK (Jest Atakiem / Threat)</option>
                    <option value="false">NIE (Ruch Prawidłowy / Benign)</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.775rem', color: 'var(--text-muted)', marginBottom: '0.3rem' }}>Wzorcowa Odpowiedź Operatora (Correct Action)</label>
                  <select
                    value={formData.correctAction || 'Isolate Host / Block'}
                    onChange={e => setFormData({ ...formData, correctAction: e.target.value })}
                    style={{ width: '100%', background: 'rgba(15, 23, 42, 0.8)', border: '1px solid var(--border-color)', color: '#ffffff', padding: '0.45rem', borderRadius: '6px', fontSize: '0.825rem' }}
                  >
                    <option value="Isolate Host / Block">Isolate Host / Block (Izolacja Hosta)</option>
                    <option value="Investigate / Reset Password">Investigate / Reset Password (Badanie / Reset Hasła)</option>
                    <option value="Escalate / Tier 2">Escalate / Tier 2 (Eskalacja do L2)</option>
                    <option value="Dismiss / False Positive">Dismiss / False Positive (Zignoruj / Fałszywy Alarm)</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.775rem', color: 'var(--text-muted)', marginBottom: '0.3rem' }}>Kategoria</label>
                  <input
                    type="text"
                    value={formData.category || ''}
                    onChange={e => setFormData({ ...formData, category: e.target.value })}
                    style={{ width: '100%', background: 'rgba(15, 23, 42, 0.6)', border: '1px solid var(--border-color)', color: '#ffffff', padding: '0.45rem', borderRadius: '6px', fontSize: '0.825rem' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.775rem', color: 'var(--text-muted)', marginBottom: '0.3rem' }}>Technika MITRE ATT&CK</label>
                  <input
                    type="text"
                    value={formData.mitreTechnique || ''}
                    onChange={e => setFormData({ ...formData, mitreTechnique: e.target.value })}
                    style={{ width: '100%', background: 'rgba(15, 23, 42, 0.6)', border: '1px solid var(--border-color)', color: '#ffffff', padding: '0.45rem', borderRadius: '6px', fontSize: '0.825rem' }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.775rem', color: 'var(--text-muted)', marginBottom: '0.3rem' }}>Źródłowy IP</label>
                  <input
                    type="text"
                    value={formData.sourceIp || ''}
                    onChange={e => setFormData({ ...formData, sourceIp: e.target.value })}
                    style={{ width: '100%', background: 'rgba(15, 23, 42, 0.6)', border: '1px solid var(--border-color)', color: '#ffffff', padding: '0.45rem', borderRadius: '6px', fontSize: '0.825rem' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.775rem', color: 'var(--text-muted)', marginBottom: '0.3rem' }}>Host Docelowy</label>
                  <input
                    type="text"
                    value={formData.destinationHost || ''}
                    onChange={e => setFormData({ ...formData, destinationHost: e.target.value })}
                    style={{ width: '100%', background: 'rgba(15, 23, 42, 0.6)', border: '1px solid var(--border-color)', color: '#ffffff', padding: '0.45rem', borderRadius: '6px', fontSize: '0.825rem' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.775rem', color: 'var(--text-muted)', marginBottom: '0.3rem' }}>Konto Użytkownika</label>
                  <input
                    type="text"
                    value={formData.userAccount || ''}
                    onChange={e => setFormData({ ...formData, userAccount: e.target.value })}
                    style={{ width: '100%', background: 'rgba(15, 23, 42, 0.6)', border: '1px solid var(--border-color)', color: '#ffffff', padding: '0.45rem', borderRadius: '6px', fontSize: '0.825rem' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.775rem', color: 'var(--text-muted)', marginBottom: '0.3rem' }}>Opis Incydentu / Przepływu Sieciowego</label>
                <textarea
                  rows={3}
                  value={formData.description || ''}
                  onChange={e => setFormData({ ...formData, description: e.target.value })}
                  style={{ width: '100%', background: 'rgba(15, 23, 42, 0.6)', border: '1px solid var(--border-color)', color: '#ffffff', padding: '0.45rem', borderRadius: '6px', fontSize: '0.825rem', fontFamily: 'inherit' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.775rem', color: 'var(--text-muted)', marginBottom: '0.3rem' }}>Surowe Logi / NetFlow (JSON)</label>
                <textarea
                  rows={4}
                  value={Array.isArray(formData.rawLogs) ? formData.rawLogs[0] : (formData.rawLogs || '')}
                  onChange={e => setFormData({ ...formData, rawLogs: [e.target.value] })}
                  style={{ width: '100%', background: 'rgba(15, 23, 42, 0.8)', border: '1px solid var(--border-color)', color: '#38bdf8', padding: '0.45rem', borderRadius: '6px', fontSize: '0.775rem', fontFamily: 'monospace' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  style={{ padding: '0.45rem 1rem', background: 'rgba(100, 116, 139, 0.2)', color: 'var(--text-muted)', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '0.825rem' }}
                >
                  Anuluj
                </button>
                <button
                  type="submit"
                  className="btn-action btn-primary"
                  style={{ padding: '0.45rem 1.25rem', fontSize: '0.825rem' }}
                >
                  Zapisz Pytanie do Bazy (test_pytania.json)
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
