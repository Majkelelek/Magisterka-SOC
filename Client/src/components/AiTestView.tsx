import React, { useState, useEffect } from 'react';
import type { Alert } from '../types/alert';
import { sendAiQuery } from '../services/api';
import { NetFlowInspector } from './NetFlowInspector';
import { getHostInfoByIp } from '../data/networkTopology';
import { Bot, Sparkles, AlertTriangle, Send, Brain, PlusCircle, Inbox, Award, Check, Search, Lock, Server, ArrowUpRight, XCircle } from 'lucide-react';

interface AiTestViewProps {
  alerts: Alert[];
  onActionTaken: (alertId: string, action: string) => void;
  onAddSampleAlert?: () => void;
  onFinishTest?: () => void;
}

export const AiTestView: React.FC<AiTestViewProps> = ({ alerts, onActionTaken, onAddSampleAlert, onFinishTest }) => {
  const [handledIds, setHandledIds] = useState<string[]>([]);
  const [selectedAlertId, setSelectedAlertId] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedSeverity, setSelectedSeverity] = useState<string>('All');

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
          Zestaw testowy nie został jeszcze załadowany. Kliknij przycisk poniżej, aby załadować pytania z bazy danych MongoDB.
        </p>
        {onAddSampleAlert && (
          <button className="btn-action btn-ai-primary" onClick={onAddSampleAlert}>
            <PlusCircle size={16} /> Załaduj Zestaw Testowy
          </button>
        )}
      </div>
    );
  }

  // Ekran podsumowania po obsłużeniu wszystkich alertów
  if (remainingAlerts.length === 0) {
    return (
      <div className="soc-card" style={{ padding: '4rem 2rem', textAlign: 'center', maxWidth: '700px', margin: '2rem auto' }}>
        <div style={{ background: 'rgba(168, 85, 247, 0.15)', padding: '1.5rem', borderRadius: '50%', display: 'inline-flex', marginBottom: '1.5rem' }}>
          <Award size={64} color="#c084fc" />
        </div>
        <h2 style={{ fontSize: '1.75rem', fontWeight: 700, color: '#ffffff', marginBottom: '0.75rem' }}>
          Test 2 (Z AI) Zakończony!
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
          <Sparkles size={20} color="#c084fc" />
          <span style={{ fontWeight: 600, fontSize: '0.95rem', color: '#f8fafc' }}>
            Postęp Testu 2: <strong>{handledIds.length} / {alerts.length}</strong> przeanalizowanych zdarzeń
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

      <div className="dashboard-grid-with-ai">
        {/* Kolumna 1: Kolejka alertów (Sticky Sidebar) */}
        <div className="soc-card sticky-queue">
          <div className="soc-card-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Bot size={18} color="var(--ai-purple)" />
              <span>Kolejka Alertów ({remainingAlerts.length} pozostało)</span>
            </div>
          </div>

          {/* Wyszukiwarka & Filtr */}
          <div style={{ padding: '0.75rem 1rem', borderBottom: '1px solid var(--border-color)', background: 'rgba(15, 23, 42, 0.6)' }}>
            <div style={{ position: 'relative', marginBottom: '0.5rem' }}>
              <Search size={15} style={{ position: 'absolute', left: '10px', top: '10px', color: 'var(--text-muted)' }} />
              <input
                type="text"
                placeholder="Szukaj IP, hosta, nazwy..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  width: '100%',
                  background: '#0f172a',
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
                    background: selectedSeverity === sev ? 'var(--accent-purple)' : '#1e293b',
                    color: selectedSeverity === sev ? 'white' : 'var(--text-muted)',
                    border: selectedSeverity === sev ? '1px solid #c084fc' : '1px solid transparent',
                    padding: '0.25rem 0.6rem',
                    borderRadius: '4px',
                    fontSize: '0.725rem',
                    cursor: 'pointer',
                    fontWeight: 600
                  }}
                >
                  {sev === 'All' ? 'Wszystkie' : sev}
                </button>
              ))}
            </div>
          </div>

          {/* Lista alertów */}
          <div className="sticky-queue-list">
            {filteredAlerts.map((alert) => (
              <div
                key={alert.id}
                className={`alert-item ${currentAlert?.id === alert.id ? 'selected-ai' : ''}`}
                onClick={() => setSelectedAlertId(alert.id)}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                  <span className="mono" style={{ fontSize: '0.75rem', color: '#c084fc', fontWeight: 700 }}>
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

        {/* Kolumna 2: Widok Telemetrii Incydentu */}
        {currentAlert ? (
          <div className="soc-card">
            <div className="soc-card-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Terminal size={18} color="#c084fc" />
                <span>Analiza Incydentu [{currentAlert.id}]</span>
              </div>
              <div>{getSeverityBadge(currentAlert.severity)}</div>
            </div>

            <div style={{ padding: '1.35rem' }}>
              <h2 style={{ fontSize: '1.3rem', fontWeight: 800, marginBottom: '1.25rem', color: '#ffffff', lineHeight: 1.3 }}>
                {currentAlert.title}
              </h2>

              {/* Sekcja 1: Kontekst Incydentu (SIEM / EDR) */}
              <div style={{ marginBottom: '1.5rem' }}>
                <div className="soc-section-title">
                  <ShieldAlert size={16} /> 1. Kontekst Incydentu (SIEM / EDR)
                </div>

                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
                  gap: '0.75rem',
                  background: 'rgba(15, 23, 42, 0.6)',
                  padding: '1rem',
                  borderRadius: '8px',
                  border: '1px solid var(--border-color)',
                  marginBottom: '1rem',
                  fontSize: '0.85rem'
                }}>
                  <div>
                    <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.75rem', fontWeight: 500 }}>Źródłowy IP:</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', marginTop: '2px' }}>
                      <span className="mono" style={{ fontWeight: 600, color: '#c084fc' }}>{currentAlert.sourceIp}</span>
                      {(() => {
                        const hostInfo = getHostInfoByIp(currentAlert.sourceIp);
                        if (!hostInfo) return null;
                        return (
                          <span style={{
                            fontSize: '0.675rem',
                            padding: '0.1rem 0.4rem',
                            borderRadius: '4px',
                            background: 'rgba(192, 132, 252, 0.15)',
                            color: '#c084fc',
                            border: '1px solid rgba(192, 132, 252, 0.3)',
                            fontWeight: 600
                          }}>
                            {hostInfo.name} ({hostInfo.os})
                          </span>
                        );
                      })()}
                    </div>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.75rem', fontWeight: 500 }}>Docelowy Host:</span>
                    <span className="mono" style={{ fontWeight: 600, color: '#f8fafc', display: 'block', marginTop: '2px' }}>{currentAlert.destinationHost}</span>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.75rem', fontWeight: 500 }}>Użytkownik:</span>
                    <span className="mono" style={{ color: '#cbd5e1', display: 'block', marginTop: '2px' }}>
                      {(!currentAlert.userAccount || currentAlert.userAccount.includes('EXTERNAL_ATTACKER') || currentAlert.userAccount.includes('node_'))
                        ? 'Zewnętrzny / Nieokreślono'
                        : currentAlert.userAccount}
                    </span>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.75rem', fontWeight: 500 }}>Kategoria Incydentu:</span>
                    <span style={{ color: '#c084fc', fontWeight: 600, display: 'block', marginTop: '2px' }}>
                      {currentAlert.category || 'Anomalia Sieciowa (SIEM)'}
                    </span>
                  </div>
                </div>

                <div>
                  <h4 style={{ fontSize: '0.825rem', color: 'var(--text-muted)', marginBottom: '0.4rem', fontWeight: 600 }}>Opis Zdarzenia (SIEM/EDR):</h4>
                  <p style={{ fontSize: '0.9rem', lineHeight: '1.6', color: '#e2e8f0', background: 'rgba(15, 23, 42, 0.5)', padding: '0.9rem', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                    {currentAlert.description}
                  </p>
                </div>
              </div>

              {/* Sekcja 2: NetFlow Inspector */}
              <div>
                <div className="soc-section-title">
                  <Terminal size={16} /> 2. Telemetria & Analiza Ruchu Sieciowego NetFlow
                </div>
                <NetFlowInspector alert={currentAlert} />
              </div>
            </div>
          </div>
        ) : null}

        {/* Kolumna 3: Dedykowany Panel Asystenta AI & Decyzji */}
        {currentAlert ? (
          <div className="soc-card sticky-queue" style={{ border: '1px solid rgba(192, 132, 252, 0.3)' }}>
            <div className="soc-card-header" style={{ background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.9), rgba(192, 132, 252, 0.1))' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Brain size={18} color="#c084fc" />
                <span style={{ color: '#ffffff' }}>Asystent AI Copilot</span>
              </div>
              <span className="soc-status-badge" style={{ background: 'rgba(192, 132, 252, 0.15)', borderColor: 'rgba(192, 132, 252, 0.35)', color: '#c084fc' }}>
                ONLINE
              </span>
            </div>

            <div style={{ padding: '1.15rem', display: 'flex', flexDirection: 'column', flex: 1, gap: '1rem' }}>
              {/* Panel Decyzyjny Operatora */}
              <div className="decision-panel" style={{ border: '1px solid rgba(192, 132, 252, 0.3)', marginBottom: 0 }}>
                <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#f8fafc', marginBottom: '0.65rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Sparkles size={14} color="#c084fc" /> Decyzja Operatora SOC:
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                  <button className="btn-action btn-danger" style={{ fontSize: '0.775rem', padding: '0.45rem' }} onClick={() => handleAction('Isolate Host / Block')}>
                    <Lock size={13} /> Zablokuj
                  </button>

                  <button className="btn-action btn-warning" style={{ fontSize: '0.775rem', padding: '0.45rem' }} onClick={() => handleAction('Investigate / Reset Password')}>
                    <Server size={13} /> Badaj / Reset
                  </button>

                  <button className="btn-action" style={{ fontSize: '0.775rem', padding: '0.45rem' }} onClick={() => handleAction('Escalate / Tier 2')}>
                    <ArrowUpRight size={13} /> Eskaluj L2
                  </button>

                  <button className="btn-action" style={{ fontSize: '0.775rem', padding: '0.45rem' }} onClick={() => handleAction('Dismiss / False Positive')}>
                    <XCircle size={13} /> False Pos.
                  </button>
                </div>
              </div>

              {/* Szybkie Pytania Sugerowane */}
              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.4rem', fontWeight: 600 }}>Szybkie Sugestie Pytań:</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                  {[
                    'Przeanalizuj ruch NetFlow i podsumuj sygnały',
                    'Czy te parametry sieciowe wskazują na False Positive?',
                    'Jaka jest zalecana reakcja dla tego typu incydentu?'
                  ].map((qText, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleSendMessage(qText)}
                      disabled={isAiLoading}
                      style={{
                        background: 'rgba(30, 41, 59, 0.6)',
                        border: '1px solid rgba(192, 132, 252, 0.2)',
                        color: '#cbd5e1',
                        padding: '0.35rem 0.6rem',
                        borderRadius: '6px',
                        fontSize: '0.725rem',
                        textAlign: 'left',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease'
                      }}
                      onMouseOver={(e) => (e.currentTarget.style.borderColor = 'rgba(192, 132, 252, 0.5)')}
                      onMouseOut={(e) => (e.currentTarget.style.borderColor = 'rgba(192, 132, 252, 0.2)')}
                    >
                      💡 {qText}
                    </button>
                  ))}
                </div>
              </div>

              {/* Chat z AI Log Window */}
              <div style={{
                flex: 1,
                minHeight: '220px',
                maxHeight: '340px',
                background: '#070a12',
                borderRadius: '8px',
                padding: '0.75rem',
                border: '1px solid #1e293b',
                overflowY: 'auto',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.5rem'
              }}>
                {chatMessages.length === 0 ? (
                  <div style={{ margin: 'auto', textAlign: 'center', color: 'var(--text-dim)', fontSize: '0.775rem' }}>
                    <Brain size={28} color="#c084fc" style={{ opacity: 0.4, margin: '0 auto 0.4rem auto' }} />
                    Zapytaj AI o rekomendację lub szczegóły ruchu sieciowego.
                  </div>
                ) : (
                  chatMessages.map((msg, i) => (
                    <div key={i} style={{
                      textAlign: msg.sender === 'user' ? 'right' : 'left'
                    }}>
                      <span style={{
                        display: 'inline-block',
                        background: msg.sender === 'user' ? '#2563eb' : '#1e293b',
                        color: '#ffffff',
                        border: msg.sender === 'ai' ? '1px solid rgba(192, 132, 252, 0.3)' : 'none',
                        padding: '0.45rem 0.75rem',
                        borderRadius: '8px',
                        fontSize: '0.8rem',
                        lineHeight: '1.4',
                        maxWidth: '90%'
                      }}>
                        {msg.text}
                      </span>
                    </div>
                  ))
                )}
              </div>

              {/* Input Bar */}
              <div style={{ display: 'flex', gap: '6px' }}>
                <input
                  type="text"
                  placeholder="Wpisz pytanie do AI..."
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                  style={{
                    flex: 1,
                    background: '#0f172a',
                    border: '1px solid rgba(192, 132, 252, 0.3)',
                    color: 'white',
                    padding: '0.45rem 0.75rem',
                    borderRadius: '6px',
                    fontSize: '0.8rem'
                  }}
                />
                <button
                  onClick={() => handleSendMessage()}
                  disabled={isAiLoading}
                  style={{
                    background: 'linear-gradient(135deg, #a855f7, #7c3aed)',
                    color: 'white',
                    border: 'none',
                    padding: '0.45rem 0.85rem',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  <Send size={14} />
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
};
