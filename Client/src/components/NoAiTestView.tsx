import React, { useState } from 'react';
import type { Alert, UserSession } from '../types/alert';
import { NetFlowInspector } from './NetFlowInspector';
import {
  ShieldAlert,
  Search,
  Lock,
  Server,
  ArrowUpRight,
  XCircle,
  Terminal,
  Activity,
  Globe,
  FileText,
  Shield,
  CheckCircle2,
  AlertTriangle,
  PanelLeftClose,
  PanelLeftOpen,
  BarChart2,
  Home
} from 'lucide-react';

interface NoAiTestViewProps {
  alerts: Alert[];
  handledIds?: string[];
  onAction: (alertId: string, actionTaken: string) => void;
  onNavigate?: (tab: string) => void;
  userSession?: UserSession | null;
}

export const NoAiTestView: React.FC<NoAiTestViewProps> = ({
  alerts,
  handledIds = [],
  onAction,
  onNavigate,
  userSession
}) => {
  const [selectedAlertId, setSelectedAlertId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedSeverity, setSelectedSeverity] = useState<string>('All');
  const [isQueueCollapsed, setIsQueueCollapsed] = useState<boolean>(false);

  const safeHandledIds = handledIds || [];
  const safeAlerts = alerts || [];

  const remainingAlerts = safeAlerts.filter(a => a && a.id && !safeHandledIds.includes(a.id));
  const currentAlert = remainingAlerts.find(a => a.id === selectedAlertId) || remainingAlerts[0] || null;

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
    }
  };

  return (
    <div>
      {/* Slim Top Toolbar Bar */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(13, 20, 36, 0.95), rgba(15, 23, 42, 0.9))',
        border: '1px solid rgba(56, 189, 248, 0.25)',
        borderRadius: '8px',
        padding: '0.35rem 0.85rem',
        marginBottom: '0.75rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        boxShadow: '0 2px 10px rgba(0,0,0,0.3)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <ShieldAlert size={16} color="#38bdf8" />
            <span style={{ fontWeight: 700, fontSize: '0.825rem', color: '#f8fafc' }}>
              Środowisko Testowe (Tryb Bez AI)
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.725rem' }}>
            <span style={{ background: 'rgba(255,255,255,0.06)', padding: '0.15rem 0.5rem', borderRadius: '4px', color: '#cbd5e1' }}>
              Wszystkie: <strong style={{ color: '#ffffff' }}>{safeAlerts.length}</strong>
            </span>
            <span style={{ background: 'var(--severity-critical-bg)', padding: '0.15rem 0.5rem', borderRadius: '4px', color: 'var(--severity-critical)' }}>
              Krytyczne: <strong>{safeAlerts.filter(a => a?.severity?.toLowerCase() === 'critical').length}</strong>
            </span>
            <span style={{ background: 'var(--severity-high-bg)', padding: '0.15rem 0.5rem', borderRadius: '4px', color: 'var(--severity-high)' }}>
              Wysokie: <strong>{safeAlerts.filter(a => a?.severity?.toLowerCase() === 'high').length}</strong>
            </span>
            <span style={{ background: 'rgba(56, 189, 248, 0.12)', padding: '0.15rem 0.5rem', borderRadius: '4px', color: '#38bdf8' }}>
              Przeanalizowano: <strong>{safeHandledIds.length} z {safeAlerts.length}</strong>
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <div style={{ width: '120px', background: '#090f1d', borderRadius: '6px', height: '6px', border: '1px solid rgba(255,255,255,0.08)', overflow: 'hidden' }}>
            <div style={{
              width: `${safeAlerts.length > 0 ? (safeHandledIds.length / safeAlerts.length) * 100 : 0}%`,
              background: 'linear-gradient(90deg, #2563eb, #38bdf8)',
              height: '100%',
              borderRadius: '6px',
              transition: 'width 0.3s ease'
            }} />
          </div>
          <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#38bdf8', fontFamily: 'JetBrains Mono, monospace' }}>
            {safeAlerts.length > 0 ? Math.round((safeHandledIds.length / safeAlerts.length) * 100) : 0}%
          </span>
        </div>
      </div>

      {remainingAlerts.length === 0 && safeAlerts.length > 0 ? (
        <div style={{
          width: '100%',
          maxWidth: '720px',
          margin: '3rem auto',
          padding: '2.5rem 2rem',
          background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.95), rgba(9, 14, 26, 0.98))',
          border: '1px solid rgba(56, 189, 248, 0.4)',
          borderRadius: '16px',
          boxShadow: '0 20px 50px rgba(0, 0, 0, 0.6), 0 0 30px rgba(56, 189, 248, 0.15)',
          textAlign: 'center'
        }}>
          <div style={{
            width: '70px',
            height: '70px',
            borderRadius: '50%',
            background: 'rgba(34, 197, 94, 0.15)',
            border: '2px solid #22c55e',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 1.5rem auto',
            boxShadow: '0 0 20px rgba(34, 197, 94, 0.3)'
          }}>
            <CheckCircle2 size={38} color="#22c55e" />
          </div>

          <h2 style={{ fontSize: '1.75rem', fontWeight: 800, color: '#ffffff', marginBottom: '0.5rem' }}>
            Dziękujemy za Udział w Teście!
          </h2>

          <p style={{ color: '#94a3b8', fontSize: '0.95rem', lineHeight: 1.6, maxWidth: '560px', margin: '0 auto 2rem auto' }}>
            Pomyślnie przeanalizowałeś i obsłużyłeś wszystkie <strong>{safeAlerts.length}</strong> wyznaczonych zdarzeń incydentów bezpieczeństwa w tej sesji. Twoje decyzje oraz czasy reakcji zostały zapisane w bazie danych.
          </p>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '1rem',
            background: 'rgba(15, 23, 42, 0.6)',
            padding: '1.25rem',
            borderRadius: '12px',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            marginBottom: '2rem'
          }}>
            <div>
              <span style={{ fontSize: '0.75rem', color: '#64748b', display: 'block', textTransform: 'uppercase', fontWeight: 600 }}>Obsłużone Alerty</span>
              <span style={{ fontSize: '1.35rem', fontWeight: 800, color: '#38bdf8' }}>{safeAlerts.length} z {safeAlerts.length}</span>
            </div>
            <div>
              <span style={{ fontSize: '0.75rem', color: '#64748b', display: 'block', textTransform: 'uppercase', fontWeight: 600 }}>Tryb Ewaluacji</span>
              <span style={{ fontSize: '1.1rem', fontWeight: 700, color: '#60a5fa' }}>Bez AI (Podstawowy)</span>
            </div>
            <div>
              <span style={{ fontSize: '0.75rem', color: '#64748b', display: 'block', textTransform: 'uppercase', fontWeight: 600 }}>Status Sesji</span>
              <span style={{ fontSize: '1.1rem', fontWeight: 700, color: '#22c55e' }}>Zakończona</span>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem', flexWrap: 'wrap' }}>
            {onNavigate && userSession?.role === 'Administrator' && (
              <button
                onClick={() => onNavigate('test-results')}
                className="btn-action btn-primary"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '0.75rem 1.5rem',
                  fontSize: '0.9rem',
                  fontWeight: 700,
                  background: 'linear-gradient(135deg, #0284c7, #2563eb)',
                  borderRadius: '8px',
                  cursor: 'pointer'
                }}
              >
                <BarChart2 size={18} /> Zobacz Wyniki Testów
              </button>
            )}
            {onNavigate && (
              <button
                onClick={() => onNavigate('home')}
                className="btn-action"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '0.75rem 1.5rem',
                  fontSize: '0.9rem',
                  fontWeight: 600,
                  borderRadius: '8px',
                  cursor: 'pointer'
                }}
              >
                <Home size={18} /> Strona Główna
              </button>
            )}
          </div>
        </div>
      ) : (
        <div
          className="dashboard-grid-with-ai"
          style={{
            gridTemplateColumns: isQueueCollapsed ? '56px 1fr 380px' : '310px 1fr 380px',
            transition: 'grid-template-columns 0.25s ease'
          }}
        >
        {/* Kolumna 1 (Lewa): Kolejka alertów (Sticky Sidebar) */}
        {isQueueCollapsed ? (
          <div className="soc-card sticky-queue" style={{ padding: '0.65rem 0.25rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem' }}>
            <button
              onClick={() => setIsQueueCollapsed(false)}
              title="Rozwiń Kolejkę Alertów"
              style={{
                background: 'rgba(56, 189, 248, 0.18)',
                border: '1px solid rgba(56, 189, 248, 0.45)',
                color: '#ffffff',
                padding: '0.45rem',
                borderRadius: '8px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '38px',
                height: '38px',
                boxShadow: '0 0 10px rgba(56, 189, 248, 0.2)',
                transition: 'all 0.15s ease'
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.background = 'rgba(56, 189, 248, 0.35)';
                e.currentTarget.style.borderColor = '#38bdf8';
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.background = 'rgba(56, 189, 248, 0.18)';
                e.currentTarget.style.borderColor = 'rgba(56, 189, 248, 0.45)';
              }}
            >
              <PanelLeftOpen size={20} />
            </button>

            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '0.5rem', width: '100%' }}>
              <Activity size={18} color="#38bdf8" />
              <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#f8fafc', fontFamily: 'JetBrains Mono, monospace' }}>
                {remainingAlerts.length}
              </span>
            </div>

            <div className="sticky-queue-list" style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.45rem', padding: '0 2px' }}>
              {filteredAlerts.map((alert) => (
                <button
                  key={alert.id}
                  onClick={() => setSelectedAlertId(alert.id)}
                  title={`${alert.id} - ${alert.title}`}
                  style={{
                    width: '38px',
                    height: '38px',
                    borderRadius: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    background: currentAlert?.id === alert.id ? 'rgba(56, 189, 248, 0.3)' : 'rgba(15, 23, 42, 0.8)',
                    border: currentAlert?.id === alert.id ? '1px solid #38bdf8' : '1px solid rgba(255, 255, 255, 0.08)',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <span style={{
                    fontSize: '0.65rem',
                    fontWeight: 800,
                    fontFamily: 'JetBrains Mono, monospace',
                    color: alert.severity === 'Critical' ? '#ff4d4d' : alert.severity === 'High' ? '#fbbf24' : '#38bdf8'
                  }}>
                    {alert.id.replace('ALT-', '')}
                  </span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="soc-card sticky-queue">
            <div className="soc-card-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Activity size={18} color="#38bdf8" />
                <span>Kolejka Alertów ({remainingAlerts.length})</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '0.725rem', color: '#94a3b8' }}>Na żywo</span>
                <button
                  onClick={() => setIsQueueCollapsed(true)}
                  title="Zwiń kolejkę alertów do lewej"
                  style={{
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid rgba(255, 255, 255, 0.12)',
                    color: '#cbd5e1',
                    padding: '0.2rem 0.45rem',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    fontSize: '0.7rem',
                    fontWeight: 600,
                    transition: 'all 0.15s ease'
                  }}
                  onMouseOver={(e) => {
                    e.currentTarget.style.color = '#ffffff';
                    e.currentTarget.style.background = 'rgba(56, 189, 248, 0.2)';
                    e.currentTarget.style.borderColor = '#38bdf8';
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.color = '#cbd5e1';
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                    e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.12)';
                  }}
                >
                  <PanelLeftClose size={14} />
                  <span>Zwiń</span>
                </button>
              </div>
            </div>

            <div style={{ padding: '0.85rem 1rem', borderBottom: '1px solid var(--border-color)', background: 'rgba(9, 15, 29, 0.7)' }}>
              <div style={{ position: 'relative', marginBottom: '0.6rem' }}>
                <Search size={14} style={{ position: 'absolute', left: '10px', top: '10px', color: '#94a3b8' }} />
                <input
                  type="text"
                  placeholder="Szukaj po IP, nazwie hosta..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{
                    width: '100%',
                    background: 'var(--bg-input)',
                    border: '1px solid rgba(56, 189, 248, 0.2)',
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
                      background: selectedSeverity === sev ? 'linear-gradient(135deg, #1d4ed8, #0284c7)' : '#090f1d',
                      color: selectedSeverity === sev ? '#ffffff' : '#94a3b8',
                      border: selectedSeverity === sev ? '1px solid #38bdf8' : '1px solid rgba(255, 255, 255, 0.08)',
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
              {filteredAlerts.length === 0 ? (
                <div style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8', fontSize: '0.8rem' }}>
                  Brak nieobsłużonych alertów.
                </div>
              ) : (
                filteredAlerts.map((alert) => (
                  <div
                    key={alert.id}
                    className={`alert-item ${currentAlert?.id === alert.id ? 'selected' : ''}`}
                    onClick={() => setSelectedAlertId(alert.id)}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                      <span className="mono" style={{ fontSize: '0.75rem', color: '#38bdf8', fontWeight: 700 }}>
                        {alert.id}
                      </span>
                      {getSeverityBadge(alert.severity)}
                    </div>
                    <div className="alert-item-title">{alert.title}</div>
                    <div className="alert-item-meta">
                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#94a3b8', fontSize: '0.75rem', fontWeight: 500 }}>
                        <Globe size={12} color="#38bdf8" /> {alert.destinationHost}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* Kolumna 2 (Środek): Telemetria & Opis Incydentu */}
        {currentAlert ? (
          <div className="soc-card">
            <div style={{ padding: '1.25rem 1.5rem', background: 'linear-gradient(180deg, rgba(15, 23, 42, 0.95), rgba(9, 15, 29, 0.95))', borderBottom: '1px solid rgba(56, 189, 248, 0.18)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', marginBottom: '0.75rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                  <span className="mono" style={{ background: 'rgba(56, 189, 248, 0.15)', border: '1px solid rgba(56, 189, 248, 0.35)', color: '#38bdf8', padding: '0.2rem 0.6rem', borderRadius: '6px', fontSize: '0.8rem', fontWeight: 700 }}>
                    {currentAlert.id}
                  </span>
                  {getSeverityBadge(currentAlert.severity)}
                </div>

                <div style={{ fontSize: '0.75rem', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Terminal size={14} color="#38bdf8" /> EDR / SIEM Console
                </div>
              </div>

              <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#ffffff', lineHeight: 1.35 }}>
                {currentAlert.title}
              </h2>
            </div>

            <div style={{ padding: '1.35rem' }}>
              {/* Metadane Incydentu */}
              <div className="incident-metrics-grid">
                <div className="metric-box">
                  <span className="metric-lbl">Źródłowy IP</span>
                  <div className="metric-val">
                    <span className="mono" style={{ color: '#ffffff', fontWeight: 700 }}>{currentAlert.sourceIp}</span>
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
                    <span className="mono" style={{ fontSize: '0.85rem', color: '#f0f9ff', fontWeight: 700 }}>{currentAlert.destinationHost}</span>
                  </div>
                </div>

                <div className="metric-box">
                  <span className="metric-lbl">Konto / Użytkownik</span>
                  <div className="metric-val">
                    <span style={{ color: '#ffffff', fontSize: '0.825rem', fontWeight: 600 }}>
                      {(!currentAlert.userAccount || currentAlert.userAccount.includes('EXTERNAL_ATTACKER') || currentAlert.userAccount.includes('node_'))
                        ? 'Zewnętrzny / Nieokreślono'
                        : currentAlert.userAccount}
                    </span>
                  </div>
                </div>

                <div className="metric-box">
                  <span className="metric-lbl">Kategoria SIEM</span>
                  <div className="metric-val">
                    <span style={{ color: '#38bdf8', fontSize: '0.85rem', fontWeight: 700 }}>
                      {currentAlert.category || 'Anomalia Sieciowa'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Opis Zdarzenia SIEM */}
              <div style={{ marginBottom: '1.5rem' }}>
                <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#94a3b8', marginBottom: '0.45rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <FileText size={14} color="#38bdf8" /> Szczegółowy Opis Rekordu SIEM / EDR:
                </div>
                <div style={{
                  background: '#060913',
                  border: '1px solid rgba(56, 189, 248, 0.2)',
                  borderRadius: '8px',
                  padding: '1rem 1.15rem',
                  color: '#f8fafc',
                  fontSize: '0.885rem',
                  lineHeight: '1.6'
                }}>
                  {currentAlert.description}
                </div>
              </div>

              {/* Analizator NetFlow */}
              <div>
                <NetFlowInspector alert={currentAlert} />
              </div>
            </div>
          </div>
        ) : null}

        {/* Kolumna 3 (Prawa): Dedykowany Prawy Panel Decyzyjny Operatora (Identyczny jak w AI, bez chatu) */}
        {currentAlert ? (
          <div className="soc-card sticky-queue" style={{ border: '1px solid rgba(56, 189, 248, 0.35)' }}>
            <div className="soc-card-header" style={{ background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.95), rgba(30, 58, 138, 0.3))' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Shield size={18} color="#38bdf8" />
                <span>Panel Decyzyjny Operatora</span>
              </div>
              <span className="soc-status-badge" style={{ background: 'rgba(56, 189, 248, 0.15)', borderColor: 'rgba(56, 189, 248, 0.4)', color: '#38bdf8' }}>
                AKTYWNY
              </span>
            </div>

            <div style={{ padding: '1.1rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {/* Instrukcja Operacyjna */}
              <div style={{
                background: 'rgba(9, 15, 29, 0.8)',
                border: '1px solid rgba(56, 189, 248, 0.2)',
                borderRadius: '8px',
                padding: '0.85rem',
                fontSize: '0.785rem',
                color: '#cbd5e1',
                lineHeight: '1.5'
              }}>
                <div style={{ color: '#38bdf8', fontWeight: 700, marginBottom: '0.35rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  ℹ️ Instrukcja Wykonania Decyzji:
                </div>
                Przeanalizuj telemetrię po lewej stronie (wpisy SIEM oraz logi NetFlow), a następnie wybierz odpowiednią akcję naprawczą dla tego alertu.
              </div>

              {/* Panel Przycisków Decyzji */}
              <div>
                <div style={{ fontSize: '0.775rem', fontWeight: 700, color: '#ffffff', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  ⚡ Wybierz Działanie Reakcji:
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                  <button
                    className="btn-action btn-danger"
                    style={{ width: '100%', justifyContent: 'flex-start', padding: '0.75rem 1rem' }}
                    onClick={() => handleAction('Isolate Host / Block')}
                  >
                    <Lock size={16} color="#ffffff" />
                    <span style={{ color: '#ffffff', fontWeight: 700 }}>Izoluj Hosta / Zablokuj Ruch</span>
                  </button>

                  <button
                    className="btn-action btn-warning"
                    style={{ width: '100%', justifyContent: 'flex-start', padding: '0.75rem 1rem' }}
                    onClick={() => handleAction('Investigate / Reset Password')}
                  >
                    <Server size={16} />
                    <span>Badaj / Zresetuj Hasło Użytkownika</span>
                  </button>

                  <button
                    className="btn-action"
                    style={{ width: '100%', justifyContent: 'flex-start', padding: '0.75rem 1rem' }}
                    onClick={() => handleAction('Escalate / Tier 2')}
                  >
                    <ArrowUpRight size={16} />
                    <span>Eskaluj Incydent do Analityka L2</span>
                  </button>

                  <button
                    className="btn-action"
                    style={{ width: '100%', justifyContent: 'flex-start', padding: '0.75rem 1rem' }}
                    onClick={() => handleAction('Dismiss / False Positive')}
                  >
                    <XCircle size={16} />
                    <span>Zignoruj jako Fałszywy Alarm (False Positive)</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </div>
      )}
    </div>
  );
};
