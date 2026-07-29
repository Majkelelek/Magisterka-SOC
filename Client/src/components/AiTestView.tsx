import React, { useState, useEffect } from 'react';
import type { Alert } from '../types/alert';
import { sendAiQuery } from '../services/api';
import { NetFlowInspector } from './NetFlowInspector';
import { Bot, Sparkles, AlertTriangle, Send, Brain, PlusCircle, Inbox, Award, Check, Lock, Server, ArrowUpRight, XCircle } from 'lucide-react';

interface AiTestViewProps {
  alerts: Alert[];
  onActionTaken: (alertId: string, action: string) => void;
  onAddSampleAlert?: () => void;
  onFinishTest?: () => void;
}

export const AiTestView: React.FC<AiTestViewProps> = ({ alerts, onActionTaken, onAddSampleAlert, onFinishTest }) => {
  const [handledIds, setHandledIds] = useState<string[]>([]);
  const [selectedAlertId, setSelectedAlertId] = useState<string>('');

  // Chat Assistant State
  const [chatMessages, setChatMessages] = useState<Array<{ sender: 'user' | 'ai'; text: string; time: string }>>([]);
  const [chatInput, setChatInput] = useState<string>('');
  const [isAiLoading, setIsAiLoading] = useState<boolean>(false);

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

    onActionTaken(alertId, actionName);
    setHandledIds(prev => [...prev, alertId]);

    if (remainingAlerts.length === 1 && onFinishTest) {
      onFinishTest();
    }
  };

  const handleSendMessage = async (textToSend?: string) => {
    const msgText = textToSend || chatInput;
    if (!msgText.trim() || !currentAlert) return;

    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    setChatMessages(prev => [...prev, { sender: 'user', text: msgText, time: timeStr }]);
    if (!textToSend) setChatInput('');

    setIsAiLoading(true);
    const aiResponseText = await sendAiQuery(currentAlert.id, msgText);
    setIsAiLoading(false);

    setChatMessages(prev => [...prev, { sender: 'ai', text: aiResponseText, time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }]);
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
          Zestaw testowy nie został jeszcze załadowany. Kliknij przycisk poniżej, aby załadować pytania z pliku <code>wynik.json</code>.
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
        <div style={{ background: 'rgba(168, 85, 247, 0.15)', padding: '1.5rem', borderRadius: '50%', display: 'inline-flex', marginBottom: '1.5rem' }}>
          <Award size={64} color="#c084fc" />
        </div>
        <h2 style={{ fontSize: '1.75rem', fontWeight: 700, color: '#ffffff', marginBottom: '0.75rem' }}>
          Test 2 (z AI Copilot) Zakończony!
        </h2>
        <p style={{ color: '#cbd5e1', fontSize: '1rem', lineHeight: '1.6', marginBottom: '1.5rem' }}>
          Przeanalizowałeś wszystkie <strong>{alerts.length}</strong> zdarzeń ze wsparciem sztucznej inteligencji.
          Twoje decyzje zostały zapisane w bazie danych.
        </p>
        <div style={{ background: 'rgba(0,0,0,0.3)', padding: '1.25rem', borderRadius: '12px', border: '1px solid #1e293b', marginBottom: '2rem', display: 'flex', justifyContent: 'space-around' }}>
          <div>
            <span style={{ display: 'block', color: 'var(--text-muted)', fontSize: '0.8rem' }}>Przeanalizowane alerty</span>
            <strong style={{ fontSize: '1.5rem', color: '#c084fc' }}>{handledIds.length} / {alerts.length}</strong>
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
          <Sparkles size={20} color="#c084fc" />
          <span style={{ fontWeight: 600, fontSize: '0.95rem', color: '#f8fafc' }}>
            Postęp Testu 2 (Wsparcie AI): <strong>{handledIds.length} / {alerts.length}</strong> przeanalizowanych zdarzeń
          </span>
        </div>
        <div style={{ width: '200px', background: '#1e293b', borderRadius: '8px', height: '8px', overflow: 'hidden' }}>
          <div style={{
            width: `${(handledIds.length / alerts.length) * 100}%`,
            background: 'linear-gradient(90deg, #a855f7, #c084fc)',
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
              <Bot size={18} color="var(--accent-purple)" />
              <span>Kolejka Alertów z AI Copilot ({remainingAlerts.length})</span>
            </div>
          </div>

          <div style={{ maxHeight: '680px', overflowY: 'auto' }}>
            {remainingAlerts.map((alert) => (
              <div
                key={alert.id}
                className={`alert-item ${currentAlert?.id === alert.id ? 'selected' : ''}`}
                onClick={() => setSelectedAlertId(alert.id)}
                style={{ borderLeftColor: currentAlert?.id === alert.id ? 'var(--accent-purple)' : 'transparent' }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                  <span className="mono" style={{ fontSize: '0.75rem', color: 'var(--accent-purple)', fontWeight: 600 }}>
                    {alert.id}
                  </span>
                  {getSeverityBadge(alert.severity)}
                </div>
                <div className="alert-item-title">{alert.title}</div>
                <div className="alert-item-meta">
                  <span>Host: {alert.destinationHost}</span>
                  {alert.aiConfidenceScore && (
                    <span style={{ color: '#c084fc', fontWeight: 600 }}>
                      AI: {alert.aiConfidenceScore}%
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Prawa kolumna: Analiza AI & Akcje */}
        {currentAlert ? (
          <div className="soc-card" style={{ minHeight: '600px', display: 'flex', flexDirection: 'column' }}>
            <div className="soc-card-header" style={{ borderBottom: '1px solid #1e293b' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Brain size={18} color="var(--accent-purple)" />
                <span>Asystent AI SOC Copilot [{currentAlert.id}]</span>
              </div>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                {getSeverityBadge(currentAlert.severity)}
                {currentAlert.aiConfidenceScore && (
                  <span style={{
                    background: 'rgba(168, 85, 247, 0.2)',
                    border: '1px solid rgba(168, 85, 247, 0.4)',
                    color: '#c084fc',
                    padding: '0.2rem 0.6rem',
                    borderRadius: '12px',
                    fontSize: '0.75rem',
                    fontWeight: 700
                  }}>
                    Pewność AI: {currentAlert.aiConfidenceScore}%
                  </span>
                )}
              </div>
            </div>

            <div style={{ padding: '1.25rem', flex: 1, overflowY: 'auto' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.75rem', color: '#ffffff' }}>
                {currentAlert.title}
              </h2>

              {/* Sekcja Podsumowanie AI */}
              <div style={{
                background: 'linear-gradient(135deg, rgba(168, 85, 247, 0.1), rgba(59, 130, 246, 0.05))',
                border: '1px solid rgba(168, 85, 247, 0.3)',
                borderRadius: '10px',
                padding: '1rem',
                marginBottom: '1.25rem'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '0.5rem', color: '#c084fc', fontWeight: 600, fontSize: '0.875rem' }}>
                  <Sparkles size={16} /> Podsumowanie Generatywne AI:
                </div>
                <p style={{ fontSize: '0.9rem', lineHeight: '1.5', color: '#f1f5f9', margin: 0 }}>
                  {currentAlert.aiSummary || 'AI dokonuje automatycznej syntezy surowych rejestrów z bazy wynik.json...'}
                </p>
              </div>

              {/* Analiza Ryzyka & Rekomendowane Akcje */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.25rem' }}>
                <div style={{ background: 'rgba(0,0,0,0.3)', padding: '0.85rem', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.35rem', textTransform: 'uppercase' }}>
                    Ocena Ryzyka AI:
                  </div>
                  <div style={{ fontSize: '0.85rem', color: '#e2e8f0', fontWeight: 500 }}>
                    {currentAlert.aiRiskAnalysis || 'Wysokie prawdopodobieństwo anomalnej aktywności.'}
                  </div>
                </div>

                <div style={{ background: 'rgba(0,0,0,0.3)', padding: '0.85rem', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.35rem', textTransform: 'uppercase' }}>
                    Rekomendowane Akcje AI:
                  </div>
                  <ul style={{ margin: 0, paddingLeft: '1.2rem', fontSize: '0.825rem', color: '#cbd5e1' }}>
                    {currentAlert.aiRecommendedActions?.map((act, i) => (
                      <li key={i}>{act}</li>
                    )) || <li>Zweryfikować wywołany proces.</li>}
                  </ul>
                </div>
              </div>

              {/* Komponent Analityczny NetFlow */}
              <NetFlowInspector alert={currentAlert} />

              {/* Czaty / Pytań do Copilota */}
              <div style={{ marginBottom: '1.25rem', background: '#0f172a', borderRadius: '8px', padding: '0.85rem', border: '1px solid #1e293b' }}>
                <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Bot size={14} color="#c084fc" /> Zapytaj AI Copilot o radę dotyczącą tego zdarzenia:
                </div>

                {chatMessages.map((msg, i) => (
                  <div key={i} style={{
                    marginBottom: '0.5rem',
                    textAlign: msg.sender === 'user' ? 'right' : 'left'
                  }}>
                    <span style={{
                      display: 'inline-block',
                      background: msg.sender === 'user' ? '#2563eb' : '#1e293b',
                      color: 'white',
                      padding: '0.4rem 0.75rem',
                      borderRadius: '8px',
                      fontSize: '0.825rem'
                    }}>
                      {msg.text}
                    </span>
                  </div>
                ))}

                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="text"
                    placeholder="Zapytaj np. czy proces rundll32 jest tu bezpieczny..."
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                    style={{ flex: 1, background: '#1a2332', border: '1px solid #334155', color: 'white', padding: '0.4rem 0.75rem', borderRadius: '6px', fontSize: '0.8rem' }}
                  />
                  <button onClick={() => handleSendMessage()} disabled={isAiLoading} style={{ background: '#8b5cf6', color: 'white', border: 'none', padding: '0.4rem 0.85rem', borderRadius: '6px', cursor: 'pointer' }}>
                    <Send size={14} />
                  </button>
                </div>
              </div>

              {/* Przyciski Decyzji Operatora */}
              <div>
                <h4 style={{ fontSize: '0.875rem', color: '#ffffff', marginBottom: '0.65rem' }}>Zatwierdź Decyzję Operatora (Alert zniknie):</h4>
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
