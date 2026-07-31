import React, { useState } from 'react';
import { loginUser } from '../services/api';
import type { UserSession } from '../types/alert';
import { Shield, Lock, User, LogIn, AlertCircle } from 'lucide-react';

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
    <div style={{
      minHeight: '85vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '2rem 1rem'
    }}>
      <div className="soc-card" style={{
        width: '100%',
        maxWidth: '440px',
        background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.95), rgba(9, 13, 22, 0.98))',
        border: '1px solid rgba(56, 189, 248, 0.25)',
        boxShadow: '0 20px 50px rgba(0, 0, 0, 0.6)',
        borderRadius: '16px',
        overflow: 'hidden'
      }}>
        {/* Header Branding */}
        <div style={{
          padding: '2.25rem 2rem 1.75rem 2rem',
          textAlign: 'center',
          borderBottom: '1px solid var(--border-color)',
          background: 'rgba(0,0,0,0.3)'
        }}>
          <div style={{
            width: '56px',
            height: '56px',
            borderRadius: '14px',
            background: 'linear-gradient(135deg, #0284c7, #0891b2)',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'white',
            marginBottom: '1rem',
            boxShadow: '0 0 20px rgba(6, 182, 212, 0.4)'
          }}>
            <Shield size={30} />
          </div>

          <h2 style={{ fontSize: '1.45rem', fontWeight: 800, color: '#ffffff', marginBottom: '0.35rem' }}>
            SOC SENTINEL AUTHENTICATION
          </h2>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: 0 }}>
          </p>
        </div>

        {/* Header Title */}
        <div style={{
          padding: '0.85rem 1.75rem',
          background: 'rgba(0,0,0,0.2)',
          borderBottom: '1px solid var(--border-color)',
          fontSize: '0.875rem',
          fontWeight: 700,
          color: '#ffffff',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <LogIn size={18} color="var(--ai-cyan)" />
          <span>Panel Logowania Operatora SOC</span>
        </div>

        {/* Form Area */}
        <div style={{ padding: '1.75rem' }}>
          {errorMsg && (
            <div style={{
              background: 'rgba(239, 68, 68, 0.15)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              color: '#f87171',
              padding: '0.65rem 0.85rem',
              borderRadius: '8px',
              marginBottom: '1.25rem',
              fontSize: '0.825rem',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <AlertCircle size={16} />
              <span>{errorMsg}</span>
            </div>
          )}

          <form onSubmit={handleLoginSubmit}>
            <div style={{ marginBottom: '1.25rem' }}>
              <label style={{ display: 'block', fontSize: '0.775rem', color: 'var(--text-muted)', marginBottom: '0.4rem', fontWeight: 500 }}>
                Nazwa Użytkownika / Operatora
              </label>
              <div style={{ position: 'relative' }}>
                <User size={16} style={{ position: 'absolute', left: '12px', top: '12px', color: 'var(--text-muted)' }} />
                <input
                  type="text"
                  required
                  placeholder="Wpisz nazwę użytkownika..."
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  style={{
                    width: '100%',
                    background: '#161e2e',
                    border: '1px solid var(--border-color)',
                    color: 'white',
                    padding: '0.65rem 0.75rem 0.65rem 2.4rem',
                    borderRadius: '8px',
                    fontSize: '0.875rem'
                  }}
                />
              </div>
            </div>

            <div style={{ marginBottom: '1.75rem' }}>
              <label style={{ display: 'block', fontSize: '0.775rem', color: 'var(--text-muted)', marginBottom: '0.4rem', fontWeight: 500 }}>
                Hasło
              </label>
              <div style={{ position: 'relative' }}>
                <Lock size={16} style={{ position: 'absolute', left: '12px', top: '12px', color: 'var(--text-muted)' }} />
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  style={{
                    width: '100%',
                    background: '#161e2e',
                    border: '1px solid var(--border-color)',
                    color: 'white',
                    padding: '0.65rem 0.75rem 0.65rem 2.4rem',
                    borderRadius: '8px',
                    fontSize: '0.875rem'
                  }}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-action btn-ai-primary"
              style={{
                width: '100%',
                justifyContent: 'center',
                padding: '0.8rem',
                fontSize: '0.9rem',
                fontWeight: 600
              }}
            >
              {loading ? 'Autoryzowanie...' : 'Zaloguj do Konsoli SOC'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
