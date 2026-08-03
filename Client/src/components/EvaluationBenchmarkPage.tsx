import React, { useState, useEffect } from 'react';
import { Play, BarChart2, CheckCircle2, XCircle, Clock, Zap, Shield, Sparkles, RefreshCw, AlertTriangle, Layers, ChevronDown, ChevronUp, FileText, Cpu, Cloud, FileSpreadsheet, Filter, Trash2, Info } from 'lucide-react';
import type { EvaluationReport, EvaluationItemResult, ModelEvaluationMetrics } from '../types/evaluation';
import { runModelEvaluation, getLatestEvaluationReport, getEvaluationHistory, fetchOllamaModels, deleteEvaluationReport } from '../services/api';
import '../styles/EvaluationBenchmarkPage.css';

export const EvaluationBenchmarkPage: React.FC = () => {
  const [report, setReport] = useState<EvaluationReport | null>(null);
  const [historicalReports, setHistoricalReports] = useState<EvaluationReport[]>([]);
  const [selectedBaseReportId, setSelectedBaseReportId] = useState<string>('');
  const [selectedModelFilter, setSelectedModelFilter] = useState<string>('ALL');
  const [activeMetricHelp, setActiveMetricHelp] = useState<{ label: string; description: string; tone: 'green' | 'teal' | 'purple' | 'blue' } | null>(null);

  const [loading, setLoading] = useState<boolean>(true);
  const [running, setRunning] = useState<boolean>(false);
  const [recordCount, setRecordCount] = useState<number>(24);
  const [iterations, setIterations] = useState<number>(1);
  const [statusMsg, setStatusMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [expandedItemId, setExpandedItemId] = useState<string | null>(null);
  const [filterMode, setFilterMode] = useState<'ALL' | 'MISMATCHED' | 'CORRECT'>('ALL');

  // Ollama Model Selection state
  const [availableOllamaModels, setAvailableOllamaModels] = useState<string[]>([]);
  const [selectedOllamaModel, setSelectedOllamaModel] = useState<string>('llama3.2');
  const [isOllamaOnline, setIsOllamaOnline] = useState<boolean>(false);

  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);
  const [activeModeText, setActiveModeText] = useState<string>('');
  const [isRunsSummaryCollapsed, setIsRunsSummaryCollapsed] = useState<boolean>(false);

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

  const handleStartBenchmark = async (mode: 'both' | 'base' | 'ft' | 'azure-base') => {
    setRunning(true);
    setElapsedSeconds(0);
    setStatusMsg(null);

    const modeText = mode === 'base'
      ? `Ollama (${selectedOllamaModel}) - ${iterations} ${iterations === 1 ? 'próba' : 'próby'}`
      : mode === 'azure-base'
        ? `Azure OpenAI (Base) - ${iterations} ${iterations === 1 ? 'próba' : 'próby'}`
        : mode === 'ft'
          ? `Azure OpenAI FT - ${iterations} ${iterations === 1 ? 'próba' : 'próby'}`
          : `Ollama + Azure OpenAI FT - ${iterations} ${iterations === 1 ? 'próba' : 'próby'}`;
    setActiveModeText(modeText);

    const timerInterval = setInterval(() => {
      setElapsedSeconds(prev => prev + 1);
    }, 1000);

    const res = await runModelEvaluation(recordCount, mode, selectedOllamaModel, 2, iterations);
    clearInterval(timerInterval);

    setRunning(false);
    if (res.success && res.report) {
      setReport(res.report);
      setSelectedBaseReportId(res.report.reportId);

      const newReports = res.reports || [res.report];
      setHistoricalReports(prev => {
        const existingMap = new Map(prev.map(r => [r.reportId, r]));
        newReports.forEach(r => existingMap.set(r.reportId, r));
        return Array.from(existingMap.values()).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      });

      setStatusMsg({ text: res.message, type: 'success' });
    } else {
      setStatusMsg({ text: res.message, type: 'error' });
    }
  };

  const calculateDiff = (valFt: number, valBase: number, isLatency: boolean = false) => {
    const diff = valFt - valBase;
    if (Math.abs(diff) < 0.01) return { text: '0.0%', isPositive: true };
    if (isLatency) {
      const isPositive = valFt < valBase;
      if (isPositive) {
        const pctReduction = ((valBase - valFt) / valBase * 100).toFixed(1);
        const speedup = valFt > 0 ? (valBase / valFt).toFixed(1) : '1.0';
        return { text: `-${pctReduction}% (${speedup}x szybciej)`, isPositive: true };
      } else {
        const pctIncrease = ((valFt - valBase) / (valBase || 1) * 100).toFixed(1);
        const slowdown = valBase > 0 ? (valFt / valBase).toFixed(1) : '1.0';
        return { text: `+${pctIncrease}% (${slowdown}x wolniej)`, isPositive: false };
      }
    }
    const isPositive = diff > 0;
    const sign = diff > 0 ? '+' : '';
    return { text: `${sign}${diff.toFixed(1)}%`, isPositive };
  };

  const renderMetricStack = (entries: Array<{ label: string; value: string }>) => (
    <div className="benchmark-metric-stack">
      {entries.map((entry) => (
        <div key={`${entry.label}-${entry.value}`} className="benchmark-metric-stack-item">
          <span className="benchmark-metric-stack-label">{entry.label}</span>
          <span className="benchmark-metric-stack-value">{entry.value}</span>
        </div>
      ))}
    </div>
  );

  const renderMetricHeader = (label: string, tooltip: string, colorClass?: string) => (
    <span className={`benchmark-th-with-info${colorClass ? ` ${colorClass}` : ''}`}>
      <span>{label}</span>
      <button
        type="button"
        className="benchmark-info-tooltip"
        aria-label={tooltip}
        onMouseEnter={() => setActiveMetricHelp({ label, description: tooltip, tone: (colorClass as 'green' | 'teal' | 'purple' | 'blue') || 'blue' })}
        onMouseLeave={() => setActiveMetricHelp(null)}
      >
        <Info size={11} />
      </button>
    </span>
  );

  const computeStrictMetrics = (rawMetrics: ModelEvaluationMetrics | undefined, itemResults: EvaluationItemResult[] | undefined, isBaseModel: boolean) => {
    if (!rawMetrics) return undefined;

    // Check if the model execution was skipped
    const isSkipped = itemResults && itemResults.length > 0
      ? itemResults.every(item => {
        const resp = isBaseModel ? item.baseModelResponse : item.fineTunedModelResponse;
        return resp.predictedAction === 'Pominięte' || resp.extractedText === '[Test pominięty]';
      })
      : (rawMetrics.modelName.includes('Pominięty') || (rawMetrics.accuracy === 0 && rawMetrics.averageLatencyMs === 0));

    if (isSkipped) {
      return {
        ...rawMetrics,
        accuracy: 0,
        precision: 0,
        recall: 0,
        f1Score: 0,
        truePositives: 0,
        falsePositives: 0,
        trueNegatives: 0,
        falseNegatives: 0,
        correctClassCount: 0,
        correctActionCount: 0,
        validSyntaxCount: 0,
        formatAdherenceRate: 0,
        classAccuracy: 0,
        actionAccuracy: 0,
        isSkipped: true
      };
    }

    if (!itemResults || itemResults.length === 0) {
      const totalTested = (rawMetrics.truePositives + rawMetrics.falsePositives + rawMetrics.trueNegatives + rawMetrics.falseNegatives) || 1;
      const classAcc = rawMetrics.correctClassCount ? (rawMetrics.correctClassCount / totalTested) * 100 : rawMetrics.accuracy;
      const actAcc = rawMetrics.correctActionCount ? (rawMetrics.correctActionCount / totalTested) * 100 : rawMetrics.accuracy;
      return { ...rawMetrics, classAccuracy: classAcc, actionAccuracy: actAcc, strictAccuracy: rawMetrics.accuracy, isSkipped: false };
    }

    const total = itemResults.length;
    let tp = 0, fp = 0, tn = 0, fn = 0;
    let correctClassCount = 0;
    let correctActionCount = 0;
    let strictCorrectCount = 0;
    let validSyntaxCount = 0;

    itemResults.forEach(item => {
      const resp = isBaseModel ? item.baseModelResponse : item.fineTunedModelResponse;
      const actual = item.groundTruthIsThreat;
      const predicted = resp.predictedIsThreat;

      const isClassOK = actual === predicted;

      const isActionOK = resp.isActionCorrect !== undefined
        ? resp.isActionCorrect
        : (resp.predictedAction.trim().toLowerCase() === (item.groundTruthAction || '').trim().toLowerCase());

      if (isClassOK) correctClassCount++;
      if (isActionOK) correctActionCount++;
      if (isClassOK && isActionOK) strictCorrectCount++;
      if (resp.isFormatValid) validSyntaxCount++;

      // Confusion matrix follows standard binary detection semantics.
      if (actual && predicted) tp++;
      else if (!actual && !predicted) tn++;
      else if (!actual && predicted) fp++;
      else if (actual && !predicted) fn++;
    });

    const precision = (tp + fp) > 0
      ? (tp / (tp + fp)) * 100.0
      : 100.0;

    const recall = (tp + fn) > 0
      ? (tp / (tp + fn)) * 100.0
      : 100.0;

    const f1Score = (precision + recall) > 0
      ? (2 * precision * recall) / (precision + recall)
      : 0.0;

    const classAccuracy = total > 0
      ? (correctClassCount / total) * 100.0
      : 0.0;

    const actionAccuracy = total > 0
      ? (correctActionCount / total) * 100.0
      : 0.0;

    const strictAccuracy = total > 0
      ? (strictCorrectCount / total) * 100.0
      : 0.0;

    // Dokładność detekcji opiera się wyłącznie na klasie Atak vs Ruch Prawidłowy.
    const accuracy = total > 0
      ? ((tp + tn) / total) * 100.0
      : 0.0;

    return {
      ...rawMetrics,
      accuracy,
      precision,
      recall,
      f1Score,
      truePositives: tp,
      falsePositives: fp,
      trueNegatives: tn,
      falseNegatives: fn,
      correctClassCount,
      correctActionCount,
      validSyntaxCount,
      formatAdherenceRate: total > 0 ? (validSyntaxCount / total) * 100.0 : 0.0,
      classAccuracy,
      actionAccuracy,
      strictAccuracy,
      isSkipped: false
    };
  };

  // Clean model filtering & historical reports logic
  const modelCategories = Array.from(
    new Set(
      historicalReports.map(r => {
        const bm = r.baseModelMetrics?.modelName || '';
        if (bm.includes('Pominięty') || (r.baseModelMetrics?.accuracy === 0 && r.baseModelMetrics?.averageLatencyMs === 0)) {
          return 'Tylko Azure OpenAI FT';
        }
        if (bm.toLowerCase().includes('azure')) {
          return 'Azure Base (gpt-4o-mini)';
        }
        return bm.replace('Model Bazowy (Ollama: ', '').replace('Model Bazowy (', '').replace(')', '').trim();
      }).filter(Boolean)
    )
  );

  const filteredHistoricalReports = selectedModelFilter === 'ALL'
    ? historicalReports
    : historicalReports.filter(r => {
      const bm = r.baseModelMetrics?.modelName || '';
      const isBmSkipped = bm.includes('Pominięty') || (r.baseModelMetrics?.accuracy === 0 && r.baseModelMetrics?.averageLatencyMs === 0);
      if (selectedModelFilter === 'Tylko Azure OpenAI FT') {
        return isBmSkipped;
      }
      if (selectedModelFilter === 'Azure Base (gpt-4o-mini)') {
        return bm.toLowerCase().includes('azure') && !isBmSkipped;
      }
      return bm.toLowerCase().includes(selectedModelFilter.toLowerCase());
    });

  const [selectedFtReportId, setSelectedFtReportId] = useState<string>('');

  const validBaseReports = historicalReports.filter(r => r.baseModelMetrics && !r.baseModelMetrics.modelName.includes('Pominięty') && r.baseModelMetrics.accuracy > 0);
  const validFtReports = historicalReports.filter(r => r.fineTunedModelMetrics && !r.fineTunedModelMetrics.modelName.includes('Pominięty') && r.fineTunedModelMetrics.accuracy > 0);

  const selectedBaseReport = historicalReports.find(r => r.reportId === selectedBaseReportId) || validBaseReports[0] || report;
  const selectedFtReport = historicalReports.find(r => r.reportId === selectedFtReportId) || validFtReports[0] || report;

  const baseMetrics = computeStrictMetrics(selectedBaseReport?.baseModelMetrics, selectedBaseReport?.itemResults, true);
  const ftMetrics = computeStrictMetrics(selectedFtReport?.fineTunedModelMetrics, selectedFtReport?.itemResults, false);

  const handleExportToExcel = () => {
    const reportsToExport = filteredHistoricalReports;

    if (reportsToExport.length === 0) {
      alert('Brak raportów do wyeksportowania dla wybranego filtra!');
      return;
    }

    const getAgreementLabel = (response: any, item: EvaluationItemResult) => {
      const isClassOK = response?.isClassCorrect ?? (response?.predictedIsThreat === item.groundTruthIsThreat);
      const isActionOK = response?.isActionCorrect ?? (
        String(response?.predictedAction || '').trim().toLowerCase() === String(item.groundTruthAction || '').trim().toLowerCase()
      );

      if (isClassOK && isActionOK) return 'Detekcja OK / Akcja OK';
      if (isActionOK) return '50% (Akcja OK, Klasyfikacja BŁĄD)';
      if (isClassOK) return '50% (Detekcja OK, Akcja BŁĄD)';
      return '0% (Detekcja BŁĄD, Akcja BŁĄD)';
    };

    // UTF-8 BOM for Microsoft Excel Polish character support
    let csv = '\uFEFF';

    // SECTION 1: MODEL RUNS SUMMARY TABLE
    csv += `=== PODSUMOWANIE PRÓB BENCHMARKOWYCH MODELU (${selectedModelFilter === 'ALL' ? 'WSZYSTKIE MODELE' : selectedModelFilter.toUpperCase()}) ===\n`;
    csv += 'Lp;ID Raportu;Data i Czas Raportu;Model Bazowy (Ollama);Testowanych Rekordow;Detekcja Accuracy (%);Action Recommendation Accuracy (%);Strict Combined Accuracy (%);Precision (%);Recall (%);F1-Score (%);Format Compliance (%);Srednia Latencja (ms);True Positives (TP);False Positives (FP);False Negatives (FN);True Negatives (TN);Fine-Tuned Model;Fine-Tuned Detection Accuracy (%);Fine-Tuned Action Recommendation Accuracy (%);Fine-Tuned Strict Combined Accuracy (%);Fine-Tuned Precision (%);Fine-Tuned Recall (%);Fine-Tuned F1-Score (%);Fine-Tuned Format Compliance (%);Fine-Tuned Srednia Latencja (ms);Fine-Tuned TP;Fine-Tuned FP;Fine-Tuned FN;Fine-Tuned TN\n';

    reportsToExport.forEach((r, idx) => {
      const bm = computeStrictMetrics(r.baseModelMetrics, r.itemResults, true) || r.baseModelMetrics;
      const ftm = computeStrictMetrics(r.fineTunedModelMetrics, r.itemResults, false) || r.fineTunedModelMetrics;
      const dateStr = new Date(r.timestamp).toLocaleString('pl-PL');

      csv += `${idx + 1};"${r.reportId}";"${dateStr}";"${bm.modelName}";${r.totalRecordsTested};` +
        `${bm.accuracy.toFixed(2).replace('.', ',')};${(bm.actionAccuracy ?? 0).toFixed(2).replace('.', ',')};${(bm.strictAccuracy ?? 0).toFixed(2).replace('.', ',')};${bm.precision.toFixed(2).replace('.', ',')};${bm.recall.toFixed(2).replace('.', ',')};${bm.f1Score.toFixed(2).replace('.', ',')};${bm.formatAdherenceRate.toFixed(2).replace('.', ',')};${bm.averageLatencyMs.toFixed(0)};${bm.truePositives};${bm.falsePositives};${bm.falseNegatives};${bm.trueNegatives};` +
        `"${ftm.modelName}";${ftm.accuracy.toFixed(2).replace('.', ',')};${(ftm.actionAccuracy ?? 0).toFixed(2).replace('.', ',')};${(ftm.strictAccuracy ?? 0).toFixed(2).replace('.', ',')};${ftm.precision.toFixed(2).replace('.', ',')};${ftm.recall.toFixed(2).replace('.', ',')};${ftm.f1Score.toFixed(2).replace('.', ',')};${ftm.formatAdherenceRate.toFixed(2).replace('.', ',')};${ftm.averageLatencyMs.toFixed(0)};${ftm.truePositives};${ftm.falsePositives};${ftm.falseNegatives};${ftm.trueNegatives}\n`;
    });

    csv += '\n=== SZCZEGÓŁOWE PREDYKCJE REKORDÓW WE WSZYSTKICH PRÓBACH ===\n';
  csv += 'Numer Proby;ID Raportu;Model Bazowy;Data i Czas;ID Alertu;Kategoria Alertu;Poziom Zagrozenia;Ground Truth;Ground Truth Akcja;Model Bazowy Predykcja;Model Bazowy Akcja;Model Bazowy Wynik (Klasa/Akcja);Model Bazowy Latencja (ms);Model FT Predykcja;Model FT Akcja;Model FT Wynik (Klasa/Akcja);Model FT Latencja (ms)\n';

    reportsToExport.forEach((r, rIdx) => {
      const bmName = r.baseModelMetrics.modelName;
      const dateStr = new Date(r.timestamp).toLocaleString('pl-PL');
      r.itemResults.forEach(item => {
        const gtClass = item.groundTruthIsThreat ? 'Atak' : 'Ruch Prawidlowy';
        const baseClass = item.baseModelResponse.predictedIsThreat ? 'Atak' : 'Ruch Prawidlowy';
        const ftClass = item.fineTunedModelResponse.predictedIsThreat ? 'Atak' : 'Ruch Prawidlowy';
        const baseResult = getAgreementLabel(item.baseModelResponse, item);
        const ftResult = getAgreementLabel(item.fineTunedModelResponse, item);

        csv += `${rIdx + 1};"${r.reportId}";"${bmName}";"${dateStr}";"${item.alertId}";"${item.category}";"${item.severity}";"${gtClass}";"${item.groundTruthAction}";"${baseClass}";"${item.baseModelResponse.predictedAction}";"${baseResult}";${item.baseModelResponse.latencyMs};"${ftClass}";"${item.fineTunedModelResponse.predictedAction}";"${ftResult}";${item.fineTunedModelResponse.latencyMs}\n`;
      });
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const modelTag = selectedModelFilter === 'ALL' ? 'Wszystkie_Modele' : selectedModelFilter.replace(/[:/]/g, '_');
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

  const handleDeleteAllFilteredReports = async () => {
    const targets = selectedModelFilter === 'ALL'
      ? historicalReports
      : historicalReports.filter(r => r.baseModelMetrics?.modelName.toLowerCase() === selectedModelFilter.toLowerCase());

    if (targets.length === 0) {
      alert('Brak prób do usunięcia w aktualnym filtrze.');
      return;
    }

    const filterName = selectedModelFilter === 'ALL' ? 'wszystkie próby' : `wszystkie próby dla modelu ${selectedModelFilter}`;
    if (!window.confirm(`Czy na pewno chcesz usunąć ${targets.length} prób (${filterName})? Operacja jest nieodwracalna.`)) {
      return;
    }

    let deletedCount = 0;
    for (const r of targets) {
      const res = await deleteEvaluationReport(r.reportId);
      if (res.success) deletedCount++;
    }

    setStatusMsg({ text: `Pomyślnie usunięto ${deletedCount} prób z bazy danych.`, type: 'success' });
    const remaining = historicalReports.filter(r => !targets.some(t => t.reportId === r.reportId));
    setHistoricalReports(remaining);
    if (remaining.length > 0) {
      setReport(remaining[0]);
      setSelectedBaseReportId(remaining[0].reportId);
    } else {
      setReport(null);
      setSelectedBaseReportId('');
    }
  };

  const activeReportItems = selectedBaseReport?.itemResults || report?.itemResults || [];
  const filteredItems = activeReportItems.filter(item => {
    const bResp = item.baseModelResponse;
    const fResp = item.fineTunedModelResponse;
    if (filterMode === 'MISMATCHED') {
      return !bResp.isClassCorrect || !fResp.isClassCorrect || !bResp.isActionCorrect || !fResp.isActionCorrect;
    }
    if (filterMode === 'CORRECT') {
      return bResp.isClassCorrect && bResp.isActionCorrect && fResp.isClassCorrect && fResp.isActionCorrect;
    }
    return true;
  });

  return (
    <div className="benchmark-hero-header">
      {/* Header Section */}
      <div className="benchmark-hero-card">
        <div className="benchmark-hero-flex-between">
          <div>
            <div className="benchmark-hero-left-title-row">
              <div className="benchmark-logo-box">
                <BarChart2 size={24} color="#c084fc" />
              </div>
              <h1 className="benchmark-hero-main-title">
                Model Benchmark & Evaluation
              </h1>
            </div>
          </div>

          {/* Controls */}
          <div className="benchmark-hero-controls">
            <div className="benchmark-hero-controls-top">
              {/* Record Count Selector */}
              <div className="benchmark-select-wrapper">
                <span className="benchmark-select-label">Rekordy:</span>
                <select
                  value={recordCount}
                  onChange={e => setRecordCount(Number(e.target.value))}
                  disabled={running}
                  className="benchmark-select-inner"
                >
                  <option value={24} style={{ background: '#0f172a' }}>24 alerty (12 kategorii x2)</option>
                  <option value={12} style={{ background: '#0f172a' }}>12 alertów (12 kategorii x1)</option>
                  <option value={36} style={{ background: '#0f172a' }}>36 alertów (12 kategorii x3)</option>
                  <option value={48} style={{ background: '#0f172a' }}>48 alertów (12 kategorii x4)</option>
                </select>
              </div>

              {/* Iterations / Repeat Count Selector */}
              <div className="benchmark-select-wrapper-purple">
                <Layers size={14} color="#c084fc" />
                <span className="benchmark-select-label-purple">Liczba Prób (Seria):</span>
                <select
                  value={iterations}
                  onChange={e => setIterations(Number(e.target.value))}
                  disabled={running}
                  className="benchmark-select-inner"
                >
                  <option value={1} style={{ background: '#0f172a' }}>1 próba (24 pytania)</option>
                  <option value={2} style={{ background: '#0f172a' }}>2 próby (48 pytań)</option>
                  <option value={3} style={{ background: '#0f172a' }}>3 próby (72 pytania)</option>
                  <option value={5} style={{ background: '#0f172a' }}>5 prób (120 pytań)</option>
                  <option value={10} style={{ background: '#0f172a' }}>10 prób (240 pytań)</option>
                </select>
              </div>

              {/* Ollama Model Selector */}
              <div className="benchmark-select-wrapper-blue">
                <Cpu size={14} color="#38bdf8" />
                <span className="benchmark-select-label-blue">Model Ollama:</span>
                {availableOllamaModels.length > 0 ? (
                  <select
                    value={selectedOllamaModel}
                    onChange={e => setSelectedOllamaModel(e.target.value)}
                    disabled={running}
                    className="benchmark-select-inner-green"
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
                    className="benchmark-input-text"
                  />
                )}
                <span className={`benchmark-status-badge ${isOllamaOnline ? 'online' : 'offline'}`}>
                  {isOllamaOnline ? 'ONLINE' : 'OFFLINE'}
                </span>
              </div>
            </div>

            {/* 3 Separate Execution Buttons */}
            <div className="benchmark-hero-buttons-row">
              {/* Button 1: Base Only */}
              <button
                onClick={() => handleStartBenchmark('base')}
                disabled={running}
                title="Wysyła zapytania WYŁĄCZNIE do lokalnej instancji Ollamy (brak opłat Azure)"
                className="benchmark-btn-cpu"
              >
                <Cpu size={14} /> Testuj Tylko Ollamę
              </button>

              {/* Button: Azure Base Only */}
              <button
                onClick={() => handleStartBenchmark('azure-base')}
                disabled={running}
                title="Wysyła zapytania WYŁĄCZNIE do bazowego modelu w Azure OpenAI (gpt-4o-mini)"
                className="benchmark-btn-cloud"
                style={{ background: '#3b82f6', borderColor: '#2563eb' }}
              >
                <Cloud size={14} /> Testuj Bazowy Azure
              </button>

              {/* Button 2: Azure FT Only */}
              <button
                onClick={() => handleStartBenchmark('ft')}
                disabled={running}
                title="Wysyła zapytania WYŁĄCZNIE do dostrojonego modelu w Azure OpenAI"
                className="benchmark-btn-cloud"
              >
                <Cloud size={14} /> Testuj Tylko Azure FT
              </button>

              {/* Button 3: Full Comparative Benchmark */}
              <button
                onClick={() => handleStartBenchmark('both')}
                disabled={running}
                title="Uruchamia pełny test porównawczy równolegle dla obu modeli"
                className="benchmark-btn-both"
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
          <div className="benchmark-live-status-box">
            <div className="benchmark-live-status-inner">
              <div className="benchmark-live-status-left">
                <RefreshCw size={16} className="animate-spin" />
                <span>Wykonywanie ewaluacji AI dla {recordCount} rekordów [{activeModeText}]</span>
              </div>
              <div className="benchmark-live-status-elapsed">
                Czas trwania: {elapsedSeconds}s
              </div>
            </div>
            <p className="benchmark-live-status-hint">
              💡 Rekordy są testowane sekwencyjnie. Podgląd każdego zapychanego i odbieranego rekordu w czasie rzeczywistym możesz śledzić na żywo w konsoli serwera .NET!
            </p>
          </div>
        )}
      </div>

      {statusMsg && (
        <div className={`benchmark-status-msg ${statusMsg.type === 'success' ? 'success' : 'error'}`}>
          {statusMsg.text}
        </div>
      )}

      {loading ? (
        <div className="soc-card benchmark-empty-card">
          <RefreshCw size={36} className="animate-spin benchmark-empty-icon" />
          <p>Wczytywanie wyników ewaluacji z bazy danych...</p>
        </div>
      ) : !report ? (
        <div className="soc-card benchmark-empty-card">
          <Sparkles size={40} className="benchmark-empty-icon" />
          <h3 className="benchmark-empty-title">Brak Wykonanego Raportu Benchmarku</h3>
          <p className="benchmark-empty-desc">
            Kliknij przycisk <strong>"Uruchom Benchmark"</strong> powyżej, aby przeprowadzić automatyczną ewaluację modeli ML i obliczyć metryki Accuracy, Precision, Recall oraz Latencję.
          </p>
        </div>
      ) : (
        <>
          {/* Historical Model Selector & Export Banner */}
          {historicalReports.length > 0 && (
            <div className="benchmark-history-banner">
              <div className="benchmark-history-inner">
                <div className="benchmark-history-icon-wrapper">
                  <Cpu size={22} color="#38bdf8" />
                </div>
                <div>
                  <div className="benchmark-history-title-badge">
                    Zarządzanie i Porównanie Prób Modeli
                    <span className="benchmark-history-badge">
                      Historia: {filteredHistoricalReports.length} prób
                    </span>
                  </div>
                  <div className="benchmark-history-desc-muted">
                    Filtruj powtórzone próby dla danego modelu lokalnego i wyeksportuj pełne zestawienie do pliku Excel.
                  </div>
                </div>
              </div>

              <div className="benchmark-history-right-controls">
                {/* Model Filter */}
                <div className="benchmark-history-filter-row">
                  <Filter size={14} color="#94a3b8" />
                  <span className="benchmark-history-filter-label">Model:</span>
                  <select
                    value={selectedModelFilter}
                    onChange={(e) => {
                      const newFilter = e.target.value;
                      setSelectedModelFilter(newFilter);
                      const matching = newFilter === 'ALL'
                        ? historicalReports
                        : historicalReports.filter(r => {
                          const bm = r.baseModelMetrics?.modelName || '';
                          const isBmSkipped = bm.includes('Pominięty') || (r.baseModelMetrics?.accuracy === 0 && r.baseModelMetrics?.averageLatencyMs === 0);
                          if (newFilter === 'Tylko Azure OpenAI FT') return isBmSkipped;
                          return bm.toLowerCase().includes(newFilter.toLowerCase());
                        });
                      if (matching.length > 0) {
                        setSelectedBaseReportId(matching[0].reportId);
                      }
                    }}
                    className="benchmark-history-select"
                  >
                    <option value="ALL">Wszystkie Modele ({historicalReports.length})</option>
                    {modelCategories.map(cat => {
                      const count = historicalReports.filter(r => {
                        const bm = r.baseModelMetrics?.modelName || '';
                        const isBmSkipped = bm.includes('Pominięty') || (r.baseModelMetrics?.accuracy === 0 && r.baseModelMetrics?.averageLatencyMs === 0);
                        if (cat === 'Tylko Azure OpenAI FT') return isBmSkipped;
                        return bm.toLowerCase().includes(cat.toLowerCase());
                      }).length;
                      return (
                        <option key={cat} value={cat}>
                          {cat} ({count} {count === 1 ? 'próba' : 'prób'})
                        </option>
                      );
                    })}
                  </select>
                </div>

                {/* Specific Run Dropdown */}
                <div className="benchmark-history-filter-row">
                  <Clock size={14} color="#38bdf8" />
                  <span className="benchmark-history-run-label">Próba do Podglądu:</span>
                  <select
                    value={selectedBaseReportId}
                    onChange={(e) => setSelectedBaseReportId(e.target.value)}
                    className="benchmark-history-select blue"
                  >
                    {filteredHistoricalReports.map((h, idx) => {
                      const bm = computeStrictMetrics(h.baseModelMetrics, h.itemResults, true) || h.baseModelMetrics;
                      const ftm = computeStrictMetrics(h.fineTunedModelMetrics, h.itemResults, false) || h.fineTunedModelMetrics;
                      const timeStr = new Date(h.timestamp).toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
                      const isAzBase = bm?.modelName?.toLowerCase().includes('azure');
                      const bmLabel = isAzBase ? 'Azure Base' : 'Ollama';
                      const summaryStr = ftm.isSkipped
                        ? `${bmLabel} (Det: ${bm.accuracy.toFixed(1)}%)`
                        : bm.isSkipped
                          ? `Azure FT (Det: ${ftm.accuracy.toFixed(1)}%)`
                          : `${bmLabel} (Det: ${bm.accuracy.toFixed(1)}%) vs Azure FT (Det: ${ftm.accuracy.toFixed(1)}%)`;
                      return (
                        <option key={h.reportId} value={h.reportId} style={{ background: '#0f172a', color: '#ffffff' }}>
                          Próba #{filteredHistoricalReports.length - idx} ({timeStr}): {summaryStr}
                        </option>
                      );
                    })}
                  </select>
                </div>

                {/* Export to CSV Button */}
                <button
                  onClick={handleExportToExcel}
                  title="Pobierz plik CSV otwieralny bezpośrednio w programie Excel"
                  className="benchmark-btn-export"
                >
                  <FileSpreadsheet size={16} />
                  Eksportuj CSV
                </button>

                {/* Delete Selected Report Button */}
                {selectedBaseReportId && (
                  <button
                    onClick={() => handleDeleteReport(selectedBaseReportId)}
                    title="Usuń obecnie wybraną próbę z bazy danych"
                    className="benchmark-btn-delete"
                  >
                    <Trash2 size={15} />
                    Usuń tę próbę
                  </button>
                )}

                {/* Delete All Filtered Reports Button */}
                {filteredHistoricalReports.length > 0 && (
                  <button
                    onClick={handleDeleteAllFilteredReports}
                    title="Usuń wszystkie próby w aktualnie wybranym filtrze"
                    className="benchmark-btn-delete-all"
                  >
                    <Trash2 size={15} />
                    Usuń Próby z Filtra ({filteredHistoricalReports.length})
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Model Multiple Runs History Table (shown when filtered model has > 1 run) */}
          {filteredHistoricalReports.length > 1 && (
            <div className="soc-card benchmark-runs-table-wrapper">
              <div className="benchmark-runs-header">
                <div className="benchmark-runs-title-group">
                  <Layers size={16} color="#38bdf8" />
                  <h4 className="benchmark-runs-title-text">
                    Zestawienie Wszystkich Prób dla Modelu: <span className="benchmark-runs-title-accent">{selectedModelFilter === 'ALL' ? 'Wszystkie Modele' : selectedModelFilter}</span> ({filteredHistoricalReports.length} wykonane testy)
                  </h4>
                </div>
                <div className="benchmark-runs-header-actions">
                  <button
                    onClick={() => setIsRunsSummaryCollapsed(prev => !prev)}
                    className="benchmark-table-btn-show"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                  >
                    {isRunsSummaryCollapsed ? <ChevronDown size={13} /> : <ChevronUp size={13} />}
                    {isRunsSummaryCollapsed ? 'Rozwiń zestawienie' : 'Zwiń zestawienie'}
                  </button>
                </div>
              </div>

              {activeMetricHelp && (
                <div className={`benchmark-metric-help-popover ${activeMetricHelp.tone}`} role="status" aria-live="polite">
                  <div className="benchmark-metric-help-kicker">Wyjaśnienie metryki</div>
                  <div className="benchmark-metric-help-title">{activeMetricHelp.label}</div>
                  <div className="benchmark-metric-help-body">{activeMetricHelp.description}</div>
                </div>
              )}

              {!isRunsSummaryCollapsed && (
              <div className="benchmark-table-overflow">
                <table className="benchmark-runs-table">
                  <thead>
                    <tr className="benchmark-runs-thead-tr">
                      <th className="benchmark-runs-th">PRÓBA #</th>
                      <th className="benchmark-runs-th">DATA I CZAS</th>
                      <th className="benchmark-runs-th">TRYB / TESTOWANY MODEL</th>
                      <th className="benchmark-runs-th green">
                        {renderMetricHeader(
                          'DETEKCJA / KLASYFIKACJA',
                          'Pokazuje, czy model poprawnie rozpoznał atak albo ruch prawidłowy. Ta metryka jest liczona wyłącznie na podstawie klasy Atak vs Ruch Prawidłowy.',
                          'green'
                        )}
                      </th>
                      <th className="benchmark-runs-th teal">
                        {renderMetricHeader(
                          'PRECISION',
                          'Spośród wszystkich przypadków, które model uznał za atak, ile rzeczywiście było atakami.'
                        )}
                      </th>
                      <th className="benchmark-runs-th teal">
                        {renderMetricHeader(
                          'RECALL',
                          'Spośród wszystkich rzeczywistych ataków, ile model wykrył.'
                        )}
                      </th>
                      <th className="benchmark-runs-th purple">
                        {renderMetricHeader(
                          'F1-SCORE',
                          'Zbalansowana miara skuteczności, będąca średnią harmoniczną Precision i Recall. Pomaga ocenić model, gdy liczą się oba aspekty naraz.'
                        )}
                      </th>
                      <th className="benchmark-runs-th blue">ŚREDNIE OPÓŹNIENIE (ms)</th>
                      <th className="benchmark-runs-th right">AKCJA</th>
                    </tr>
                  </thead>
                  <tbody>
                    {/* Summary Row for Averages Across All Runs */}
                    {(() => {
                      if (!filteredHistoricalReports || filteredHistoricalReports.length === 0) return null;

                      let sumOllamaBaseAcc = 0, sumOllamaBasePrec = 0, sumOllamaBaseRec = 0, sumOllamaBaseF1 = 0, sumOllamaBaseLat = 0;
                      let sumAzureBaseAcc = 0, sumAzureBasePrec = 0, sumAzureBaseRec = 0, sumAzureBaseF1 = 0, sumAzureBaseLat = 0;
                      let sumFtAcc = 0, sumFtPrec = 0, sumFtRec = 0, sumFtF1 = 0, sumFtLat = 0;
                      let validOllamaBaseCnt = 0, validAzureBaseCnt = 0, validFtCnt = 0;

                      filteredHistoricalReports.forEach(h => {
                        const bm = computeStrictMetrics(h.baseModelMetrics, h.itemResults, true) || h.baseModelMetrics;
                        const ftm = computeStrictMetrics(h.fineTunedModelMetrics, h.itemResults, false) || h.fineTunedModelMetrics;
                        const isAzureBase = bm?.modelName?.toLowerCase().includes('azure');

                        if (bm && !bm.isSkipped && (bm.accuracy > 0 || bm.averageLatencyMs > 0)) {
                          if (isAzureBase) {
                            sumAzureBaseAcc += bm.accuracy || 0;
                            sumAzureBasePrec += bm.precision || 0;
                            sumAzureBaseRec += bm.recall || 0;
                            sumAzureBaseF1 += bm.f1Score || 0;
                            sumAzureBaseLat += bm.averageLatencyMs || 0;
                            validAzureBaseCnt++;
                          } else {
                            sumOllamaBaseAcc += bm.accuracy || 0;
                            sumOllamaBasePrec += bm.precision || 0;
                            sumOllamaBaseRec += bm.recall || 0;
                            sumOllamaBaseF1 += bm.f1Score || 0;
                            sumOllamaBaseLat += bm.averageLatencyMs || 0;
                            validOllamaBaseCnt++;
                          }
                        }
                        if (ftm && !ftm.isSkipped && (ftm.accuracy > 0 || ftm.averageLatencyMs > 0)) {
                          sumFtAcc += ftm.accuracy || 0;
                          sumFtPrec += ftm.precision || 0;
                          sumFtRec += ftm.recall || 0;
                          sumFtF1 += ftm.f1Score || 0;
                          sumFtLat += ftm.averageLatencyMs || 0;
                          validFtCnt++;
                        }
                      });

                      const cnt = filteredHistoricalReports.length;
                      const avgOllamaBaseAcc = validOllamaBaseCnt > 0 ? sumOllamaBaseAcc / validOllamaBaseCnt : 0;
                      const avgOllamaBasePrec = validOllamaBaseCnt > 0 ? sumOllamaBasePrec / validOllamaBaseCnt : 0;
                      const avgOllamaBaseRec = validOllamaBaseCnt > 0 ? sumOllamaBaseRec / validOllamaBaseCnt : 0;
                      const avgOllamaBaseF1 = validOllamaBaseCnt > 0 ? sumOllamaBaseF1 / validOllamaBaseCnt : 0;
                      const avgOllamaBaseLat = validOllamaBaseCnt > 0 ? sumOllamaBaseLat / validOllamaBaseCnt : 0;

                      const avgAzureBaseAcc = validAzureBaseCnt > 0 ? sumAzureBaseAcc / validAzureBaseCnt : 0;
                      const avgAzureBasePrec = validAzureBaseCnt > 0 ? sumAzureBasePrec / validAzureBaseCnt : 0;
                      const avgAzureBaseRec = validAzureBaseCnt > 0 ? sumAzureBaseRec / validAzureBaseCnt : 0;
                      const avgAzureBaseF1 = validAzureBaseCnt > 0 ? sumAzureBaseF1 / validAzureBaseCnt : 0;
                      const avgAzureBaseLat = validAzureBaseCnt > 0 ? sumAzureBaseLat / validAzureBaseCnt : 0;

                      const avgFtAcc = validFtCnt > 0 ? sumFtAcc / validFtCnt : 0;
                      const avgFtPrec = validFtCnt > 0 ? sumFtPrec / validFtCnt : 0;
                      const avgFtRec = validFtCnt > 0 ? sumFtRec / validFtCnt : 0;
                      const avgFtF1 = validFtCnt > 0 ? sumFtF1 / validFtCnt : 0;
                      const avgFtLat = validFtCnt > 0 ? sumFtLat / validFtCnt : 0;

                      const baseSummaryLabel = validOllamaBaseCnt > 0 && validAzureBaseCnt > 0
                        ? 'Ollama / Azure Base'
                        : validAzureBaseCnt > 0
                          ? 'Azure Base'
                          : 'Ollama';

                      const accuracyEntries = [
                        ...(validOllamaBaseCnt > 0 ? [{ label: 'Ollama', value: `${avgOllamaBaseAcc.toFixed(1)}%` }] : []),
                        ...(validAzureBaseCnt > 0 ? [{ label: 'Azure Base', value: `${avgAzureBaseAcc.toFixed(1)}%` }] : []),
                        ...(validFtCnt > 0 ? [{ label: 'Azure FT', value: `${avgFtAcc.toFixed(1)}%` }] : [])
                      ];

                      const precisionEntries = [
                        ...(validOllamaBaseCnt > 0 ? [{ label: 'Ollama', value: `${avgOllamaBasePrec.toFixed(1)}%` }] : []),
                        ...(validAzureBaseCnt > 0 ? [{ label: 'Azure Base', value: `${avgAzureBasePrec.toFixed(1)}%` }] : []),
                        ...(validFtCnt > 0 ? [{ label: 'Azure FT', value: `${avgFtPrec.toFixed(1)}%` }] : [])
                      ];

                      const recallEntries = [
                        ...(validOllamaBaseCnt > 0 ? [{ label: 'Ollama', value: `${avgOllamaBaseRec.toFixed(1)}%` }] : []),
                        ...(validAzureBaseCnt > 0 ? [{ label: 'Azure Base', value: `${avgAzureBaseRec.toFixed(1)}%` }] : []),
                        ...(validFtCnt > 0 ? [{ label: 'Azure FT', value: `${avgFtRec.toFixed(1)}%` }] : [])
                      ];

                      const f1Entries = [
                        ...(validOllamaBaseCnt > 0 ? [{ label: 'Ollama', value: `${avgOllamaBaseF1.toFixed(1)}%` }] : []),
                        ...(validAzureBaseCnt > 0 ? [{ label: 'Azure Base', value: `${avgAzureBaseF1.toFixed(1)}%` }] : []),
                        ...(validFtCnt > 0 ? [{ label: 'Azure FT', value: `${avgFtF1.toFixed(1)}%` }] : [])
                      ];

                      const latencyEntries = [
                        ...(validOllamaBaseCnt > 0 ? [{ label: 'Ollama', value: `${avgOllamaBaseLat.toFixed(0)} ms` }] : []),
                        ...(validAzureBaseCnt > 0 ? [{ label: 'Azure Base', value: `${avgAzureBaseLat.toFixed(0)} ms` }] : []),
                        ...(validFtCnt > 0 ? [{ label: 'Azure FT', value: `${avgFtLat.toFixed(0)} ms` }] : [])
                      ];

                      return (
                        <tr
                          style={{
                            background: 'linear-gradient(90deg, rgba(56, 189, 248, 0.22) 0%, rgba(139, 92, 246, 0.22) 100%)',
                            borderBottom: '2px solid #38bdf8',
                            boxShadow: '0 2px 10px rgba(56, 189, 248, 0.15)'
                          }}
                        >
                          <td style={{ padding: '0.65rem 0.75rem', fontWeight: 900, color: '#ffffff', fontSize: '0.775rem' }}>
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: '#38bdf8', color: '#0f172a', padding: '0.15rem 0.5rem', borderRadius: '4px', fontWeight: 800 }}>
                              <BarChart2 size={12} /> ŚREDNIA ({cnt})
                            </span>
                          </td>
                          <td style={{ padding: '0.65rem 0.75rem', color: '#94a3b8', fontSize: '0.725rem', fontWeight: 600 }}>
                            Średnia z {cnt} prób
                          </td>
                          <td style={{ padding: '0.65rem 0.75rem', fontWeight: 800, color: '#ffffff' }}>
                            <span style={{ padding: '0.2rem 0.5rem', borderRadius: '4px', background: 'rgba(255, 255, 255, 0.1)', fontSize: '0.725rem' }}>
                              {baseSummaryLabel}
                            </span>
                          </td>
                          <td style={{ padding: '0.65rem 0.75rem', fontWeight: 900, color: '#4ade80', fontSize: '0.85rem' }}>
                            {renderMetricStack(accuracyEntries)}
                          </td>
                          <td style={{ padding: '0.65rem 0.75rem', fontWeight: 900, color: '#14b8a6', fontSize: '0.85rem' }}>
                            {renderMetricStack(precisionEntries)}
                          </td>
                          <td style={{ padding: '0.65rem 0.75rem', fontWeight: 900, color: '#14b8a6', fontSize: '0.85rem' }}>
                            {renderMetricStack(recallEntries)}
                          </td>
                          <td style={{ padding: '0.65rem 0.75rem', fontWeight: 900, color: '#c084fc', fontSize: '0.85rem' }}>
                            {renderMetricStack(f1Entries)}
                          </td>
                          <td style={{ padding: '0.65rem 0.75rem', fontWeight: 800, color: '#38bdf8', fontSize: '0.85rem' }}>
                            {renderMetricStack(latencyEntries)}
                          </td>
                          <td style={{ padding: '0.65rem 0.75rem', textAlign: 'right' }}>
                            <span style={{ fontSize: '0.7rem', fontWeight: 800, padding: '0.2rem 0.55rem', borderRadius: '4px', background: 'rgba(56, 189, 248, 0.25)', color: '#38bdf8', border: '1px solid rgba(56, 189, 248, 0.4)' }}>
                              Podsumowanie
                            </span>
                          </td>
                        </tr>
                      );
                    })()}

                    {filteredHistoricalReports.map((h, idx) => {
                      const isSelected = h.reportId === selectedBaseReportId || h.reportId === selectedFtReportId;
                      const bm = computeStrictMetrics(h.baseModelMetrics, h.itemResults, true) || h.baseModelMetrics;
                      const ftm = computeStrictMetrics(h.fineTunedModelMetrics, h.itemResults, false) || h.fineTunedModelMetrics;

                      const isBaseActive = bm && !bm.isSkipped && (bm.accuracy > 0 || bm.averageLatencyMs > 0);
                      const isFtActive = ftm && !ftm.isSkipped && (ftm.accuracy > 0 || ftm.averageLatencyMs > 0);

                      const isAzureBase = bm?.modelName?.toLowerCase().includes('azure');
                      const baseLabel = isAzureBase ? 'Azure Base' : 'Ollama';
                      const modeBadge = isBaseActive && isFtActive
                        ? <span className="benchmark-mode-badge both">{baseLabel} + Azure FT</span>
                        : isFtActive
                          ? <span className="benchmark-mode-badge ft-only">⚡ Tylko Azure OpenAI FT</span>
                          : isAzureBase
                            ? <span className="benchmark-mode-badge base-only" style={{ background: 'rgba(59, 130, 246, 0.2)', color: '#60a5fa', border: '1px solid rgba(59, 130, 246, 0.3)' }}>☁️ Azure (Base)</span>
                            : <span className="benchmark-mode-badge base-only">🦙 Ollama ({(bm?.modelName || 'Ollama').replace('Model Bazowy (Ollama: ', '').replace(')', '')})</span>;

                      return (
                        <tr
                          key={h.reportId}
                          onClick={() => {
                            if (isBaseActive) setSelectedBaseReportId(h.reportId);
                            if (isFtActive) setSelectedFtReportId(h.reportId);
                          }}
                          style={{
                            borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
                            background: isSelected ? 'rgba(56, 189, 248, 0.12)' : 'transparent',
                            cursor: 'pointer',
                            transition: 'background 0.15s'
                          }}
                        >
                          <td style={{ padding: '0.65rem 0.75rem', fontWeight: 800, color: isSelected ? '#38bdf8' : '#ffffff' }}>
                            #{filteredHistoricalReports.length - idx} {isSelected && '(Wybrany)'}
                          </td>
                          <td style={{ padding: '0.65rem 0.75rem', color: '#94a3b8' }}>{new Date(h.timestamp).toLocaleString('pl-PL')}</td>
                          <td style={{ padding: '0.65rem 0.75rem' }}>{modeBadge}</td>
                          <td style={{ padding: '0.65rem 0.75rem', fontWeight: 800, color: '#4ade80' }}>
                            {renderMetricStack([
                              ...(isBaseActive ? [{ label: `${baseLabel} (detekcja)`, value: `${bm.accuracy.toFixed(1)}%` }] : []),
                              ...(isFtActive ? [{ label: 'Azure FT (detekcja)', value: `${ftm.accuracy.toFixed(1)}%` }] : [])
                            ])}
                          </td>
                          <td className="benchmark-runs-td teal-bold">
                            {renderMetricStack([
                              ...(isBaseActive ? [{ label: baseLabel, value: `${bm.precision.toFixed(1)}%` }] : []),
                              ...(isFtActive ? [{ label: 'Azure FT', value: `${ftm.precision.toFixed(1)}%` }] : [])
                            ])}
                          </td>
                          <td className="benchmark-runs-td teal-bold">
                            {renderMetricStack([
                              ...(isBaseActive ? [{ label: baseLabel, value: `${bm.recall.toFixed(1)}%` }] : []),
                              ...(isFtActive ? [{ label: 'Azure FT', value: `${ftm.recall.toFixed(1)}%` }] : [])
                            ])}
                          </td>
                          <td className="benchmark-runs-td purple-bold">
                            {renderMetricStack([
                              ...(isBaseActive ? [{ label: baseLabel, value: `${bm.f1Score.toFixed(1)}%` }] : []),
                              ...(isFtActive ? [{ label: 'Azure FT', value: `${ftm.f1Score.toFixed(1)}%` }] : [])
                            ])}
                          </td>
                          <td className="benchmark-runs-td blue-bold">
                            {renderMetricStack([
                              ...(isBaseActive ? [{ label: baseLabel, value: `${bm.averageLatencyMs.toFixed(0)} ms` }] : []),
                              ...(isFtActive ? [{ label: 'Azure FT', value: `${ftm.averageLatencyMs.toFixed(0)} ms` }] : [])
                            ])}
                          </td>
                          <td className="benchmark-runs-td right">
                            <div className="benchmark-runs-action-cell">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (isBaseActive) setSelectedBaseReportId(h.reportId);
                                  if (isFtActive) setSelectedFtReportId(h.reportId);
                                }}
                                className="benchmark-table-btn-show"
                                style={{
                                  background: isSelected ? '#38bdf8' : 'rgba(255,255,255,0.1)',
                                  color: isSelected ? '#0f172a' : '#ffffff',
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
              )}
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
                    <th style={{ padding: '0.85rem 1rem', width: '32%' }}>METRYKA NAUKOWA</th>
                    <th style={{ padding: '0.85rem 1rem', color: '#38bdf8', width: '28%' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <span style={{ fontSize: '0.725rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#38bdf8', fontWeight: 800 }}>
                          {selectedBaseReport?.baseModelMetrics?.modelName?.toLowerCase().includes('azure')
                            ? 'MODEL BAZOWY (AZURE: GPT-4O-MINI)'
                            : 'MODEL BAZOWY (OLLAMA)'}
                        </span>
                        <select
                          value={selectedBaseReportId || selectedBaseReport?.reportId}
                          onChange={(e) => setSelectedBaseReportId(e.target.value)}
                          style={{
                            background: '#0f172a',
                            color: '#38bdf8',
                            border: '1px solid rgba(56, 189, 248, 0.5)',
                            borderRadius: '6px',
                            padding: '0.35rem 0.5rem',
                            fontSize: '0.775rem',
                            fontWeight: 700,
                            cursor: 'pointer',
                            outline: 'none'
                          }}
                        >
                          {(validBaseReports.length > 0 ? validBaseReports : historicalReports).map((r) => {
                            const bm = computeStrictMetrics(r.baseModelMetrics, r.itemResults, true);
                            const rawName = bm?.modelName || 'Model Bazowy';
                            const name = rawName.includes('Azure')
                              ? 'Azure Base (gpt-4o-mini)'
                              : rawName.replace('Model Bazowy (Ollama: ', '').replace('Model Bazowy (', '').replace(')', '');
                            return (
                              <option key={r.reportId} value={r.reportId}>
                                {name} ({bm?.accuracy.toFixed(1)}% Acc) - {new Date(r.timestamp).toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' })}
                              </option>
                            );
                          })}
                        </select>
                      </div>
                    </th>
                    <th style={{ padding: '0.85rem 1rem', color: '#c084fc', width: '28%' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <span style={{ fontSize: '0.725rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#c084fc', fontWeight: 800 }}>
                          MODEL FINE-TUNED (AZURE)
                        </span>
                        <select
                          value={selectedFtReportId || selectedFtReport?.reportId}
                          onChange={(e) => setSelectedFtReportId(e.target.value)}
                          style={{
                            background: '#0f172a',
                            color: '#c084fc',
                            border: '1px solid rgba(192, 132, 252, 0.5)',
                            borderRadius: '6px',
                            padding: '0.35rem 0.5rem',
                            fontSize: '0.775rem',
                            fontWeight: 700,
                            cursor: 'pointer',
                            outline: 'none'
                          }}
                        >
                          {(validFtReports.length > 0 ? validFtReports : historicalReports).map((r) => {
                            const ftm = computeStrictMetrics(r.fineTunedModelMetrics, r.itemResults, false);
                            return (
                              <option key={r.reportId} value={r.reportId}>
                                Azure FT ({ftm?.accuracy.toFixed(1)}% Acc) - {new Date(r.timestamp).toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' })}
                              </option>
                            );
                          })}
                        </select>
                      </div>
                    </th>
                    <th style={{ padding: '0.85rem 1rem', textAlign: 'right', width: '12%' }}>RÓŻNICA / ZYSK (%)</th>
                  </tr>
                </thead>
                <tbody>
                  {/* Full SOC Accuracy (100% OK) */}
                  <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
                    <td style={{ padding: '0.85rem 1rem', fontWeight: 700, color: '#ffffff' }}>
                      🎯 Dokładność Detekcji SOC (Atak vs Ruch Prawidłowy)
                    </td>
                    <td style={{ padding: '0.85rem 1rem', fontFamily: 'monospace', fontSize: '0.95rem', color: '#38bdf8', fontWeight: 700 }}>
                      {baseMetrics && !baseMetrics.isSkipped ? `${baseMetrics.accuracy.toFixed(1)}%` : 'Pominięto'}
                    </td>
                    <td style={{ padding: '0.85rem 1rem', fontFamily: 'monospace', fontSize: '0.95rem', color: '#c084fc', fontWeight: 700 }}>
                      {ftMetrics && !ftMetrics.isSkipped ? `${ftMetrics.accuracy.toFixed(1)}%` : 'Pominięto'}
                    </td>
                    <td style={{ padding: '0.85rem 1rem', textAlign: 'right' }}>
                      {(() => {
                        if (!baseMetrics || !ftMetrics || baseMetrics.isSkipped || ftMetrics.isSkipped) return '-';
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

                  {/* Class Accuracy */}
                  <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
                    <td style={{ padding: '0.85rem 1rem', fontWeight: 700, color: '#ffffff' }}>
                      🏷️ Zgodność Klasyfikacji (Trafienie Kategori/Typu Ruchu)
                    </td>
                    <td style={{ padding: '0.85rem 1rem', fontFamily: 'monospace', fontSize: '0.95rem', color: '#38bdf8', fontWeight: 700 }}>
                      {baseMetrics && baseMetrics.classAccuracy !== undefined && !baseMetrics.isSkipped ? `${baseMetrics.classAccuracy.toFixed(1)}%` : 'Pominięto'}
                    </td>
                    <td style={{ padding: '0.85rem 1rem', fontFamily: 'monospace', fontSize: '0.95rem', color: '#c084fc', fontWeight: 700 }}>
                      {ftMetrics && ftMetrics.classAccuracy !== undefined && !ftMetrics.isSkipped ? `${ftMetrics.classAccuracy.toFixed(1)}%` : 'Pominięto'}
                    </td>
                    <td style={{ padding: '0.85rem 1rem', textAlign: 'right' }}>
                      {(() => {
                        if (!baseMetrics || !ftMetrics || baseMetrics.isSkipped || ftMetrics.isSkipped || baseMetrics.classAccuracy === undefined || ftMetrics.classAccuracy === undefined) return '-';
                        const diff = calculateDiff(ftMetrics.classAccuracy, baseMetrics.classAccuracy);
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

                  {/* Action Accuracy */}
                  <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
                    <td style={{ padding: '0.85rem 1rem', fontWeight: 700, color: '#ffffff' }}>
                      ⚙️ Zgodność Rekomendacji Akcji (Isolation / Escalation / Dismiss)
                    </td>
                    <td style={{ padding: '0.85rem 1rem', fontFamily: 'monospace', fontSize: '0.95rem', color: '#38bdf8', fontWeight: 700 }}>
                      {baseMetrics && baseMetrics.actionAccuracy !== undefined && !baseMetrics.isSkipped ? `${baseMetrics.actionAccuracy.toFixed(1)}%` : 'Pominięto'}
                    </td>
                    <td style={{ padding: '0.85rem 1rem', fontFamily: 'monospace', fontSize: '0.95rem', color: '#c084fc', fontWeight: 700 }}>
                      {ftMetrics && ftMetrics.actionAccuracy !== undefined && !ftMetrics.isSkipped ? `${ftMetrics.actionAccuracy.toFixed(1)}%` : 'Pominięto'}
                    </td>
                    <td style={{ padding: '0.85rem 1rem', textAlign: 'right' }}>
                      {(() => {
                        if (!baseMetrics || !ftMetrics || baseMetrics.isSkipped || ftMetrics.isSkipped || baseMetrics.actionAccuracy === undefined || ftMetrics.actionAccuracy === undefined) return '-';
                        const diff = calculateDiff(ftMetrics.actionAccuracy, baseMetrics.actionAccuracy);
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
                      {baseMetrics && !baseMetrics.isSkipped ? `${baseMetrics.precision.toFixed(1)}%` : 'Pominięto'}
                    </td>
                    <td style={{ padding: '0.85rem 1rem', fontFamily: 'monospace', fontSize: '0.95rem', color: '#c084fc', fontWeight: 700 }}>
                      {ftMetrics && !ftMetrics.isSkipped ? `${ftMetrics.precision.toFixed(1)}%` : 'Pominięto'}
                    </td>
                    <td style={{ padding: '0.85rem 1rem', textAlign: 'right' }}>
                      {(() => {
                        if (!baseMetrics || !ftMetrics || baseMetrics.isSkipped || ftMetrics.isSkipped) return '-';
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
                      {baseMetrics && !baseMetrics.isSkipped ? `${baseMetrics.recall.toFixed(1)}%` : 'Pominięto'}
                    </td>
                    <td style={{ padding: '0.85rem 1rem', fontFamily: 'monospace', fontSize: '0.95rem', color: '#c084fc', fontWeight: 700 }}>
                      {ftMetrics && !ftMetrics.isSkipped ? `${ftMetrics.recall.toFixed(1)}%` : 'Pominięto'}
                    </td>
                    <td style={{ padding: '0.85rem 1rem', textAlign: 'right' }}>
                      {(() => {
                        if (!baseMetrics || !ftMetrics || baseMetrics.isSkipped || ftMetrics.isSkipped) return '-';
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
                      {baseMetrics && !baseMetrics.isSkipped ? `${baseMetrics.f1Score.toFixed(1)}%` : 'Pominięto'}
                    </td>
                    <td style={{ padding: '0.85rem 1rem', fontFamily: 'monospace', fontSize: '0.95rem', color: '#c084fc', fontWeight: 700 }}>
                      {ftMetrics && !ftMetrics.isSkipped ? `${ftMetrics.f1Score.toFixed(1)}%` : 'Pominięto'}
                    </td>
                    <td style={{ padding: '0.85rem 1rem', textAlign: 'right' }}>
                      {(() => {
                        if (!baseMetrics || !ftMetrics || baseMetrics.isSkipped || ftMetrics.isSkipped) return '-';
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
                      {baseMetrics && !baseMetrics.isSkipped ? `${baseMetrics.formatAdherenceRate.toFixed(1)}%` : 'Pominięto'}
                    </td>
                    <td style={{ padding: '0.85rem 1rem', fontFamily: 'monospace', fontSize: '0.95rem', color: '#c084fc', fontWeight: 700 }}>
                      {ftMetrics && !ftMetrics.isSkipped ? `${ftMetrics.formatAdherenceRate.toFixed(1)}%` : 'Pominięto'}
                    </td>
                    <td style={{ padding: '0.85rem 1rem', textAlign: 'right' }}>
                      {(() => {
                        if (!baseMetrics || !ftMetrics || baseMetrics.isSkipped || ftMetrics.isSkipped) return '-';
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
                      {baseMetrics && !baseMetrics.isSkipped ? `${baseMetrics.averageLatencyMs.toFixed(0)} ms` : 'Pominięto'}
                    </td>
                    <td style={{ padding: '0.85rem 1rem', fontFamily: 'monospace', fontSize: '0.95rem', color: '#c084fc', fontWeight: 700 }}>
                      {ftMetrics && !ftMetrics.isSkipped ? `${ftMetrics.averageLatencyMs.toFixed(0)} ms` : 'Pominięto'}
                    </td>
                    <td style={{ padding: '0.85rem 1rem', textAlign: 'right' }}>
                      {(() => {
                        if (!baseMetrics || !ftMetrics || baseMetrics.isSkipped || ftMetrics.isSkipped) return '-';
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
                            {diff.text}
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
          <div className="benchmark-cm-grid">
            {/* Base Model Confusion Matrix */}
            <div className="soc-card benchmark-cm-card">
              <div className="benchmark-cm-header">
                <Shield size={16} color="#60a5fa" />
                <h4 className="benchmark-cm-title blue">
                  Confusion Matrix: {baseMetrics?.modelName || 'Model Bazowy'}
                </h4>
              </div>

              <div className="benchmark-cm-cells-grid">
                <div className="benchmark-cm-cell base-tp">
                  <div className="benchmark-cm-label green">True Positives (TP)</div>
                  <div className="benchmark-cm-value">{baseMetrics && !baseMetrics.isSkipped ? baseMetrics.truePositives : 'N/A'}</div>
                  <div className="benchmark-cm-desc">Prawidłowo Wykryty Atak</div>
                </div>
                <div className="benchmark-cm-cell base-fp">
                  <div className="benchmark-cm-label red">False Positives (FP)</div>
                  <div className="benchmark-cm-value">{baseMetrics && !baseMetrics.isSkipped ? baseMetrics.falsePositives : 'N/A'}</div>
                  <div className="benchmark-cm-desc">Błędny Alarm (Fałszywe Zagrożenie)</div>
                </div>
                <div className="benchmark-cm-cell base-fn">
                  <div className="benchmark-cm-label red">False Negatives (FN)</div>
                  <div className="benchmark-cm-value">{baseMetrics && !baseMetrics.isSkipped ? baseMetrics.falseNegatives : 'N/A'}</div>
                  <div className="benchmark-cm-desc">Przegapiony Atak</div>
                </div>
                <div className="benchmark-cm-cell base-tn">
                  <div className="benchmark-cm-label green">True Negatives (TN)</div>
                  <div className="benchmark-cm-value">{baseMetrics && !baseMetrics.isSkipped ? baseMetrics.trueNegatives : 'N/A'}</div>
                  <div className="benchmark-cm-desc">Poprawny Ruch Prawidłowy</div>
                </div>
              </div>
            </div>

            {/* Fine-Tuned Model Confusion Matrix */}
            <div className="soc-card benchmark-cm-card border-purple">
              <div className="benchmark-cm-header">
                <Sparkles size={16} color="#c084fc" />
                <h4 className="benchmark-cm-title purple">
                  Confusion Matrix: {ftMetrics?.modelName || 'Model Fine-Tuned'}
                </h4>
              </div>

              <div className="benchmark-cm-cells-grid">
                <div className="benchmark-cm-cell tp-purple">
                  <div className="benchmark-cm-label green">True Positives (TP)</div>
                  <div className="benchmark-cm-value">{ftMetrics && !ftMetrics.isSkipped ? ftMetrics.truePositives : 'N/A'}</div>
                  <div className="benchmark-cm-desc">Prawidłowo Wykryty Atak</div>
                </div>
                <div className="benchmark-cm-cell fp-purple">
                  <div className="benchmark-cm-label red">False Positives (FP)</div>
                  <div className="benchmark-cm-value">{ftMetrics && !ftMetrics.isSkipped ? ftMetrics.falsePositives : 'N/A'}</div>
                  <div className="benchmark-cm-desc">Błędny Alarm (Fałszywe Zagrożenie)</div>
                </div>
                <div className="benchmark-cm-cell fn-purple">
                  <div className="benchmark-cm-label red">False Negatives (FN)</div>
                  <div className="benchmark-cm-value">{ftMetrics && !ftMetrics.isSkipped ? ftMetrics.falseNegatives : 'N/A'}</div>
                  <div className="benchmark-cm-desc">Przegapiony Atak</div>
                </div>
                <div className="benchmark-cm-cell tn-purple">
                  <div className="benchmark-cm-label green">True Negatives (TN)</div>
                  <div className="benchmark-cm-value">{ftMetrics && !ftMetrics.isSkipped ? ftMetrics.trueNegatives : 'N/A'}</div>
                  <div className="benchmark-cm-desc">Poprawny Ruch Prawidłowy</div>
                </div>
              </div>
            </div>
          </div>

          {/* Section 3: Log Inspection Table */}
          <div className="soc-card benchmark-cm-card">
            <div className="benchmark-section3-header">
              <div className="benchmark-section3-title-group">
                <FileText size={18} color="#c084fc" />
                <h3 className="benchmark-section3-title-text">
                  Szczegóły Zapytań I Log Inspection ({filteredItems.length} rekordów)
                </h3>
              </div>

              {/* Filter Pills */}
              <div className="benchmark-section3-filter-row">
                <button
                  onClick={() => setFilterMode('ALL')}
                  className={`benchmark-filter-btn ${filterMode === 'ALL' ? 'benchmark-filter-all-active' : 'benchmark-filter-inactive'}`}
                >
                  Wszystkie ({report.itemResults.length})
                </button>
                <button
                  onClick={() => setFilterMode('MISMATCHED')}
                  className={`benchmark-filter-btn ${filterMode === 'MISMATCHED' ? 'benchmark-filter-mismatched-active' : 'benchmark-filter-inactive'}`}
                >
                  Tylko Rozbieżne / Błędy
                </button>
                <button
                  onClick={() => setFilterMode('CORRECT')}
                  className={`benchmark-filter-btn ${filterMode === 'CORRECT' ? 'benchmark-filter-correct-active' : 'benchmark-filter-inactive'}`}
                >
                  Tylko 100% Zgodne
                </button>
              </div>
            </div>

            <div className="benchmark-inspection-table-overflow">
              <table className="benchmark-inspection-table">
                <thead>
                  <tr className="benchmark-inspection-table-thead-tr">
                    <th className="benchmark-inspection-table-th">ID</th>
                    <th className="benchmark-inspection-table-th">ALERT &amp; KATEGORIA</th>
                    <th className="benchmark-inspection-table-th">GROUND TRUTH</th>
                    <th className="benchmark-inspection-table-th">MODEL BAZOWY</th>
                    <th className="benchmark-inspection-table-th">MODEL FINE-TUNED</th>
                    <th className="benchmark-inspection-table-th right">AKCJA</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredItems.map(item => {
                    const isExpanded = expandedItemId === item.alertId;
                    const baseResp = (selectedBaseReport?.itemResults.find(r => r.alertId === item.alertId) || item).baseModelResponse;
                    const ftResp = (selectedFtReport?.itemResults.find(r => r.alertId === item.alertId) || item).fineTunedModelResponse;

                    return (
                      <React.Fragment key={item.alertId}>
                        <tr className="benchmark-inspection-tr">
                          <td className="benchmark-inspection-td-id">{item.alertId}</td>
                          <td className="benchmark-inspection-td max-w-260">
                            <div className="benchmark-alert-title-text">{item.alertTitle}</div>
                            <div className="benchmark-alert-meta-text">{item.category} ({item.severity})</div>
                          </td>
                          <td className="benchmark-inspection-td">
                            <div className="benchmark-gt-col">
                              <span className={`benchmark-inspection-gt-badge ${item.groundTruthIsThreat ? 'threat' : 'benign'}`}>
                                {item.groundTruthIsThreat ? <AlertTriangle size={13} color="#f87171" /> : <CheckCircle2 size={13} color="#4ade80" />}
                                {item.groundTruthIsThreat ? 'Atak (Zagrożenie)' : 'Ruch Prawidłowy'}
                              </span>
                              <span className="benchmark-inspection-gt-action">
                                Akcja: {item.groundTruthAction}
                              </span>
                            </div>
                          </td>
                          {(() => {
                            const isBaseActionOK = baseResp.isActionCorrect || (baseResp.predictedAction.trim().toLowerCase() === (item.groundTruthAction || '').trim().toLowerCase());
                            const isFtActionOK = ftResp.isActionCorrect || (ftResp.predictedAction.trim().toLowerCase() === (item.groundTruthAction || '').trim().toLowerCase());

                            return (
                              <>
                                {/* Base Model Result */}
                                <td className="benchmark-inspection-td">
                                  <div className="benchmark-model-col">
                                    <div className="benchmark-model-col-row">
                                      <span className={`benchmark-inspection-pred-badge ${(item.groundTruthIsThreat === baseResp.predictedIsThreat) ? 'base-ok' : 'base-err'}`}>
                                        {(item.groundTruthIsThreat === baseResp.predictedIsThreat) ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
                                        {baseResp.predictedIsThreat ? 'Atak' : 'Ruch Prawidłowy'}
                                      </span>
                                      <span className={`benchmark-inspection-agreement-badge ${(item.groundTruthIsThreat === baseResp.predictedIsThreat) && isBaseActionOK ? 'base-ok-action-ok'
                                        : (item.groundTruthIsThreat === baseResp.predictedIsThreat) && !isBaseActionOK ? 'base-ok-action-err'
                                          : 'base-err-class'
                                        }`}>
                                        {(item.groundTruthIsThreat === baseResp.predictedIsThreat)
                                          ? (isBaseActionOK
                                            ? 'Detekcja OK / Akcja OK'
                                            : '50% (Detekcja OK, Akcja BŁĄD)')
                                          : (isBaseActionOK
                                            ? '50% (Akcja OK, Klasyfikacja BŁĄD)'
                                            : '0% (Detekcja BŁĄD, Akcja BŁĄD)')}
                                      </span>
                                    </div>
                                    <div className="benchmark-model-meta-row">
                                      <span>
                                        Akcja: <strong className={isBaseActionOK ? 'base-ok' : 'base-err'}>{baseResp.predictedAction}</strong>
                                        {!isBaseActionOK && (
                                          <span className="benchmark-inspection-meta-action action-diff">(≠ {item.groundTruthAction})</span>
                                        )}
                                      </span>
                                      <span className="benchmark-latency-base">
                                        <Clock size={10} /> {baseResp.latencyMs} ms
                                      </span>
                                    </div>
                                  </div>
                                </td>

                                {/* Fine-Tuned Model Result */}
                                <td className="benchmark-inspection-td">
                                  <div className="benchmark-model-col">
                                    <div className="benchmark-model-col-row">
                                      <span className={`benchmark-inspection-pred-badge ${(item.groundTruthIsThreat === ftResp.predictedIsThreat) ? 'ft-ok' : 'ft-err'}`}>
                                        {(item.groundTruthIsThreat === ftResp.predictedIsThreat) ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
                                        {ftResp.predictedIsThreat ? 'Atak' : 'Ruch Prawidłowy'}
                                      </span>
                                      <span className={`benchmark-inspection-agreement-badge ${(item.groundTruthIsThreat === ftResp.predictedIsThreat) && isFtActionOK ? 'ft-ok-action-ok'
                                        : (item.groundTruthIsThreat === ftResp.predictedIsThreat) && !isFtActionOK ? 'ft-ok-action-err'
                                          : 'ft-err-class'
                                        }`}>
                                        {(item.groundTruthIsThreat === ftResp.predictedIsThreat)
                                          ? (isFtActionOK
                                            ? 'Detekcja OK / Akcja OK'
                                            : '50% (Detekcja OK, Akcja BŁĄD)')
                                          : (isFtActionOK
                                            ? '50% (Akcja OK, Klasyfikacja BŁĄD)'
                                            : '0% (Detekcja BŁĄD, Akcja BŁĄD)')}
                                      </span>
                                    </div>
                                    <div className="benchmark-model-meta-row">
                                      <span>
                                        Akcja: <strong className={isFtActionOK ? 'ft-ok' : 'ft-err'}>{ftResp.predictedAction}</strong>
                                        {!isFtActionOK && (
                                          <span className="benchmark-meta-action-diff">(≠ {item.groundTruthAction})</span>
                                        )}
                                      </span>
                                      <span className="benchmark-latency-ft">
                                        <Zap size={10} /> {ftResp.latencyMs} ms
                                      </span>
                                    </div>
                                  </div>
                                </td>
                              </>
                            );
                          })()}

                          <td className="benchmark-inspection-td right">
                            <button
                              onClick={() => setExpandedItemId(isExpanded ? null : item.alertId)}
                              className="benchmark-inspection-btn-preview"
                            >
                              {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />} Podgląd Surowy
                            </button>
                          </td>
                        </tr>

                        {/* Expanded details row */}
                        {isExpanded && (
                          <tr className="benchmark-inspection-expanded-tr">
                            <td colSpan={6} className="benchmark-inspection-expanded-td">
                              <div className="benchmark-inspection-expanded-grid">
                                <div className="benchmark-inspection-expanded-box base">
                                  <div className="benchmark-inspection-expanded-title base">
                                    MODEL BAZOWY ({baseMetrics?.modelName || 'LOKALNA OLLAMA'}):
                                  </div>
                                  <pre className="benchmark-inspection-expanded-pre">
                                    {baseResp.extractedText}
                                  </pre>
                                </div>

                                <div className="benchmark-inspection-expanded-box ft">
                                  <div className="benchmark-inspection-expanded-title ft">MODEL WYFINETUNINGOWANY (FT):</div>
                                  <pre className="benchmark-inspection-expanded-pre">
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