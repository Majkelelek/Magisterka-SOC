import React, { useState, useEffect } from 'react';
import { Play, BarChart2, CheckCircle2, XCircle, Clock, Zap, Shield, Sparkles, RefreshCw, AlertTriangle, Layers, ChevronDown, ChevronUp, FileText, Cpu, Cloud, Download, FileSpreadsheet, Filter, Trash2 } from 'lucide-react';
import type { EvaluationReport } from '../types/evaluation';
import { runModelEvaluation, getLatestEvaluationReport, getEvaluationHistory, fetchOllamaModels, deleteEvaluationReport } from '../services/api';

export const EvaluationBenchmarkPage: React.FC = () => {
  const [report, setReport] = useState<EvaluationReport | null>(null);
  const [historicalReports, setHistoricalReports] = useState<EvaluationReport[]>([]);
  const [selectedBaseReportId, setSelectedBaseReportId] = useState<string>('');
  const [selectedModelFilter, setSelectedModelFilter] = useState<string>('ALL');

  const [loading, setLoading] = useState<boolean>(true);
  const [running, setRunning] = useState<boolean>(false);
  const [recordCount, setRecordCount] = useState<number>(20);
  const [statusMsg, setStatusMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [expandedItemId, setExpandedItemId] = useState<string | null>(null);
  const [filterMode, setFilterMode] = useState<'ALL' | 'MISMATCHED' | 'CORRECT'>('ALL');

  // Ollama Model Selection state
  const [availableOllamaModels, setAvailableOllamaModels] = useState<string[]>([]);
  const [selectedOllamaModel, setSelectedOllamaModel] = useState<string>('llama3.2');
  const [isOllamaOnline, setIsOllamaOnline] = useState<boolean>(false);

  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);
  const [activeModeText, setActiveModeText] = useState<string>('');

  const loadReportsData = async () => {
    setLoading(true);
    const res = await getLatestEvaluationReport();
    if (res.success && res.report) {
      setReport(res.report);
      setSelectedBaseReportId(res.report.reportId);
    }
    const histRes = await getEvaluationHistory();
    if (histRes.success && histRes.reports.length > 0) {
      setHistoricalReports(histRes.reports);
      if (!res.report) {
        setReport(histRes.reports[0]);
        setSelectedBaseReportId(histRes.reports[0].reportId);
      }
    }
    setLoading(false);
  };

  const loadOllamaModels = async () => {
    const res = await fetchOllamaModels();
    setIsOllamaOnline(res.isOllamaOnline);
    if (res.success && res.models.length > 0) {
      setAvailableOllamaModels(res.models);
      const preferred = res.models.find(m => m.includes('llama3.2')) || res.models[0];
      setSelectedOllamaModel(preferred);
    }
  };

  useEffect(() => {
    loadReportsData();
    loadOllamaModels();
  }, []);

  const handleStartBenchmark = async (mode: 'both' | 'base' | 'ft') => {
    setRunning(true);
    setElapsedSeconds(0);
    setStatusMsg(null);

    const modeText = mode === 'base'
      ? `Ollama (${selectedOllamaModel})`
      : mode === 'ft'
        ? 'Azure OpenAI FT'
        : `Ollama + Azure OpenAI FT`;
    setActiveModeText(modeText);

    const timerInterval = setInterval(() => {
      setElapsedSeconds(prev => prev + 1);
    }, 1000);

    const res = await runModelEvaluation(recordCount, mode, selectedOllamaModel);
    clearInterval(timerInterval);

    setRunning(false);
    if (res.success && res.report) {
      setReport(res.report);
      setSelectedBaseReportId(res.report.reportId);
      setHistoricalReports(prev => [res.report!, ...prev.filter(r => r.reportId !== res.report!.reportId)]);
      setStatusMsg({ text: res.message, type: 'success' });
    } else {
      setStatusMsg({ text: res.message, type: 'error' });
    }
  };

  const calculateDiff = (valFt: number, valBase: number, isLatency: boolean = false) => {
    const diff = valFt - valBase;
    if (Math.abs(diff) < 0.01) return { text: '0.0%', isPositive: true };
    const pct = isLatency
      ? ((valBase - valFt) / valBase * 100).toFixed(1)
      : diff.toFixed(1);
    const isPositive = isLatency ? (valFt < valBase) : (diff > 0);
    const sign = diff > 0 ? '+' : '';
    return { text: `${sign}${pct}%`, isPositive };
  };

  // Model filtering & historical reports logic
  const uniqueModelNames = Array.from(
    new Set(historicalReports.map(r => r.baseModelMetrics?.modelName).filter(Boolean))
  );

  const filteredHistoricalReports = selectedModelFilter === 'ALL'
    ? historicalReports
    : historicalReports.filter(r => r.baseModelMetrics?.modelName.toLowerCase() === selectedModelFilter.toLowerCase());

  const selectedBaseReport = historicalReports.find(r => r.reportId === selectedBaseReportId) || report;
  const baseMetrics = selectedBaseReport?.baseModelMetrics || report?.baseModelMetrics;
  const ftMetrics = report?.fineTunedModelMetrics;

  const handleExportToExcel = () => {
    const reportsToExport = selectedModelFilter === 'ALL'
      ? historicalReports
      : historicalReports.filter(r => r.baseModelMetrics?.modelName.toLowerCase() === selectedModelFilter.toLowerCase());

    if (reportsToExport.length === 0) {
      alert('Brak raportów do wyeksportowania dla wybranego filtra!');
      return;
    }

    // UTF-8 BOM for Microsoft Excel Polish character support
    let csv = '\uFEFF';

    // SECTION 1: MODEL RUNS SUMMARY TABLE
    csv += `=== PODSUMOWANIE PRÓB BENCHMARKOWYCH MODELU (${selectedModelFilter === 'ALL' ? 'WSZYSTKIE MODELE' : selectedModelFilter.toUpperCase()}) ===\n`;
    csv += 'Lp;ID Raportu;Data i Czas Raportu;Model Bazowy (Ollama);Testowanych Rekordow;Accuracy (%);Precision (%);Recall (%);F1-Score (%);Format Compliance (%);Srednia Latencja (ms);True Positives (TP);False Positives (FP);False Negatives (FN);True Negatives (TN);Fine-Tuned Model;Fine-Tuned Accuracy (%);Fine-Tuned F1-Score (%)\n';

    reportsToExport.forEach((r, idx) => {
      const bm = r.baseModelMetrics;
      const ftm = r.fineTunedModelMetrics;
      const dateStr = new Date(r.timestamp).toLocaleString('pl-PL');
      csv += `${idx + 1};"${r.reportId}";"${dateStr}";"${bm.modelName}";${r.totalRecordsTested};${bm.accuracy.toFixed(2)};${bm.precision.toFixed(2)};${bm.recall.toFixed(2)};${bm.f1Score.toFixed(2)};${bm.formatAdherenceRate.toFixed(2)};${bm.averageLatencyMs.toFixed(0)};${bm.truePositives};${bm.falsePositives};${bm.falseNegatives};${bm.trueNegatives};"${ftm.modelName}";${ftm.accuracy.toFixed(2)};${ftm.f1Score.toFixed(2)}\n`;
    });

    csv += '\n=== SZCZEGÓŁOWE PREDYKCJE REKORDÓW WE WSZYSTKICH PRÓBACH ===\n';
    csv += 'Numer Proby;ID Raportu;Model Bazowy;Data i Czas;ID Alertu;Kategoria Alertu;Poziom Zagrozenia;Ground Truth;Ground Truth Akcja;Model Bazowy Predykcja;Model Bazowy Akcja;Model Bazowy Wynik;Model Bazowy Latencja (ms);Model FT Predykcja;Model FT Akcja;Model FT Wynik;Model FT Latencja (ms)\n';

    reportsToExport.forEach((r, rIdx) => {
      const bmName = r.baseModelMetrics.modelName;
      const dateStr = new Date(r.timestamp).toLocaleString('pl-PL');
      r.itemResults.forEach(item => {
        const gtClass = item.groundTruthIsThreat ? 'Atak' : 'Ruch Prawidlowy';
        const baseClass = item.baseModelResponse.predictedIsThreat ? 'Atak' : 'Ruch Prawidlowy';
        const baseResult = item.baseModelResponse.isClassCorrect ? 'OK' : 'BLAD';
        const ftClass = item.fineTunedModelResponse.predictedIsThreat ? 'Atak' : 'Ruch Prawidlowy';
        const ftResult = item.fineTunedModelResponse.isClassCorrect ? 'OK' : 'BLAD';

        csv += `${rIdx + 1};"${r.reportId}";"${bmName}";"${dateStr}";"${item.alertId}";"${item.category}";"${item.severity}";"${gtClass}";"${item.groundTruthAction}";"${baseClass}";"${item.baseModelResponse.predictedAction}";"${baseResult}";${item.baseModelResponse.latencyMs};"${ftClass}";"${item.fineTunedModelResponse.predictedAction}";"${ftResult}";${item.fineTunedModelResponse.latencyMs}\n`;
      });
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const modelTag = selectedModelFilter === 'ALL' ? 'Wszystkie_Modele' : selectedModelFilter.replace(/[:\/]/g, '_');
    const timestampStr = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
    link.href = url;
    link.download = `Benchmark_Modelu_${modelTag}_${timestampStr}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleDeleteReport = async (reportIdToDelete: string) => {
    if (!reportIdToDelete) return;
    if (!window.confirm(`Czy na pewno chcesz usunąć tę próbę benchmarku (ID: ${reportIdToDelete})? Operacja trwale usunie wynik z bazy MongoDB.`)) {
      return;
    }

    const res = await deleteEvaluationReport(reportIdToDelete);
    if (res.success) {
      setStatusMsg({ text: `Pomyślnie usunięto próbę benchmarku z bazy danych.`, type: 'success' });
      setHistoricalReports(prev => {
        const updated = prev.filter(r => r.reportId !== reportIdToDelete);
        if (selectedBaseReportId === reportIdToDelete) {
          const nextReport = updated[0];
          if (nextReport) {
            setReport(nextReport);
            setSelectedBaseReportId(nextReport.reportId);
          } else {
            setReport(null);
            setSelectedBaseReportId('');
          }
        }
        return updated;
      });
    } else {
      setStatusMsg({ text: res.message, type: 'error' });
    }
  };

  const filteredItems = (report?.itemResults || []).filter(item => {
    const bResp = (selectedBaseReport?.itemResults.find(r => r.alertId === item.alertId) || item).baseModelResponse;
    const fResp = item.fineTunedModelResponse;
    if (filterMode === 'MISMATCHED') {
      return !bResp.isClassCorrect || !fResp.isClassCorrect || !bResp.isActionCorrect || !fResp.isActionCorrect;
    }
    if (filterMode === 'CORRECT') {
      return bResp.isClassCorrect && fResp.isClassCorrect;
    }
    return true;
  });

  return (
    <div style={{ paddingBottom: '3rem' }}>
      {/* Header Section */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.95), rgba(7, 10, 18, 0.98))',
        border: '1px solid rgba(139, 92, 246, 0.35)',
        borderRadius: '14px',
        padding: '1.5rem 1.75rem',
        marginBottom: '1.5rem',
        boxShadow: '0 10px 30px rgba(0, 0, 0, 0.5), 0 0 20px rgba(139, 92, 246, 0.15)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{
                background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.25), rgba(99, 102, 241, 0.25))',
                padding: '8px 12px',
                borderRadius: '10px',
                border: '1px solid rgba(139, 92, 246, 0.5)'
              }}>
                <BarChart2 size={24} color="#c084fc" />
              </div>
              <h1 style={{ fontSize: '1.6rem', fontWeight: 800, color: '#ffffff', margin: 0 }}>
                Model Benchmark & Evaluation
              </h1>
            </div>
            <p style={{ color: '#94a3b8', fontSize: '0.85rem', marginTop: '0.4rem', marginBottom: 0 }}>
              Naukowa ewaluacja i porównanie wyników klasyfikacji incydentów SOC (<strong>Model Bazowy: Lokalna Ollama</strong> vs <strong>Model Wyfinetuningowany: Azure OpenAI FT</strong>).
            </p>
          </div>

          {/* Controls */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', alignItems: 'flex-end' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              {/* Record Count Selector */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(15, 23, 42, 0.8)', padding: '0.4rem 0.75rem', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                <span style={{ fontSize: '0.8rem', color: '#94a3b8', fontWeight: 600 }}>Rekordy:</span>
                <select
                  value={recordCount}
                  onChange={e => setRecordCount(Number(e.target.value))}
                  disabled={running}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: '#ffffff',
                    fontWeight: 700,
                    fontSize: '0.85rem',
                    cursor: 'pointer',
                    outline: 'none'
                  }}
                >
                  <option value={10} style={{ background: '#0f172a' }}>10 alertów</option>
                  <option value={20} style={{ background: '#0f172a' }}>20 alertów</option>
                  <option value={50} style={{ background: '#0f172a' }}>50 alertów</option>
                  <option value={75} style={{ background: '#0f172a' }}>75 alertów (Całość)</option>
                </select>
              </div>

              {/* Ollama Model Selector */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(15, 23, 42, 0.8)', padding: '0.4rem 0.75rem', borderRadius: '8px', border: '1px solid rgba(56, 189, 248, 0.3)' }}>
                <Cpu size={14} color="#38bdf8" />
                <span style={{ fontSize: '0.8rem', color: '#38bdf8', fontWeight: 600 }}>Model Ollama:</span>
                {availableOllamaModels.length > 0 ? (
                  <select
                    value={selectedOllamaModel}
                    onChange={e => setSelectedOllamaModel(e.target.value)}
                    disabled={running}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: '#4ade80',
                      fontWeight: 700,
                      fontSize: '0.85rem',
                      cursor: 'pointer',
                      outline: 'none'
                    }}
                  >
                    {availableOllamaModels.map(m => (
                      <option key={m} value={m} style={{ background: '#0f172a', color: '#ffffff' }}>
                        {m}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    value={selectedOllamaModel}
                    onChange={e => setSelectedOllamaModel(e.target.value)}
                    disabled={running}
                    placeholder="np. llama3.2"
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: '#ffffff',
                      fontWeight: 700,
                      fontSize: '0.85rem',
                      width: '100px',
                      outline: 'none'
                    }}
                  />
                )}
                <span style={{
                  fontSize: '0.7rem',
                  padding: '2px 6px',
                  borderRadius: '4px',
                  background: isOllamaOnline ? 'rgba(34, 197, 94, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                  color: isOllamaOnline ? '#4ade80' : '#f87171',
                  fontWeight: 700
                }}>
                  {isOllamaOnline ? 'ONLINE' : 'OFFLINE'}
                </span>
              </div>
            </div>

            {/* 3 Separate Execution Buttons */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              {/* Button 1: Base Only */}
              <button
                onClick={() => handleStartBenchmark('base')}
                disabled={running}
                title="Wysyła zapytania WYŁĄCZNIE do lokalnej instancji Ollamy (brak opłat Azure)"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  background: 'rgba(56, 189, 248, 0.15)',
                  border: '1px solid rgba(56, 189, 248, 0.4)',
                  color: '#38bdf8',
                  borderRadius: '8px',
                  padding: '0.45rem 0.9rem',
                  fontSize: '0.8rem',
                  fontWeight: 700,
                  cursor: running ? 'not-allowed' : 'pointer',
                  opacity: running ? 0.6 : 1
                }}
              >
                <Cpu size={14} /> Testuj Tylko Ollamę
              </button>

              {/* Button 2: Azure FT Only */}
              <button
                onClick={() => handleStartBenchmark('ft')}
                disabled={running}
                title="Wysyła zapytania WYŁĄCZNIE do dostrojonego modelu w Azure OpenAI"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  background: 'rgba(192, 132, 252, 0.15)',
                  border: '1px solid rgba(192, 132, 252, 0.4)',
                  color: '#c084fc',
                  borderRadius: '8px',
                  padding: '0.45rem 0.9rem',
                  fontSize: '0.8rem',
                  fontWeight: 700,
                  cursor: running ? 'not-allowed' : 'pointer',
                  opacity: running ? 0.6 : 1
                }}
              >
                <Cloud size={14} /> Testuj Tylko Azure FT
              </button>

              {/* Button 3: Full Comparative Benchmark */}
              <button
                onClick={() => handleStartBenchmark('both')}
                disabled={running}
                title="Uruchamia pełny test porównawczy równolegle dla obu modeli"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  background: 'linear-gradient(135deg, #8b5cf6, #6366f1)',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '0.5rem 1.1rem',
                  fontSize: '0.825rem',
                  fontWeight: 800,
                  cursor: running ? 'not-allowed' : 'pointer',
                  boxShadow: '0 4px 14px rgba(139, 92, 246, 0.4)',
                  opacity: running ? 0.6 : 1
                }}
              >
                {running ? (
                  <>
                    <RefreshCw size={14} className="animate-spin" /> Testowanie...
                  </>
                ) : (
                  <>
                    <Play size={14} fill="#ffffff" /> Pełny Benchmark (Obydwa)
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Live Execution Status */}
        {running && (
          <div style={{
            marginTop: '1.25rem',
            background: 'rgba(15, 23, 42, 0.85)',
            border: '1px solid rgba(139, 92, 246, 0.4)',
            borderRadius: '10px',
            padding: '1rem 1.25rem',
            boxShadow: '0 4px 15px rgba(0, 0, 0, 0.3)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#c084fc', fontWeight: 700, fontSize: '0.9rem' }}>
                <RefreshCw size={16} className="animate-spin" />
                <span>Wykonywanie ewaluacji AI dla {recordCount} rekordów [{activeModeText}]</span>
              </div>
              <div style={{ color: '#38bdf8', fontWeight: 700, fontSize: '0.85rem' }}>
                Czas trwania: {elapsedSeconds}s
              </div>
            </div>
            <p style={{ color: '#94a3b8', fontSize: '0.825rem', margin: 0 }}>
              💡 Rekordy są testowane sekwencyjnie. Podgląd każdego zapychanego i odbieranego rekordu w czasie rzeczywistym możesz śledzić na żywo w konsoli serwera .NET!
            </p>
          </div>
        )}
      </div>

      {statusMsg && (
        <div style={{
          padding: '0.85rem 1.25rem',
          borderRadius: '8px',
          marginBottom: '1.5rem',
          background: statusMsg.type === 'success' ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)',
          border: statusMsg.type === 'success' ? '1px solid rgba(34, 197, 94, 0.3)' : '1px solid rgba(239, 68, 68, 0.3)',
          color: statusMsg.type === 'success' ? '#4ade80' : '#f87171',
          fontSize: '0.875rem',
          fontWeight: 600
        }}>
          {statusMsg.text}
        </div>
      )}

      {loading ? (
        <div className="soc-card" style={{ padding: '4rem', textAlign: 'center', color: 'var(--text-muted)' }}>
          <RefreshCw size={36} className="animate-spin" style={{ margin: '0 auto 1rem auto', color: '#8b5cf6' }} />
          <p style={{ fontSize: '0.9rem' }}>Wczytywanie wyników ewaluacji z bazy danych...</p>
        </div>
      ) : !report ? (
        <div className="soc-card" style={{ padding: '4rem', textAlign: 'center', color: 'var(--text-muted)' }}>
          <Sparkles size={40} style={{ margin: '0 auto 1rem auto', color: '#8b5cf6' }} />
          <h3 style={{ color: '#ffffff', margin: '0 0 0.5rem 0' }}>Brak Wykonanego Raportu Benchmarku</h3>
          <p style={{ fontSize: '0.875rem', maxWidth: '480px', margin: '0 auto 1.5rem auto' }}>
            Kliknij przycisk <strong>"Uruchom Benchmark"</strong> powyżej, aby przeprowadzić automatyczną ewaluację modeli ML i obliczyć metryki Accuracy, Precision, Recall oraz Latencję.
          </p>
        </div>
      ) : (
        <>
          {/* Historical Model Selector & Export Banner */}
          {historicalReports.length > 0 && (
            <div style={{
              background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.95), rgba(30, 41, 59, 0.95))',
              border: '1px solid rgba(56, 189, 248, 0.4)',
              borderRadius: '12px',
              padding: '1rem 1.25rem',
              marginBottom: '1.5rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '1rem',
              boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ background: 'rgba(56, 189, 248, 0.15)', padding: '0.6rem', borderRadius: '8px', border: '1px solid rgba(56, 189, 248, 0.3)' }}>
                  <Cpu size={22} color="#38bdf8" />
                </div>
                <div>
                  <div style={{ color: '#ffffff', fontWeight: 800, fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    Zarządzanie i Porównanie Prób Modeli
                    <span style={{ fontSize: '0.725rem', background: 'rgba(56, 189, 248, 0.2)', color: '#38bdf8', padding: '2px 8px', borderRadius: '12px', fontWeight: 700 }}>
                      Historia: {filteredHistoricalReports.length} prób
                    </span>
                  </div>
                  <div style={{ color: '#94a3b8', fontSize: '0.8rem', marginTop: '2px' }}>
                    Filtruj powtórzone próby dla danego modelu lokalnego i wyeksportuj pełne zestawienie do pliku Excel.
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                {/* Model Filter */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Filter size={14} color="#94a3b8" />
                  <span style={{ fontSize: '0.775rem', color: '#94a3b8', fontWeight: 600 }}>Model:</span>
                  <select
                    value={selectedModelFilter}
                    onChange={(e) => {
                      const newFilter = e.target.value;
                      setSelectedModelFilter(newFilter);
                      const matching = newFilter === 'ALL'
                        ? historicalReports
                        : historicalReports.filter(h => h.baseModelMetrics?.modelName.toLowerCase() === newFilter.toLowerCase());
                      if (matching.length > 0) {
                        setSelectedBaseReportId(matching[0].reportId);
                      }
                    }}
                    style={{
                      background: '#0f172a',
                      color: '#ffffff',
                      border: '1px solid rgba(255, 255, 255, 0.2)',
                      borderRadius: '6px',
                      padding: '0.4rem 0.65rem',
                      fontSize: '0.8rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      outline: 'none'
                    }}
                  >
                    <option value="ALL">Wszystkie Modele ({historicalReports.length})</option>
                    {uniqueModelNames.map(name => {
                      const count = historicalReports.filter(h => h.baseModelMetrics?.modelName.toLowerCase() === name.toLowerCase()).length;
                      return (
                        <option key={name} value={name}>
                          {name} ({count} {count === 1 ? 'próba' : 'prób'})
                        </option>
                      );
                    })}
                  </select>
                </div>

                {/* Specific Run Dropdown */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Clock size={14} color="#38bdf8" />
                  <span style={{ fontSize: '0.775rem', color: '#38bdf8', fontWeight: 700 }}>Próba do Podglądu:</span>
                  <select
                    value={selectedBaseReportId}
                    onChange={(e) => setSelectedBaseReportId(e.target.value)}
                    style={{
                      background: '#0f172a',
                      color: '#38bdf8',
                      border: '1px solid #38bdf8',
                      borderRadius: '6px',
                      padding: '0.4rem 0.75rem',
                      fontWeight: 800,
                      fontSize: '0.8rem',
                      cursor: 'pointer',
                      outline: 'none',
                      boxShadow: '0 0 8px rgba(56, 189, 248, 0.2)'
                    }}
                  >
                    {filteredHistoricalReports.map((h, idx) => (
                      <option key={h.reportId} value={h.reportId} style={{ background: '#0f172a', color: '#ffffff' }}>
                        Próba #{filteredHistoricalReports.length - idx}: {h.baseModelMetrics.modelName} ({new Date(h.timestamp).toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}) - {h.baseModelMetrics.accuracy}% Acc
                      </option>
                    ))}
                  </select>
                </div>

                {/* Export to Excel Button */}
                <button
                  onClick={handleExportToExcel}
                  title="Pobierz plik CSV otwieralny bezpośrednio w programie Excel"
                  style={{
                    background: 'linear-gradient(135deg, #10b981, #059669)',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '0.5rem 1rem',
                    fontWeight: 800,
                    fontSize: '0.8rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)',
                    transition: 'all 0.2s'
                  }}
                >
                  <FileSpreadsheet size={16} />
                  Eksportuj do Excela (.csv)
                </button>

                {/* Delete Selected Report Button */}
                {selectedBaseReportId && (
                  <button
                    onClick={() => handleDeleteReport(selectedBaseReportId)}
                    title="Usuń obecnie wybraną próbę z bazy danych"
                    style={{
                      background: 'rgba(239, 68, 68, 0.15)',
                      color: '#f87171',
                      border: '1px solid rgba(239, 68, 68, 0.35)',
                      borderRadius: '8px',
                      padding: '0.5rem 0.85rem',
                      fontWeight: 800,
                      fontSize: '0.8rem',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      transition: 'all 0.2s'
                    }}
                  >
                    <Trash2 size={15} />
                    Usuń próbę
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Model Multiple Runs History Table (shown when filtered model has > 1 run) */}
          {filteredHistoricalReports.length > 1 && (
            <div className="soc-card" style={{ padding: '1.25rem', marginBottom: '1.5rem', background: 'rgba(15, 23, 42, 0.6)', border: '1px solid rgba(56, 189, 248, 0.25)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Layers size={16} color="#38bdf8" />
                  <h4 style={{ margin: 0, fontSize: '0.9rem', color: '#ffffff', fontWeight: 800 }}>
                    Zestawienie Wszystkich Prób dla Modelu: <span style={{ color: '#38bdf8' }}>{selectedModelFilter === 'ALL' ? 'Wszystkie Modele' : selectedModelFilter}</span> ({filteredHistoricalReports.length} wykonane testy)
                  </h4>
                </div>
                <button
                  onClick={handleExportToExcel}
                  style={{ background: 'transparent', border: 'none', color: '#10b981', fontSize: '0.775rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                >
                  <Download size={13} /> Pobierz arkusz dla wszystkich próbek
                </button>
              </div>

              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.775rem', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ background: 'rgba(30, 41, 59, 0.8)', color: '#94a3b8', borderBottom: '1px solid rgba(255, 255, 255, 0.1)' }}>
                      <th style={{ padding: '0.5rem 0.75rem' }}>PRÓBA #</th>
                      <th style={{ padding: '0.5rem 0.75rem' }}>MODEL BAZOWY</th>
                      <th style={{ padding: '0.5rem 0.75rem' }}>DATA I CZAS</th>
                      <th style={{ padding: '0.5rem 0.75rem' }}>ACCURACY</th>
                      <th style={{ padding: '0.5rem 0.75rem' }}>PRECISION</th>
                      <th style={{ padding: '0.5rem 0.75rem' }}>RECALL</th>
                      <th style={{ padding: '0.5rem 0.75rem' }}>F1-SCORE</th>
                      <th style={{ padding: '0.5rem 0.75rem' }}>LATENCJA</th>
                      <th style={{ padding: '0.5rem 0.75rem', textAlign: 'right' }}>AKCJA</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredHistoricalReports.map((h, idx) => {
                      const isSelected = h.reportId === selectedBaseReportId;
                      const bm = h.baseModelMetrics;
                      return (
                        <tr
                          key={h.reportId}
                          onClick={() => setSelectedBaseReportId(h.reportId)}
                          style={{
                            borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
                            background: isSelected ? 'rgba(56, 189, 248, 0.12)' : 'transparent',
                            cursor: 'pointer',
                            transition: 'background 0.15s'
                          }}
                        >
                          <td style={{ padding: '0.5rem 0.75rem', fontWeight: 800, color: isSelected ? '#38bdf8' : '#ffffff' }}>
                            #{filteredHistoricalReports.length - idx} {isSelected && '(Wybrany)'}
                          </td>
                          <td style={{ padding: '0.5rem 0.75rem', fontWeight: 700, color: '#38bdf8' }}>{bm.modelName}</td>
                          <td style={{ padding: '0.5rem 0.75rem', color: '#94a3b8' }}>{new Date(h.timestamp).toLocaleString('pl-PL')}</td>
                          <td style={{ padding: '0.5rem 0.75rem', fontWeight: 700, color: bm.accuracy >= 80 ? '#4ade80' : '#f87171' }}>{bm.accuracy.toFixed(1)}%</td>
                          <td style={{ padding: '0.5rem 0.75rem', color: '#cbd5e1' }}>{bm.precision.toFixed(1)}%</td>
                          <td style={{ padding: '0.5rem 0.75rem', color: '#cbd5e1' }}>{bm.recall.toFixed(1)}%</td>
                          <td style={{ padding: '0.5rem 0.75rem', fontWeight: 700, color: '#c084fc' }}>{bm.f1Score.toFixed(1)}%</td>
                          <td style={{ padding: '0.5rem 0.75rem', color: '#38bdf8' }}>{bm.averageLatencyMs.toFixed(0)} ms</td>
                          <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '6px' }}>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedBaseReportId(h.reportId);
                                }}
                                style={{
                                  background: isSelected ? '#38bdf8' : 'rgba(255,255,255,0.1)',
                                  color: isSelected ? '#0f172a' : '#ffffff',
                                  border: 'none',
                                  borderRadius: '4px',
                                  padding: '0.25rem 0.5rem',
                                  fontSize: '0.7rem',
                                  fontWeight: 800,
                                  cursor: 'pointer'
                                }}
                              >
                                {isSelected ? 'Aktywny' : 'Pokaż'}
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteReport(h.reportId);
                                }}
                                title="Trwale usuń tę próbę"
                                style={{
                                  background: 'rgba(239, 68, 68, 0.2)',
                                  color: '#f87171',
                                  border: '1px solid rgba(239, 68, 68, 0.3)',
                                  borderRadius: '4px',
                                  padding: '0.25rem 0.5rem',
                                  fontSize: '0.7rem',
                                  fontWeight: 800,
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '3px'
                                }}
                              >
                                <Trash2 size={12} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Section 1: Summary Table */}
          <div className="soc-card" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Layers size={18} color="#38bdf8" />
                <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#ffffff', margin: 0 }}>
                  Zagregowane Metryki ML (Podsumowanie Zbioru: {report.totalRecordsTested} alertów)
                </h3>
              </div>
              <span style={{ fontSize: '0.775rem', color: '#64748b', fontFamily: 'monospace' }}>
                Raport ID: {report.reportId} | {new Date(report.timestamp).toLocaleString('pl-PL')}
              </span>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ background: 'rgba(15, 23, 42, 0.9)', borderBottom: '1px solid var(--border-color)', color: '#94a3b8' }}>
                    <th style={{ padding: '0.85rem 1rem' }}>METRYKA NAUKOWA</th>
                    <th style={{ padding: '0.85rem 1rem', color: '#38bdf8' }}>{baseMetrics ? baseMetrics.modelName.toUpperCase() : 'MODEL BAZOWY'}</th>
                    <th style={{ padding: '0.85rem 1rem', color: '#c084fc' }}>{ftMetrics ? ftMetrics.modelName.toUpperCase() : 'MODEL FINE-TUNED'}</th>
                    <th style={{ padding: '0.85rem 1rem', textAlign: 'right' }}>RÓŻNICA / ZYSK (%)</th>
                  </tr>
                </thead>
                <tbody>
                  {/* Accuracy */}
                  <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
                    <td style={{ padding: '0.85rem 1rem', fontWeight: 700, color: '#ffffff' }}>
                      🎯 Accuracy (Dokładność klasyfikacji)
                    </td>
                    <td style={{ padding: '0.85rem 1rem', fontFamily: 'monospace', fontSize: '0.95rem', color: '#38bdf8', fontWeight: 700 }}>
                      {baseMetrics ? `${baseMetrics.accuracy.toFixed(1)}%` : '-'}
                    </td>
                    <td style={{ padding: '0.85rem 1rem', fontFamily: 'monospace', fontSize: '0.95rem', color: '#c084fc', fontWeight: 700 }}>
                      {ftMetrics ? `${ftMetrics.accuracy.toFixed(1)}%` : '-'}
                    </td>
                    <td style={{ padding: '0.85rem 1rem', textAlign: 'right' }}>
                      {(() => {
                        if (!baseMetrics || !ftMetrics) return '-';
                        const diff = calculateDiff(ftMetrics.accuracy, baseMetrics.accuracy);
                        return (
                          <span style={{
                            padding: '0.2rem 0.65rem',
                            borderRadius: '6px',
                            fontWeight: 800,
                            fontSize: '0.8rem',
                            background: diff.isPositive ? 'rgba(34, 197, 94, 0.18)' : 'rgba(239, 68, 68, 0.18)',
                            color: diff.isPositive ? '#4ade80' : '#f87171'
                          }}>
                            {diff.text}
                          </span>
                        );
                      })()}
                    </td>
                  </tr>

                  {/* Precision */}
                  <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
                    <td style={{ padding: '0.85rem 1rem', fontWeight: 700, color: '#ffffff' }}>
                      🔍 Precision (Precyzja Wykrywania Ataków)
                    </td>
                    <td style={{ padding: '0.85rem 1rem', fontFamily: 'monospace', fontSize: '0.95rem', color: '#38bdf8', fontWeight: 700 }}>
                      {baseMetrics ? `${baseMetrics.precision.toFixed(1)}%` : '-'}
                    </td>
                    <td style={{ padding: '0.85rem 1rem', fontFamily: 'monospace', fontSize: '0.95rem', color: '#c084fc', fontWeight: 700 }}>
                      {ftMetrics ? `${ftMetrics.precision.toFixed(1)}%` : '-'}
                    </td>
                    <td style={{ padding: '0.85rem 1rem', textAlign: 'right' }}>
                      {(() => {
                        if (!baseMetrics || !ftMetrics) return '-';
                        const diff = calculateDiff(ftMetrics.precision, baseMetrics.precision);
                        return (
                          <span style={{
                            padding: '0.2rem 0.65rem',
                            borderRadius: '6px',
                            fontWeight: 800,
                            fontSize: '0.8rem',
                            background: diff.isPositive ? 'rgba(34, 197, 94, 0.18)' : 'rgba(239, 68, 68, 0.18)',
                            color: diff.isPositive ? '#4ade80' : '#f87171'
                          }}>
                            {diff.text}
                          </span>
                        );
                      })()}
                    </td>
                  </tr>

                  {/* Recall */}
                  <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
                    <td style={{ padding: '0.85rem 1rem', fontWeight: 700, color: '#ffffff' }}>
                      ⚡ Recall (Czułość / Wykrywalność)
                    </td>
                    <td style={{ padding: '0.85rem 1rem', fontFamily: 'monospace', fontSize: '0.95rem', color: '#38bdf8', fontWeight: 700 }}>
                      {baseMetrics ? `${baseMetrics.recall.toFixed(1)}%` : '-'}
                    </td>
                    <td style={{ padding: '0.85rem 1rem', fontFamily: 'monospace', fontSize: '0.95rem', color: '#c084fc', fontWeight: 700 }}>
                      {ftMetrics ? `${ftMetrics.recall.toFixed(1)}%` : '-'}
                    </td>
                    <td style={{ padding: '0.85rem 1rem', textAlign: 'right' }}>
                      {(() => {
                        if (!baseMetrics || !ftMetrics) return '-';
                        const diff = calculateDiff(ftMetrics.recall, baseMetrics.recall);
                        return (
                          <span style={{
                            padding: '0.2rem 0.65rem',
                            borderRadius: '6px',
                            fontWeight: 800,
                            fontSize: '0.8rem',
                            background: diff.isPositive ? 'rgba(34, 197, 94, 0.18)' : 'rgba(239, 68, 68, 0.18)',
                            color: diff.isPositive ? '#4ade80' : '#f87171'
                          }}>
                            {diff.text}
                          </span>
                        );
                      })()}
                    </td>
                  </tr>

                  {/* F1-Score */}
                  <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
                    <td style={{ padding: '0.85rem 1rem', fontWeight: 700, color: '#ffffff' }}>
                      📊 F1-Score (Średnia Harmoniacka Precision & Recall)
                    </td>
                    <td style={{ padding: '0.85rem 1rem', fontFamily: 'monospace', fontSize: '0.95rem', color: '#38bdf8', fontWeight: 700 }}>
                      {baseMetrics ? `${baseMetrics.f1Score.toFixed(1)}%` : '-'}
                    </td>
                    <td style={{ padding: '0.85rem 1rem', fontFamily: 'monospace', fontSize: '0.95rem', color: '#c084fc', fontWeight: 700 }}>
                      {ftMetrics ? `${ftMetrics.f1Score.toFixed(1)}%` : '-'}
                    </td>
                    <td style={{ padding: '0.85rem 1rem', textAlign: 'right' }}>
                      {(() => {
                        if (!baseMetrics || !ftMetrics) return '-';
                        const diff = calculateDiff(ftMetrics.f1Score, baseMetrics.f1Score);
                        return (
                          <span style={{
                            padding: '0.2rem 0.65rem',
                            borderRadius: '6px',
                            fontWeight: 800,
                            fontSize: '0.8rem',
                            background: diff.isPositive ? 'rgba(34, 197, 94, 0.18)' : 'rgba(239, 68, 68, 0.18)',
                            color: diff.isPositive ? '#4ade80' : '#f87171'
                          }}>
                            {diff.text}
                          </span>
                        );
                      })()}
                    </td>
                  </tr>

                  {/* Format Compliance */}
                  <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
                    <td style={{ padding: '0.85rem 1rem', fontWeight: 700, color: '#ffffff' }}>
                      📋 Format Compliance / Syntax Valid (%)
                    </td>
                    <td style={{ padding: '0.85rem 1rem', fontFamily: 'monospace', fontSize: '0.95rem', color: '#38bdf8', fontWeight: 700 }}>
                      {baseMetrics ? `${baseMetrics.formatAdherenceRate.toFixed(1)}%` : '-'}
                    </td>
                    <td style={{ padding: '0.85rem 1rem', fontFamily: 'monospace', fontSize: '0.95rem', color: '#c084fc', fontWeight: 700 }}>
                      {ftMetrics ? `${ftMetrics.formatAdherenceRate.toFixed(1)}%` : '-'}
                    </td>
                    <td style={{ padding: '0.85rem 1rem', textAlign: 'right' }}>
                      {(() => {
                        if (!baseMetrics || !ftMetrics) return '-';
                        const diff = calculateDiff(ftMetrics.formatAdherenceRate, baseMetrics.formatAdherenceRate);
                        return (
                          <span style={{
                            padding: '0.2rem 0.65rem',
                            borderRadius: '6px',
                            fontWeight: 800,
                            fontSize: '0.8rem',
                            background: diff.isPositive ? 'rgba(34, 197, 94, 0.18)' : 'rgba(239, 68, 68, 0.18)',
                            color: diff.isPositive ? '#4ade80' : '#f87171'
                          }}>
                            {diff.text}
                          </span>
                        );
                      })()}
                    </td>
                  </tr>

                  {/* Average Latency */}
                  <tr>
                    <td style={{ padding: '0.85rem 1rem', fontWeight: 700, color: '#ffffff' }}>
                      ⏱️ Średnia Latencja / Execution Time (ms)
                    </td>
                    <td style={{ padding: '0.85rem 1rem', fontFamily: 'monospace', fontSize: '0.95rem', color: '#38bdf8', fontWeight: 700 }}>
                      {baseMetrics ? `${baseMetrics.averageLatencyMs.toFixed(0)} ms` : '-'}
                    </td>
                    <td style={{ padding: '0.85rem 1rem', fontFamily: 'monospace', fontSize: '0.95rem', color: '#c084fc', fontWeight: 700 }}>
                      {ftMetrics ? `${ftMetrics.averageLatencyMs.toFixed(0)} ms` : '-'}
                    </td>
                    <td style={{ padding: '0.85rem 1rem', textAlign: 'right' }}>
                      {(() => {
                        if (!baseMetrics || !ftMetrics) return '-';
                        const diff = calculateDiff(ftMetrics.averageLatencyMs, baseMetrics.averageLatencyMs, true);
                        return (
                          <span style={{
                            padding: '0.2rem 0.65rem',
                            borderRadius: '6px',
                            fontWeight: 800,
                            fontSize: '0.8rem',
                            background: diff.isPositive ? 'rgba(34, 197, 94, 0.18)' : 'rgba(239, 68, 68, 0.18)',
                            color: diff.isPositive ? '#4ade80' : '#f87171'
                          }}>
                            {diff.text} (Szybciej)
                          </span>
                        );
                      })()}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Section 2: Confusion Matrix Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '1.5rem', marginBottom: '1.5rem' }}>
            {/* Base Model Confusion Matrix */}
            <div className="soc-card" style={{ padding: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1rem', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '0.65rem' }}>
                <Shield size={16} color="#60a5fa" />
                <h4 style={{ fontSize: '0.95rem', fontWeight: 800, color: '#38bdf8', margin: 0 }}>
                  Confusion Matrix: {baseMetrics?.modelName || 'Model Bazowy'}
                </h4>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', textAlign: 'center' }}>
                <div style={{ background: 'rgba(34, 197, 94, 0.15)', border: '1px solid rgba(34, 197, 94, 0.3)', padding: '1rem', borderRadius: '10px' }}>
                  <div style={{ fontSize: '0.725rem', color: '#4ade80', fontWeight: 700, textTransform: 'uppercase' }}>True Positives (TP)</div>
                  <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#ffffff', marginTop: '0.2rem' }}>{baseMetrics?.truePositives ?? 0}</div>
                  <div style={{ fontSize: '0.7rem', color: '#94a3b8', marginTop: '2px' }}>Prawidłowo Wykryty Atak</div>
                </div>

                <div style={{ background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.3)', padding: '1rem', borderRadius: '10px' }}>
                  <div style={{ fontSize: '0.725rem', color: '#f87171', fontWeight: 700, textTransform: 'uppercase' }}>False Positives (FP)</div>
                  <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#ffffff', marginTop: '0.2rem' }}>{baseMetrics?.falsePositives ?? 0}</div>
                  <div style={{ fontSize: '0.7rem', color: '#94a3b8', marginTop: '2px' }}>Błędny Alarm (Fałszywe Zagrożenie)</div>
                </div>

                <div style={{ background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.3)', padding: '1rem', borderRadius: '10px' }}>
                  <div style={{ fontSize: '0.725rem', color: '#f87171', fontWeight: 700, textTransform: 'uppercase' }}>False Negatives (FN)</div>
                  <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#ffffff', marginTop: '0.2rem' }}>{baseMetrics?.falseNegatives ?? 0}</div>
                  <div style={{ fontSize: '0.7rem', color: '#94a3b8', marginTop: '2px' }}>Przegapiony Atak</div>
                </div>

                <div style={{ background: 'rgba(34, 197, 94, 0.15)', border: '1px solid rgba(34, 197, 94, 0.3)', padding: '1rem', borderRadius: '10px' }}>
                  <div style={{ fontSize: '0.725rem', color: '#4ade80', fontWeight: 700, textTransform: 'uppercase' }}>True Negatives (TN)</div>
                  <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#ffffff', marginTop: '0.2rem' }}>{baseMetrics?.trueNegatives ?? 0}</div>
                  <div style={{ fontSize: '0.7rem', color: '#94a3b8', marginTop: '2px' }}>Poprawny Ruch Prawidłowy</div>
                </div>
              </div>
            </div>

            {/* Fine-Tuned Model Confusion Matrix */}
            <div className="soc-card" style={{ padding: '1.25rem', border: '1px solid rgba(139, 92, 246, 0.35)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1rem', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '0.65rem' }}>
                <Sparkles size={16} color="#c084fc" />
                <h4 style={{ fontSize: '0.95rem', fontWeight: 800, color: '#c084fc', margin: 0 }}>
                  Confusion Matrix: {ftMetrics?.modelName || 'Model Fine-Tuned'}
                </h4>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', textAlign: 'center' }}>
                <div style={{ background: 'rgba(34, 197, 94, 0.2)', border: '1px solid rgba(34, 197, 94, 0.4)', padding: '1rem', borderRadius: '10px' }}>
                  <div style={{ fontSize: '0.725rem', color: '#4ade80', fontWeight: 700, textTransform: 'uppercase' }}>True Positives (TP)</div>
                  <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#ffffff', marginTop: '0.2rem' }}>{ftMetrics?.truePositives ?? 0}</div>
                  <div style={{ fontSize: '0.7rem', color: '#94a3b8', marginTop: '2px' }}>Prawidłowo Wykryty Atak</div>
                </div>

                <div style={{ background: 'rgba(239, 68, 68, 0.2)', border: '1px solid rgba(239, 68, 68, 0.4)', padding: '1rem', borderRadius: '10px' }}>
                  <div style={{ fontSize: '0.725rem', color: '#f87171', fontWeight: 700, textTransform: 'uppercase' }}>False Positives (FP)</div>
                  <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#ffffff', marginTop: '0.2rem' }}>{ftMetrics?.falsePositives ?? 0}</div>
                  <div style={{ fontSize: '0.7rem', color: '#94a3b8', marginTop: '2px' }}>Błędny Alarm (Fałszywe Zagrożenie)</div>
                </div>

                <div style={{ background: 'rgba(239, 68, 68, 0.2)', border: '1px solid rgba(239, 68, 68, 0.4)', padding: '1rem', borderRadius: '10px' }}>
                  <div style={{ fontSize: '0.725rem', color: '#f87171', fontWeight: 700, textTransform: 'uppercase' }}>False Negatives (FN)</div>
                  <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#ffffff', marginTop: '0.2rem' }}>{ftMetrics?.falseNegatives ?? 0}</div>
                  <div style={{ fontSize: '0.7rem', color: '#94a3b8', marginTop: '2px' }}>Przegapiony Atak</div>
                </div>

                <div style={{ background: 'rgba(34, 197, 94, 0.2)', border: '1px solid rgba(34, 197, 94, 0.4)', padding: '1rem', borderRadius: '10px' }}>
                  <div style={{ fontSize: '0.725rem', color: '#4ade80', fontWeight: 700, textTransform: 'uppercase' }}>True Negatives (TN)</div>
                  <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#ffffff', marginTop: '0.2rem' }}>{ftMetrics?.trueNegatives ?? 0}</div>
                  <div style={{ fontSize: '0.7rem', color: '#94a3b8', marginTop: '2px' }}>Poprawny Ruch Prawidłowy</div>
                </div>
              </div>
            </div>
          </div>

          {/* Section 3: Log Inspection Table */}
          <div className="soc-card" style={{ padding: '1.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem', marginBottom: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <FileText size={18} color="#c084fc" />
                <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#ffffff', margin: 0 }}>
                  Szczegóły Zapytań I Log Inspection ({filteredItems.length} rekordów)
                </h3>
              </div>

              {/* Filter Pills */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <button
                  onClick={() => setFilterMode('ALL')}
                  style={{
                    padding: '0.3rem 0.75rem',
                    borderRadius: '6px',
                    fontSize: '0.775rem',
                    fontWeight: 600,
                    background: filterMode === 'ALL' ? 'rgba(139, 92, 246, 0.3)' : 'rgba(15, 23, 42, 0.6)',
                    color: filterMode === 'ALL' ? '#c084fc' : '#94a3b8',
                    border: '1px solid var(--border-color)',
                    cursor: 'pointer'
                  }}
                >
                  Wszystkie ({report.itemResults.length})
                </button>
                <button
                  onClick={() => setFilterMode('MISMATCHED')}
                  style={{
                    padding: '0.3rem 0.75rem',
                    borderRadius: '6px',
                    fontSize: '0.775rem',
                    fontWeight: 600,
                    background: filterMode === 'MISMATCHED' ? 'rgba(239, 68, 68, 0.3)' : 'rgba(15, 23, 42, 0.6)',
                    color: filterMode === 'MISMATCHED' ? '#f87171' : '#94a3b8',
                    border: '1px solid var(--border-color)',
                    cursor: 'pointer'
                  }}
                >
                  Tylko Rozbieżne / Błędy
                </button>
                <button
                  onClick={() => setFilterMode('CORRECT')}
                  style={{
                    padding: '0.3rem 0.75rem',
                    borderRadius: '6px',
                    fontSize: '0.775rem',
                    fontWeight: 600,
                    background: filterMode === 'CORRECT' ? 'rgba(34, 197, 94, 0.3)' : 'rgba(15, 23, 42, 0.6)',
                    color: filterMode === 'CORRECT' ? '#4ade80' : '#94a3b8',
                    border: '1px solid var(--border-color)',
                    cursor: 'pointer'
                  }}
                >
                  Tylko 100% Zgodne
                </button>
              </div>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.8rem' }}>
                <thead>
                  <tr style={{ background: 'rgba(15, 23, 42, 0.8)', borderBottom: '1px solid var(--border-color)', color: '#94a3b8' }}>
                    <th style={{ padding: '0.75rem 0.85rem' }}>ID</th>
                    <th style={{ padding: '0.75rem 0.85rem' }}>ALERT & KATEGORIA</th>
                    <th style={{ padding: '0.75rem 0.85rem' }}>GROUND TRUTH</th>
                    <th style={{ padding: '0.75rem 0.85rem' }}>MODEL BAZOWY</th>
                    <th style={{ padding: '0.75rem 0.85rem' }}>MODEL FINE-TUNED</th>
                    <th style={{ padding: '0.75rem 0.85rem', textAlign: 'right' }}>AKCJA</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredItems.map(item => {
                    const isExpanded = expandedItemId === item.alertId;
                    const baseResp = (selectedBaseReport?.itemResults.find(r => r.alertId === item.alertId) || item).baseModelResponse;
                    const ftResp = item.fineTunedModelResponse;

                    return (
                      <React.Fragment key={item.alertId}>
                        <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)', transition: 'background 0.15s' }}>
                          <td style={{ padding: '0.75rem 0.85rem', fontWeight: 700, color: '#38bdf8' }}>{item.alertId}</td>
                          <td style={{ padding: '0.75rem 0.85rem', maxWidth: '260px' }}>
                            <div style={{ fontWeight: 600, color: '#ffffff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {item.alertTitle}
                            </div>
                            <div style={{ fontSize: '0.725rem', color: '#64748b', marginTop: '2px' }}>
                              {item.category} ({item.severity})
                            </div>
                          </td>
                          <td style={{ padding: '0.75rem 0.85rem' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                              <span style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '5px',
                                fontSize: '0.75rem',
                                fontWeight: 700,
                                color: item.groundTruthIsThreat ? '#f87171' : '#4ade80'
                              }}>
                                {item.groundTruthIsThreat ? <AlertTriangle size={13} color="#f87171" /> : <CheckCircle2 size={13} color="#4ade80" />}
                                {item.groundTruthIsThreat ? 'Atak (Zagrożenie)' : 'Ruch Prawidłowy'}
                              </span>
                              <span style={{ fontSize: '0.7rem', color: '#94a3b8', background: 'rgba(255,255,255,0.05)', padding: '1px 6px', borderRadius: '4px', width: 'fit-content' }}>
                                Akcja: {item.groundTruthAction}
                              </span>
                            </div>
                          </td>

                          {/* Base Model Result */}
                          <td style={{ padding: '0.75rem 0.85rem' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <span style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  padding: '0.2rem 0.55rem',
                                  borderRadius: '6px',
                                  fontSize: '0.75rem',
                                  fontWeight: 800,
                                  background: baseResp.isClassCorrect ? 'rgba(34, 197, 94, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                                  color: baseResp.isClassCorrect ? '#4ade80' : '#f87171',
                                  border: baseResp.isClassCorrect ? '1px solid rgba(34, 197, 94, 0.35)' : '1px solid rgba(239, 68, 68, 0.35)'
                                }}>
                                  {baseResp.isClassCorrect ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
                                  {baseResp.predictedIsThreat ? 'Atak' : 'Ruch Prawidłowy'}
                                </span>
                                <span style={{
                                  fontSize: '0.65rem',
                                  fontWeight: 800,
                                  padding: '1px 5px',
                                  borderRadius: '3px',
                                  background: baseResp.isClassCorrect ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                                  color: baseResp.isClassCorrect ? '#4ade80' : '#f87171'
                                }}>
                                  {baseResp.isClassCorrect ? 'OK' : 'BŁĄD'}
                                </span>
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.7rem', color: '#64748b' }}>
                                <span>Akcja: <strong style={{ color: '#cbd5e1' }}>{baseResp.predictedAction}</strong></span>
                                <span style={{ color: '#38bdf8', display: 'inline-flex', alignItems: 'center', gap: '3px', fontWeight: 600 }}>
                                  <Clock size={10} /> {baseResp.latencyMs} ms
                                </span>
                              </div>
                            </div>
                          </td>

                          {/* Fine-Tuned Model Result */}
                          <td style={{ padding: '0.75rem 0.85rem' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <span style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  padding: '0.2rem 0.55rem',
                                  borderRadius: '6px',
                                  fontSize: '0.75rem',
                                  fontWeight: 800,
                                  background: ftResp.isClassCorrect ? 'rgba(139, 92, 246, 0.25)' : 'rgba(239, 68, 68, 0.2)',
                                  color: ftResp.isClassCorrect ? '#c084fc' : '#f87171',
                                  border: ftResp.isClassCorrect ? '1px solid rgba(139, 92, 246, 0.4)' : '1px solid rgba(239, 68, 68, 0.35)'
                                }}>
                                  {ftResp.isClassCorrect ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
                                  {ftResp.predictedIsThreat ? 'Atak' : 'Ruch Prawidłowy'}
                                </span>
                                <span style={{
                                  fontSize: '0.65rem',
                                  fontWeight: 800,
                                  padding: '1px 5px',
                                  borderRadius: '3px',
                                  background: ftResp.isClassCorrect ? 'rgba(139, 92, 246, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                                  color: ftResp.isClassCorrect ? '#c084fc' : '#f87171'
                                }}>
                                  {ftResp.isClassCorrect ? 'OK' : 'BŁĄD'}
                                </span>
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.7rem', color: '#64748b' }}>
                                <span>Akcja: <strong style={{ color: '#cbd5e1' }}>{ftResp.predictedAction}</strong></span>
                                <span style={{ color: '#c084fc', display: 'inline-flex', alignItems: 'center', gap: '3px', fontWeight: 600 }}>
                                  <Zap size={10} /> {ftResp.latencyMs} ms
                                </span>
                              </div>
                            </div>
                          </td>

                          <td style={{ padding: '0.75rem 0.85rem', textAlign: 'right' }}>
                            <button
                              onClick={() => setExpandedItemId(isExpanded ? null : item.alertId)}
                              style={{
                                background: 'rgba(139, 92, 246, 0.15)',
                                border: '1px solid rgba(139, 92, 246, 0.3)',
                                color: '#c084fc',
                                padding: '0.25rem 0.55rem',
                                borderRadius: '5px',
                                fontSize: '0.725rem',
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px'
                              }}
                            >
                              {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />} Podgląd Surowy
                            </button>
                          </td>
                        </tr>

                        {/* Expanded details row */}
                        {isExpanded && (
                          <tr style={{ background: 'rgba(15, 23, 42, 0.6)' }}>
                            <td colSpan={6} style={{ padding: '1rem 1.25rem' }}>
                              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', fontSize: '0.775rem' }}>
                                <div style={{ background: 'rgba(10, 15, 26, 0.8)', padding: '0.75rem', borderRadius: '8px', border: '1px solid rgba(56, 189, 248, 0.25)' }}>
                                  <div style={{ fontWeight: 700, color: '#38bdf8', marginBottom: '0.4rem' }}>
                                    MODEL BAZOWY ({baseMetrics?.modelName || 'LOKALNA OLLAMA'}):
                                  </div>
                                  <pre style={{ whiteSpace: 'pre-wrap', color: '#cbd5e1', fontFamily: 'monospace', margin: 0, fontSize: '0.725rem' }}>
                                    {baseResp.extractedText}
                                  </pre>
                                </div>

                                <div style={{ background: 'rgba(10, 15, 26, 0.8)', padding: '0.75rem', borderRadius: '8px', border: '1px solid rgba(139, 92, 246, 0.25)' }}>
                                  <div style={{ fontWeight: 700, color: '#c084fc', marginBottom: '0.4rem' }}>MODEL WYFINETUNINGOWANY (FT):</div>
                                  <pre style={{ whiteSpace: 'pre-wrap', color: '#cbd5e1', fontFamily: 'monospace', margin: 0, fontSize: '0.725rem' }}>
                                    {ftResp.extractedText}
                                  </pre>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
