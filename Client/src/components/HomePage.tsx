import React from 'react';
import { Shield, Eye, Bot, Play, Layers, Cpu } from 'lucide-react';
import '../styles/HomePage.css';

interface HomePageProps {
  onNavigate: (tab: 'no-ai' | 'with-ai') => void;
}

export const HomePage: React.FC<HomePageProps> = ({ onNavigate }) => {
  return (
    <div className="home-container">
      {/* Hero Welcome Banner */}
      <div className="soc-card home-hero-card">
        <div className="home-hero-glow" />

        <div className="home-hero-content">
          <div className="home-hero-text-box">
            <div className="home-badge-pill">
              <Shield size={14} /> SYSTEM EWALUACJI OPERATORA SOC
            </div>

            <h1 className="home-hero-title">
              Platforma Badawcza Analizy Zgłoszeń Bezpieczeństwa
            </h1>

            <p className="home-hero-desc">
              Aplikacja stworzona na potrzeby pracy magisterskiej. Służy do przeprowadzenia obiektywnych pomiarów porównawczych czasu reakcji, trafności decyzji i efektywności pracy analityka SOC w trybie tradycyjnym oraz ze wsparciem Asystenta AI.
            </p>
          </div>
        </div>
      </div>

      {/* Mode Selection Heading */}
      <div className="home-section-title-box">
        <Layers size={20} color="var(--accent-blue)" />
        <h2 className="home-section-title">
          Wybierz Scenariusz Testowy:
        </h2>
      </div>

      {/* Cards Grid */}
      <div className="home-cards-grid">
        {/* Test 1 Card */}
        <div className="soc-card home-scenario-card">
          <div>
            <div className="home-card-header">
              <div className="home-card-icon-wrapper test-no-ai">
                <Eye size={26} />
              </div>
              <span className="mono home-card-badge test-no-ai">
                TRYB TRADYCYJNY
              </span>
            </div>

            <h3 className="home-card-title">
              Test 1: Praca z Alertami (Bez AI)
            </h3>

            <p className="home-card-desc">
              Standardowy interfejs analityka SOC. Zadaniem operatora jest samodzielna weryfikacja logów zdarzeń, identyfikacja taktyk MITRE ATT&CK oraz podjęcie manualnych akcji naprawczych.
            </p>
          </div>

          <button
            className="btn-action home-btn-test1"
            onClick={() => onNavigate('no-ai')}
          >
            <Play size={16} /> Rozpocznij Test 1 (Bez AI)
          </button>
        </div>

        {/* Test 2 Card */}
        <div className="soc-card home-scenario-card">
          <div>
            <div className="home-card-header">
              <div className="home-card-icon-wrapper test-with-ai">
                <Cpu size={26} />
              </div>
              <span className="mono home-card-badge test-with-ai">
                TRYB WZBOGACONY AI
              </span>
            </div>

            <h3 className="home-card-title">
              Test 2: Praca z Alertami (Z AI)
            </h3>

            <p className="home-card-desc">
              Pulpit wspierany przez moduł Asystenta AI. Zawiera automatyczne wygenerowane analizy przyczyn źródłowych, rekomendowane akcje 1-Click oraz czat ze wsparciem silnika LLM.
            </p>
          </div>

          <button
            className="btn-action btn-ai-primary home-btn-test2"
            onClick={() => onNavigate('with-ai')}
          >
            <Bot size={16} /> Rozpocznij Test 2 (Z AI)
          </button>
        </div>
      </div>
    </div>
  );
};
