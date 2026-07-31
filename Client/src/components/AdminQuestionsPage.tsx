import React, { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Search, Filter, HelpCircle, CheckCircle, AlertTriangle, RefreshCw, Shield, Upload, Sparkles, Loader2 } from 'lucide-react';
import type { Alert } from '../types/alert';
import { fetchTestSet, addTestAlertItem, updateTestAlertItem, deleteTestAlertItem, deleteAllTestAlerts, importAttackSamples, generateSingleAiAnalysis, generateAllAiAnalyses } from '../services/api';
import '../styles/AdminQuestionsPage.css';

export const AdminQuestionsPage: React.FC = () => {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterSeverity, setFilterSeverity] = useState('ALL');
  const [filterThreat, setFilterThreat] = useState('ALL');
  const [deletingAll, setDeletingAll] = useState(false);
  const [importing, setImporting] = useState(false);
  const [generatingAiId, setGeneratingAiId] = useState<string | null>(null);
  const [generatingAllAi, setGeneratingAllAi] = useState(false);

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

  const handleDeleteAll = async () => {
    if (!window.confirm("CZY NA PEWNO chcesz usunąć WSZYSTKIE pytania testowe z bazy danych MongoDB Atlas oraz pliku lokalnego?\n\nTa operacja usunie wszystkie rekordy pytań i jest NIEODWRACALNA!")) {
      return;
    }
    setDeletingAll(true);
    setStatusMsg(null);
    const res = await deleteAllTestAlerts();
    setDeletingAll(false);

    if (res.success) {
      setStatusMsg({ text: res.message, type: 'success' });
      setAlerts([]);
    } else {
      setStatusMsg({ text: res.message, type: 'error' });
    }
  };

  const handleImportSamples = async () => {
    setImporting(true);
    setStatusMsg(null);
    const res = await importAttackSamples();
    setImporting(false);

    if (res.success) {
      setStatusMsg({ text: res.message, type: 'success' });
      loadQuestions();
    } else {
      setStatusMsg({ text: res.message, type: 'error' });
    }
  };

  const handleGenerateSingleAi = async (id: string) => {
    setGeneratingAiId(id);
    setStatusMsg(null);
    const res = await generateSingleAiAnalysis(id);
    setGeneratingAiId(null);

    if (res.success) {
      setStatusMsg({ text: res.message, type: 'success' });
      loadQuestions();
    } else {
      setStatusMsg({ text: res.message, type: 'error' });
    }
  };

  const handleGenerateAllAi = async () => {
    if (!window.confirm(`Czy chcesz wygenerować i zapisać wstępne analizy AI dla WSZYSTKICH ${alerts.length} pytań w bazie? Ta operacja zajmie chwilę.`)) {
      return;
    }
    setGeneratingAllAi(true);
    setStatusMsg(null);
    const res = await generateAllAiAnalyses();
    setGeneratingAllAi(false);

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
    <div className="admin-q-wrapper">
      {/* Header Banner */}
      <div className="soc-card admin-q-header">
        <div className="admin-q-flex-header">
          <div>
            <div className="admin-q-sub-badge">
              <HelpCircle size={13} /> PANEL ADMINISTRATORA: ZARZĄDZANIE ZESTAWEM PYTAŃ (TEST_PYTANIA.JSON)
            </div>
            <h2 className="admin-q-title">
              Baza Zdarzeń i Pytań Testowych ({alerts.length} Incydentów)
            </h2>
            <p className="admin-q-desc">
              Możesz tu dodawać nowe pytania, modyfikować parametry (IP, techniki MITRE, flagę isThreat) oraz masowo usuwać lub importować zdarzenia.
            </p>
          </div>

          <div className="admin-q-btn-group">
            <button
              onClick={loadQuestions}
              className="btn-action admin-q-btn-refresh"
            >
              <RefreshCw size={14} /> Odśwież
            </button>
            <button
              onClick={handleOpenAddModal}
              className="btn-action btn-primary admin-q-btn-add"
            >
              <Plus size={15} /> Dodaj Pytanie
            </button>

            <button
              onClick={handleImportSamples}
              disabled={importing}
              className="btn-action admin-q-btn-cyan"
            >
              <Upload size={14} /> {importing ? 'Importowanie...' : 'Importuj Próbki Ataków'}
            </button>

            <button
              onClick={handleGenerateAllAi}
              disabled={generatingAllAi || loading || alerts.length === 0}
              className="btn-action admin-q-btn-sparkles"
              title="Wstępnie wygeneruj i zapisz analizy AI w bazie dla wszystkich pytań testowych"
            >
              {generatingAllAi ? (
                <>
                  <Loader2 size={14} className="animate-spin" /> Generowanie AI...
                </>
              ) : (
                <>
                  <Sparkles size={14} /> Wygeneruj AI Dla Wszystkich Pytań
                </>
              )}
            </button>

            <button
              onClick={handleDeleteAll}
              disabled={deletingAll}
              className="btn-action admin-q-btn-danger"
            >
              <Trash2 size={14} /> {deletingAll ? 'Usuwanie...' : 'Usuń Wszystkie Pytania z Bazy'}
            </button>
          </div>
        </div>
      </div>

      {statusMsg && (
        <div className={`admin-q-status-msg ${statusMsg.type}`}>
          {statusMsg.text}
        </div>
      )}

      {/* Metrics Bar */}
      <div className="admin-q-metrics-grid">
        <div className="soc-card admin-q-metric-card">
          <div className="admin-q-metric-label">ŁĄCZNIE PYTAŃ W BAZIE</div>
          <div className="admin-q-metric-val">{alerts.length}</div>
        </div>
        <div className="soc-card admin-q-metric-card">
          <div className="admin-q-metric-label" style={{ color: '#f87171' }}>INCYDENTY ZAGROŻEŃ (ATAKI)</div>
          <div className="admin-q-metric-val red">{alerts.filter(a => a.isThreat).length}</div>
        </div>
        <div className="soc-card admin-q-metric-card">
          <div className="admin-q-metric-label" style={{ color: '#4ade80' }}>RUCH PRAWIDŁOWY (FALSE POSITIVE)</div>
          <div className="admin-q-metric-val green">{alerts.filter(a => !a.isThreat).length}</div>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="soc-card admin-q-filter-bar">
        <div className="admin-q-filter-search-col">
          <Search size={16} color="var(--text-muted)" />
          <input
            type="text"
            placeholder="Szukaj po ID (ALT-001), tytule, IP lub kategorii..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="admin-q-search-input"
          />
        </div>

        <div className="admin-q-filter-dropdowns">
          <div className="admin-q-filter-label">
            <Filter size={14} /> Severność:
            <select
              value={filterSeverity}
              onChange={e => setFilterSeverity(e.target.value)}
              className="admin-q-filter-select"
            >
              <option value="ALL">Wszystkie</option>
              <option value="CRITICAL">Critical</option>
              <option value="HIGH">High</option>
              <option value="MEDIUM">Medium</option>
              <option value="LOW">Low</option>
            </select>
          </div>

          <div className="admin-q-filter-label">
            Typ Zdarzenia:
            <select
              value={filterThreat}
              onChange={e => setFilterThreat(e.target.value)}
              className="admin-q-filter-select"
            >
              <option value="ALL">Wszystkie</option>
              <option value="THREAT">Tylko Ataki (Threat = True)</option>
              <option value="BENIGN">Tylko Ruch Prawidłowy (Benign = False)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Table of Alerts */}
      <div className="soc-card admin-q-table-card">
        {loading ? (
          <div className="admin-q-table-msg">
            Ładowanie bazy pytań testowych...
          </div>
        ) : filteredAlerts.length === 0 ? (
          <div className="admin-q-table-msg">
            Brak pytań spełniających podane kryteria wyszukiwania.
          </div>
        ) : (
          <div className="admin-q-table-scroll">
            <table className="admin-q-table">
              <thead>
                <tr className="admin-q-table-row-head">
                  <th className="admin-q-table-th">ID</th>
                  <th className="admin-q-table-th">TYTUŁ / OPIS INCYDENTU</th>
                  <th className="admin-q-table-th">KATEGORIA</th>
                  <th className="admin-q-table-th">SEVERITY</th>
                  <th className="admin-q-table-th">TYP (IS THREAT)</th>
                  <th className="admin-q-table-th">WZORCOWA ODPOWIEDŹ (CORRECT ACTION)</th>
                  <th className="admin-q-table-th">ANALIZA AI</th>
                  <th className="admin-q-table-th">ŹRÓDŁO IP</th>
                  <th className="admin-q-table-th" style={{ textAlign: 'right' }}>AKCJE</th>
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

                  const hasPreGeneratedAi = Boolean(alert.aiAnalysis && !alert.aiAnalysis.includes('[Błąd'));

                  return (
                    <tr key={alert.id} className="admin-q-table-row">
                      <td className="admin-q-table-td-id">{alert.id}</td>
                      <td className="admin-q-table-td-title">
                        <div className="admin-q-table-title-main">
                          {alert.title}
                        </div>
                        <div className="admin-q-table-title-sub">
                          {alert.description}
                        </div>
                      </td>
                      <td className="admin-q-table-td-category">{alert.category}</td>
                      <td className="admin-q-table-td">
                        <span className={`admin-q-severity-badge ${alert.severity.toLowerCase()}`}>
                          {alert.severity}
                        </span>
                      </td>
                      <td className="admin-q-table-td">
                        {alert.isThreat ? (
                          <span className="admin-q-threat-badge threat">
                            <AlertTriangle size={13} /> Atak (Zagrożenie)
                          </span>
                        ) : (
                          <span className="admin-q-threat-badge benign">
                            <CheckCircle size={13} /> Ruch Prawidłowy
                          </span>
                        )}
                      </td>
                      <td className="admin-q-table-td">
                        <span className="admin-q-action-badge" style={{
                          background: correctLabelBg,
                          color: correctLabelColor
                        }}>
                          {alert.correctAction || (alert.isThreat ? 'Isolate Host / Block' : 'Dismiss / False Positive')}
                        </span>
                      </td>
                      <td className="admin-q-table-td">
                        {hasPreGeneratedAi ? (
                          <span className="admin-q-ai-badge ready">
                            <Sparkles size={11} /> AI Gotowe
                          </span>
                        ) : (
                          <span className="admin-q-ai-badge live">
                            ⚪ Brak (Na żywo)
                          </span>
                        )}
                      </td>
                      <td className="admin-q-table-td-ip">{alert.sourceIp}</td>
                      <td className="admin-q-table-td" style={{ textAlign: 'right' }}>
                        <div className="admin-q-row-actions">
                          <button
                            onClick={() => handleGenerateSingleAi(alert.id)}
                            disabled={generatingAiId === alert.id || generatingAllAi}
                            className={`admin-q-row-btn-sparkles ${hasPreGeneratedAi ? 'ready' : 'live'}`}
                            title={hasPreGeneratedAi ? "Wygeneruj ponownie wstępną analizę AI dla tego pytania" : "Wygeneruj i zapisz wstępną analizę AI w bazie"}
                          >
                            {generatingAiId === alert.id ? (
                              <Loader2 size={12} className="animate-spin" />
                            ) : (
                              <Sparkles size={12} />
                            )}
                            {hasPreGeneratedAi ? 'Odśwież AI' : 'Generuj AI'}
                          </button>
                          <button
                            onClick={() => handleOpenEditModal(alert)}
                            className="admin-q-row-btn-edit"
                            title="Edytuj parametry pytania"
                          >
                            <Edit2 size={12} /> Edytuj
                          </button>
                          <button
                            onClick={() => handleDelete(alert.id)}
                            className="admin-q-row-btn-delete"
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
        <div className="admin-q-modal-overlay">
          <div className="soc-card admin-q-modal-card">
            <div className="admin-q-modal-header">
              <h3 className="admin-q-modal-title">
                <Shield size={18} color="#38bdf8" />
                {editingAlert ? `Edycja Pytania / Alertu (${editingAlert.id})` : 'Dodaj Nowe Pytanie do Bazy Testowej'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="admin-q-modal-close">✕</button>
            </div>

            <form onSubmit={handleSubmitForm} className="admin-q-form">
              <div className="admin-q-form-row-2col">
                <div>
                  <label className="admin-q-form-label">ID Alertu / Pytania</label>
                  <input
                    type="text"
                    value={formData.id || ''}
                    onChange={e => setFormData({ ...formData, id: e.target.value })}
                    disabled={!!editingAlert}
                    className="admin-q-form-input"
                  />
                </div>
                <div>
                  <label className="admin-q-form-label">Poziom Zagrożenia (Severity)</label>
                  <select
                    value={formData.severity || 'High'}
                    onChange={e => setFormData({ ...formData, severity: e.target.value as Alert['severity'] })}
                    className="admin-q-form-select"
                  >
                    <option value="Critical">Critical</option>
                    <option value="High">High</option>
                    <option value="Medium">Medium</option>
                    <option value="Low">Low</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="admin-q-form-label">Tytuł Pytania / Zdarzenia</label>
                <input
                  type="text"
                  value={formData.title || ''}
                  onChange={e => setFormData({ ...formData, title: e.target.value })}
                  className="admin-q-form-input"
                  placeholder="np. Zdarzenie #76: Wykryto Atak SQL Injection"
                />
              </div>

              <div className="admin-q-form-row-2col">
                <div>
                  <label className="admin-q-form-label">Czy to jest Atak (IsThreat)?</label>
                  <select
                    value={formData.isThreat ? 'true' : 'false'}
                    onChange={e => {
                      const isT = e.target.value === 'true';
                      setFormData({
                        ...formData,
                        isThreat: isT,
                        correctAction: isT ? (formData.correctAction === 'Dismiss' ? 'Isolation' : formData.correctAction) : 'Dismiss'
                      });
                    }}
                    className="admin-q-form-select"
                  >
                    <option value="true">TAK (Jest Atakiem / Threat)</option>
                    <option value="false">NIE (Ruch Prawidłowy / Benign)</option>
                  </select>
                </div>

                <div>
                  <label className="admin-q-form-label">Wzorcowa Odpowiedź Operatora (Correct Action)</label>
                  <select
                    value={formData.correctAction || 'Isolation'}
                    onChange={e => setFormData({ ...formData, correctAction: e.target.value })}
                    className="admin-q-form-select"
                  >
                    <option value="Isolation">Isolation (Izolacja Hosta / Blokada Ruchu)</option>
                    <option value="Escalation">Escalation (Eskalacja do L2)</option>
                    <option value="Dismiss">Dismiss (Zignoruj / Fałszywy Alarm / BENIGN)</option>
                  </select>
                </div>
              </div>

              <div className="admin-q-form-row-2col">
                <div>
                  <label className="admin-q-form-label">Kategoria</label>
                  <input
                    type="text"
                    value={formData.category || ''}
                    onChange={e => setFormData({ ...formData, category: e.target.value })}
                    className="admin-q-form-input"
                  />
                </div>
                <div>
                  <label className="admin-q-form-label">Technika MITRE ATT&CK</label>
                  <input
                    type="text"
                    value={formData.mitreTechnique || ''}
                    onChange={e => setFormData({ ...formData, mitreTechnique: e.target.value })}
                    className="admin-q-form-input"
                  />
                </div>
              </div>

              <div className="admin-q-form-row-3col">
                <div>
                  <label className="admin-q-form-label">Źródłowy IP</label>
                  <input
                    type="text"
                    value={formData.sourceIp || ''}
                    onChange={e => setFormData({ ...formData, sourceIp: e.target.value })}
                    className="admin-q-form-input"
                  />
                </div>
                <div>
                  <label className="admin-q-form-label">Host Docelowy</label>
                  <input
                    type="text"
                    value={formData.destinationHost || ''}
                    onChange={e => setFormData({ ...formData, destinationHost: e.target.value })}
                    className="admin-q-form-input"
                  />
                </div>
                <div>
                  <label className="admin-q-form-label">Konto Użytkownika</label>
                  <input
                    type="text"
                    value={formData.userAccount || ''}
                    onChange={e => setFormData({ ...formData, userAccount: e.target.value })}
                    className="admin-q-form-input"
                  />
                </div>
              </div>

              <div>
                <label className="admin-q-form-label">Opis Incydentu / Przepływu Sieciowego</label>
                <textarea
                  rows={3}
                  value={formData.description || ''}
                  onChange={e => setFormData({ ...formData, description: e.target.value })}
                  className="admin-q-form-textarea"
                />
              </div>

              <div>
                <label className="admin-q-form-label">Surowe Logi / NetFlow (JSON)</label>
                <textarea
                  rows={4}
                  value={Array.isArray(formData.rawLogs) ? formData.rawLogs[0] : (formData.rawLogs || '')}
                  onChange={e => setFormData({ ...formData, rawLogs: [e.target.value] })}
                  className="admin-q-form-textarea-code"
                />
              </div>

              <div className="admin-q-form-footer">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="admin-q-btn-cancel"
                >
                  Anuluj
                </button>
                <button
                  type="submit"
                  className="btn-action btn-primary admin-q-btn-submit"
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
