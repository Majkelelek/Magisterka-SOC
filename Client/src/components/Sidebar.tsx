import React from 'react';
import { Shield, Home, Sparkles, HelpCircle, Users, LogOut, Layers, Cloud, Zap } from 'lucide-react';
import type { UserSession } from '../types/alert';
import '../styles/Sidebar.css';

export type ProviderTab = 'all' | 'openai' | 'gemini' | 'deepseek' | 'anthropic';

interface SidebarProps {
  activeTab: 'home' | 'admin-users' | 'admin-questions' | 'benchmark';
  providerTab: ProviderTab;
  onTabChange: (tab: 'home' | 'admin-users' | 'admin-questions' | 'benchmark', provider?: ProviderTab) => void;
  userSession: UserSession | null;
  onLogout: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  providerTab,
  onTabChange,
  userSession,
  onLogout,
}) => {
  if (!userSession) return null;

  const userInitial = userSession.username ? userSession.username.charAt(0).toUpperCase() : 'U';

  return (
    <aside className="soc-sidebar">
      {/* Brand Header */}
      <div className="soc-sidebar-logo" onClick={() => onTabChange('benchmark', 'all')}>
        <div className="soc-sidebar-logo-icon">
          <Shield size={22} color="#ffffff" />
        </div>
        <div className="soc-sidebar-logo-text">
          <span className="soc-sidebar-brand-name">SOC AI Platform</span>
          <span className="soc-sidebar-brand-sub">System Ewaluacji</span>
        </div>
      </div>

      {/* Navigation List */}
      <nav className="soc-sidebar-nav">
        <div className="soc-sidebar-section-label">Menu Główne</div>

        <button
          className={`soc-sidebar-link ${activeTab === 'home' ? 'active' : ''}`}
          onClick={() => onTabChange('home')}
        >
          <Home size={18} />
          <span>Dashboard</span>
        </button>

        <div className="soc-sidebar-section-label" style={{ marginTop: '1.25rem' }}>Ewaluacja Modeli AI</div>

        <button
          className={`soc-sidebar-link ${activeTab === 'benchmark' && providerTab === 'all' ? 'active' : ''}`}
          onClick={() => onTabChange('benchmark', 'all')}
        >
          <Layers size={17} color={activeTab === 'benchmark' && providerTab === 'all' ? '#ffffff' : '#38bdf8'} />
          <span>Wszystkie Modele</span>
        </button>

        <button
          className={`soc-sidebar-link ${activeTab === 'benchmark' && providerTab === 'openai' ? 'active' : ''}`}
          onClick={() => onTabChange('benchmark', 'openai')}
        >
          <Cloud size={17} color={activeTab === 'benchmark' && providerTab === 'openai' ? '#ffffff' : '#60a5fa'} />
          <span>OpenAI (Azure / GPT-4o)</span>
        </button>

        <button
          className={`soc-sidebar-link ${activeTab === 'benchmark' && providerTab === 'gemini' ? 'active' : ''}`}
          onClick={() => onTabChange('benchmark', 'gemini')}
        >
          <Sparkles size={17} color={activeTab === 'benchmark' && providerTab === 'gemini' ? '#ffffff' : '#4ade80'} />
          <span>Google Gemini (1.5 / 2.0)</span>
        </button>

        <button
          className={`soc-sidebar-link ${activeTab === 'benchmark' && providerTab === 'deepseek' ? 'active' : ''}`}
          onClick={() => onTabChange('benchmark', 'deepseek')}
        >
          <Zap size={17} color={activeTab === 'benchmark' && providerTab === 'deepseek' ? '#ffffff' : '#f87171'} />
          <span>DeepSeek (v4-flash)</span>
        </button>

        <button
          className={`soc-sidebar-link ${activeTab === 'benchmark' && providerTab === 'anthropic' ? 'active' : ''}`}
          onClick={() => onTabChange('benchmark', 'anthropic')}
        >
          <Shield size={17} color={activeTab === 'benchmark' && providerTab === 'anthropic' ? '#ffffff' : '#fb923c'} />
          <span>Anthropic (Claude 3.5)</span>
        </button>

        {userSession.role === 'Administrator' && (
          <>
            <div className="soc-sidebar-section-label" style={{ marginTop: '1.25rem' }}>Administracja</div>

            <button
              className={`soc-sidebar-link ${activeTab === 'admin-questions' ? 'active' : ''}`}
              onClick={() => onTabChange('admin-questions')}
            >
              <HelpCircle size={18} />
              <span>Zarządzanie Pytaniami</span>
            </button>

            <button
              className={`soc-sidebar-link ${activeTab === 'admin-users' ? 'active' : ''}`}
              onClick={() => onTabChange('admin-users')}
            >
              <Users size={18} />
              <span>Zarządzanie Użytkownikami</span>
            </button>
          </>
        )}
      </nav>

      {/* User Profile Card */}
      <div className="soc-sidebar-footer">
        <div className="soc-sidebar-user-card">
          <div className="soc-sidebar-avatar">
            {userInitial}
          </div>
          <div className="soc-sidebar-user-info">
            <span className="soc-sidebar-username">{userSession.username}</span>
            <span className="soc-sidebar-user-role">{userSession.role}</span>
          </div>
        </div>

        <button className="soc-sidebar-logout-btn" onClick={onLogout} title="Wyloguj operatora">
          <LogOut size={16} />
          <span>Wyloguj się</span>
        </button>
      </div>
    </aside>
  );
};
