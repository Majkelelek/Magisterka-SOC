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

  // Sub-tabs State for AI Providers (including 'all' tab)
  type ProviderTab = 'all' | 'openai' | 'gemini' | 'deepseek' | 'anthropic' | 'ollama';
  const [providerTab, setProviderTab] = useState<ProviderTab>('all');

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

    const res = await runModelEvaluation(recordCount, mode, selectedOllamaModel, 2, iterations, providerTab);
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

  const matchesProvider = (r: EvaluationReport | null, tab: ProviderTab): boolean => {
    if (!r) return false;
    if (tab === 'all') return true;
    const baseName = (r.baseModelMetrics?.modelName || '').toLowerCase();
    const ftName = (r.fineTunedModelMetrics?.modelName || '').toLowerCase();
    const isBmSkipped = baseName.includes('pominięty') || (r.baseModelMetrics?.accuracy === 0 && r.baseModelMetrics?.averageLatencyMs === 0);

    switch (tab) {
      case 'openai':
        // Both fine-tuned and base (if not skipped) MUST be OpenAI / Azure
        if (!/openai|azure|gpt/i.test(ftName)) return false;
        if (!isBmSkipped && !/openai|azure|gpt/i.test(baseName)) return false;
        return true;

      case 'gemini':
        if (!/gemini/i.test(ftName)) return false;
        if (!isBmSkipped && !/gemini/i.test(baseName)) return false;
        return true;

      case 'deepseek':
        if (!/deepseek/i.test(ftName)) return false;
        if (!isBmSkipped && !/deepseek/i.test(baseName)) return false;
        return true;

      case 'anthropic':
        if (!/claude|anthropic/i.test(ftName)) return false;
        if (!isBmSkipped && !/claude|anthropic/i.test(baseName)) return false;
        return true;

      case 'ollama':
        // Both models MUST be local Ollama models (no cloud providers)
        if (/azure|openai|gpt|gemini|deepseek|claude|anthropic/i.test(ftName)) return false;
        if (!isBmSkipped && /azure|openai|gpt|gemini|deepseek|claude|anthropic/i.test(baseName)) return false;
        return /ollama|llama|mistral|qwen|gemma|phi/i.test(ftName) || /ollama|llama|mistral|qwen|gemma|phi/i.test(baseName);

      default:
        return true;
    }
  };

  const getReportCategoryLabel = (r: EvaluationReport): string => {
    const bm = r.baseModelMetrics?.modelName || '';
    const ftm = r.fineTunedModelMetrics?.modelName || '';
    const isBmSkipped = bm.includes('Pominięty') || (r.baseModelMetrics?.accuracy === 0 && r.baseModelMetrics?.averageLatencyMs === 0);

    if (isBmSkipped) {
      return `Tylko ${ftm || 'Azure OpenAI FT'}`;
    }

    const cleanBm = bm.replace('Model Bazowy (Ollama: ', '').replace('Model Bazowy (', '').replace(')', '').trim();
    const cleanFtm = ftm.replace('Model Dostrojony (', '').replace(')', '').trim();

    return `${cleanBm} ➔ ${cleanFtm}`;
  };

  const providerReports = historicalReports.filter(r => matchesProvider(r, providerTab));

  const modelCategories = Array.from(
    new Set(providerReports.map(r => getReportCategoryLabel(r)).filter(Boolean))
  );

  const filteredHistoricalReports = providerReports.filter(r => {
    if (selectedModelFilter === 'ALL') return true;
    return getReportCategoryLabel(r) === selectedModelFilter;
  });

  const [selectedFtReportId, setSelectedFtReportId] = useState<string>('');

  const validBaseReports = filteredHistoricalReports.filter(r => r.baseModelMetrics && !r.baseModelMetrics.modelName.includes('Pominięty') && r.baseModelMetrics.accuracy > 0);
  const validFtReports = filteredHistoricalReports.filter(r => r.fineTunedModelMetrics && !r.fineTunedModelMetrics.modelName.includes('Pominięty') && r.fineTunedModelMetrics.accuracy > 0);

  const selectedBaseReport = filteredHistoricalReports.find(r => r.reportId === selectedBaseReportId) || validBaseReports[0] || (matchesProvider(report, providerTab) ? report : null);
  const selectedFtReport = filteredHistoricalReports.find(r => r.reportId === selectedFtReportId) || validFtReports[0] || (matchesProvider(report, providerTab) ? report : null);

  const baseMetrics = computeStrictMetrics(selectedBaseReport?.baseModelMetrics, selectedBaseReport?.itemResults, true);
  const ftMetrics = computeStrictMetrics(selectedFtReport?.fineTunedModelMetrics, selectedFtReport?.itemResults, false);

  const escapeXml = (str: any): string => {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  };

  const handleExportToExcel = () => {
    const allReports = historicalReports.length > 0 ? historicalReports : (report ? [report] : []);

    if (allReports.length === 0) {
      alert('Brak wyników do wyeksportowania! Uruchom najpierw benchmark.');
      return;
    }

    const providers = [
      { key: 'openai', sheetName: 'OpenAI', label: 'OpenAI (Azure / Direct)', matches: (m: string) => /openai|gpt|azure/i.test(m) },
      { key: 'gemini', sheetName: 'Google Gemini', label: 'Google Gemini', matches: (m: string) => /gemini/i.test(m) },
      { key: 'deepseek', sheetName: 'DeepSeek', label: 'DeepSeek AI', matches: (m: string) => /deepseek/i.test(m) },
      { key: 'anthropic', sheetName: 'Anthropic', label: 'Anthropic Claude', matches: (m: string) => /claude|anthropic/i.test(m) },
      { key: 'ollama', sheetName: 'Local Ollama', label: 'Local Ollama (SLM/LLM)', matches: (m: string) => /ollama|llama|mistral|qwen/i.test(m) }
    ];

    let xml = `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:html="http://www.w3.org/TR/REC-html40">
 <Styles>
  <Style ss:ID="Default" ss:Name="Normal">
   <Alignment ss:Vertical="Bottom"/>
   <Font ss:FontName="Calibri" ss:Size="11" ss:Color="#0F172A"/>
  </Style>
  <Style ss:ID="Title">
   <Alignment ss:Horizontal="Left" ss:Vertical="Center"/>
   <Font ss:FontName="Calibri" ss:Size="14" ss:Bold="1" ss:Color="#0EA5E9"/>
  </Style>
  <Style ss:ID="SubTitle">
   <Alignment ss:Horizontal="Left" ss:Vertical="Center"/>
   <Font ss:FontName="Calibri" ss:Size="11" ss:Bold="1" ss:Color="#64748B"/>
  </Style>
  <Style ss:ID="TableHeader">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
   <Font ss:FontName="Calibri" ss:Size="10" ss:Bold="1" ss:Color="#FFFFFF"/>
   <Interior ss:Color="#1E293B" ss:Pattern="Solid"/>
  </Style>
  <Style ss:ID="SubHeader">
   <Alignment ss:Horizontal="Left" ss:Vertical="Center"/>
   <Font ss:FontName="Calibri" ss:Size="11" ss:Bold="1" ss:Color="#38BDF8"/>
   <Interior ss:Color="#0F172A" ss:Pattern="Solid"/>
  </Style>
  <Style ss:ID="BoldCell">
   <Font ss:FontName="Calibri" ss:Size="10" ss:Bold="1"/>
  </Style>
  <Style ss:ID="SuccessCell">
   <Font ss:FontName="Calibri" ss:Size="10" ss:Color="#16A34A" ss:Bold="1"/>
  </Style>
  <Style ss:ID="ErrorCell">
   <Font ss:FontName="Calibri" ss:Size="10" ss:Color="#DC2626" ss:Bold="1"/>
  </Style>
 </Styles>
`;

    providers.forEach(p => {
      let pReports = allReports.filter(r =>
        p.matches(r.baseModelMetrics?.modelName || '') ||
        p.matches(r.fineTunedModelMetrics?.modelName || '')
      );

      // Fallback distribution for OpenAI and Ollama if no explicit naming matches
      if (pReports.length === 0) {
        if (p.key === 'openai') {
          pReports = allReports.filter(r => (r.fineTunedModelMetrics?.totalRecordsTested || r.totalRecordsTested || 0) > 0 || r.baseModelMetrics?.modelName?.toLowerCase().includes('azure'));
        } else if (p.key === 'ollama') {
          pReports = allReports.filter(r => (r.baseModelMetrics?.totalRecordsTested || r.totalRecordsTested || 0) > 0);
        }
      }

      xml += ` <Worksheet ss:Name="${escapeXml(p.sheetName)}">\n  <Table>\n`;
      xml += `   <Column ss:Width="160"/>\n   <Column ss:Width="140"/>\n   <Column ss:Width="180"/>\n   <Column ss:Width="70"/>\n   <Column ss:Width="90"/>\n   <Column ss:Width="90"/>\n   <Column ss:Width="90"/>\n   <Column ss:Width="90"/>\n   <Column ss:Width="110"/>\n   <Column ss:Width="110"/>\n   <Column ss:Width="50"/>\n   <Column ss:Width="50"/>\n   <Column ss:Width="50"/>\n   <Column ss:Width="50"/>\n`;

      xml += `   <Row ss:Height="26">
    <Cell ss:StyleID="Title"><Data ss:Type="String">EWALUACJA BENCHMARK AI — ARKUSZ DOSTAWCY: ${escapeXml(p.label.toUpperCase())}</Data></Cell>
   </Row>\n`;
      xml += `   <Row ss:Height="18"><Cell ss:StyleID="SubTitle"><Data ss:Type="String">Wygenerowano: ${escapeXml(new Date().toLocaleString('pl-PL'))}</Data></Cell></Row>\n`;
      xml += `   <Row ss:Height="12"></Row>\n`;

      xml += `   <Row ss:Height="24">
    <Cell ss:StyleID="TableHeader"><Data ss:Type="String">ID Raportu</Data></Cell>
    <Cell ss:StyleID="TableHeader"><Data ss:Type="String">Data i Czas</Data></Cell>
    <Cell ss:StyleID="TableHeader"><Data ss:Type="String">Nazwa Modelu</Data></Cell>
    <Cell ss:StyleID="TableHeader"><Data ss:Type="String">Rekordy</Data></Cell>
    <Cell ss:StyleID="TableHeader"><Data ss:Type="String">Accuracy (%)</Data></Cell>
    <Cell ss:StyleID="TableHeader"><Data ss:Type="String">Precision (%)</Data></Cell>
    <Cell ss:StyleID="TableHeader"><Data ss:Type="String">Recall (%)</Data></Cell>
    <Cell ss:StyleID="TableHeader"><Data ss:Type="String">F1-Score (%)</Data></Cell>
    <Cell ss:StyleID="TableHeader"><Data ss:Type="String">Zgodność Formatu (%)</Data></Cell>
    <Cell ss:StyleID="TableHeader"><Data ss:Type="String">Śr. Latencja (ms)</Data></Cell>
    <Cell ss:StyleID="TableHeader"><Data ss:Type="String">TP</Data></Cell>
    <Cell ss:StyleID="TableHeader"><Data ss:Type="String">FP</Data></Cell>
    <Cell ss:StyleID="TableHeader"><Data ss:Type="String">FN</Data></Cell>
    <Cell ss:StyleID="TableHeader"><Data ss:Type="String">TN</Data></Cell>
   </Row>\n`;

      if (pReports.length === 0) {
        xml += `   <Row ss:Height="20">
    <Cell><Data ss:Type="String">Brak zarejestrowanych prób benchmarkowych dla dostawcy ${escapeXml(p.label)}.</Data></Cell>
   </Row>\n`;
      } else {
        pReports.forEach(r => {
          const metricsList = [r.baseModelMetrics, r.fineTunedModelMetrics].filter(Boolean);
          metricsList.forEach(m => {
            const recordCnt = m?.totalRecordsTested || r.totalRecordsTested || 0;
            if (!m || recordCnt === 0) return;
            const isSkipped = m.modelName?.includes('Pominięty');
            if (isSkipped) return;
            xml += `   <Row ss:Height="20">
    <Cell ss:StyleID="BoldCell"><Data ss:Type="String">${escapeXml(r.reportId)}</Data></Cell>
    <Cell><Data ss:Type="String">${escapeXml(new Date(r.timestamp).toLocaleString('pl-PL'))}</Data></Cell>
    <Cell><Data ss:Type="String">${escapeXml(m.modelName)}</Data></Cell>
    <Cell><Data ss:Type="Number">${recordCnt}</Data></Cell>
    <Cell><Data ss:Type="Number">${m.accuracy.toFixed(1)}</Data></Cell>
    <Cell><Data ss:Type="Number">${m.precision.toFixed(1)}</Data></Cell>
    <Cell><Data ss:Type="Number">${m.recall.toFixed(1)}</Data></Cell>
    <Cell><Data ss:Type="Number">${m.f1Score.toFixed(1)}</Data></Cell>
    <Cell><Data ss:Type="Number">${(m.formatAdherenceRate ?? 100).toFixed(1)}</Data></Cell>
    <Cell><Data ss:Type="Number">${m.averageLatencyMs}</Data></Cell>
    <Cell><Data ss:Type="Number">${m.truePositives ?? 0}</Data></Cell>
    <Cell><Data ss:Type="Number">${m.falsePositives ?? 0}</Data></Cell>
    <Cell><Data ss:Type="Number">${m.falseNegatives ?? 0}</Data></Cell>
    <Cell><Data ss:Type="Number">${m.trueNegatives ?? 0}</Data></Cell>
   </Row>\n`;
          });
        });

        // Add detailed item predictions table
        xml += `   <Row ss:Height="14"></Row>\n`;
        xml += `   <Row ss:Height="22"><Cell ss:StyleID="SubHeader"><Data ss:Type="String">SZCZEGÓŁOWE PREDYKCJE REKORDÓW BENCHMARKU</Data></Cell></Row>\n`;
        xml += `   <Row ss:Height="22">
    <Cell ss:StyleID="TableHeader"><Data ss:Type="String">ID Alertu</Data></Cell>
    <Cell ss:StyleID="TableHeader"><Data ss:Type="String">Kategoria</Data></Cell>
    <Cell ss:StyleID="TableHeader"><Data ss:Type="String">Ground Truth Akcja</Data></Cell>
    <Cell ss:StyleID="TableHeader"><Data ss:Type="String">Model</Data></Cell>
    <Cell ss:StyleID="TableHeader"><Data ss:Type="String">Predykcja Modelu</Data></Cell>
    <Cell ss:StyleID="TableHeader"><Data ss:Type="String">Latencja (ms)</Data></Cell>
    <Cell ss:StyleID="TableHeader"><Data ss:Type="String">Klasa Poprawna</Data></Cell>
    <Cell ss:StyleID="TableHeader"><Data ss:Type="String">Akcja Poprawna</Data></Cell>
   </Row>\n`;

        pReports.forEach(r => {
          if (r.itemResults) {
            r.itemResults.forEach(item => {
              if (item.baseModelResponse && item.baseModelResponse.predictedAction !== 'Pominięte') {
                xml += `   <Row ss:Height="19">
    <Cell><Data ss:Type="String">${escapeXml(item.alertId)}</Data></Cell>
    <Cell><Data ss:Type="String">${escapeXml(item.category || '')}</Data></Cell>
    <Cell><Data ss:Type="String">${escapeXml(item.groundTruthAction || '')}</Data></Cell>
    <Cell><Data ss:Type="String">${escapeXml(r.baseModelMetrics?.modelName || 'Base Model')}</Data></Cell>
    <Cell><Data ss:Type="String">${escapeXml(item.baseModelResponse.predictedAction)}</Data></Cell>
    <Cell><Data ss:Type="Number">${item.baseModelResponse.latencyMs}</Data></Cell>
    <Cell ss:StyleID="${item.baseModelResponse.isClassCorrect ? 'SuccessCell' : 'ErrorCell'}"><Data ss:Type="String">${item.baseModelResponse.isClassCorrect ? 'TAK' : 'NIE'}</Data></Cell>
    <Cell ss:StyleID="${item.baseModelResponse.isActionCorrect ? 'SuccessCell' : 'ErrorCell'}"><Data ss:Type="String">${item.baseModelResponse.isActionCorrect ? 'TAK' : 'NIE'}</Data></Cell>
   </Row>\n`;
              }
              if (item.fineTunedModelResponse && item.fineTunedModelResponse.predictedAction !== 'Pominięte') {
                xml += `   <Row ss:Height="19">
    <Cell><Data ss:Type="String">${escapeXml(item.alertId)}</Data></Cell>
    <Cell><Data ss:Type="String">${escapeXml(item.category || '')}</Data></Cell>
    <Cell><Data ss:Type="String">${escapeXml(item.groundTruthAction || '')}</Data></Cell>
    <Cell><Data ss:Type="String">${escapeXml(r.fineTunedModelMetrics?.modelName || 'Fine-Tuned Model')}</Data></Cell>
    <Cell><Data ss:Type="String">${escapeXml(item.fineTunedModelResponse.predictedAction)}</Data></Cell>
    <Cell><Data ss:Type="Number">${item.fineTunedModelResponse.latencyMs}</Data></Cell>
    <Cell ss:StyleID="${item.fineTunedModelResponse.isClassCorrect ? 'SuccessCell' : 'ErrorCell'}"><Data ss:Type="String">${item.fineTunedModelResponse.isClassCorrect ? 'TAK' : 'NIE'}</Data></Cell>
    <Cell ss:StyleID="${item.fineTunedModelResponse.isActionCorrect ? 'SuccessCell' : 'ErrorCell'}"><Data ss:Type="String">${item.fineTunedModelResponse.isActionCorrect ? 'TAK' : 'NIE'}</Data></Cell>
   </Row>\n`;
              }
            });
          }
        });
      }

      xml += `  </Table>\n </Worksheet>\n`;
    });

    xml += `</Workbook>`;

    const blob = new Blob([xml], { type: 'application/vnd.ms-excel;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Ewaluacja_AI_Benchmark_5_Arkuszy_${new Date().toISOString().substring(0, 10)}.xls`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
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
      {/* AI Provider Sub-Tabs Bar */}
      <div className="benchmark-provider-tabs-bar">
        <button
          type="button"
          className={`provider-tab-btn all ${providerTab === 'all' ? 'active' : ''}`}
          onClick={() => {
            setProviderTab('all');
            setSelectedModelFilter('ALL');
          }}
        >
          <Layers size={16} color="#38bdf8" /> Wszystkie Modele
        </button>

        <button
          type="button"
          className={`provider-tab-btn openai ${providerTab === 'openai' ? 'active' : ''}`}
          onClick={() => {
            setProviderTab('openai');
            setSelectedModelFilter('ALL');
          }}
        >
          <Cloud size={16} color="#60a5fa" /> OpenAI (Azure / GPT-4o)
        </button>

        <button
          type="button"
          className={`provider-tab-btn gemini ${providerTab === 'gemini' ? 'active' : ''}`}
          onClick={() => {
            setProviderTab('gemini');
            setSelectedModelFilter('ALL');
          }}
        >
          <Sparkles size={16} color="#4ade80" /> Google Gemini (1.5 / 2.0)
        </button>

        <button
          type="button"
          className={`provider-tab-btn deepseek ${providerTab === 'deepseek' ? 'active' : ''}`}
          onClick={() => {
            setProviderTab('deepseek');
            setSelectedModelFilter('ALL');
          }}
        >
          <Zap size={16} color="#f87171" /> DeepSeek (V3 / R1)
        </button>

        <button
          type="button"
          className={`provider-tab-btn anthropic ${providerTab === 'anthropic' ? 'active' : ''}`}
          onClick={() => {
            setProviderTab('anthropic');
            setSelectedModelFilter('ALL');
          }}
        >
          <Shield size={16} color="#fb923c" /> Anthropic (Claude 3.5)
        </button>

        <button
          type="button"
          className={`provider-tab-btn ollama ${providerTab === 'ollama' ? 'active' : ''}`}
          onClick={() => {
            setProviderTab('ollama');
            setSelectedModelFilter('ALL');
          }}
        >
          <Cpu size={16} color="#c084fc" /> Local Ollama (SLM / LLM)
        </button>
      </div>

      {/* Header Section */}
      <div className="benchmark-hero-card">
        <div className="benchmark-hero-flex-between">
          <div>
            <div className="benchmark-hero-left-title-row">
              <div className="benchmark-logo-box">
                <BarChart2 size={24} color="#c084fc" />
              </div>
              <h1 className="benchmark-hero-main-title">
                Model Benchmark & Evaluation — {providerTab === 'all' ? 'Wszystkie Modele (Pełne Zestawienie)' : providerTab === 'openai' ? 'OpenAI / Azure' : providerTab === 'gemini' ? 'Google Gemini' : providerTab === 'deepseek' ? 'DeepSeek AI' : providerTab === 'anthropic' ? 'Anthropic Claude' : 'Local Ollama'}
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

              {/* Ollama Model Selector — only on All/Ollama tabs */}
              {(providerTab === 'all' || providerTab === 'ollama') && (
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
              )}
            </div>

            {/* ── Dedicated Test Buttons Per Provider Tab ── */}
            <div className="benchmark-hero-buttons-row">

              {/* ═══ TAB: Wszystkie Modele ═══ */}
              {providerTab === 'all' && (
                <>
                  <button
                    onClick={() => handleStartBenchmark('base')}
                    disabled={running}
                    title="Wysyła zapytania WYŁĄCZNIE do lokalnej instancji Ollamy"
                    className="benchmark-btn-cpu"
                  >
                    <Cpu size={14} /> Testuj Ollamę
                  </button>
                  <button
                    onClick={() => handleStartBenchmark('azure-base')}
                    disabled={running}
                    title="Wysyła zapytania WYŁĄCZNIE do bazowego modelu Azure OpenAI (gpt-4o-mini)"
                    className="benchmark-btn-cloud"
                    style={{ background: '#3b82f6', borderColor: '#2563eb' }}
                  >
                    <Cloud size={14} /> Testuj Azure Base
                  </button>
                  <button
                    onClick={() => handleStartBenchmark('ft')}
                    disabled={running}
                    title="Wysyła zapytania WYŁĄCZNIE do dostrojonego modelu Azure OpenAI"
                    className="benchmark-btn-cloud"
                  >
                    <Cloud size={14} /> Testuj Azure FT
                  </button>
                  <button
                    onClick={() => handleStartBenchmark('both')}
                    disabled={running}
                    title="Uruchamia pełny test porównawczy równolegle dla obu modeli"
                    className="benchmark-btn-both"
                  >
                    {running ? (
                      <><RefreshCw size={14} className="animate-spin" /> Testowanie...</>
                    ) : (
                      <><Play size={14} fill="#ffffff" /> Pełny Benchmark (Obydwa)</>
                    )}
                  </button>
                </>
              )}

              {/* ═══ TAB: OpenAI / Azure ═══ */}
              {providerTab === 'openai' && (
                <>
                  <button
                    onClick={() => handleStartBenchmark('azure-base')}
                    disabled={running}
                    title="Testuj WYŁĄCZNIE bazowy model Azure OpenAI (gpt-4o-mini)"
                    className="benchmark-btn-cloud"
                    style={{ background: '#3b82f6', borderColor: '#2563eb' }}
                  >
                    <Cloud size={14} /> Testuj Azure Base (gpt-4o-mini)
                  </button>
                  <button
                    onClick={() => handleStartBenchmark('ft')}
                    disabled={running}
                    title="Testuj WYŁĄCZNIE dostrojony model Azure OpenAI FT"
                    className="benchmark-btn-cloud"
                  >
                    <Cloud size={14} /> Testuj Azure Fine-Tuned
                  </button>
                  <button
                    onClick={() => handleStartBenchmark('both')}
                    disabled={running}
                    title="Porównaj Azure Base vs Azure FT obok siebie"
                    className="benchmark-btn-both"
                  >
                    {running ? (
                      <><RefreshCw size={14} className="animate-spin" /> Testowanie...</>
                    ) : (
                      <><Play size={14} fill="#ffffff" /> Porównaj Base vs FT</>
                    )}
                  </button>
                </>
              )}

              {/* ═══ TAB: Google Gemini ═══ */}
              {providerTab === 'gemini' && (
                <>
                  <button
                    onClick={() => handleStartBenchmark('base')}
                    disabled={running}
                    title="Testuj WYŁĄCZNIE bazowy model Google Gemini"
                    className="benchmark-btn-cpu"
                    style={{ background: 'linear-gradient(135deg, #16a34a, #15803d)', borderColor: '#166534' }}
                  >
                    {running ? (
                      <><RefreshCw size={14} className="animate-spin" /> Testowanie Gemini Base...</>
                    ) : (
                      <><Sparkles size={14} /> Testuj Gemini Base</>
                    )}
                  </button>
                  <button
                    onClick={() => handleStartBenchmark('ft')}
                    disabled={running}
                    title="Testuj WYŁĄCZNIE dostrojony model Google Gemini FT"
                    className="benchmark-btn-cloud"
                    style={{ background: 'linear-gradient(135deg, #059669, #047857)', borderColor: '#065f46' }}
                  >
                    {running ? (
                      <><RefreshCw size={14} className="animate-spin" /> Testowanie Gemini FT...</>
                    ) : (
                      <><Sparkles size={14} /> Testuj Gemini FT</>
                    )}
                  </button>
                  <button
                    onClick={() => handleStartBenchmark('both')}
                    disabled={running}
                    title="Porównaj Gemini Base vs Gemini FT obok siebie"
                    className="benchmark-btn-both"
                    style={{ background: 'linear-gradient(135deg, #16a34a, #7c3aed)', borderColor: '#15803d' }}
                  >
                    <Play size={14} fill="#ffffff" /> Porównaj Gemini (Base vs FT)
                  </button>
                </>
              )}

              {/* ═══ TAB: DeepSeek ═══ */}
              {providerTab === 'deepseek' && (
                <>
                  <button
                    onClick={() => handleStartBenchmark('base')}
                    disabled={running}
                    title="Testuj WYŁĄCZNIE bazowy model DeepSeek AI"
                    className="benchmark-btn-cpu"
                    style={{ background: 'linear-gradient(135deg, #dc2626, #991b1b)', borderColor: '#7f1d1d' }}
                  >
                    {running ? (
                      <><RefreshCw size={14} className="animate-spin" /> Testowanie DeepSeek Base...</>
                    ) : (
                      <><Zap size={14} /> Testuj DeepSeek Base</>
                    )}
                  </button>
                  <button
                    onClick={() => handleStartBenchmark('ft')}
                    disabled={running}
                    title="Testuj WYŁĄCZNIE dostrojony model DeepSeek FT"
                    className="benchmark-btn-cloud"
                    style={{ background: 'linear-gradient(135deg, #b91c1c, #991b1b)', borderColor: '#7f1d1d' }}
                  >
                    {running ? (
                      <><RefreshCw size={14} className="animate-spin" /> Testowanie DeepSeek FT...</>
                    ) : (
                      <><Zap size={14} /> Testuj DeepSeek FT</>
                    )}
                  </button>
                  <button
                    onClick={() => handleStartBenchmark('both')}
                    disabled={running}
                    title="Porównaj DeepSeek Base vs DeepSeek FT obok siebie"
                    className="benchmark-btn-both"
                    style={{ background: 'linear-gradient(135deg, #dc2626, #7c3aed)', borderColor: '#991b1b' }}
                  >
                    <Play size={14} fill="#ffffff" /> Porównaj DeepSeek (Base vs FT)
                  </button>
                </>
              )}

              {/* ═══ TAB: Anthropic Claude ═══ */}
              {providerTab === 'anthropic' && (
                <>
                  <button
                    onClick={() => handleStartBenchmark('base')}
                    disabled={running}
                    title="Testuj WYŁĄCZNIE bazowy model Anthropic Claude"
                    className="benchmark-btn-cpu"
                    style={{ background: 'linear-gradient(135deg, #ea580c, #c2410c)', borderColor: '#9a3412' }}
                  >
                    {running ? (
                      <><RefreshCw size={14} className="animate-spin" /> Testowanie Claude Base...</>
                    ) : (
                      <><Shield size={14} /> Testuj Claude Base</>
                    )}
                  </button>
                  <button
                    onClick={() => handleStartBenchmark('ft')}
                    disabled={running}
                    title="Testuj WYŁĄCZNIE dostrojony model Anthropic Claude FT"
                    className="benchmark-btn-cloud"
                    style={{ background: 'linear-gradient(135deg, #c2410c, #9a3412)', borderColor: '#7c2d12' }}
                  >
                    {running ? (
                      <><RefreshCw size={14} className="animate-spin" /> Testowanie Claude FT...</>
                    ) : (
                      <><Shield size={14} /> Testuj Claude FT</>
                    )}
                  </button>
                  <button
                    onClick={() => handleStartBenchmark('both')}
                    disabled={running}
                    title="Porównaj Claude Base vs Claude FT obok siebie"
                    className="benchmark-btn-both"
                    style={{ background: 'linear-gradient(135deg, #ea580c, #7c3aed)', borderColor: '#c2410c' }}
                  >
                    <Play size={14} fill="#ffffff" /> Porównaj Claude (Base vs FT)
                  </button>
                </>
              )}

              {/* ═══ TAB: Local Ollama ═══ */}
              {providerTab === 'ollama' && (
                <>
                  <button
                    onClick={() => handleStartBenchmark('base')}
                    disabled={running}
                    title={`Testuj WYŁĄCZNIE bazowy lokalny model Ollama: ${selectedOllamaModel}`}
                    className="benchmark-btn-cpu"
                  >
                    {running ? (
                      <><RefreshCw size={14} className="animate-spin" /> Testowanie {selectedOllamaModel} Base...</>
                    ) : (
                      <><Cpu size={14} /> Testuj {selectedOllamaModel} Base</>
                    )}
                  </button>
                  <button
                    onClick={() => handleStartBenchmark('ft')}
                    disabled={running}
                    title={`Testuj WYŁĄCZNIE dostrojony lokalny model ${selectedOllamaModel} FT`}
                    className="benchmark-btn-cloud"
                  >
                    {running ? (
                      <><RefreshCw size={14} className="animate-spin" /> Testowanie {selectedOllamaModel} FT...</>
                    ) : (
                      <><Cpu size={14} /> Testuj {selectedOllamaModel} FT</>
                    )}
                  </button>
                  <button
                    onClick={() => handleStartBenchmark('both')}
                    disabled={running}
                    title={`Porównaj ${selectedOllamaModel} (Base) vs ${selectedOllamaModel} (FT) obok siebie`}
                    className="benchmark-btn-both"
                  >
                    <Play size={14} fill="#ffffff" /> Porównaj {selectedOllamaModel} (Base vs FT)
                  </button>
                </>
              )}
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
                        ? providerReports
                        : providerReports.filter(r => getReportCategoryLabel(r) === newFilter);
                      if (matching.length > 0) {
                        setSelectedBaseReportId(matching[0].reportId);
                      }
                    }}
                    className="benchmark-history-select"
                  >
                    <option value="ALL">Wszystkie Modele ({providerReports.length})</option>
                    {modelCategories.map(cat => {
                      const count = providerReports.filter(r => getReportCategoryLabel(r) === cat).length;
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

                {/* Export to Excel (5 Sheets) Button */}
                <button
                  onClick={handleExportToExcel}
                  title="Pobierz 1 plik Excel (.xls) zawierający 5 osobnych arkuszy (po jednym dla OpenAI, Gemini, DeepSeek, Anthropic, Ollama)"
                  className="benchmark-btn-export"
                >
                  <FileSpreadsheet size={16} />
                  Eksportuj do Excela (5 Arkuszy)
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

          {/* Empty State when no reports match active provider tab */}
          {filteredHistoricalReports.length === 0 && (
            <div className="soc-card" style={{ padding: '2.5rem', textAlign: 'center', margin: '1.5rem 0', border: '1px dashed rgba(56, 189, 248, 0.3)', background: 'rgba(15, 23, 42, 0.6)' }}>
              <Layers size={40} color="#38bdf8" style={{ marginBottom: '1rem', opacity: 0.8 }} />
              <h3 style={{ color: '#ffffff', fontSize: '1.25rem', fontWeight: 800, margin: '0 0 0.5rem 0' }}>
                Brak zapisanych wyników w zakładce: {providerTab === 'openai' ? 'OpenAI / Azure' : providerTab === 'gemini' ? 'Google Gemini' : providerTab === 'deepseek' ? 'DeepSeek AI' : providerTab === 'anthropic' ? 'Anthropic Claude' : providerTab === 'ollama' ? 'Local Ollama' : 'Wszystkie Modele'}
              </h3>
              <p style={{ color: '#94a3b8', fontSize: '0.9rem', maxWidth: '600px', margin: '0 auto 1.5rem auto', lineHeight: 1.5 }}>
                Baza danych nie posiada jeszcze zapisanych prób benchmarkowych dla tego dostawcy AI. Wykonaj test przyciskiem powyżej, aby zarejestrować metryki dla tego modelu.
              </p>
            </div>
          )}

          {/* Render 50/50 Split View and ML Summary Tables ONLY when matching reports exist */}
          {filteredHistoricalReports.length > 0 && selectedBaseReport && (
            <>
              {/* 50/50 Split View (Pół strony na Bazowy / Pół strony na Fine-Tuned) */}
              <div className="benchmark-split-view-wrapper" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem', marginBottom: '1.5rem' }}>
                {/* LEWA STRONA (50%): MODEL BAZOWY */}
                <div className="soc-card" style={{ padding: '1.25rem', background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.95), rgba(7, 10, 18, 0.98))', border: '1px solid rgba(56, 189, 248, 0.4)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', borderBottom: '1px solid rgba(56, 189, 248, 0.2)', paddingBottom: '0.75rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Cpu size={22} color="#38bdf8" />
                      <div>
                        <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: '#38bdf8' }}>
                          MODEL BAZOWY (BASE MODEL)
                        </h3>
                        <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                          {selectedBaseReport?.baseModelMetrics?.modelName || 'Base Model'}
                        </span>
                      </div>
                    </div>
                    <span className="benchmark-status-badge online" style={{ background: 'rgba(56, 189, 248, 0.2)', color: '#38bdf8', padding: '4px 8px' }}>
                      50% VIEW (BAZOWY)
                    </span>
                  </div>

                  {/* Grid Wyników Modelu Bazowego */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '1rem' }}>
                    <div style={{ background: 'rgba(15, 23, 42, 0.85)', padding: '0.75rem', borderRadius: '8px', border: '1px solid rgba(56, 189, 248, 0.2)' }}>
                      <div style={{ fontSize: '0.7rem', color: '#94a3b8', fontWeight: 700 }}>DETEKCJA ACCURACY</div>
                      <div style={{ fontSize: '1.35rem', fontWeight: 900, color: '#38bdf8' }}>
                        {baseMetrics && !baseMetrics.isSkipped ? `${baseMetrics.accuracy.toFixed(1)}%` : 'N/A'}
                      </div>
                    </div>
                    <div style={{ background: 'rgba(15, 23, 42, 0.85)', padding: '0.75rem', borderRadius: '8px', border: '1px solid rgba(56, 189, 248, 0.2)' }}>
                      <div style={{ fontSize: '0.7rem', color: '#94a3b8', fontWeight: 700 }}>STRICT COMBINED</div>
                      <div style={{ fontSize: '1.35rem', fontWeight: 900, color: '#4ade80' }}>
                        {baseMetrics && !baseMetrics.isSkipped ? `${(baseMetrics.strictAccuracy ?? baseMetrics.accuracy).toFixed(1)}%` : 'N/A'}
                      </div>
                    </div>
                    <div style={{ background: 'rgba(15, 23, 42, 0.85)', padding: '0.75rem', borderRadius: '8px', border: '1px solid rgba(56, 189, 248, 0.2)' }}>
                      <div style={{ fontSize: '0.7rem', color: '#94a3b8', fontWeight: 700 }}>PRECISION / RECALL</div>
                      <div style={{ fontSize: '0.9rem', fontWeight: 800, color: '#ffffff' }}>
                        {baseMetrics && !baseMetrics.isSkipped ? `${baseMetrics.precision.toFixed(1)}% / ${baseMetrics.recall.toFixed(1)}%` : 'N/A'}
                      </div>
                    </div>
                    <div style={{ background: 'rgba(15, 23, 42, 0.85)', padding: '0.75rem', borderRadius: '8px', border: '1px solid rgba(56, 189, 248, 0.2)' }}>
                      <div style={{ fontSize: '0.7rem', color: '#94a3b8', fontWeight: 700 }}>ŚREDNIA LATENCJA</div>
                      <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#c084fc' }}>
                        {baseMetrics && !baseMetrics.isSkipped ? `${baseMetrics.averageLatencyMs.toFixed(0)} ms` : 'N/A'}
                      </div>
                    </div>
                  </div>

                  {/* Macierz Pomyłek dla Bazowego */}
                  <div style={{ background: 'rgba(10, 15, 26, 0.85)', padding: '0.75rem', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
                    <div style={{ fontSize: '0.725rem', fontWeight: 800, color: '#94a3b8', marginBottom: '6px' }}>MACIERZ POMYŁEK (CONFUSION MATRIX)</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', textAlign: 'center', fontSize: '0.775rem', fontWeight: 800 }}>
                      <div style={{ background: 'rgba(34, 197, 94, 0.15)', padding: '6px', borderRadius: '6px', color: '#4ade80' }}>
                        TP: {baseMetrics?.truePositives ?? 0}
                      </div>
                      <div style={{ background: 'rgba(239, 68, 68, 0.15)', padding: '6px', borderRadius: '6px', color: '#f87171' }}>
                        FP: {baseMetrics?.falsePositives ?? 0}
                      </div>
                      <div style={{ background: 'rgba(239, 68, 68, 0.15)', padding: '6px', borderRadius: '6px', color: '#f87171' }}>
                        FN: {baseMetrics?.falseNegatives ?? 0}
                      </div>
                      <div style={{ background: 'rgba(34, 197, 94, 0.15)', padding: '6px', borderRadius: '6px', color: '#4ade80' }}>
                        TN: {baseMetrics?.trueNegatives ?? 0}
                      </div>
                    </div>
                  </div>
                </div>

                {/* PRAWA STRONA (50%): MODEL FINE-TUNED */}
                <div className="soc-card" style={{ padding: '1.25rem', background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.95), rgba(7, 10, 18, 0.98))', border: '1px solid rgba(192, 132, 252, 0.4)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', borderBottom: '1px solid rgba(192, 132, 252, 0.2)', paddingBottom: '0.75rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Sparkles size={22} color="#c084fc" />
                      <div>
                        <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: '#c084fc' }}>
                          MODEL DOSTROJONY (FINE-TUNED)
                        </h3>
                        <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                          {selectedFtReport?.fineTunedModelMetrics?.modelName || 'Azure Fine-Tuned'}
                        </span>
                      </div>
                    </div>
                    <span className="benchmark-status-badge online" style={{ background: 'rgba(192, 132, 252, 0.2)', color: '#c084fc', padding: '4px 8px' }}>
                      50% VIEW (DOSTROJONY)
                    </span>
                  </div>

                  {/* Grid Wyników Modelu Fine-Tuned */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '1rem' }}>
                    <div style={{ background: 'rgba(15, 23, 42, 0.85)', padding: '0.75rem', borderRadius: '8px', border: '1px solid rgba(192, 132, 252, 0.2)' }}>
                      <div style={{ fontSize: '0.7rem', color: '#94a3b8', fontWeight: 700 }}>DETEKCJA ACCURACY</div>
                      <div style={{ fontSize: '1.35rem', fontWeight: 900, color: '#c084fc' }}>
                        {ftMetrics && !ftMetrics.isSkipped ? `${ftMetrics.accuracy.toFixed(1)}%` : 'N/A'}
                      </div>
                    </div>
                    <div style={{ background: 'rgba(15, 23, 42, 0.85)', padding: '0.75rem', borderRadius: '8px', border: '1px solid rgba(192, 132, 252, 0.2)' }}>
                      <div style={{ fontSize: '0.7rem', color: '#94a3b8', fontWeight: 700 }}>STRICT COMBINED</div>
                      <div style={{ fontSize: '1.35rem', fontWeight: 900, color: '#4ade80' }}>
                        {ftMetrics && !ftMetrics.isSkipped ? `${(ftMetrics.strictAccuracy ?? ftMetrics.accuracy).toFixed(1)}%` : 'N/A'}
                      </div>
                    </div>
                    <div style={{ background: 'rgba(15, 23, 42, 0.85)', padding: '0.75rem', borderRadius: '8px', border: '1px solid rgba(192, 132, 252, 0.2)' }}>
                      <div style={{ fontSize: '0.7rem', color: '#94a3b8', fontWeight: 700 }}>PRECISION / RECALL</div>
                      <div style={{ fontSize: '0.9rem', fontWeight: 800, color: '#ffffff' }}>
                        {ftMetrics && !ftMetrics.isSkipped ? `${ftMetrics.precision.toFixed(1)}% / ${ftMetrics.recall.toFixed(1)}%` : 'N/A'}
                      </div>
                    </div>
                    <div style={{ background: 'rgba(15, 23, 42, 0.85)', padding: '0.75rem', borderRadius: '8px', border: '1px solid rgba(192, 132, 252, 0.2)' }}>
                      <div style={{ fontSize: '0.7rem', color: '#94a3b8', fontWeight: 700 }}>ŚREDNIA LATENCJA</div>
                      <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#38bdf8' }}>
                        {ftMetrics && !ftMetrics.isSkipped ? `${ftMetrics.averageLatencyMs.toFixed(0)} ms` : 'N/A'}
                      </div>
                    </div>
                  </div>

                  {/* Macierz Pomyłek dla Fine-Tuned */}
                  <div style={{ background: 'rgba(10, 15, 26, 0.85)', padding: '0.75rem', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
                    <div style={{ fontSize: '0.725rem', fontWeight: 800, color: '#94a3b8', marginBottom: '6px' }}>MACIERZ POMYŁEK (CONFUSION MATRIX)</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', textAlign: 'center', fontSize: '0.775rem', fontWeight: 800 }}>
                      <div style={{ background: 'rgba(34, 197, 94, 0.15)', padding: '6px', borderRadius: '6px', color: '#4ade80' }}>
                        TP: {ftMetrics?.truePositives ?? 0}
                      </div>
                      <div style={{ background: 'rgba(239, 68, 68, 0.15)', padding: '6px', borderRadius: '6px', color: '#f87171' }}>
                        FP: {ftMetrics?.falsePositives ?? 0}
                      </div>
                      <div style={{ background: 'rgba(239, 68, 68, 0.15)', padding: '6px', borderRadius: '6px', color: '#f87171' }}>
                        FN: {ftMetrics?.falseNegatives ?? 0}
                      </div>
                      <div style={{ background: 'rgba(34, 197, 94, 0.15)', padding: '6px', borderRadius: '6px', color: '#4ade80' }}>
                        TN: {ftMetrics?.trueNegatives ?? 0}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

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
        </>
      )}
    </div>
  );
};