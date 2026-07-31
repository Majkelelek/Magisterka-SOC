import React, { useState, useEffect } from 'react';
import type { Alert, UserSession } from '../types/alert';
import { NetFlowInspector } from './NetFlowInspector';
import { askAiAssistant } from '../services/api';
import '../styles/AiTestView.css';
import {
  Brain,
  Search,
  Lock,
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
  Loader2,
  PanelLeftClose,
  PanelLeftOpen,
  CheckCircle2,
  BarChart2,
  Home,
  RotateCw
} from 'lucide-react';

interface AiTestViewProps {
  alerts: Alert[];
  handledIds?: string[];
  onAction: (alertId: string, actionTaken: string) => void;
  onNavigate?: (tab: string) => void;
  userSession?: UserSession | null;
}

export const AiTestView: React.FC<AiTestViewProps> = ({
  alerts,
  handledIds = [],
  onAction,
  onNavigate,
  userSession
}) => {
  const [selectedAlertId, setSelectedAlertId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedSeverity, setSelectedSeverity] = useState<string>('All');
  const [chatInput, setChatInput] = useState<string>('');
  const [isAiLoading, setIsAiLoading] = useState<boolean>(false);
  const [isQueueCollapsed, setIsQueueCollapsed] = useState<boolean>(false);

  // Persistent autoAnalysisMap from sessionStorage to avoid re-triggering AI prompts on page refresh
  const [autoAnalysisMap, setAutoAnalysisMap] = useState<Record<string, { text: string; confidence: number; isAttack: boolean; verdictText: string; loading: boolean }>>(() => {
    try {
      const cached = sessionStorage.getItem('soc_ai_auto_analysis_map');
      return cached ? JSON.parse(cached) : {};
    } catch {
      return {};
    }
  });

  // Persistent chat messages per alert ID
  const [chatMessagesMap, setChatMessagesMap] = useState<Record<string, Array<{ sender: 'user' | 'ai'; text: string }>>>(() => {
    try {
      const cached = sessionStorage.getItem('soc_ai_chat_messages_map');
      return cached ? JSON.parse(cached) : {};
    } catch {
      return {};
    }
  });

  // Save autoAnalysisMap to sessionStorage on changes
  useEffect(() => {
    try {
      sessionStorage.setItem('soc_ai_auto_analysis_map', JSON.stringify(autoAnalysisMap));
    } catch (e) {
      console.error('Błąd zapisu autoAnalysisMap do sessionStorage:', e);
    }
  }, [autoAnalysisMap]);

  // Save chatMessagesMap to sessionStorage on changes
  useEffect(() => {
    try {
      sessionStorage.setItem('soc_ai_chat_messages_map', JSON.stringify(chatMessagesMap));
    } catch (e) {
      console.error('Błąd zapisu chatMessagesMap do sessionStorage:', e);
    }
  }, [chatMessagesMap]);

  const safeHandledIds = handledIds || [];
  const safeAlerts = alerts || [];

  const remainingAlerts = safeAlerts.filter(a => a && a.id && !safeHandledIds.includes(a.id));
  const currentAlert = remainingAlerts.find(a => a.id === selectedAlertId) || remainingAlerts[0] || null;
  const chatMessages = currentAlert ? (chatMessagesMap[currentAlert.id] || []) : [];

  useEffect(() => {
    if (!currentAlert) return;
    const alertId = currentAlert.id;

    // 1. Jeśli alert ma wstępnie wygenerowaną analizę AI z bazy, użyj jej natychmiast bez zapytania API!
    if (currentAlert.aiAnalysis && !currentAlert.aiAnalysis.includes('[Błąd')) {
      const text = currentAlert.aiAnalysis;
      const lowerText = text.toLowerCase();
      const isFalseAlarm = lowerText.includes('fałszywy alarm') || lowerText.includes('falszywy alarm') || lowerText.includes('false positive') || lowerText.includes('brak ataku') || lowerText.includes('czysty ruch') || lowerText.includes('normalny ruch');
      const isAttack = !isFalseAlarm;
      const verdictText = isAttack ? 'ATAK WYKRYTY' : 'FAŁSZYWY ALARM';

      const match = text.match(/(?:\*{0,2}(?:PEWNOŚĆ|PEWNOŚĆ AI|Pewność|Confidence)\*{0,2})[:\s]*(\d{1,3})\s*%/i)
        || text.match(/(\d{1,3})\s*%/);
      let confidence = match ? parseInt(match[1], 10) : 0;
      if (!confidence || confidence <= 0 || confidence > 100) {
        const sev = (currentAlert.severity || '').toLowerCase();
        confidence = sev === 'critical' ? 95 : sev === 'high' ? 88 : sev === 'medium' ? 80 : 75;
      }

      setAutoAnalysisMap(prev => ({
        ...prev,
        [alertId]: { text, confidence, isAttack, verdictText, loading: false }
      }));
      return;
    }

    // 2. Pomijaj zapytanie API tylko jeśli analiza jest w podręcznej pamięci (i nie jest błędem)
    const cached = autoAnalysisMap[alertId];
    if (cached && cached.text && !cached.loading && !cached.text.includes('[Błąd')) {
      return;
    }
    if (autoAnalysisMap[alertId]?.loading) {
      return;
    }

    // 3. W przeciwnym wypadku – wyślij zapytanie NA ŻYWO do Azure OpenAI
    setAutoAnalysisMap(prev => ({
      ...prev,
      [alertId]: { text: '', confidence: 0, isAttack: true, verdictText: 'ANALIZA...', loading: true }
    }));

    askAiAssistant(alertId, 'Przeanalizuj automatycznie ten alert SOC. Określ czy to ataki czy fałszywy alarm, podaj uzasadnienie, rekomendowaną akcję reakcji oraz wskaźnik pewności AI w % (np. PEWNOŚĆ AI: 95%).')
      .then(res => {
        const text = res.answer || '';
        const lowerText = text.toLowerCase();

        const isFalseAlarm = lowerText.includes('fałszywy alarm') || lowerText.includes('falszywy alarm') || lowerText.includes('false positive') || lowerText.includes('brak ataku') || lowerText.includes('czysty ruch') || lowerText.includes('normalny ruch');
        const isAttack = !isFalseAlarm;
        const verdictText = isAttack ? 'ATAK WYKRYTY' : 'FAŁSZYWY ALARM';

        const match = text.match(/(?:\*{0,2}(?:PEWNOŚĆ|PEWNOŚĆ AI|Pewność|Confidence)\*{0,2})[:\s]*(\d{1,3})\s*%/i)
          || text.match(/(\d{1,3})\s*%/);
        let confidence = match ? parseInt(match[1], 10) : 0;
        if (!confidence || confidence <= 0 || confidence > 100) {
          const sev = (currentAlert.severity || '').toLowerCase();
          confidence = sev === 'critical' ? 95 : sev === 'high' ? 88 : sev === 'medium' ? 80 : 75;
        }
        setAutoAnalysisMap(prev => ({
          ...prev,
          [alertId]: { text, confidence, isAttack, verdictText, loading: false }
        }));
      })
      .catch(() => {
        setAutoAnalysisMap(prev => ({
          ...prev,
          [alertId]: { text: 'Wystąpił problem podczas pobierania automatycznej oceny AI.', confidence: 0, isAttack: true, verdictText: 'BŁĄD', loading: false }
        }));
      });
  }, [currentAlert?.id, currentAlert?.aiAnalysis]);

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

  const handleSendMessage = async (textToSend?: string) => {
    const query = textToSend || chatInput;
    if (!query.trim() || !currentAlert || isAiLoading) return;
    const alertId = currentAlert.id;

    const userMsg = { sender: 'user' as const, text: query };
    setChatMessagesMap(prev => ({
      ...prev,
      [alertId]: [...(prev[alertId] || []), userMsg]
    }));

    if (!textToSend) setChatInput('');
    setIsAiLoading(true);

    try {
      const response = await askAiAssistant(alertId, query);
      const aiMsg = { sender: 'ai' as const, text: response.answer };
      setChatMessagesMap(prev => ({
        ...prev,
        [alertId]: [...(prev[alertId] || []), aiMsg]
      }));
    } catch {
      const errorMsg = { sender: 'ai' as const, text: 'Przepraszam, wystąpił błąd podczas połączenia z modułem AI.' };
      setChatMessagesMap(prev => ({
        ...prev,
        [alertId]: [...(prev[alertId] || []), errorMsg]
      }));
    } finally {
      setIsAiLoading(false);
    }
  };

  const handleRetryAnalysis = () => {
    if (!currentAlert) return;
    const alertId = currentAlert.id;
    setAutoAnalysisMap(prev => {
      const updated = { ...prev };
      delete updated[alertId];
      return updated;
    });
  };

  const renderFormattedAiText = (rawText: string, isAttack: boolean = true) => {
    if (!rawText) return null;

    if (rawText.includes('[Błąd')) {
      return (
        <div className="ai-error-banner">
          <span className="ai-error-banner-text">{rawText}</span>
          <button
            onClick={handleRetryAnalysis}
            className="btn-action btn-primary ai-btn-retry"
          >
            <RotateCw size={13} /> Ponów Próbę AI
          </button>
        </div>
      );
    }

    let resultVal = '';
    let riskVal = '';
    let actionVal = '';
    let justificationVal = '';

    const lines = rawText.split('\n').map(l => l.trim()).filter(Boolean);
    let currentKey = '';

    lines.forEach((line) => {
      const lower = line.toLowerCase();
      if (lower.includes('pewność') || lower.includes('confidence')) return;

      if (lower.includes('wynik analizy')) {
        currentKey = 'result';
        const parts = line.split(':');
        if (parts[1] && parts[1].trim()) resultVal = parts[1].replace(/\*/g, '').trim();
      } else if (lower.includes('ocena ryzyka')) {
        currentKey = 'risk';
        const parts = line.split(':');
        if (parts[1] && parts[1].trim()) riskVal = parts[1].replace(/\*/g, '').trim();
      } else if (lower.includes('rekomendowana akcja')) {
        currentKey = 'action';
        const parts = line.split(':');
        if (parts[1] && parts[1].trim()) actionVal = parts[1].replace(/\*/g, '').trim();
      } else if (lower.includes('uzasadnienie')) {
        currentKey = 'justification';
        const parts = line.split(':');
        if (parts[1] && parts[1].trim()) justificationVal = parts[1].replace(/\*/g, '').trim();
      } else {
        const cleanLine = line.replace(/\*/g, '').trim();
        if (currentKey === 'result' && !resultVal) resultVal = cleanLine;
        else if (currentKey === 'risk' && !riskVal) riskVal = cleanLine;
        else if (currentKey === 'action' && !actionVal) actionVal = cleanLine;
        else if (currentKey === 'justification') {
          justificationVal += (justificationVal ? ' ' : '') + cleanLine;
        }
      }
    });

    const accentColor = isAttack ? '#f87171' : '#34d399';
    const borderLeftColor = isAttack ? '#ef4444' : '#10b981';
    const borderColor = isAttack ? 'rgba(239, 68, 68, 0.35)' : 'rgba(52, 211, 153, 0.35)';
    const boxBg = isAttack ? 'rgba(35, 10, 10, 0.75)' : 'rgba(6, 30, 20, 0.75)';

    if (resultVal || riskVal || actionVal || justificationVal) {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
          {/* Top row: Compact Metadata Badges */}
          <div className="ai-metric-badges">
            {resultVal && (
              <div className="ai-metric-badge-box" style={{ background: boxBg, border: `1px solid ${borderColor}` }}>
                <span className="ai-metric-badge-label">Wynik: </span>
                <strong style={{ color: accentColor }}>{resultVal}</strong>
              </div>
            )}

            {riskVal && (
              <div className="ai-metric-badge-box" style={{ background: boxBg, border: `1px solid ${borderColor}` }}>
                <span className="ai-metric-badge-label">Ocena Ryzyka: </span>
                <strong style={{ color: riskVal.toLowerCase().includes('wysok') || riskVal.toLowerCase().includes('krytycz') ? '#f87171' : '#fbbf24' }}>
                  {riskVal}
                </strong>
              </div>
            )}

            {actionVal && (
              <div className="ai-metric-badge-box" style={{ background: boxBg, border: `1px solid ${borderColor}` }}>
                <span className="ai-metric-badge-label">Rekomendowana Akcja: </span>
                <strong style={{ color: '#38bdf8' }}>{actionVal}</strong>
              </div>
            )}
          </div>

          {/* Bottom row: Justification */}
          {justificationVal && (
            <div className="ai-justification-box" style={{ background: boxBg, borderLeft: `3px solid ${borderLeftColor}`, border: `1px solid ${borderColor}` }}>
              <span className="ai-justification-title" style={{ color: accentColor }}>
                Uzasadnienie AI:
              </span>
              {justificationVal}
            </div>
          )}
        </div>
      );
    }

    return (
      <div className="ai-justification-box" style={{ background: boxBg, borderLeft: `3px solid ${borderLeftColor}` }}>
        {rawText.replace(/\*\*/g, '')}
      </div>
    );
  };

  const currentAnalysis = currentAlert ? autoAnalysisMap[currentAlert.id] : null;
  const isCurrentAttack = currentAnalysis ? currentAnalysis.isAttack : true;

  const cardBg = isCurrentAttack
    ? 'linear-gradient(135deg, rgba(88, 28, 28, 0.95), rgba(30, 10, 10, 0.95))'
    : 'linear-gradient(135deg, rgba(14, 55, 38, 0.95), rgba(6, 30, 20, 0.95))';

  const cardBorder = isCurrentAttack
    ? '1px solid rgba(239, 68, 68, 0.85)'
    : '1px solid rgba(52, 211, 153, 0.85)';

  const cardShadow = isCurrentAttack
    ? '0 4px 20px rgba(220, 38, 38, 0.35)'
    : '0 4px 20px rgba(16, 185, 129, 0.25)';

  const headerTitleColor = isCurrentAttack ? '#f87171' : '#34d399';
  const sparklesIconColor = isCurrentAttack ? '#ef4444' : '#10b981';
  const analyzedPillBg = isCurrentAttack ? 'rgba(239, 68, 68, 0.15)' : 'rgba(52, 211, 153, 0.15)';
  const analyzedPillBorder = isCurrentAttack ? '1px solid rgba(239, 68, 68, 0.4)' : '1px solid rgba(52, 211, 153, 0.4)';
  const outputBoxBg = isCurrentAttack ? 'rgba(20, 8, 8, 0.85)' : 'rgba(4, 20, 14, 0.85)';
  const outputBoxBorder = isCurrentAttack ? '1px solid rgba(239, 68, 68, 0.4)' : '1px solid rgba(52, 211, 153, 0.4)';

  return (
    <div>
      {/* Cała sekcja: Automatyczna Wstępna Ocena AI - Na samej górze widoku */}
      <div
        className="ai-analysis-card"
        style={{
          background: cardBg,
          border: cardBorder,
          boxShadow: cardShadow,
          transition: 'all 0.3s ease'
        }}
      >
        <div className="ai-verdict-banner">
          <div className="ai-verdict-left">
            <div className="ai-verdict-title" style={{ color: headerTitleColor }}>
              <Sparkles size={18} color={sparklesIconColor} />
              <span>Automatyczna Wstępna Ocena AI</span>
            </div>

            <div className="ai-verdict-stats-group">
              <span className="ai-verdict-stats-badge-all">
                Wszystkie: <strong style={{ color: '#ffffff' }}>{safeAlerts.length}</strong>
              </span>
              <span className="badge-severity badge-critical">
                Krytyczne: <strong>{safeAlerts.filter(a => a?.severity?.toLowerCase() === 'critical').length}</strong>
              </span>
              <span className="badge-severity badge-high">
                Wysokie: <strong>{safeAlerts.filter(a => a?.severity?.toLowerCase() === 'high').length}</strong>
              </span>
              <span style={{ background: analyzedPillBg, border: analyzedPillBorder, color: headerTitleColor }}>
                Przeanalizowano: <strong>{safeHandledIds.length} z {safeAlerts.length}</strong>
              </span>
            </div>
          </div>

          {currentAlert && (
            autoAnalysisMap[currentAlert.id]?.loading ? (
              <span className="ai-verdict-loading-lbl" style={{ color: headerTitleColor }}>
                <Loader2 size={14} className="animate-spin" /> Analizowanie alertu {currentAlert.id}...
              </span>
            ) : (
              <div className="ai-verdict-right">
                {/* Badge 1: Wynik Analizy */}
                <div
                  className="ai-verdict-badge-main"
                  style={{
                    background: autoAnalysisMap[currentAlert.id]?.isAttack
                      ? 'linear-gradient(135deg, rgba(220, 38, 38, 0.9), rgba(239, 68, 68, 0.75))'
                      : 'linear-gradient(135deg, rgba(16, 185, 129, 0.9), rgba(52, 211, 153, 0.75))',
                    border: autoAnalysisMap[currentAlert.id]?.isAttack
                      ? '1px solid rgba(239, 68, 68, 1)'
                      : '1px solid rgba(52, 211, 153, 1)',
                    boxShadow: autoAnalysisMap[currentAlert.id]?.isAttack
                      ? '0 0 12px rgba(239, 68, 68, 0.5)'
                      : '0 0 12px rgba(52, 211, 153, 0.5)'
                  }}
                >
                  {autoAnalysisMap[currentAlert.id]?.isAttack ? (
                    <ShieldAlert size={13} color="#ffffff" />
                  ) : (
                    <CheckCircle2 size={13} color="#ffffff" />
                  )}
                  <span>
                    {autoAnalysisMap[currentAlert.id]?.verdictText || 'ATAK WYKRYTY'}
                  </span>
                </div>

                {/* Badge 2: Pewność AI */}
                <div
                  className="ai-confidence-badge"
                  style={{
                    background: isCurrentAttack
                      ? 'linear-gradient(135deg, rgba(185, 28, 28, 0.6), rgba(239, 68, 68, 0.35))'
                      : 'linear-gradient(135deg, rgba(4, 120, 87, 0.6), rgba(52, 211, 153, 0.35))',
                    border: isCurrentAttack
                      ? '1px solid rgba(239, 68, 68, 0.85)'
                      : '1px solid rgba(52, 211, 153, 0.85)',
                    boxShadow: isCurrentAttack
                      ? '0 0 10px rgba(239, 68, 68, 0.3)'
                      : '0 0 10px rgba(52, 211, 153, 0.3)'
                  }}
                >
                  <Brain size={12} color="#ffffff" />
                  <span className="ai-confidence-badge-text">
                    {autoAnalysisMap[currentAlert.id]?.confidence || 90}% Pewności
                  </span>
                </div>
              </div>
            )
          )}
        </div>

        {/* Confidence Progress Bar */}
        {currentAlert && !autoAnalysisMap[currentAlert.id]?.loading && (
          <div className="ai-confidence-progress-bg">
            <div
              className="ai-confidence-progress-bar"
              style={{
                width: `${autoAnalysisMap[currentAlert.id]?.confidence || 90}%`,
                background: (autoAnalysisMap[currentAlert.id]?.confidence || 90) >= 85
                  ? 'linear-gradient(90deg, #10b981, #34d399)'
                  : (autoAnalysisMap[currentAlert.id]?.confidence || 90) >= 70
                  ? 'linear-gradient(90deg, #f59e0b, #fbbf24)'
                  : 'linear-gradient(90deg, #ef4444, #f87171)'
              }}
            />
          </div>
        )}

        {/* AI Analysis Output */}
        {currentAlert && (
          <div
            className="ai-output-box"
            style={{
              background: outputBoxBg,
              border: outputBoxBorder
            }}
          >
            {autoAnalysisMap[currentAlert.id]?.loading ? (
              <span className="ai-output-loading">
                <Loader2 size={13} className="animate-spin" /> Analizowanie wektorów ataku dla alertu {currentAlert.id}...
              </span>
            ) : (
              renderFormattedAiText(autoAnalysisMap[currentAlert.id]?.text || 'Brak automatycznej analizy.', isCurrentAttack)
            )}
          </div>
        )}
      </div>

      {remainingAlerts.length === 0 && safeAlerts.length > 0 ? (
        <div className="ai-completion-card-view">
          <div className="ai-completion-icon-view">
            <CheckCircle2 size={38} color="#22c55e" />
          </div>

          <h2 className="ai-completion-title-view">
            Dziękujemy za Udział w Teście!
          </h2>

          <p className="ai-completion-desc-view">
            Pomyślnie przeanalizowałeś i obsłużyłeś wszystkie <strong>{safeAlerts.length}</strong> wyznaczonych zdarzeń incydentów bezpieczeństwa w tej sesji. Twoje decyzje oraz czasy reakcji zostały zapisane w bazie danych.
          </p>

          <div className="ai-completion-grid-view">
            <div>
              <span className="lbl">Obsłużone Alerty</span>
              <span className="ai-completion-val-cyan">{safeAlerts.length} z {safeAlerts.length}</span>
            </div>
            <div>
              <span className="lbl">Tryb Ewaluacji</span>
              <span className="ai-completion-val-purple">Z Asystentem AI</span>
            </div>
            <div>
              <span className="lbl">Status Sesji</span>
              <span className="ai-completion-val-green">Zakończona</span>
            </div>
          </div>

          <div className="ai-completion-buttons-view">
            {onNavigate && userSession?.role === 'Administrator' && (
              <button
                onClick={() => onNavigate('test-results')}
                className="btn-action btn-primary ai-completion-btn-nav"
              >
                <BarChart2 size={18} /> Zobacz Wyniki Testów
              </button>
            )}
            {onNavigate && (
              <button
                onClick={() => onNavigate('home')}
                className="btn-action ai-completion-btn-home"
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
            <div className="soc-card sticky-queue ai-queue-collapsed-view">
              <button
                onClick={() => setIsQueueCollapsed(false)}
                title="Rozwiń Kolejkę Alertów"
                className="ai-btn-expand-queue"
              >
                <PanelLeftOpen size={20} />
              </button>

              <div className="ai-collapsed-header-view">
                <Bot size={18} color="#38bdf8" />
                <span className="ai-collapsed-count-text">
                  {remainingAlerts.length}
                </span>
              </div>

              <div className="ai-collapsed-list-view">
                {filteredAlerts.map((alert) => (
                  <button
                    key={alert.id}
                    onClick={() => setSelectedAlertId(alert.id)}
                    title={`${alert.id} - ${alert.title}`}
                    className={`ai-collapsed-item ${currentAlert?.id === alert.id ? 'selected' : 'unselected'}`}
                  >
                    <span className={`ai-collapsed-item-id-txt ${alert.severity === 'Critical' ? 'critical' : alert.severity === 'High' ? 'high' : 'medium-low'}`}>
                      {alert.id.replace('ALT-', '')}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="soc-card sticky-queue">
              <div className="soc-card-header">
                <div className="ai-queue-header-row">
                  <Bot size={18} color="#38bdf8" />
                  <span>Kolejka Alertów ({remainingAlerts.length})</span>
                </div>
                <div className="ai-queue-header-actions">
                  <span className="ai-queue-live-label-txt">Na żywo</span>
                  <button
                    onClick={() => setIsQueueCollapsed(true)}
                    title="Zwiń kolejkę alertów do lewej"
                    className="ai-btn-collapse-queue"
                  >
                    <PanelLeftClose size={14} />
                    <span>Zwiń</span>
                  </button>
                </div>
              </div>

              <div className="ai-queue-search-section">
                <div className="ai-queue-search-input-box">
                  <Search size={14} />
                  <input
                    type="text"
                    placeholder="Szukaj po IP, nazwie hosta..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="ai-queue-search-input-val"
                  />
                </div>

                <div className="ai-queue-filters-row">
                  {['All', 'Critical', 'High', 'Medium', 'Low'].map((sev) => (
                    <button
                      key={sev}
                      onClick={() => setSelectedSeverity(sev)}
                      className={`ai-queue-filter-btn-item ${selectedSeverity === sev ? 'selected' : 'unselected'}`}
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
                    <div className="ai-item-header-meta">
                      <span className="ai-item-header-meta-mono">
                        {alert.id}
                      </span>
                      {getSeverityBadge(alert.severity)}
                    </div>
                    <div className="alert-item-title">{alert.title}</div>
                    <div className="alert-item-meta">
                      <span className="ai-item-meta-row">
                        <Globe size={12} color="#38bdf8" /> {alert.destinationHost}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Kolumna 2 (Środek): Telemetria & Opis Incydentu */}
          {currentAlert ? (
            <div className="soc-card">
              <div className="ai-middle-header">
                <div className="ai-middle-header-top-row">
                  <div className="ai-middle-header-badges">
                    <span className="ai-middle-header-badge-id">
                      {currentAlert.id}
                    </span>
                    {getSeverityBadge(currentAlert.severity)}
                  </div>

                  <div className="ai-middle-header-right-label">
                    <Terminal size={14} color="#38bdf8" /> AI Telemetry Hub
                  </div>
                </div>

                <h2 className="ai-middle-header-title">
                  {currentAlert.title}
                </h2>
              </div>

              <div className="ai-middle-body">
                {/* Metadane */}
                <div className="incident-metrics-grid">
                  <div className="metric-box">
                    <span className="metric-lbl">Źródłowy IP</span>
                    <div className="metric-val">
                      <span className="mono ai-middle-metric-ip-val">{currentAlert.sourceIp}</span>
                    </div>
                    {(() => {
                      const hostInfo = getHostInfoByIp(currentAlert.sourceIp);
                      if (!hostInfo) return null;
                      return (
                        <span className="ai-middle-metric-host-info">
                          {hostInfo.name} ({hostInfo.os})
                        </span>
                      );
                    })()}
                  </div>

                  <div className="metric-box">
                    <span className="metric-lbl">Docelowy Host</span>
                    <div className="metric-val">
                      <span className="mono ai-middle-metric-host-val">{currentAlert.destinationHost}</span>
                    </div>
                  </div>

                  <div className="metric-box">
                    <span className="metric-lbl">Konto / Użytkownik</span>
                    <div className="metric-val">
                      <span className="ai-middle-metric-user-val">
                        {(!currentAlert.userAccount || currentAlert.userAccount.includes('EXTERNAL_ATTACKER') || currentAlert.userAccount.includes('node_'))
                          ? 'Zewnętrzny / Nieokreślono'
                          : currentAlert.userAccount}
                      </span>
                    </div>
                  </div>

                  <div className="metric-box">
                    <span className="metric-lbl">Kategoria SIEM</span>
                    <div className="metric-val">
                      <span className="ai-middle-metric-cat-val">
                        {currentAlert.category || 'Anomalia Sieciowa'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Opis Zdarzenia SIEM */}
                <div className="ai-middle-desc-wrapper">
                  <div className="ai-middle-desc-title">
                    <FileText size={14} color="#38bdf8" /> Szczegółowy Opis Rekordu SIEM / EDR:
                  </div>
                  <div className="ai-middle-desc-box">
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
            <div className="soc-card sticky-queue" style={{ border: '1px solid rgba(56, 189, 248, 0.35)' }}>
              <div className="soc-card-header ai-right-header-wrapper">
                <div className="ai-right-header-row">
                  <Brain size={18} color="#38bdf8" />
                  <span>Panel Decyzyjny & AI</span>
                </div>
                <span className="soc-status-badge ai-right-status-badge">
                  ONLINE
                </span>
              </div>

              <div className="ai-right-body-wrapper">
                {/* Panel Decyzyjny Operatora */}
                <div>
                  <div className="ai-right-decision-title">
                    ⚡ Wybierz Działanie Reakcji:
                  </div>
                  <div className="ai-right-decision-buttons">
                    <button className="btn-action btn-danger ai-right-decision-btn" onClick={() => handleAction('Isolation')}>
                      <Lock size={15} color="#ffffff" />
                      <span className="ai-right-decision-btn-txt danger">Izoluj Hosta / Zablokuj Ruch (Isolation)</span>
                    </button>

                    <button className="btn-action btn-warning ai-right-decision-btn" onClick={() => handleAction('Escalation')}>
                      <ArrowUpRight size={15} color="#f59e0b" />
                      <span className="ai-right-decision-btn-txt warning">Eskaluj Incydent do L2 (Escalation)</span>
                    </button>

                    <button className="btn-action ai-right-decision-btn dismiss" onClick={() => handleAction('Dismiss')}>
                      <XCircle size={15} color="#4ade80" />
                      <span className="ai-right-decision-btn-txt green">Zignoruj jako Fałszywy Alarm / BENIGN (Dismiss)</span>
                    </button>
                  </div>
                </div>

                {/* Sugestie pytań do Asystenta AI */}
                <div className="ai-right-suggestions-section">
                  <div className="ai-right-suggestions-title">
                    <Sparkles size={12} color="#38bdf8" /> Szybkie Zapytania Analityka SOC:
                  </div>
                  <div className="ai-right-suggestions-buttons">
                    {[
                      { icon: '🔎', text: 'Wyjaśnij wektory zagrożenia i technikę MITRE dla tego ataku', color: '#38bdf8' },
                      { icon: '🛡️', text: 'Podaj zalecane reguły mitygacji (np. Sigma / YARA)', color: '#34d399' },
                      { icon: '📊', text: 'Czy ten adres IP występował w innych alertach?', color: '#fbbf24' },
                      { icon: '📄', text: 'Przygotuj krótkie podsumowanie incydentu do raportu SOC', color: '#38bdf8' }
                    ].map((item, idx) => (
                      <button
                        key={idx}
                        onClick={() => handleSendMessage(`${item.icon} ${item.text}`)}
                        disabled={isAiLoading}
                        style={{
                          background: 'rgba(30, 41, 59, 0.85)',
                          border: '1px solid rgba(148, 163, 184, 0.3)',
                          color: '#e2e8f0',
                          padding: '0.45rem 0.7rem',
                          borderRadius: '6px',
                          fontSize: '0.735rem',
                          fontWeight: 500,
                          textAlign: 'left',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          transition: 'all 0.15s ease'
                        }}
                        onMouseOver={(e) => {
                          e.currentTarget.style.background = 'rgba(51, 65, 85, 0.95)';
                          e.currentTarget.style.borderColor = item.color;
                          e.currentTarget.style.color = '#ffffff';
                        }}
                        onMouseOut={(e) => {
                          e.currentTarget.style.background = 'rgba(30, 41, 59, 0.85)';
                          e.currentTarget.style.borderColor = 'rgba(148, 163, 184, 0.3)';
                          e.currentTarget.style.color = '#e2e8f0';
                        }}
                      >
                        <span style={{ fontSize: '0.85rem' }}>{item.icon}</span>
                        <span style={{ color: '#e2e8f0', lineHeight: 1.3 }}>{item.text}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Chat Log Window z Asystentem AI */}
                <div className="ai-right-chat-window">
                  {chatMessages.length === 0 && !isAiLoading ? (
                    <div className="ai-right-chat-empty">
                      <Brain size={26} color="#38bdf8" />
                      Zapytaj Asystenta AI o szczegóły analityczne incydentu.
                    </div>
                  ) : (
                    <>
                      {chatMessages.map((msg, i) => (
                        <div key={i} className={`ai-chat-bubble-wrapper ${msg.sender === 'user' ? 'user' : ''}`}>
                          <span className={`ai-chat-bubble-msg ${msg.sender === 'user' ? 'user' : 'ai'}`}>
                            {msg.text}
                          </span>
                        </div>
                      ))}
                      {isAiLoading && (
                        <div className="ai-chat-bubble-wrapper">
                          <span className="ai-chat-loading-bubble">
                            <Loader2 size={14} className="animate-spin" /> Model Fine-Tuned Azure AI przetwarza zapytanie...
                          </span>
                        </div>
                      )}
                    </>
                  )}
                </div>

                {/* Input Box */}
                <div className="ai-chat-input-wrapper">
                  <input
                    type="text"
                    placeholder="Napisz do Asystenta AI..."
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                    className="ai-chat-input-field"
                  />
                  <button
                    onClick={() => handleSendMessage()}
                    disabled={isAiLoading}
                    className="ai-chat-btn-send"
                  >
                    <Send size={14} />
                  </button>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
};
