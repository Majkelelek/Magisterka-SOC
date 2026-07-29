import React, { useState } from 'react';
import {
  Clock,
  Zap,
  ArrowUpRight,
  ArrowDownLeft,
  FileJson,
  ChevronDown,
  ChevronUp,
  ShieldAlert,
  CheckCircle2,
  HardDrive,
  Network
} from 'lucide-react';
import type { Alert } from '../types/alert';
import { NetworkTopologyModal } from './NetworkTopologyModal';

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
    <div style={{
      background: 'linear-gradient(145deg, rgba(15, 23, 42, 0.9), rgba(11, 17, 32, 0.95))',
      border: '1px solid rgba(56, 189, 248, 0.25)',
      borderRadius: '12px',
      padding: '1.25rem',
      boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.4)',
      marginBottom: '1.25rem'
    }}>
      {/* Inspector Title */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '1rem',
        borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
        paddingBottom: '0.75rem'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            background: 'rgba(56, 189, 248, 0.15)',
            border: '1px solid rgba(56, 189, 248, 0.35)',
            padding: '8px',
            borderRadius: '8px',
            display: 'flex'
          }}>
            <Network size={20} color="#38bdf8" />
          </div>
          <div>
            <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: '#ffffff' }}>
              Analizator Przepływu i Ruchu Sieciowego
            </h4>
            <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
              Telemetria & Analiza Przepływu NetFlow • Port docelowy: <strong style={{ color: '#38bdf8' }}>{destPort}</strong>
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            onClick={() => setShowTopologyModal(true)}
            title="Otwórz bazę topologii sieci ofiary"
            style={{
              background: 'rgba(56, 189, 248, 0.15)',
              border: '1px solid rgba(56, 189, 248, 0.35)',
              color: '#38bdf8',
              padding: '0.35rem 0.75rem',
              borderRadius: '6px',
              fontSize: '0.775rem',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <Network size={14} />
            <span>Topologia Sieci Ofiary</span>
          </button>

          <button
            onClick={() => setShowRawJson(!showRawJson)}
            style={{
              background: showRawJson ? 'rgba(56, 189, 248, 0.25)' : 'rgba(30, 41, 59, 0.8)',
              border: '1px solid rgba(56, 189, 248, 0.3)',
              color: '#38bdf8',
              padding: '0.35rem 0.75rem',
              borderRadius: '6px',
              fontSize: '0.775rem',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <FileJson size={14} />
            {showRawJson ? 'Ukryj Surowy JSON' : 'Pokaż Surowy JSON (79 Pól)'}
            {showRawJson ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        </div>
      </div>

      {/* 4 Stat Cards Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
        gap: '0.85rem',
        marginBottom: '1rem'
      }}>
        {/* Stat Card 1: Czas Trwania */}
        <div style={{
          background: 'rgba(30, 41, 59, 0.5)',
          border: '1px solid rgba(255,255,255,0.06)',
          borderRadius: '8px',
          padding: '0.75rem 1rem'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.725rem', color: '#94a3b8', marginBottom: '0.25rem' }}>
            <Clock size={13} color="#38bdf8" /> Czas Trwania Przepływu
          </div>
          <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#f8fafc' }}>
            {formatDuration(duration)}
          </div>
          <div style={{ fontSize: '0.675rem', color: '#64748b', marginTop: '2px' }}>
            Łącznie: {duration.toLocaleString()} µs
          </div>
        </div>

        {/* Stat Card 2: Transfer i Natężenie */}
        <div style={{
          background: 'rgba(30, 41, 59, 0.5)',
          border: '1px solid rgba(255,255,255,0.06)',
          borderRadius: '8px',
          padding: '0.75rem 1rem'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.725rem', color: '#94a3b8', marginBottom: '0.25rem' }}>
            <Zap size={13} color="#fbbf24" /> Natężenie i Pasmo
          </div>
          <div style={{ fontSize: '1.15rem', fontWeight: 800, color: isThreat ? '#f87171' : '#f8fafc' }}>
            {formatBandwidth(flowBytesSec)}
          </div>
          <div style={{ fontSize: '0.675rem', color: '#64748b', marginTop: '2px' }}>
            Częstotliwość: {formatPacketRate(flowPktsSec)}
          </div>
        </div>

        {/* Stat Card 3: Wolumen Pakietów */}
        <div style={{
          background: 'rgba(30, 41, 59, 0.5)',
          border: '1px solid rgba(255,255,255,0.06)',
          borderRadius: '8px',
          padding: '0.75rem 1rem'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.725rem', color: '#94a3b8', marginBottom: '0.25rem' }}>
            <ArrowUpRight size={13} color="#4ade80" /> Pakiety (Fwd / Bwd)
          </div>
          <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#f8fafc' }}>
            {fwdPkts} <span style={{ fontSize: '0.85rem', color: '#94a3b8', fontWeight: 400 }}>fwd</span> / {bwdPkts} <span style={{ fontSize: '0.85rem', color: '#94a3b8', fontWeight: 400 }}>bwd</span>
          </div>
          <div style={{ fontSize: '0.675rem', color: '#64748b', marginTop: '2px' }}>
            Bajtów: {fwdBytes} B fwd / {bwdBytes} B bwd
          </div>
        </div>

        {/* Stat Card 4: Średni Rozmiar Pakietu */}
        <div style={{
          background: 'rgba(30, 41, 59, 0.5)',
          border: '1px solid rgba(255,255,255,0.06)',
          borderRadius: '8px',
          padding: '0.75rem 1rem'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.725rem', color: '#94a3b8', marginBottom: '0.25rem' }}>
            <HardDrive size={13} color="#c084fc" /> Średni Rozmiar Pakietu
          </div>
          <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#f8fafc' }}>
            {pktLenMean.toFixed(1)} B
          </div>
          <div style={{ fontSize: '0.675rem', color: '#64748b', marginTop: '2px' }}>
            Długość ramki danych
          </div>
        </div>
      </div>

      {/* Traffic Asymmetry & TCP Flags Bar */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '1rem',
        alignItems: 'center'
      }}>
        {/* Visual Asymmetry Bar */}
        <div style={{ background: 'rgba(15, 23, 42, 0.6)', padding: '0.65rem 0.85rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: '#94a3b8', marginBottom: '0.35rem' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <ArrowUpRight size={11} color="#34d399" /> Wychodzące (Fwd): {fwdPct}%
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <ArrowDownLeft size={11} color="#60a5fa" /> Przychodzące (Bwd): {bwdPct}%
            </span>
          </div>
          <div style={{ height: '8px', width: '100%', background: '#1e293b', borderRadius: '4px', overflow: 'hidden', display: 'flex' }}>
            <div style={{ width: `${fwdPct}%`, background: 'linear-gradient(90deg, #10b981, #059669)', transition: 'width 0.3s ease' }} />
            <div style={{ width: `${bwdPct}%`, background: 'linear-gradient(90deg, #3b82f6, #1d4ed8)', transition: 'width 0.3s ease' }} />
          </div>
        </div>

        {/* TCP Flag Status Indicators */}
        <div style={{ background: 'rgba(15, 23, 42, 0.6)', padding: '0.65rem 0.85rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
          <div style={{ fontSize: '0.7rem', color: '#94a3b8', marginBottom: '0.35rem', fontWeight: 600 }}>
            Flagi Protokołu TCP:
          </div>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            <span style={{
              padding: '0.15rem 0.45rem',
              borderRadius: '4px',
              fontSize: '0.65rem',
              fontWeight: 700,
              background: ackFlag > 0 ? 'rgba(52, 211, 153, 0.2)' : 'rgba(51, 65, 85, 0.3)',
              color: ackFlag > 0 ? '#34d399' : '#64748b',
              border: ackFlag > 0 ? '1px solid rgba(52, 211, 153, 0.4)' : '1px solid rgba(51, 65, 85, 0.4)'
            }}>
              ACK: {ackFlag}
            </span>
            <span style={{
              padding: '0.15rem 0.45rem',
              borderRadius: '4px',
              fontSize: '0.65rem',
              fontWeight: 700,
              background: synFlag > 0 ? 'rgba(245, 158, 11, 0.2)' : 'rgba(51, 65, 85, 0.3)',
              color: synFlag > 0 ? '#fbbf24' : '#64748b',
              border: synFlag > 0 ? '1px solid rgba(245, 158, 11, 0.4)' : '1px solid rgba(51, 65, 85, 0.4)'
            }}>
              SYN: {synFlag}
            </span>
            <span style={{
              padding: '0.15rem 0.45rem',
              borderRadius: '4px',
              fontSize: '0.65rem',
              fontWeight: 700,
              background: pshFlag > 0 ? 'rgba(168, 85, 247, 0.2)' : 'rgba(51, 65, 85, 0.3)',
              color: pshFlag > 0 ? '#c084fc' : '#64748b',
              border: pshFlag > 0 ? '1px solid rgba(168, 85, 247, 0.4)' : '1px solid rgba(51, 65, 85, 0.4)'
            }}>
              PSH: {pshFlag}
            </span>
            <span style={{
              padding: '0.15rem 0.45rem',
              borderRadius: '4px',
              fontSize: '0.65rem',
              fontWeight: 700,
              background: finFlag > 0 ? 'rgba(239, 68, 68, 0.2)' : 'rgba(51, 65, 85, 0.3)',
              color: finFlag > 0 ? '#f87171' : '#64748b',
              border: finFlag > 0 ? '1px solid rgba(239, 68, 68, 0.4)' : '1px solid rgba(51, 65, 85, 0.4)'
            }}>
              FIN: {finFlag}
            </span>
            <span style={{
              padding: '0.15rem 0.45rem',
              borderRadius: '4px',
              fontSize: '0.65rem',
              fontWeight: 700,
              background: rstFlag > 0 ? 'rgba(239, 68, 68, 0.2)' : 'rgba(51, 65, 85, 0.3)',
              color: rstFlag > 0 ? '#f87171' : '#64748b',
              border: rstFlag > 0 ? '1px solid rgba(239, 68, 68, 0.4)' : '1px solid rgba(51, 65, 85, 0.4)'
            }}>
              RST: {rstFlag}
            </span>
          </div>
        </div>
      </div>

      {/* Expandable Formatted Raw JSON View */}
      {showRawJson && (
        <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
          <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <FileJson size={14} color="#38bdf8" /> Pełne Dane Przepływu (Pobrane z bazy danych MongoDB):
          </div>
          <pre style={{
            background: '#070a12',
            border: '1px solid #1e293b',
            borderRadius: '8px',
            padding: '1rem',
            fontSize: '0.75rem',
            lineHeight: '1.5',
            color: '#38bdf8',
            maxHeight: '260px',
            overflowY: 'auto',
            fontFamily: 'Consolas, Monaco, monospace',
            margin: 0
          }}>
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
