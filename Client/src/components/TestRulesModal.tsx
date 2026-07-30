import React from 'react';
import { ShieldAlert, Play, Clock, HelpCircle, CheckCircle2 } from 'lucide-react';

interface TestRulesModalProps {
  isOpen: boolean;
  testMode: 'NoAI' | 'WithAI';
  alertCount?: number;
  onStartTest: () => void;
  onClose: () => void;
}

export const TestRulesModal: React.FC<TestRulesModalProps> = ({
  isOpen,
  testMode,
  alertCount = 20,
  onStartTest,
  onClose
}) => {
  if (!isOpen) return null;

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
      zIndex: 1000
    }}>
      <div className="soc-card" style={{
        width: '100%',
        maxWidth: '560px',
        padding: '2rem',
        background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.98), rgba(7, 10, 18, 0.99))',
        border: '1px solid rgba(56, 189, 248, 0.3)',
        borderRadius: '16px',
        boxShadow: '0 20px 50px rgba(0, 0, 0, 0.6)'
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '1.5rem', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '1rem' }}>
          <div style={{
            background: testMode === 'WithAI' ? 'rgba(168, 85, 247, 0.2)' : 'rgba(37, 99, 235, 0.2)',
            padding: '10px',
            borderRadius: '12px',
            border: testMode === 'WithAI' ? '1px solid rgba(168, 85, 247, 0.4)' : '1px solid rgba(37, 99, 235, 0.4)'
          }}>
            <ShieldAlert size={28} color={testMode === 'WithAI' ? '#c084fc' : '#60a5fa'} />
          </div>
          <div>
            <h2 style={{ fontSize: '1.35rem', fontWeight: 800, color: '#ffffff', margin: 0 }}>
              Instrukcja i Zasady Testu
            </h2>
            <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
              Tryb: <strong style={{ color: testMode === 'WithAI' ? '#c084fc' : '#60a5fa' }}>
                {testMode === 'WithAI' ? 'Test 2 (Z AI)' : 'Test 1 (Tradycyjny - Bez AI)'}
              </strong>
            </span>
          </div>
        </div>

        {/* Content Rules */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', fontSize: '0.925rem', lineHeight: '1.6', color: '#cbd5e1', marginBottom: '2rem' }}>
          <div style={{ display: 'flex', gap: '12px' }}>
            <Clock size={20} color="#38bdf8" style={{ flexShrink: 0, marginTop: '2px' }} />
            <div>
              <strong>Zestaw zdarzeń:</strong> Przeanalizujesz {alertCount} wyselekcjonowanych zdarzeń z autentycznego zestawu incydentów bezpieczeństwa – od groźnych ataków po rutynowy ruch (False Positive).
            </div>
          </div>

          <div style={{ display: 'flex', gap: '12px' }}>
            <HelpCircle size={20} color="#fbbf24" style={{ flexShrink: 0, marginTop: '2px' }} />
            <div>
              <strong>Brak natychmiastowych podpowiedzi:</strong> Podczas testu aplikacja <u>nie będzie pokazywać</u>, czy Twoja odpowiedź była poprawna czy błędna. Wynik pozna Administrator po zakończeniu próby.
            </div>
          </div>

          <div style={{ display: 'flex', gap: '12px' }}>
            <CheckCircle2 size={20} color="#4ade80" style={{ flexShrink: 0, marginTop: '2px' }} />
            <div>
              <strong>Automatyczny postęp:</strong> Po wybraniu reakcji dla danego alertu, zgłoszenie znika i aplikacja automatycznie ładuje kolejny przypadek.
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: '1px solid #334155',
              color: '#94a3b8',
              padding: '0.75rem 1.25rem',
              borderRadius: '8px',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: '0.9rem'
            }}
          >
            Anuluj
          </button>
          <button
            onClick={onStartTest}
            style={{
              backgroundColor: testMode === 'WithAI' ? '#8b5cf6' : '#2563eb',
              color: 'white',
              border: 'none',
              padding: '0.75rem 1.75rem',
              borderRadius: '8px',
              cursor: 'pointer',
              fontWeight: 700,
              fontSize: '0.95rem',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              boxShadow: '0 4px 14px rgba(37, 99, 235, 0.4)'
            }}
          >
            <Play size={18} /> Rozpocznij Test ({alertCount} Zdarzeń)
          </button>
        </div>
      </div>
    </div>
  );
};
