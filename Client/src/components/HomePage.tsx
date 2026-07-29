import React from 'react';
import { Shield, Eye, Bot, Play, Server, Layers, Cpu } from 'lucide-react';

interface HomePageProps {
  onNavigate: (tab: 'no-ai' | 'with-ai') => void;
  alertCount: number;
}

export const HomePage: React.FC<HomePageProps> = ({ onNavigate, alertCount }) => {
  return (
    <div style={{ width: '100%', padding: '1rem 0' }}>
      {/* Hero Welcome Banner */}
      <div className="soc-card" style={{
        padding: '3rem 2.5rem',
        marginBottom: '2.5rem',
        background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.95), rgba(7, 10, 18, 0.95))',
        border: '1px solid rgba(56, 189, 248, 0.2)',
        position: 'relative',
        overflow: 'hidden'
      }}>
        <div style={{
          position: 'absolute',
          top: '-50px',
          right: '-50px',
          width: '250px',
          height: '250px',
          background: 'radial-gradient(circle, rgba(6, 182, 212, 0.15) 0%, rgba(0,0,0,0) 70%)',
          pointerEvents: 'none'
        }} />

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '2rem' }}>
          <div style={{ flex: 1, minWidth: '320px' }}>
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              background: 'rgba(6, 182, 212, 0.1)',
              border: '1px solid rgba(6, 182, 212, 0.25)',
              color: 'var(--ai-cyan)',
              padding: '0.3rem 0.8rem',
              borderRadius: '20px',
              fontSize: '0.775rem',
              fontWeight: 600,
              letterSpacing: '0.5px',
              marginBottom: '1.25rem'
            }}>
              <Shield size={14} /> SYSTEM EWALUACJI OPERATORA SOC
            </div>

            <h1 style={{ fontSize: '2.25rem', fontWeight: 800, color: '#ffffff', marginBottom: '0.85rem', lineHeight: '1.2' }}>
              Platforma Badawcza Analizy Zgłoszeń Bezpieczeństwa
            </h1>

            <p style={{ color: 'var(--text-muted)', fontSize: '0.975rem', lineHeight: '1.6', maxWidth: '780px' }}>
              Aplikacja stworzona na potrzeby pracy magisterskiej. Służy do przeprowadzenia obiektywnych pomiarów porównawczych czasu reakcji, trafności decyzji i efektywności pracy analityka SOC w trybie tradycyjnym oraz ze wsparciem Asystenta AI.
            </p>
          </div>
        </div>
      </div>

      {/* Mode Selection Heading */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1.25rem' }}>
        <Layers size={20} color="var(--accent-blue)" />
        <h2 style={{ fontSize: '1.25rem', color: '#ffffff', fontWeight: 700 }}>
          Wybierz Scenariusz Testowy:
        </h2>
      </div>

      {/* Cards Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: '1.75rem' }}>
        {/* Test 1 Card */}
        <div className="soc-card" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <div style={{ background: 'rgba(59, 130, 246, 0.12)', color: '#60a5fa', padding: '0.75rem', borderRadius: '10px', border: '1px solid rgba(59, 130, 246, 0.25)' }}>
                <Eye size={26} />
              </div>
              <span className="mono" style={{ fontSize: '0.725rem', color: 'var(--text-muted)', background: 'rgba(0,0,0,0.4)', padding: '0.25rem 0.6rem', borderRadius: '4px', border: '1px solid var(--border-color)' }}>
                TRYB TRADYCYJNY
              </span>
            </div>

            <h3 style={{ fontSize: '1.35rem', fontWeight: 700, color: '#ffffff', marginBottom: '0.65rem' }}>
              Test 1: Praca z Alertami (Bez AI)
            </h3>

            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', lineHeight: '1.6', marginBottom: '1.75rem' }}>
              Standardowy interfejs analityka SOC. Zadaniem operatora jest samodzielna weryfikacja logów zdarzeń, identyfikacja taktyk MITRE ATT&CK oraz podjęcie manualnych akcji naprawczych.
            </p>
          </div>

          <button
            className="btn-action"
            style={{
              width: '100%',
              justifyContent: 'center',
              padding: '0.85rem',
              background: 'rgba(59, 130, 246, 0.15)',
              border: '1px solid rgba(59, 130, 246, 0.35)',
              color: '#60a5fa',
              fontSize: '0.925rem',
              fontWeight: 600
            }}
            onClick={() => onNavigate('no-ai')}
          >
            <Play size={16} /> Rozpocznij Test 1 (Bez AI)
          </button>
        </div>

        {/* Test 2 Card */}
        <div className="soc-card" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <div style={{ background: 'rgba(6, 182, 212, 0.12)', color: 'var(--ai-cyan)', padding: '0.75rem', borderRadius: '10px', border: '1px solid rgba(6, 182, 212, 0.25)' }}>
                <Cpu size={26} />
              </div>
              <span className="mono" style={{ fontSize: '0.725rem', color: 'var(--ai-cyan)', background: 'rgba(6, 182, 212, 0.1)', padding: '0.25rem 0.6rem', borderRadius: '4px', border: '1px solid rgba(6, 182, 212, 0.25)' }}>
                TRYB WZBOGACONY AI
              </span>
            </div>

            <h3 style={{ fontSize: '1.35rem', fontWeight: 700, color: '#ffffff', marginBottom: '0.65rem' }}>
              Test 2: Praca z Alertami (Z AI)
            </h3>

            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', lineHeight: '1.6', marginBottom: '1.75rem' }}>
              Pulpit wspierany przez moduł Asystenta AI. Zawiera automatyczne wygenerowane analizy przyczyn źródłowych, rekomendowane akcje 1-Click oraz czat ze wsparciem silnika LLM.
            </p>
          </div>

          <button
            className="btn-action btn-ai-primary"
            style={{
              width: '100%',
              justifyContent: 'center',
              padding: '0.85rem',
              fontSize: '0.925rem',
              fontWeight: 600
            }}
            onClick={() => onNavigate('with-ai')}
          >
            <Bot size={16} /> Rozpocznij Test 2 (Z AI)
          </button>
        </div>
      </div>
    </div>
  );
};
