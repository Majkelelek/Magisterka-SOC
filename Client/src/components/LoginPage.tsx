import React, { useState } from 'react';
import { loginUser } from '../services/api';
import type { UserSession } from '../types/alert';
import { Shield, Lock, User, LogIn, AlertCircle } from 'lucide-react';
import '../styles/LoginPage.css';

interface LoginPageProps {
  onLoginSuccess: (session: UserSession) => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onLoginSuccess }) => {
  // Form State
  const [username, setUsername] = useState<string>('');
  const [password, setPassword] = useState<string>('');

  // UI State
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) return;

    setErrorMsg(null);
    setLoading(true);

    const result = await loginUser(username, password);
    setLoading(false);

    if ('error' in result) {
      setErrorMsg(result.error);
    } else {
      onLoginSuccess(result);
    }
  };

  return (
    <div className="login-page-wrapper">
      <div className="soc-card login-card">
        {/* Header Branding */}
        <div className="login-branding">
          <div className="login-icon-box">
            <Shield size={30} />
          </div>

          <h2 className="login-title">
            SOC SENTINEL AUTHENTICATION
          </h2>
        </div>

        {/* Header Title */}
        <div className="login-header-sub">
          <LogIn size={18} color="var(--ai-cyan)" />
          <span>Panel Logowania Operatora SOC</span>
        </div>

        {/* Form Area */}
        <div className="login-form-box">
          {errorMsg && (
            <div className="login-error-alert">
              <AlertCircle size={16} />
              <span>{errorMsg}</span>
            </div>
          )}

          <form onSubmit={handleLoginSubmit}>
            <div className="login-input-group">
              <label className="login-label">
                Nazwa Użytkownika / Operatora
              </label>
              <div className="login-input-wrapper">
                <User size={16} className="login-input-icon" />
                <input
                  type="text"
                  required
                  placeholder="Wpisz nazwę użytkownika..."
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="login-input-field"
                />
              </div>
            </div>

            <div className="login-input-group last">
              <label className="login-label">
                Hasło
              </label>
              <div className="login-input-wrapper">
                <Lock size={16} className="login-input-icon" />
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="login-input-field"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-action btn-ai-primary login-submit-btn"
            >
              {loading ? 'Autoryzowanie...' : 'Zaloguj do Konsoli SOC'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
