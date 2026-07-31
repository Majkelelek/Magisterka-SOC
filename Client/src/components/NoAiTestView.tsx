import React, { useState } from 'react';
import type { Alert, UserSession } from '../types/alert';
import { NetFlowInspector } from './NetFlowInspector';
import '../styles/NoAiTestView.css';
import {
  ShieldAlert,
  Search,
  Lock,
  ArrowUpRight,
  XCircle,
  Terminal,
  Activity,
  Globe,
  FileText,
  Shield,
  CheckCircle2,
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
      <div className="no-ai-toolbar">
        <div className="no-ai-toolbar-left">
          <div className="no-ai-toolbar-title">
            <ShieldAlert size={16} className="no-ai-title-badge-icon" />
            <span className="no-ai-title-badge-text">
              Środowisko Testowe (Tryb Bez AI)
            </span>
          </div>

          <div className="no-ai-stats-group">
            <span className="no-ai-stats-badge">
              Wszystkie: <strong>{safeAlerts.length}</strong>
            </span>
            <span className="no-ai-stats-badge critical">
              Krytyczne: <strong>{safeAlerts.filter(a => a?.severity?.toLowerCase() === 'critical').length}</strong>
            </span>
            <span className="no-ai-stats-badge high">
              Wysokie: <strong>{safeAlerts.filter(a => a?.severity?.toLowerCase() === 'high').length}</strong>
            </span>
            <span className="no-ai-stats-badge analyzed">
              Przeanalizowano: <strong>{safeHandledIds.length} z {safeAlerts.length}</strong>
            </span>
          </div>
        </div>

        <div className="no-ai-progress-wrapper">
          <div className="no-ai-progress-bg">
            <div
              className="no-ai-progress-bar"
              style={{
                width: `${safeAlerts.length > 0 ? (safeHandledIds.length / safeAlerts.length) * 100 : 0}%`
              }}
            />
          </div>
          <span className="no-ai-progress-text">
            {safeAlerts.length > 0 ? Math.round((safeHandledIds.length / safeAlerts.length) * 100) : 0}%
          </span>
        </div>
      </div>

      {remainingAlerts.length === 0 && safeAlerts.length > 0 ? (
        <div className="no-ai-completion-card">
          <div className="no-ai-completion-icon">
            <CheckCircle2 size={38} color="#22c55e" />
          </div>

          <h2 className="no-ai-completion-title">
            Dziękujemy za Udział w Teście!
          </h2>

          <p className="no-ai-completion-desc">
            Pomyślnie przeanalizowałeś i obsłużyłeś wszystkie <strong>{safeAlerts.length}</strong> wyznaczonych zdarzeń incydentów bezpieczeństwa w tej sesji. Twoje decyzje oraz czasy reakcji zostały zapisane w bazie danych.
          </p>

          <div className="no-ai-completion-grid">
            <div>
              <span className="no-ai-completion-label">Obsłużone Alerty</span>
              <span className="no-ai-completion-val-cyan">{safeAlerts.length} z {safeAlerts.length}</span>
            </div>
            <div>
              <span className="no-ai-completion-label">Tryb Ewaluacji</span>
              <span className="no-ai-completion-val-blue">Bez AI (Podstawowy)</span>
            </div>
            <div>
              <span className="no-ai-completion-label">Status Sesji</span>
              <span className="no-ai-completion-val-green">Zakończona</span>
            </div>
          </div>

          <div className="no-ai-completion-buttons">
            {onNavigate && userSession?.role === 'Administrator' && (
              <button
                onClick={() => onNavigate('test-results')}
                className="btn-action btn-primary no-ai-completion-btn-nav"
              >
                <BarChart2 size={18} /> Zobacz Wyniki Testów
              </button>
            )}
            {onNavigate && (
              <button
                onClick={() => onNavigate('home')}
                className="btn-action no-ai-completion-btn-home"
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
            <div className="soc-card sticky-queue no-ai-queue-collapsed">
              <button
                onClick={() => setIsQueueCollapsed(false)}
                title="Rozwiń Kolejkę Alertów"
                className="no-ai-btn-expand-queue"
              >
                <PanelLeftOpen size={20} />
              </button>

              <div className="no-ai-collapsed-header">
                <Activity size={18} color="#38bdf8" />
                <span className="no-ai-collapsed-count">
                  {remainingAlerts.length}
                </span>
              </div>

              <div className="no-ai-collapsed-list">
                {filteredAlerts.map((alert) => (
                  <button
                    key={alert.id}
                    onClick={() => setSelectedAlertId(alert.id)}
                    title={`${alert.id} - ${alert.title}`}
                    className={`no-ai-collapsed-item ${currentAlert?.id === alert.id ? 'selected' : 'unselected'}`}
                  >
                    <span className={`no-ai-collapsed-item-id ${alert.severity === 'Critical' ? 'critical' : alert.severity === 'High' ? 'high' : 'medium-low'}`}>
                      {alert.id.replace('ALT-', '')}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="soc-card sticky-queue">
              <div className="soc-card-header">
                <div className="no-ai-queue-header-left">
                  <Activity size={18} color="#38bdf8" />
                  <span>Kolejka Alertów ({remainingAlerts.length})</span>
                </div>
                <div className="no-ai-queue-header-right">
                  <span className="no-ai-queue-live-lbl">Na żywo</span>
                  <button
                    onClick={() => setIsQueueCollapsed(true)}
                    title="Zwiń kolejkę alertów do lewej"
                    className="no-ai-btn-collapse-queue"
                  >
                    <PanelLeftClose size={14} />
                    <span>Zwiń</span>
                  </button>
                </div>
              </div>

              <div className="no-ai-queue-search-container">
                <div className="no-ai-queue-search-input-wrapper">
                  <Search size={14} />
                  <input
                    type="text"
                    placeholder="Szukaj po IP, nazwie hosta..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="no-ai-queue-search-input"
                  />
                </div>

                <div className="no-ai-queue-filters">
                  {['All', 'Critical', 'High', 'Medium', 'Low'].map((sev) => (
                    <button
                      key={sev}
                      onClick={() => setSelectedSeverity(sev)}
                      className={`no-ai-queue-filter-btn ${selectedSeverity === sev ? 'selected' : 'unselected'}`}
                    >
                      {sev === 'All' ? 'Wszystkie' : sev}
                    </button>
                  ))}
                </div>
              </div>

              <div className="sticky-queue-list">
                {filteredAlerts.length === 0 ? (
                  <div className="no-ai-queue-empty">
                    Brak nieobsłużonych alertów.
                  </div>
                ) : (
                  filteredAlerts.map((alert) => (
                    <div
                      key={alert.id}
                      className={`alert-item ${currentAlert?.id === alert.id ? 'selected' : ''}`}
                      onClick={() => setSelectedAlertId(alert.id)}
                    >
                      <div className="no-ai-item-meta">
                        <span className="mono no-ai-item-id-link">
                          {alert.id}
                        </span>
                        {getSeverityBadge(alert.severity)}
                      </div>
                      <div className="alert-item-title">{alert.title}</div>
                      <div className="alert-item-meta">
                        <span className="no-ai-queue-meta-span">
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
              <div className="no-ai-header">
                <div className="no-ai-header-top">
                  <div className="no-ai-header-badges">
                    <span className="no-ai-badge-alert-id">
                      {currentAlert.id}
                    </span>
                    {getSeverityBadge(currentAlert.severity)}
                  </div>

                  <div className="no-ai-header-console">
                    <Terminal size={14} color="#38bdf8" /> EDR / SIEM Console
                  </div>
                </div>

                <h2 className="no-ai-header-title">
                  {currentAlert.title}
                </h2>
              </div>

              <div className="no-ai-body-wrapper">
                {/* Metadane Incydentu */}
                <div className="incident-metrics-grid">
                  <div className="metric-box">
                    <span className="metric-lbl">Źródłowy IP</span>
                    <div className="metric-val">
                      <span className="no-ai-metric-ip-val">{currentAlert.sourceIp}</span>
                    </div>
                    {(() => {
                      const hostInfo = getHostInfoByIp(currentAlert.sourceIp);
                      if (!hostInfo) return null;
                      return (
                        <span className="no-ai-metric-host-info">
                          {hostInfo.name} ({hostInfo.os})
                        </span>
                      );
                    })()}
                  </div>

                  <div className="metric-box">
                    <span className="metric-lbl">Docelowy Host</span>
                    <div className="metric-val">
                      <span className="no-ai-metric-host-val">{currentAlert.destinationHost}</span>
                    </div>
                  </div>

                  <div className="metric-box">
                    <span className="metric-lbl">Konto / Użytkownik</span>
                    <div className="metric-val">
                      <span className="no-ai-metric-user-val">
                        {(!currentAlert.userAccount || currentAlert.userAccount.includes('EXTERNAL_ATTACKER') || currentAlert.userAccount.includes('node_'))
                          ? 'Zewnętrzny / Nieokreślono'
                          : currentAlert.userAccount}
                      </span>
                    </div>
                  </div>

                  <div className="metric-box">
                    <span className="metric-lbl">Kategoria SIEM</span>
                    <div className="metric-val">
                      <span className="no-ai-metric-cat-val">
                        {currentAlert.category || 'Anomalia Sieciowa'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Opis Zdarzenia SIEM */}
                <div className="no-ai-desc-section">
                  <div className="no-ai-desc-title">
                    <FileText size={14} color="#38bdf8" /> Szczegółowy Opis Rekordu SIEM / EDR:
                  </div>
                  <div className="no-ai-desc-box">
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

          {/* Kolumna 3 (Prawa): Dedykowany Prawy Panel Decyzyjny Operatora */}
          {currentAlert ? (
            <div className="soc-card sticky-queue no-ai-right-panel-wrapper">
              <div className="soc-card-header no-ai-right-panel-header-wrapper">
                <div className="no-ai-right-panel-header">
                  <Shield size={18} color="#38bdf8" />
                  <span>Panel Decyzyjny Operatora</span>
                </div>
                <span className="soc-status-badge no-ai-right-panel-status-badge">
                  AKTYWNY
                </span>
              </div>

              <div className="no-ai-action-panel">
                {/* Instrukcja Operacyjna */}
                <div className="no-ai-instruction-box">
                  <div className="no-ai-right-panel-instruction-title">
                    ℹ️ Instrukcja Wykonania Decyzji:
                  </div>
                  Przeanalizuj telemetrię po lewej stronie (wpisy SIEM oraz logi NetFlow), a następnie wybierz odpowiednią akcję naprawczą dla tego alertu.
                </div>

                {/* Panel Przycisków Decyzji */}
                <div>
                  <div className="no-ai-decision-heading">
                    ⚡ Wybierz Działanie Reakcji:
                  </div>
                  <div className="no-ai-decision-btn-group">
                    <button
                      className="btn-action btn-danger no-ai-decision-btn"
                      onClick={() => handleAction('Isolation')}
                    >
                      <Lock size={16} color="#ffffff" />
                      <span className="no-ai-decision-btn-text danger">Izoluj Hosta / Zablokuj Ruch (Isolation)</span>
                    </button>

                    <button
                      className="btn-action btn-warning no-ai-decision-btn"
                      onClick={() => handleAction('Escalation')}
                    >
                      <ArrowUpRight size={16} color="#f59e0b" />
                      <span className="no-ai-decision-btn-text warning">Eskaluj Incydent do L2 (Escalation)</span>
                    </button>

                    <button
                      className="btn-action no-ai-decision-btn dismiss"
                      onClick={() => handleAction('Dismiss')}
                    >
                      <XCircle size={16} color="#4ade80" />
                      <span className="no-ai-decision-btn-text green">Zignoruj jako Fałszywy Alarm / BENIGN (Dismiss)</span>
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
