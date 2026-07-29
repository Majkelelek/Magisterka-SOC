import React from 'react';
import { X, Server, Shield, Monitor, Network, HardDrive, Lock, Info } from 'lucide-react';
import { VICTIM_NETWORK_TOPOLOGY, type HostInfo } from '../data/networkTopology';

interface NetworkTopologyModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const NetworkTopologyModal: React.FC<NetworkTopologyModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  const firewalls = VICTIM_NETWORK_TOPOLOGY.filter(h => h.role === 'Firewall');
  const infrastructure = VICTIM_NETWORK_TOPOLOGY.filter(h => h.role === 'Infrastructure');
  const publicServers = VICTIM_NETWORK_TOPOLOGY.filter(h => h.role === 'PublicServer');
  const workstations = VICTIM_NETWORK_TOPOLOGY.filter(h => h.role === 'Workstation');

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(5, 10, 20, 0.85)',
      backdropFilter: 'blur(8px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 99999,
      padding: '1.25rem'
    }}>
      <div style={{
        backgroundColor: '#0f172a',
        border: '1px solid rgba(56, 189, 248, 0.35)',
        borderRadius: '16px',
        maxWidth: '900px',
        width: '100%',
        maxHeight: '90vh',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.9)',
        color: '#f8fafc',
        overflow: 'hidden'
      }}>
        {/* Modal Header */}
        <div style={{
          padding: '1.25rem 1.5rem',
          background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.9), rgba(15, 23, 42, 0.95))',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              background: 'rgba(56, 189, 248, 0.15)',
              border: '1px solid rgba(56, 189, 248, 0.3)',
              padding: '10px',
              borderRadius: '10px',
              display: 'flex'
            }}>
              <Network size={22} color="#38bdf8" />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800, color: '#ffffff' }}>
                Mapa Topologii Sieci Ofiary (Victim Network Infrastructure)
              </h3>
              <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                Podsieć wewnętrzna: <strong style={{ color: '#38bdf8' }}>192.168.10.0/24</strong> • Dedykowany podgląd dla Operatora SOC
              </span>
            </div>
          </div>

          <button
            onClick={onClose}
            style={{
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              color: '#94a3b8',
              padding: '6px',
              borderRadius: '8px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center'
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Modal Body */}
        <div style={{ padding: '1.5rem', overflowY: 'auto', flex: 1 }}>
          <div style={{
            background: 'rgba(56, 189, 248, 0.08)',
            border: '1px solid rgba(56, 189, 248, 0.2)',
            borderRadius: '10px',
            padding: '0.85rem 1.1rem',
            fontSize: '0.825rem',
            color: '#cbd5e1',
            marginBottom: '1.25rem',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '10px'
          }}>
            <Info size={18} color="#38bdf8" style={{ flexShrink: 0, marginTop: '2px' }} />
            <span>
              Poniższa lista zawiera tożsamości, role oraz adresy IP urządzeń wchodzących w skład chronionej infrastruktury. Wykorzystaj te dane do szybkiej identyfikacji hosta źródłowego lub docelowego podczas analizy alertów.
            </span>
          </div>

          {/* Section 1: Firewall & Gateway */}
          <div style={{ marginBottom: '1.5rem' }}>
            <h4 style={{ fontSize: '0.875rem', fontWeight: 700, color: '#f87171', marginBottom: '0.65rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Shield size={16} /> Zapora Sieciowa (Firewall & Gateway)
            </h4>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '0.75rem' }}>
              {firewalls.map((h, i) => (
                <HostCard key={i} host={h} />
              ))}
            </div>
          </div>

          {/* Section 2: Core Infrastructure */}
          <div style={{ marginBottom: '1.5rem' }}>
            <h4 style={{ fontSize: '0.875rem', fontWeight: 700, color: '#fbbf24', marginBottom: '0.65rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Lock size={16} /> Kontroler Domeny & DNS (Core Infrastructure)
            </h4>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '0.75rem' }}>
              {infrastructure.map((h, i) => (
                <HostCard key={i} host={h} />
              ))}
            </div>
          </div>

          {/* Section 3: Public Servers */}
          <div style={{ marginBottom: '1.5rem' }}>
            <h4 style={{ fontSize: '0.875rem', fontWeight: 700, color: '#38bdf8', marginBottom: '0.65rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Server size={16} /> Publiczne Serwery Usługowe (Web & App)
            </h4>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '0.75rem' }}>
              {publicServers.map((h, i) => (
                <HostCard key={i} host={h} />
              ))}
            </div>
          </div>

          {/* Section 4: Insiders / Workstations */}
          <div>
            <h4 style={{ fontSize: '0.875rem', fontWeight: 700, color: '#4ade80', marginBottom: '0.65rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Monitor size={16} /> Stacje Robocze Pracowników (Insiders)
            </h4>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '0.75rem' }}>
              {workstations.map((h, i) => (
                <HostCard key={i} host={h} />
              ))}
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div style={{
          padding: '1rem 1.5rem',
          background: '#070a12',
          borderTop: '1px solid rgba(255, 255, 255, 0.08)',
          display: 'flex',
          justifyContent: 'flex-end'
        }}>
          <button
            onClick={onClose}
            style={{
              background: 'linear-gradient(135deg, #38bdf8, #0284c7)',
              color: '#000000',
              border: 'none',
              padding: '0.55rem 1.5rem',
              borderRadius: '8px',
              fontWeight: 700,
              fontSize: '0.85rem',
              cursor: 'pointer'
            }}
          >
            Zamknij Bazę Topologii
          </button>
        </div>
      </div>
    </div>
  );
};

const HostCard: React.FC<{ host: HostInfo }> = ({ host }) => {
  return (
    <div style={{
      background: 'rgba(30, 41, 59, 0.6)',
      border: '1px solid rgba(255, 255, 255, 0.08)',
      borderRadius: '10px',
      padding: '0.75rem 0.9rem',
      display: 'flex',
      flexDirection: 'column',
      gap: '4px'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: '0.825rem', fontWeight: 700, color: '#f8fafc' }}>
          {host.name}
        </span>
        <span style={{
          fontSize: '0.65rem',
          padding: '0.1rem 0.4rem',
          borderRadius: '4px',
          fontWeight: 600,
          background: host.role === 'Firewall' ? 'rgba(239, 68, 68, 0.2)' :
                      host.role === 'Infrastructure' ? 'rgba(245, 158, 11, 0.2)' :
                      host.role === 'PublicServer' ? 'rgba(56, 189, 248, 0.2)' : 'rgba(74, 222, 128, 0.2)',
          color: host.role === 'Firewall' ? '#f87171' :
                 host.role === 'Infrastructure' ? '#fbbf24' :
                 host.role === 'PublicServer' ? '#38bdf8' : '#4ade80'
        }}>
          {host.role}
        </span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '2px' }}>
        <span className="mono" style={{ fontSize: '0.8rem', color: '#38bdf8', fontWeight: 700 }}>
          {host.ip}
        </span>
        {host.publicIp && (
          <span className="mono" style={{ fontSize: '0.725rem', color: '#94a3b8' }}>
            (Zewnętrzny: {host.publicIp})
          </span>
        )}
      </div>

      <div style={{ fontSize: '0.725rem', color: '#cbd5e1', marginTop: '2px' }}>
        <strong>System:</strong> {host.os}
      </div>
      <div style={{ fontSize: '0.675rem', color: '#64748b', marginTop: '1px' }}>
        {host.description}
      </div>
    </div>
  );
};
