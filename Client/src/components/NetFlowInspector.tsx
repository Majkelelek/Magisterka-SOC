import React, { useState } from 'react';
import {
  Clock,
  Zap,
  ArrowUpRight,
  ArrowDownLeft,
  FileJson,
  ChevronDown,
  ChevronUp,
  HardDrive,
  Network
} from 'lucide-react';
import type { Alert } from '../types/alert';
import { NetworkTopologyModal } from './NetworkTopologyModal';
import '../styles/NetFlowInspector.css';

interface NetFlowInspectorProps {
  alert: Alert;
}

export const NetFlowInspector: React.FC<NetFlowInspectorProps> = ({ alert }) => {
  const [showRawJson, setShowRawJson] = useState<boolean>(false);
  const [showTopologyModal, setShowTopologyModal] = useState<boolean>(false);

  // Try parsing raw log JSON object if available
  let netflowObj: Record<string, any> = {};
  if (alert.rawLogs && alert.rawLogs.length > 0) {
    try {
      netflowObj = JSON.parse(alert.rawLogs[0]);
    } catch {
      // If single line fail, fallback
    }
  }

  // Key NetFlow fields extraction (guaranteed number types)
  const destPort = Number(netflowObj['Destination Port']) || 80;
  const duration = Number(netflowObj['Flow Duration']) || 0;
  const fwdPkts = Number(netflowObj['Total Fwd Packets']) || 0;
  const bwdPkts = Number(netflowObj['Total Backward Packets']) || 0;
  const fwdBytes = Number(netflowObj['Total Length of Fwd Packets']) || 0;
  const bwdBytes = Number(netflowObj['Total Length of Bwd Packets']) || 0;
  const flowBytesSec = Number(netflowObj['Flow Bytes/s']) || 0;
  const flowPktsSec = Number(netflowObj['Flow Packets/s']) || 0;
  const pktLenMean = Number(netflowObj['Packet Length Mean']) || 0;
  const ackFlag = Number(netflowObj['ACK Flag Count']) || 0;
  const synFlag = Number(netflowObj['SYN Flag Count']) || 0;
  const pshFlag = Number(netflowObj['PSH Flag Count']) || 0;
  const finFlag = Number(netflowObj['FIN Flag Count']) || 0;
  const rstFlag = Number(netflowObj['RST Flag Count']) || 0;
  const label = netflowObj['Label'] ?? (alert.isThreat ? 'DDoS' : 'BENIGN');
  const isThreat = alert.isThreat ?? (label === 'DDoS' || alert.severity === 'Critical');

  // Format Duration human readable
  const formatDuration = (us: number) => {
    if (us < 1000) return `${us} µs`;
    if (us < 1000000) return `${(us / 1000).toFixed(2)} ms`;
    return `${(us / 1000000).toFixed(2)} s`;
  };

  // Format Bandwidth human readable
  const formatBandwidth = (bps: number) => {
    if (bps < 1000) return `${bps.toFixed(0)} B/s`;
    if (bps < 1000000) return `${(bps / 1000).toFixed(1)} KB/s`;
    return `${(bps / 1000000).toFixed(2)} MB/s`;
  };

  // Format Packet Rate human readable
  const formatPacketRate = (pps: number) => {
    if (pps < 1000) return `${pps.toFixed(0)} pkt/s`;
    return `${(pps / 1000).toFixed(1)}k pkt/s`;
  };

  // Traffic Ratio %
  const totalPkts = (fwdPkts + bwdPkts) || 1;
  const fwdPct = Math.round((fwdPkts / totalPkts) * 100);
  const bwdPct = 100 - fwdPct;

  return (
    <div className="netflow-inspector-card">
      {/* Inspector Title */}
      <div className="netflow-inspector-header">
        <div className="netflow-header-left">
          <div className="netflow-header-icon">
            <Network size={20} color="#38bdf8" />
          </div>
          <div>
            <h4 className="netflow-header-title">
              Analizator Przepływu i Ruchu Sieciowego
            </h4>
            <span className="netflow-header-subtitle">
              Telemetria & Analiza Przepływu NetFlow • Port docelowy: <strong className="netflow-port-highlight">{destPort}</strong>
            </span>
          </div>
        </div>

        <div className="netflow-header-right">
          <button
            onClick={() => setShowTopologyModal(true)}
            title="Otwórz bazę topologii sieci ofiary"
            className="netflow-btn-topology"
          >
            <Network size={14} />
            <span>Topologia Sieci Ofiary</span>
          </button>

          <button
            onClick={() => setShowRawJson(!showRawJson)}
            className={`netflow-btn-json ${showRawJson ? 'active' : ''}`}
          >
            <FileJson size={14} />
            {showRawJson ? 'Ukryj Surowy JSON' : 'Pokaż Surowy JSON (79 Pól)'}
            {showRawJson ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        </div>
      </div>

      {/* 4 Stat Cards Grid */}
      <div className="netflow-stats-grid">
        {/* Stat Card 1: Czas Trwania */}
        <div className="netflow-stat-card">
          <div className="netflow-stat-title">
            <Clock size={13} color="#38bdf8" /> Czas Trwania Przepływu
          </div>
          <div className="netflow-stat-value">
            {formatDuration(duration)}
          </div>
          <div className="netflow-stat-subtext">
            Łącznie: {duration.toLocaleString()} µs
          </div>
        </div>

        {/* Stat Card 2: Transfer i Natężenie */}
        <div className="netflow-stat-card">
          <div className="netflow-stat-title">
            <Zap size={13} color="#fbbf24" /> Natężenie i Pasmo
          </div>
          <div className={`netflow-stat-value ${isThreat ? 'threat' : ''}`}>
            {formatBandwidth(flowBytesSec)}
          </div>
          <div className="netflow-stat-subtext">
            Częstotliwość: {formatPacketRate(flowPktsSec)}
          </div>
        </div>

        {/* Stat Card 3: Wolumen Pakietów */}
        <div className="netflow-stat-card">
          <div className="netflow-stat-title">
            <ArrowUpRight size={13} color="#4ade80" /> Pakiety (Fwd / Bwd)
          </div>
          <div className="netflow-stat-value">
            {fwdPkts} <span className="netflow-stat-subtext">fwd</span> / {bwdPkts} <span className="netflow-stat-subtext">bwd</span>
          </div>
          <div className="netflow-stat-subtext">
            Bajtów: {fwdBytes} B fwd / {bwdBytes} B bwd
          </div>
        </div>

        {/* Stat Card 4: Średni Rozmiar Pakietu */}
        <div className="netflow-stat-card">
          <div className="netflow-stat-title">
            <HardDrive size={13} color="#c084fc" /> Średni Rozmiar Pakietu
          </div>
          <div className="netflow-stat-value">
            {pktLenMean.toFixed(1)} B
          </div>
          <div className="netflow-stat-subtext">
            Długość ramki danych
          </div>
        </div>
      </div>

      {/* Traffic Asymmetry & TCP Flags Bar */}
      <div className="netflow-asymmetry-grid">
        {/* Visual Asymmetry Bar */}
        <div className="netflow-bar-container">
          <div className="netflow-bar-labels">
            <span className="netflow-bar-label-item">
              <ArrowUpRight size={11} color="#34d399" /> Wychodzące (Fwd): {fwdPct}%
            </span>
            <span className="netflow-bar-label-item">
              <ArrowDownLeft size={11} color="#60a5fa" /> Przychodzące (Bwd): {bwdPct}%
            </span>
          </div>
          <div className="netflow-bar-track">
            <div className="netflow-bar-fill-fwd" style={{ width: `${fwdPct}%` }} />
            <div className="netflow-bar-fill-bwd" style={{ width: `${bwdPct}%` }} />
          </div>
        </div>

        {/* TCP Flag Status Indicators */}
        <div className="netflow-flags-container">
          <div className="netflow-flags-title">
            Flagi Protokołu TCP:
          </div>
          <div className="netflow-flags-list">
            <span className={`netflow-flag-badge ${ackFlag > 0 ? 'active-ack' : ''}`}>
              ACK: {ackFlag}
            </span>
            <span className={`netflow-flag-badge ${synFlag > 0 ? 'active-syn' : ''}`}>
              SYN: {synFlag}
            </span>
            <span className={`netflow-flag-badge ${pshFlag > 0 ? 'active-psh' : ''}`}>
              PSH: {pshFlag}
            </span>
            <span className={`netflow-flag-badge ${finFlag > 0 ? 'active-fin' : ''}`}>
              FIN: {finFlag}
            </span>
            <span className={`netflow-flag-badge ${rstFlag > 0 ? 'active-rst' : ''}`}>
              RST: {rstFlag}
            </span>
          </div>
        </div>
      </div>

      {/* Expandable Formatted Raw JSON View */}
      {showRawJson && (
        <div className="netflow-raw-json-box">
          <div className="netflow-raw-json-title">
            <FileJson size={14} color="#38bdf8" /> Pełne Dane Przepływu (Pobrane z bazy danych MongoDB):
          </div>
          <pre className="netflow-raw-json-pre">
            {JSON.stringify(netflowObj, null, 2)}
          </pre>
        </div>
      )}
      {/* Modal Topologii Sieci */}
      <NetworkTopologyModal
        isOpen={showTopologyModal}
        onClose={() => setShowTopologyModal(false)}
      />
    </div>
  );
};
