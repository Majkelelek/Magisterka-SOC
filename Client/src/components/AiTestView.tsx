import React, { useState, useEffect } from 'react';
import type { Alert, UserSession } from '../types/alert';
import { NetFlowInspector } from './NetFlowInspector';
import { askAiAssistant } from '../services/api';
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
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '0.75rem',
          background: 'rgba(239, 68, 68, 0.12)',
          border: '1px solid rgba(239, 68, 68, 0.4)',
          padding: '0.45rem 0.75rem',
          borderRadius: '6px',
          color: '#fca5a5',
          fontSize: '0.8rem'
        }}>
          <span style={{ fontWeight: 500 }}>{rawText}</span>
          <button
            onClick={handleRetryAnalysis}
            className="btn-action btn-primary"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '0.35rem 0.85rem',
              fontSize: '0.75rem',
              fontWeight: 700,
              background: 'linear-gradient(135deg, #dc2626, #ef4444)',
              borderRadius: '5px',
              border: 'none',
              cursor: 'pointer',
              color: '#ffffff',
              boxShadow: '0 2px 8px rgba(239, 68, 68, 0.4)'
            }}
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
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center' }}>
            {resultVal && (
              <div style={{ background: boxBg, padding: '0.3rem 0.6rem', borderRadius: '6px', border: `1px solid ${borderColor}`, fontSize: '0.785rem' }}>
                <span style={{ color: '#94a3b8', fontWeight: 600 }}>Wynik: </span>
                <strong style={{ color: accentColor }}>{resultVal}</strong>
              </div>
            )}

            {riskVal && (
              <div style={{ background: boxBg, padding: '0.3rem 0.6rem', borderRadius: '6px', border: `1px solid ${borderColor}`, fontSize: '0.785rem' }}>
                <span style={{ color: '#94a3b8', fontWeight: 600 }}>Ocena Ryzyka: </span>
                <strong style={{ color: riskVal.toLowerCase().includes('wysok') || riskVal.toLowerCase().includes('krytycz') ? '#f87171' : '#fbbf24' }}>
                  {riskVal}
                </strong>
              </div>
            )}

            {actionVal && (
              <div style={{ background: boxBg, padding: '0.3rem 0.6rem', borderRadius: '6px', border: `1px solid ${borderColor}`, fontSize: '0.785rem' }}>
                <span style={{ color: '#94a3b8', fontWeight: 600 }}>Rekomendowana Akcja: </span>
                <strong style={{ color: '#38bdf8' }}>{actionVal}</strong>
              </div>
            )}
          </div>

          {/* Bottom row: Justification */}
          {justificationVal && (
            <div style={{ background: boxBg, padding: '0.45rem 0.65rem', borderRadius: '6px', borderLeft: `3px solid ${borderLeftColor}`, border: `1px solid ${borderColor}`, fontSize: '0.8rem', color: '#e2e8f0', lineHeight: 1.45 }}>
              <span style={{ fontSize: '0.7rem', fontWeight: 800, color: accentColor, textTransform: 'uppercase', letterSpacing: '0.4px', display: 'block', marginBottom: '2px' }}>
                Uzasadnienie AI:
              </span>
              {justificationVal}
            </div>
          )}
        </div>
      );
    }

    return (
      <div style={{ background: boxBg, padding: '0.45rem 0.65rem', borderRadius: '6px', borderLeft: `3px solid ${borderLeftColor}`, fontSize: '0.8rem', color: '#e2e8f0', lineHeight: 1.45 }}>
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
      <div style={{
        background: cardBg,
        border: cardBorder,
        borderRadius: '8px',
        padding: '0.65rem 1rem',
        marginBottom: '0.75rem',
        boxShadow: cardShadow,
        transition: 'all 0.3s ease'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.4rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.875rem', fontWeight: 800, color: headerTitleColor }}>
              <Sparkles size={18} color={sparklesIconColor} />
              <span>Automatyczna Wstępna Ocena AI</span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.725rem' }}>
              <span style={{ background: 'rgba(255,255,255,0.06)', padding: '0.15rem 0.5rem', borderRadius: '4px', color: '#cbd5e1' }}>
                Wszystkie: <strong style={{ color: '#ffffff' }}>{safeAlerts.length}</strong>
              </span>
              <span style={{ background: 'var(--severity-critical-bg)', padding: '0.15rem 0.5rem', borderRadius: '4px', color: 'var(--severity-critical)' }}>
                Krytyczne: <strong>{safeAlerts.filter(a => a?.severity?.toLowerCase() === 'critical').length}</strong>
              </span>
              <span style={{ background: 'var(--severity-high-bg)', padding: '0.15rem 0.5rem', borderRadius: '4px', color: 'var(--severity-high)' }}>
                Wysokie: <strong>{safeAlerts.filter(a => a?.severity?.toLowerCase() === 'high').length}</strong>
              </span>
              <span style={{ background: analyzedPillBg, padding: '0.15rem 0.5rem', borderRadius: '4px', color: headerTitleColor, border: analyzedPillBorder }}>
                Przeanalizowano: <strong>{safeHandledIds.length} z {safeAlerts.length}</strong>
              </span>
            </div>
          </div>

          {currentAlert && (
            autoAnalysisMap[currentAlert.id]?.loading ? (
              <span style={{ fontSize: '0.75rem', color: headerTitleColor, display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600 }}>
                <Loader2 size={14} className="animate-spin" /> Analizowanie alertu {currentAlert.id}...
              </span>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {/* Badge 1: Wynik Analizy (Atak Wykryty -> Czerwony, Fałszywy Alarm -> Zielony) */}
                <div style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px',
                  background: autoAnalysisMap[currentAlert.id]?.isAttack
                    ? 'linear-gradient(135deg, rgba(220, 38, 38, 0.9), rgba(239, 68, 68, 0.75))'
                    : 'linear-gradient(135deg, rgba(16, 185, 129, 0.9), rgba(52, 211, 153, 0.75))',
                  border: autoAnalysisMap[currentAlert.id]?.isAttack
                    ? '1px solid rgba(239, 68, 68, 1)'
                    : '1px solid rgba(52, 211, 153, 1)',
                  padding: '0.2rem 0.65rem',
                  borderRadius: '20px',
                  boxShadow: autoAnalysisMap[currentAlert.id]?.isAttack
                    ? '0 0 12px rgba(239, 68, 68, 0.5)'
                    : '0 0 12px rgba(52, 211, 153, 0.5)'
                }}>
                  {autoAnalysisMap[currentAlert.id]?.isAttack ? (
                    <ShieldAlert size={13} color="#ffffff" />
                  ) : (
                    <CheckCircle2 size={13} color="#ffffff" />
                  )}
                  <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#ffffff', letterSpacing: '0.3px' }}>
                    {autoAnalysisMap[currentAlert.id]?.verdictText || 'ATAK WYKRYTY'}
                  </span>
                </div>

                {/* Badge 2: Pewność AI */}
                <div style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px',
                  background: isCurrentAttack
                    ? 'linear-gradient(135deg, rgba(185, 28, 28, 0.6), rgba(239, 68, 68, 0.35))'
                    : 'linear-gradient(135deg, rgba(4, 120, 87, 0.6), rgba(52, 211, 153, 0.35))',
                  border: isCurrentAttack
                    ? '1px solid rgba(239, 68, 68, 0.85)'
                    : '1px solid rgba(52, 211, 153, 0.85)',
                  padding: '0.2rem 0.65rem',
                  borderRadius: '20px',
                  boxShadow: isCurrentAttack
                    ? '0 0 10px rgba(239, 68, 68, 0.3)'
                    : '0 0 10px rgba(52, 211, 153, 0.3)'
                }}>
                  <Brain size={12} color="#ffffff" />
                  <span style={{ fontSize: '0.775rem', fontWeight: 800, color: '#ffffff', fontFamily: 'JetBrains Mono, monospace' }}>
                    {autoAnalysisMap[currentAlert.id]?.confidence || 90}% Pewności
                  </span>
                </div>
              </div>
            )
          )}
        </div>

        {/* Confidence Progress Bar */}
        {currentAlert && !autoAnalysisMap[currentAlert.id]?.loading && (
          <div style={{ width: '100%', background: '#090f1d', borderRadius: '4px', height: '4px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.08)', marginBottom: '0.45rem' }}>
            <div style={{
              width: `${autoAnalysisMap[currentAlert.id]?.confidence || 90}%`,
              height: '100%',
              background: (autoAnalysisMap[currentAlert.id]?.confidence || 90) >= 85
                ? 'linear-gradient(90deg, #10b981, #34d399)'
                : (autoAnalysisMap[currentAlert.id]?.confidence || 90) >= 70
                ? 'linear-gradient(90deg, #f59e0b, #fbbf24)'
                : 'linear-gradient(90deg, #ef4444, #f87171)',
              borderRadius: '4px',
              transition: 'width 0.4s ease-in-out'
            }} />
          </div>
        )}

        {/* AI Analysis Output */}
        {currentAlert && (
          <div style={{
            fontSize: '0.815rem',
            color: '#f8fafc',
            background: outputBoxBg,
            padding: '0.45rem 0.65rem',
            borderRadius: '6px',
            border: outputBoxBorder
          }}>
            {autoAnalysisMap[currentAlert.id]?.loading ? (
              <span style={{ color: '#94a3b8', fontStyle: 'italic', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.785rem' }}>
                <Loader2 size={13} className="animate-spin" /> Analizowanie wektorów ataku dla alertu {currentAlert.id}...
              </span>
            ) : (
              renderFormattedAiText(autoAnalysisMap[currentAlert.id]?.text || 'Brak automatycznej analizy.', isCurrentAttack)
            )}
          </div>
        )}
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
              <span style={{ fontSize: '1.1rem', fontWeight: 700, color: '#c084fc' }}>Z Asystentem AI</span>
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
              <Bot size={18} color="#38bdf8" />
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
                <Bot size={18} color="#38bdf8" />
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
                    border: '1px solid rgba(56, 189, 248, 0.25)',
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
                      background: selectedSeverity === sev ? 'linear-gradient(135deg, #0284c7, #38bdf8)' : '#090f1d',
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
              {filteredAlerts.map((alert) => (
                <div
                  key={alert.id}
                  className={`alert-item ${currentAlert?.id === alert.id ? 'selected-ai' : ''}`}
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
              ))}
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
                  <Terminal size={14} color="#38bdf8" /> AI Telemetry Hub
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
                  border: '1px solid rgba(56, 189, 248, 0.25)',
                  borderRadius: '8px',
                  padding: '1rem 1.15rem',
                  color: '#f8fafc',
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
          <div className="soc-card sticky-queue" style={{ border: '1px solid rgba(56, 189, 248, 0.35)' }}>
            <div className="soc-card-header" style={{ background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.95), rgba(14, 116, 144, 0.25))' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Brain size={18} color="#38bdf8" />
                <span>Panel Decyzyjny & AI</span>
              </div>
              <span className="soc-status-badge" style={{ background: 'rgba(56, 189, 248, 0.15)', borderColor: 'rgba(56, 189, 248, 0.4)', color: '#38bdf8' }}>
                ONLINE
              </span>
            </div>

            <div style={{ padding: '1.1rem', display: 'flex', flexDirection: 'column', flex: 1, gap: '1rem' }}>

              {/* Panel Decyzyjny Operatora */}
              <div>
                <div style={{ fontSize: '0.775rem', fontWeight: 700, color: '#ffffff', marginBottom: '0.65rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  ⚡ Wybierz Działanie Reakcji:
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <button className="btn-action btn-danger" style={{ width: '100%', justifyContent: 'flex-start', padding: '0.65rem 0.85rem' }} onClick={() => handleAction('Isolation')}>
                    <Lock size={15} color="#ffffff" />
                    <span style={{ color: '#ffffff', fontWeight: 700 }}>Izoluj Hosta / Zablokuj Ruch (Isolation)</span>
                  </button>

                  <button className="btn-action btn-warning" style={{ width: '100%', justifyContent: 'flex-start', padding: '0.65rem 0.85rem' }} onClick={() => handleAction('Escalation')}>
                    <ArrowUpRight size={15} color="#f59e0b" />
                    <span style={{ color: '#fbbf24', fontWeight: 700 }}>Eskaluj Incydent do L2 (Escalation)</span>
                  </button>

                  <button className="btn-action" style={{ width: '100%', justifyContent: 'flex-start', padding: '0.65rem 0.85rem', background: 'rgba(34, 197, 94, 0.15)', border: '1px solid rgba(34, 197, 94, 0.4)' }} onClick={() => handleAction('Dismiss')}>
                    <XCircle size={15} color="#4ade80" />
                    <span style={{ color: '#4ade80', fontWeight: 700 }}>Zignoruj jako Fałszywy Alarm / BENIGN (Dismiss)</span>
                  </button>
                </div>
              </div>

              {/* Sugestie pytań do Asystenta AI */}
              <div style={{ paddingTop: '0.5rem', borderTop: '1px solid rgba(255, 255, 255, 0.08)' }}>
                <div style={{ fontSize: '0.725rem', color: '#38bdf8', marginBottom: '0.4rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Sparkles size={12} color="#38bdf8" /> Szybkie Zapytania Analityka SOC:
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
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
              <div style={{
                flex: 1,
                minHeight: '180px',
                maxHeight: '260px',
                background: '#040711',
                borderRadius: '8px',
                padding: '0.75rem',
                border: '1px solid rgba(56, 189, 248, 0.25)',
                overflowY: 'auto',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.5rem'
              }}>
                {chatMessages.length === 0 && !isAiLoading ? (
                  <div style={{ margin: 'auto', textAlign: 'center', color: 'var(--text-dim)', fontSize: '0.775rem' }}>
                    <Brain size={26} color="#38bdf8" style={{ opacity: 0.5, margin: '0 auto 0.4rem auto' }} />
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
                          border: msg.sender === 'ai' ? '1px solid rgba(56, 189, 248, 0.35)' : 'none',
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
                          color: '#38bdf8',
                          border: '1px dashed rgba(56, 189, 248, 0.4)',
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
      )}
    </div>
  );
};
