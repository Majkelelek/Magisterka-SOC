import React from 'react';
import { ShieldAlert, Play, Clock, HelpCircle, CheckCircle2 } from 'lucide-react';
import '../styles/TestRulesModal.css';

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

  const modeClass = testMode === 'WithAI' ? 'mode-with-ai' : 'mode-no-ai';

  return (
    <div className="test-rules-overlay">
      <div className="soc-card test-rules-card">
        {/* Header */}
        <div className="test-rules-header">
          <div className={`test-rules-icon-box ${modeClass}`}>
            <ShieldAlert size={28} color={testMode === 'WithAI' ? '#c084fc' : '#60a5fa'} />
          </div>
          <div>
            <h2 className="test-rules-title">
              Instrukcja i Zasady Testu
            </h2>
            <span className="test-rules-subtitle">
              Tryb: <strong className={`test-rules-mode-text ${modeClass}`}>
                {testMode === 'WithAI' ? 'Test 2 (Z AI)' : 'Test 1 (Tradycyjny - Bez AI)'}
              </strong>
            </span>
          </div>
        </div>

        {/* Content Rules */}
        <div className="test-rules-content">
          <div className="test-rules-item">
            <Clock size={20} color="#38bdf8" className="test-rules-item-icon" />
            <div>
              <strong>Zestaw zdarzeń:</strong> Przeanalizujesz {alertCount} wyselekcjonowanych zdarzeń z autentycznego zestawu incydentów bezpieczeństwa – od groźnych ataków po rutynowy ruch (False Positive).
            </div>
          </div>

          <div className="test-rules-item">
            <HelpCircle size={20} color="#fbbf24" className="test-rules-item-icon" />
            <div>
              <strong>Brak natychmiastowych podpowiedzi:</strong> Podczas testu aplikacja <u>nie będzie pokazywać</u>, czy Twoja odpowiedź była poprawna czy błędna. Wynik pozna Administrator po zakończeniu próby.
            </div>
          </div>

          <div className="test-rules-item">
            <CheckCircle2 size={20} color="#4ade80" className="test-rules-item-icon" />
            <div>
              <strong>Automatyczny postęp:</strong> Po wybraniu reakcji dla danego alertu, zgłoszenie znika i aplikacja automatycznie ładuje kolejny przypadek.
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="test-rules-actions">
          <button
            onClick={onClose}
            className="test-rules-btn-cancel"
          >
            Anuluj
          </button>
          <button
            onClick={onStartTest}
            className={`test-rules-btn-start ${modeClass}`}
          >
            <Play size={18} /> Rozpocznij Test ({alertCount} Zdarzeń)
          </button>
        </div>
      </div>
    </div>
  );
};
