import React from 'react';
import { ShieldAlert, Play, Clock, HelpCircle, CheckCircle2 } from 'lucide-react';

interface TestRulesModalProps {
  isOpen: boolean;
  testMode: 'NoAI' | 'WithAI';
  onStartTest: () => void;
  onClose: () => void;
}

export const TestRulesModal: React.FC<TestRulesModalProps> = ({
  isOpen,
  testMode,
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
      zIndex: 9999,
      padding: '1.5rem'
    }}>
      <div style={{
        backgroundColor: '#0f172a',
        border: '1px solid #1e293b',
        borderRadius: '16px',
        maxWidth: '650px',
        width: '100%',
        padding: '2rem',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7)',
        color: '#f8fafc'
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '1.5rem', borderBottom: '1px solid #1e293b', paddingBottom: '1rem' }}>
          <div style={{
            background: testMode === 'WithAI' ? 'rgba(168, 85, 247, 0.2)' : 'rgba(59, 130, 246, 0.2)',
            padding: '12px',
            borderRadius: '12px',
            display: 'flex'
          }}>
            <ShieldAlert size={28} color={testMode === 'WithAI' ? '#c084fc' : '#60a5fa'} />
          </div>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 700 }}>
              Instrukcja Testu Badawczego Operatora SOC
            </h2>
            <span style={{ fontSize: '0.85rem', color: '#94a3b8' }}>
              Tryb: <strong style={{ color: testMode === 'WithAI' ? '#c084fc' : '#60a5fa' }}>
                {testMode === 'WithAI' ? 'Test 2 (Wsparcie AI Copilot)' : 'Test 1 (Tradycyjny - Bez AI)'}
              </strong>
            </span>
          </div>
        </div>

        {/* Content Rules */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', fontSize: '0.925rem', lineHeight: '1.6', color: '#cbd5e1', marginBottom: '2rem' }}>
          <div style={{ display: 'flex', gap: '12px' }}>
            <Clock size={20} color="#38bdf8" style={{ flexShrink: 0, marginTop: '2px' }} />
            <div>
              <strong>Zestaw zdarzeń:</strong> Przeanalizujesz 75 wyselekcjonowanych zdarzeń z autentycznego zestawu incydentów bezpieczeństwa – od groźnych ataków po rutynowy ruch (False Positive).
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
              background: testMode === 'WithAI' ? 'linear-[#a855f7, #7c3aed]' : 'linear-[#2563eb, #1d4ed8]',
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
            <Play size={18} /> Rozpocznij Test (30 Zdarzeń)
          </button>
        </div>
      </div>
    </div>
  );
};
