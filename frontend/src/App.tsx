import { useState } from 'react';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { DashboardPage } from './pages/DashboardPage';
import { ContentGenerationPage } from './pages/ContentGenerationPage';
import { TranslationPage } from './pages/TranslationPage';
import { HistoryPage } from './pages/HistoryPage';
import { ModelComparisonPage } from './pages/ModelComparisonPage';
import { SettingsPage } from './pages/SettingsPage';
import { OpenRouterKeyPage } from './pages/OpenRouterKeyPage';
import { TranslationComparisonPage } from './pages/TranslationComparisonPage';
import { RunDetailDrawer } from './components/RunDetailDrawer';

export function App() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    return !!sessionStorage.getItem('roso_session_token');
  });
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [activeRunDetailId, setActiveRunDetailId] = useState<string | null>(null);

  if (!isAuthenticated) {
    return <OpenRouterKeyPage onSuccess={() => setIsAuthenticated(true)} />;
  }

  const pageTitles: Record<string, string> = {
    dashboard: 'Dashboard Overview',
    generate: 'Content Generation Interface',
    history: 'History Runs & Audit Trail',
    translation: 'Strict Content Translation',
    comparison: 'Side-by-Side Generation Comparison',
    'translation-comparison': 'Translation Comparison',
    settings: 'AI / Prompt Settings Configuration'
  };

  return (
    <div className="app-container">
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
      />

      <div className="main-content">
        <Header title={pageTitles[activeTab] || 'RosoTravel AI POC'} />

        <main className="content-body">
          {activeTab === 'dashboard' && (
            <DashboardPage onNavigateToHistory={() => setActiveTab('history')} />
          )}

          {activeTab === 'generate' && <ContentGenerationPage />}

          {activeTab === 'translation' && <TranslationPage />}

          {activeTab === 'history' && <HistoryPage />}

          {activeTab === 'comparison' && <ModelComparisonPage />}
          
          {activeTab === 'translation-comparison' && <TranslationComparisonPage />}

          {activeTab === 'settings' && <SettingsPage />}
        </main>
      </div>

      {activeRunDetailId && (
        <RunDetailDrawer
          runId={activeRunDetailId}
          onClose={() => setActiveRunDetailId(null)}
        />
      )}
    </div>
  );
}

export default App;
