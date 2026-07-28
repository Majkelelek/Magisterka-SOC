import React, { useState, useEffect } from 'react';
import type { Alert } from '../types/alert';
import { AlertTriangle, ShieldAlert, Terminal, Lock, Server, ArrowUpRight, XCircle, Search, Inbox, PlusCircle, Award, Check } from 'lucide-react';

interface NoAiTestViewProps {
  alerts: Alert[];
  onActionTaken: (alertId: string, action: string) => void;
  onAddSampleAlert?: () => void;
  onFinishTest?: () => void;
}

export const NoAiTestView: React.FC<NoAiTestViewProps> = ({ alerts, onActionTaken, onAddSampleAlert, onFinishTest }) => {
  const [handledIds, setHandledIds] = useState<string[]>([]);
  const [selectedAlertId, setSelectedAlertId] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedSeverity, setSelectedSeverity] = useState<string>('All');

  // Pozostałe alerty (te, na które operator nie podjął jeszcze decyzji)
  const remainingAlerts = alerts.filter(a => !handledIds.includes(a.id));
  const currentAlert = remainingAlerts.find(a => a.id === selectedAlertId) || remainingAlerts[0];

  useEffect(() => {
    if (remainingAlerts.length > 0 && (!selectedAlertId || handledIds.includes(selectedAlertId))) {
      setSelectedAlertId(remainingAlerts[0].id);
    }
  }, [handledIds, remainingAlerts, selectedAlertId]);

  const handleAction = (actionName: string) => {
    if (!currentAlert) return;
    const alertId = currentAlert.id;
    
    // Zapisz decyzję w stanie i backendzie
    onActionTaken(alertId, actionName);
    setHandledIds(prev => [...prev, alertId]);

    // Powiadom o zakończeniu testu, jeśli to było ostatnie pytanie
    if (remainingAlerts.length === 1 && onFinishTest) {
      onFinishTest();
    }
  };

  const getSeverityBadge = (severity: string) => {
    switch (severity?.toLowerCase()) {
      case 'critical': return <span className="badge-severity badge-critical"><AlertTriangle size={12} /> CRITICAL</span>;
      case 'high': return <span className="badge-severity badge-high"><AlertTriangle size={12} /> HIGH</span>;
      case 'medium': return <span className="badge-severity badge-medium"><AlertTriangle size={12} /> MEDIUM</span>;
      default: return <span className="badge-severity badge-low"><AlertTriangle size={12} /> LOW</span>;
    }
  };

  if (alerts.length === 0) {
    return (
      <div className="soc-card" style={{ padding: '4rem 2rem', textAlign: 'center' }}>
        <Inbox size={48} color="var(--text-muted)" style={{ margin: '0 auto 1rem auto', opacity: 0.5 }} />
        <h3 style={{ fontSize: '1.25rem', marginBottom: '0.5rem', color: '#ffffff' }}>Brak alertów w zestawie testowym</h3>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1.5rem', maxWidth: '500px', margin: '0 auto 1.5rem auto' }}>
          Zestaw testowy nie został jeszcze załadowany. Kliknij przycisk poniżej, aby załadować pytań z pliku <code>wls_test_pytania.json</code>.
        </p>
        {onAddSampleAlert && (
          <button className="btn-action btn-ai-primary" onClick={onAddSampleAlert}>
            <PlusCircle size={16} /> Załaduj Zestaw Testowy
          </button>
        )}
      </div>
    );
  }

  // Ekran podsumowania po obsłużeniu wszystkich 30 alertów
  if (remainingAlerts.length === 0) {
    return (
      <div className="soc-card" style={{ padding: '4rem 2rem', textAlign: 'center', maxWidth: '700px', margin: '2rem auto' }}>
        <div style={{ background: 'rgba(34, 197, 94, 0.15)', padding: '1.5rem', borderRadius: '50%', display: 'inline-flex', marginBottom: '1.5rem' }}>
          <Award size={64} color="#4ade80" />
        </div>
        <h2 style={{ fontSize: '1.75rem', fontWeight: 700, color: '#ffffff', marginBottom: '0.75rem' }}>
          Test Zakończony!
        </h2>
        <p style={{ color: '#cbd5e1', fontSize: '1rem', lineHeight: '1.6', marginBottom: '1.5rem' }}>
          Przeanalizowałeś wszystkie <strong>{alerts.length}</strong> zdarzeń w trybie <strong>Tradycyjnym (Bez AI)</strong>.
          Twoje decyzje zostały zapisane w bazie danych. Administrator może teraz przejrzeć wyniki w panelu zarządczym.
        </p>
        <div style={{ background: 'rgba(0,0,0,0.3)', padding: '1.25rem', borderRadius: '12px', border: '1px solid #1e293b', marginBottom: '2rem', display: 'flex', justifyContent: 'space-around' }}>
          <div>
            <span style={{ display: 'block', color: 'var(--text-muted)', fontSize: '0.8rem' }}>Przeanalizowane alerty</span>
            <strong style={{ fontSize: '1.5rem', color: '#60a5fa' }}>{handledIds.length} / {alerts.length}</strong>
          </div>
          <div>
            <span style={{ display: 'block', color: 'var(--text-muted)', fontSize: '0.8rem' }}>Stan testu</span>
            <strong style={{ fontSize: '1.25rem', color: '#4ade80', display: 'flex', alignItems: 'center', gap: '6px', justifyContent: 'center', marginTop: '4px' }}>
              <Check size={18} /> Zapisano w bazie
            </strong>
          </div>
        </div>
      </div>
    );
  }

  const filteredAlerts = remainingAlerts.filter(a => {
    const matchesSearch = a.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          a.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          a.sourceIp.includes(searchQuery) ||
                          a.destinationHost.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesSeverity = selectedSeverity === 'All' || a.severity.toLowerCase() === selectedSeverity.toLowerCase();
    return matchesSearch && matchesSeverity;
  });

  return (
    <div>
      {/* Pasek postępu testu */}
      <div style={{
        background: '#0f172a',
        border: '1px solid #1e293b',
        borderRadius: '12px',
        padding: '0.85rem 1.25rem',
        marginBottom: '1rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <ShieldAlert size={20} color="#60a5fa" />
          <span style={{ fontWeight: 600, fontSize: '0.95rem', color: '#f8fafc' }}>
            Postęp Testu 1 (Bez AI): <strong>{handledIds.length} / {alerts.length}</strong> przeanalizowanych zdarzeń
          </span>
        </div>
        <div style={{ width: '200px', background: '#1e293b', borderRadius: '8px', height: '8px', overflow: 'hidden' }}>
          <div style={{
            width: `${(handledIds.length / alerts.length) * 100}%`,
            background: 'linear-gradient(90deg, #3b82f6, #60a5fa)',
            height: '100%',
            transition: 'width 0.3s ease'
          }} />
        </div>
      </div>

      <div className="dashboard-grid">
        {/* Lewa kolumna: Kolejka alertów */}
        <div className="soc-card">
          <div className="soc-card-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <ShieldAlert size={18} color="var(--accent-blue)" />
              <span>Kolejka Alertów ({remainingAlerts.length} pozostało)</span>
            </div>
          </div>

          {/* Wyszukiwarka & Filtr */}
          <div style={{ padding: '0.75rem 1rem', borderBottom: '1px solid var(--border-color)', background: 'rgba(0,0,0,0.2)' }}>
            <div style={{ position: 'relative', marginBottom: '0.5rem' }}>
              <Search size={15} style={{ position: 'absolute', left: '10px', top: '10px', color: 'var(--text-muted)' }} />
              <input
                type="text"
                placeholder="Szukaj IP, hosta, nazwy..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  width: '100%',
                  background: '#1a2332',
                  border: '1px solid var(--border-color)',
                  color: 'white',
                  padding: '0.45rem 0.5rem 0.45rem 2rem',
                  borderRadius: '6px',
                  fontSize: '0.8rem'
                }}
              />
            </div>

            <div style={{ display: 'flex', gap: '0.35rem' }}>
              {['All', 'Critical', 'High', 'Medium', 'Low'].map((sev) => (
                <button
                  key={sev}
                  onClick={() => setSelectedSeverity(sev)}
                  style={{
                    background: selectedSeverity === sev ? 'var(--accent-blue)' : '#1f2937',
                    color: selectedSeverity === sev ? 'white' : 'var(--text-muted)',
                    border: 'none',
                    padding: '0.25rem 0.6rem',
                    borderRadius: '4px',
                    fontSize: '0.725rem',
                    cursor: 'pointer',
                    fontWeight: 500
                  }}
                >
                  {sev === 'All' ? 'Wszystkie' : sev}
                </button>
              ))}
            </div>
          </div>

          {/* Lista alertów */}
          <div style={{ maxHeight: '640px', overflowY: 'auto' }}>
            {filteredAlerts.map((alert) => (
              <div
                key={alert.id}
                className={`alert-item ${currentAlert?.id === alert.id ? 'selected' : ''}`}
                onClick={() => setSelectedAlertId(alert.id)}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                  <span className="mono" style={{ fontSize: '0.75rem', color: 'var(--accent-blue)', fontWeight: 600 }}>
                    {alert.id}
                  </span>
                  {getSeverityBadge(alert.severity)}
                </div>
                <div className="alert-item-title">{alert.title}</div>
                <div className="alert-item-meta">
                  <span>Host: {alert.destinationHost}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Prawa kolumna: Widok analityczny */}
        {currentAlert ? (
          <div className="soc-card" style={{ minHeight: '600px' }}>
            <div className="soc-card-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Terminal size={18} color="var(--accent-blue)" />
                <span>Szczegóły Analityczne Incydentu [{currentAlert.id}]</span>
              </div>
              <div>{getSeverityBadge(currentAlert.severity)}</div>
            </div>

            <div style={{ padding: '1.25rem' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.75rem', color: '#ffffff' }}>
                {currentAlert.title}
              </h2>

              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                gap: '0.75rem',
                background: 'rgba(0,0,0,0.3)',
                padding: '1rem',
                borderRadius: '8px',
                border: '1px solid var(--border-color)',
                marginBottom: '1.25rem',
                fontSize: '0.85rem'
              }}>
                <div>
                  <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.75rem' }}>Źródłowy IP:</span>
                  <span className="mono" style={{ fontWeight: 600, color: '#60a5fa' }}>{currentAlert.sourceIp}</span>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.75rem' }}>Docelowy Host:</span>
                  <span className="mono" style={{ fontWeight: 600, color: '#f3f4f6' }}>{currentAlert.destinationHost}</span>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.75rem' }}>Użytkownik:</span>
                  <span className="mono" style={{ color: '#f3f4f6' }}>{currentAlert.userAccount}</span>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.75rem' }}>Wywołana Taktyka:</span>
                  <span style={{ color: '#f87171', fontWeight: 600 }}>{currentAlert.mitreTechnique}</span>
                </div>
              </div>

              <div style={{ marginBottom: '1.25rem' }}>
                <h4 style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: '0.4rem' }}>Opis Zdarzenia (SIEM/EDR):</h4>
                <p style={{ fontSize: '0.9rem', lineHeight: '1.5', color: '#d1d5db', background: 'rgba(255,255,255,0.02)', padding: '0.85rem', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
                  {currentAlert.description}
                </p>
              </div>

              <div style={{ marginBottom: '1.5rem' }}>
                <h4 style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: '0.4rem' }}>Surowe Logi Bezpieczeństwa (LANL 2017):</h4>
                <div style={{
                  background: '#070a12',
                  border: '1px solid #1f293d',
                  borderRadius: '8px',
                  padding: '0.85rem',
                  maxHeight: '180px',
                  overflowY: 'auto'
                }}>
                  {currentAlert.rawLogs?.map((log, idx) => (
                    <div key={idx} className="mono" style={{ fontSize: '0.775rem', color: '#38bdf8', marginBottom: '0.35rem', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                      {log}
                    </div>
                  ))}
                </div>
              </div>

              {/* Przyciski Decyzji Operatora */}
              <div>
                <h4 style={{ fontSize: '0.875rem', color: '#ffffff', marginBottom: '0.65rem' }}>Podejmij Decyzję Operatora (Alert zniknie i przejdzie do następnego):</h4>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem' }}>
                  <button className="btn-action btn-danger" onClick={() => handleAction('Isolate Host / Block')}>
                    <Lock size={15} /> Izoluj Hosta / Zablokuj
                  </button>

                  <button className="btn-action btn-warning" onClick={() => handleAction('Investigate / Reset Password')}>
                    <Server size={15} /> Badaj / Zresetuj Hasło
                  </button>

                  <button className="btn-action" onClick={() => handleAction('Escalate / Tier 2')}>
                    <ArrowUpRight size={15} /> Eskaluj do L2
                  </button>

                  <button className="btn-action" onClick={() => handleAction('Dismiss / False Positive')}>
                    <XCircle size={15} /> Zignoruj (False Positive)
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
};
