export interface HostInfo {
  ip: string;
  publicIp?: string;
  name: string;
  role: 'Infrastructure' | 'PublicServer' | 'Workstation' | 'Firewall';
  os: string;
  description: string;
}

export const VICTIM_NETWORK_TOPOLOGY: HostInfo[] = [
  // Firewall & Gateways
  {
    ip: '172.16.0.1',
    publicIp: '205.174.165.80',
    name: 'Firewall Brzegowy (PFW-01)',
    role: 'Firewall',
    os: 'Enterprise Gateway OS',
    description: 'Zapora sieciowa brzegowa chroniąca podsieć wewnętrzną 192.168.10.0/24'
  },
  // Core Infrastructure
  {
    ip: '192.168.10.3',
    name: 'DNS + DC Server (DC-01)',
    role: 'Infrastructure',
    os: 'Windows Server 2012 R2',
    description: 'Główny kontroler domeny Active Directory oraz serwer nazewnictwa DNS'
  },
  // Public Servers
  {
    ip: '192.168.10.50',
    publicIp: '205.174.165.68',
    name: 'Web Server 16 Public (WEB-SRV-01)',
    role: 'PublicServer',
    os: 'Windows Server 2016 (IIS)',
    description: 'Publiczny serwer aplikacji webowych IIS udostępniony w Internecie'
  },
  {
    ip: '192.168.10.51',
    publicIp: '205.174.165.66',
    name: 'Ubuntu Server 12 Public (UBUNTU-SRV-02)',
    role: 'PublicServer',
    os: 'Ubuntu Server 12.04 LTS (Apache)',
    description: 'Publiczny serwer Linuksowy świadczący usługi portalowe'
  },
  // Workstations - Windows
  {
    ip: '192.168.10.15',
    name: 'Win 10 Pro 64-bit (WS-WIN10-64)',
    role: 'Workstation',
    os: 'Windows 10 Pro (64-bit)',
    description: 'Stacja robocza pracownika biurowego'
  },
  {
    ip: '192.168.10.14',
    name: 'Win 10 Pro 32-bit (WS-WIN10-32)',
    role: 'Workstation',
    os: 'Windows 10 Pro (32-bit)',
    description: 'Stacja robocza działu obsługi klienta'
  },
  {
    ip: '192.168.10.9',
    name: 'Win 7 Pro 64-bit (WS-WIN7-64)',
    role: 'Workstation',
    os: 'Windows 7 Professional (64-bit)',
    description: 'Stacja robocza starszej generacji'
  },
  {
    ip: '192.168.10.5',
    name: 'Win 8.1 64-bit (WS-WIN8-64)',
    role: 'Workstation',
    os: 'Windows 8.1 Enterprise (64-bit)',
    description: 'Stacja robocza analityka finansowego'
  },
  {
    ip: '192.168.10.8',
    name: 'Win Vista 64-bit (WS-VISTA-64)',
    role: 'Workstation',
    os: 'Windows Vista Business (64-bit)',
    description: 'Legacy stacja testowa'
  },
  // Workstations - Linux & Mac
  {
    ip: '192.168.10.25',
    name: 'Mac OS Workstation (MAC-DEV-01)',
    role: 'Workstation',
    os: 'macOS High Sierra',
    description: 'Stacja robocza dewelopera aplikacji'
  },
  {
    ip: '192.168.10.12',
    name: 'Ubuntu 16.04 64-bit (WS-UBUNTU16-64)',
    role: 'Workstation',
    os: 'Ubuntu Desktop 16.04 (64-bit)',
    description: 'Stacja robocza inżyniera DevOps'
  },
  {
    ip: '192.168.10.16',
    name: 'Ubuntu 16.04 32-bit (WS-UBUNTU16-32)',
    role: 'Workstation',
    os: 'Ubuntu Desktop 16.04 (32-bit)',
    description: 'Stacja laboratoryjna R&D'
  },
  {
    ip: '192.168.10.17',
    name: 'Ubuntu 14.04 64-bit (WS-UBUNTU14-64)',
    role: 'Workstation',
    os: 'Ubuntu Desktop 14.04 (64-bit)',
    description: 'Stacja testowa systemów wbudowanych'
  },
  {
    ip: '192.168.10.19',
    name: 'Ubuntu 14.04 32-bit (WS-UBUNTU14-32)',
    role: 'Workstation',
    os: 'Ubuntu Desktop 14.04 (32-bit)',
    description: 'Stacja testowa narzędzi legacy'
  }
];

export function getHostInfoByIp(ip: string): HostInfo | undefined {
  return VICTIM_NETWORK_TOPOLOGY.find(h => h.ip === ip || h.publicIp === ip);
}
