import React, { useState, useEffect } from 'react';
import { Database } from 'lucide-react';
import type { UserSession } from '../types/alert';
import { getAuthStatus, type SystemHealthStatus } from '../services/api';
import '../styles/Header.css';

interface HeaderProps {
  activeTab: 'home' | 'admin-users' | 'admin-questions' | 'benchmark';
  userSession: UserSession | null;
}

export const Header: React.FC<HeaderProps> = ({ activeTab, userSession }) => {
  const [healthStatus, setHealthStatus] = useState<SystemHealthStatus>({
    isServerOnline: null,
    isConnectedToMongoDB: null,
    databaseProvider: 'Sprawdzanie...'
  });

  useEffect(() => {
    let isMounted = true;
    const checkHealth = async () => {
      const status = await getAuthStatus();
      if (isMounted) {
        setHealthStatus(status);
      }
    };

    checkHealth();
    const interval = setInterval(checkHealth, 30000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  if (!userSession) return null;

  const getTabInfo = () => {
    switch (activeTab) {
      case 'home':
        return {
          title: 'Dashboard',
          subtitle: 'Przegląd modułów i scenariuszy ewaluacyjnych SOC'
        };
      case 'benchmark':
        return {
          title: 'Czat AI & Benchmark',
          subtitle: 'Asystent SOC oparty o modele językowe oraz ewaluacja benchmarków'
        };
      case 'admin-questions':
        return {
          title: 'Zarządzanie Pytaniami',
          subtitle: 'Baza pytań scenariuszowych oraz wzorcowych danych uczących'
        };
      case 'admin-users':
        return {
          title: 'Zarządzanie Użytkownikami',
          subtitle: 'Panel administracyjny kont operatorów i uprawnień'
        };
      default:
        return {
          title: 'SOC AI Platform',
          subtitle: 'System wspomagania decyzji operatora SOC'
        };
    }
  };

  const tabInfo = getTabInfo();

  return (
    <header className="soc-top-header">
      <div className="soc-top-header-left">
        <h1 className="soc-page-title">{tabInfo.title}</h1>
        <p className="soc-page-subtitle">{tabInfo.subtitle}</p>
      </div>

      <div className="soc-top-header-right">
        {/* Backend Server Status Badge */}
        <span className={`soc-pill-badge ${healthStatus.isServerOnline === null ? 'checking' : healthStatus.isServerOnline ? 'online' : 'offline'}`}>
          <span className={`pulse-dot ${healthStatus.isServerOnline === null ? 'checking' : healthStatus.isServerOnline ? 'online' : 'offline'}`}></span>
          SERVER: {healthStatus.isServerOnline === null ? 'SPRAWDZANIE...' : healthStatus.isServerOnline ? 'ONLINE' : 'OFFLINE'}
        </span>

        {/* Database Status Badge */}
        <span className={`soc-pill-badge ${healthStatus.isConnectedToMongoDB === null ? 'checking' : healthStatus.isConnectedToMongoDB ? 'db-online' : 'offline'}`}>
          <Database size={13} />
          BAZA: {healthStatus.isConnectedToMongoDB === null ? 'SPRAWDZANIE...' : healthStatus.isConnectedToMongoDB ? 'ONLINE' : 'OFFLINE'}
        </span>
      </div>
    </header>
  );
};
