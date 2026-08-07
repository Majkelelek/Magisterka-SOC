import React from 'react';
import { Shield, Sparkles, Play, Layers, HelpCircle } from 'lucide-react';
import '../styles/HomePage.css';

interface HomePageProps {
  onNavigate: (tab: 'benchmark' | 'admin-questions') => void;
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
              <Shield size={14} /> SYSTEM EWALUACJI I BENCHMARKU MODELI AI SOC
            </div>

            <h1 className="home-hero-title">
              Platforma Badawcza Ewaluacji AI w Cyberbezpieczeństwie
            </h1>

            <p className="home-hero-desc">
              Aplikacja stworzona na potrzeby pracy magisterskiej. Służy do przeprowadzania automatycznej ewaluacji i benchmarku modeli językowych (LLM / SLM) w zadaniach analizy alertów SOC, klasyfikacji zagrożeń oraz rekomendacji akcji zaradczych.
            </p>
          </div>
        </div>
      </div>

      {/* Mode Selection Heading */}
      <div className="home-section-title-box">
        <Layers size={20} color="var(--accent-blue)" />
        <h2 className="home-section-title">
          Główne Moduły Systemu:
        </h2>
      </div>

      {/* Cards Grid */}
      <div className="home-cards-grid">
        {/* Benchmark Evaluation Card */}
        <div className="soc-card home-scenario-card">
          <div>
            <div className="home-card-header">
              <div className="home-card-icon-wrapper test-with-ai">
                <Sparkles size={26} color="#a855f7" />
              </div>
              <span className="mono home-card-badge test-with-ai">
                BENCHMARK LLM / SLM
              </span>
            </div>

            <h3 className="home-card-title">
              Ewaluacja AI (Benchmark)
            </h3>

            <p className="home-card-desc">
              Automatyczny moduł testowania dostawców AI (Azure OpenAI, Google Gemini, DeepSeek, Anthropic Claude). Oblicza dokładność detekcji (Accuracy), Precision, Recall, F1-Score oraz średnią latencję z opcją eksportu wyników do CSV/Excel.
            </p>
          </div>

          <button
            className="btn-action btn-ai-primary home-btn-test2"
            onClick={() => onNavigate('benchmark')}
          >
            <Play size={16} /> Przejdź do Ewaluacji AI
          </button>
        </div>

        {/* Question Set Card */}
        <div className="soc-card home-scenario-card">
          <div>
            <div className="home-card-header">
              <div className="home-card-icon-wrapper test-no-ai">
                <HelpCircle size={26} color="#38bdf8" />
              </div>
              <span className="mono home-card-badge test-no-ai">
                ZBIÓR DANYCH TESTOWYCH
              </span>
            </div>

            <h3 className="home-card-title">
              Zarządzanie Zbiorem Pytań Testowych
            </h3>

            <p className="home-card-desc">
              Zarządzaj pytaniami testowymi w bazie MongoDB Atlas, edytuj etykiety Ground Truth (Atak vs Ruch Prawidłowy), dodawaj próbki ataków oraz sprawdzaj spójność kategorii.
            </p>
          </div>

          <button
            className="btn-action home-btn-test1"
            onClick={() => onNavigate('admin-questions')}
          >
            <HelpCircle size={16} /> Zarządzaj Pytaniami
          </button>
        </div>
      </div>
    </div>
  );
};
