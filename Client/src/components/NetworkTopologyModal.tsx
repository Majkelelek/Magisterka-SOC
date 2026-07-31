import React, { useEffect } from 'react';
import { X, Server, Shield, Monitor, Network, Lock, Info } from 'lucide-react';
import { VICTIM_NETWORK_TOPOLOGY, type HostInfo } from '../data/networkTopology';
import '../styles/NetworkTopologyModal.css';

interface NetworkTopologyModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const NetworkTopologyModal: React.FC<NetworkTopologyModalProps> = ({ isOpen, onClose }) => {
  // Keydown listener to close modal on ESC key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const firewalls = VICTIM_NETWORK_TOPOLOGY.filter(h => h.role === 'Firewall');
  const infrastructure = VICTIM_NETWORK_TOPOLOGY.filter(h => h.role === 'Infrastructure');
  const publicServers = VICTIM_NETWORK_TOPOLOGY.filter(h => h.role === 'PublicServer');
  const workstations = VICTIM_NETWORK_TOPOLOGY.filter(h => h.role === 'Workstation');

  return (
    <div
      onClick={onClose}
      className="network-topology-overlay"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="network-topology-container"
      >
        {/* Modal Header */}
        <div className="network-topology-header">
          <div className="network-topology-header-left">
            <div className="network-topology-icon-box">
              <Network size={22} color="#38bdf8" />
            </div>
            <div>
              <h3 className="network-topology-title">
                Mapa Topologii Sieci Ofiary (Victim Network Infrastructure)
              </h3>
              <span className="network-topology-subtitle">
                Podsieć wewnętrzna: <strong className="network-topology-ip-highlight">192.168.10.0/24</strong> • Dedykowany podgląd dla Operatora SOC
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="network-topology-close-btn"
          >
            <X size={20} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="network-topology-body">
          <div className="network-topology-info-alert">
            <Info size={18} color="#38bdf8" className="network-topology-info-icon" />
            <span>
              Poniższa lista zawiera tożsamości, role oraz adresy IP urządzeń wchodzących w skład chronionej infrastruktury. Wykorzystaj te dane do szybkiej identyfikacji hosta źródłowego lub docelowego podczas analizy alertów.
            </span>
          </div>

          {/* Section 1: Firewall & Gateway */}
          <div className="network-topology-section">
            <h4 className="network-topology-section-title firewall">
              <Shield size={16} /> Zapora Sieciowa (Firewall & Gateway)
            </h4>
            <div className="network-topology-grid">
              {firewalls.map((h, i) => (
                <HostCard key={i} host={h} />
              ))}
            </div>
          </div>

          {/* Section 2: Core Infrastructure */}
          <div className="network-topology-section">
            <h4 className="network-topology-section-title infrastructure">
              <Lock size={16} /> Kontroler Domeny & DNS (Core Infrastructure)
            </h4>
            <div className="network-topology-grid">
              {infrastructure.map((h, i) => (
                <HostCard key={i} host={h} />
              ))}
            </div>
          </div>

          {/* Section 3: Public Servers */}
          <div className="network-topology-section">
            <h4 className="network-topology-section-title public-server">
              <Server size={16} /> Publiczne Serwery Usługowe (Web & App)
            </h4>
            <div className="network-topology-grid">
              {publicServers.map((h, i) => (
                <HostCard key={i} host={h} />
              ))}
            </div>
          </div>

          {/* Section 4: Insiders / Workstations */}
          <div className="network-topology-section last">
            <h4 className="network-topology-section-title workstation">
              <Monitor size={16} /> Stacje Robocze Pracowników (Insiders)
            </h4>
            <div className="network-topology-grid workstations">
              {workstations.map((h, i) => (
                <HostCard key={i} host={h} />
              ))}
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="network-topology-footer">
          <button
            type="button"
            onClick={onClose}
            className="network-topology-footer-close-btn"
          >
            Zamknij Bazę Topologii
          </button>
        </div>
      </div>
    </div>
  );
};

const HostCard: React.FC<{ host: HostInfo }> = ({ host }) => {
  const getBadgeClass = (role: string) => {
    switch (role) {
      case 'Firewall': return 'role-firewall';
      case 'Infrastructure': return 'role-infrastructure';
      case 'PublicServer': return 'role-public-server';
      default: return 'role-workstation';
    }
  };

  return (
    <div className="host-card">
      <div className="host-card-header">
        <span className="host-card-name">
          {host.name}
        </span>
        <span className={`host-card-role-badge ${getBadgeClass(host.role)}`}>
          {host.role}
        </span>
      </div>

      <div className="host-card-ip-row">
        <span className="mono host-card-ip">
          {host.ip}
        </span>
        {host.publicIp && (
          <span className="mono host-card-public-ip">
            (Zewnętrzny: {host.publicIp})
          </span>
        )}
      </div>

      <div className="host-card-os">
        <strong>System:</strong> {host.os}
      </div>
      <div className="host-card-desc">
        {host.description}
      </div>
    </div>
  );
};
