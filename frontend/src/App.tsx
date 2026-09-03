import { useState } from 'react';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { DashboardPage } from './pages/DashboardPage';
import { ContentGenerationPage } from './pages/ContentGenerationPage';
import { HistoryPage } from './pages/HistoryPage';
import { ModelComparisonPage } from './pages/ModelComparisonPage';
import { SettingsPage } from './pages/SettingsPage';
import { RunDetailDrawer } from './components/RunDetailDrawer';

export function App() {
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [activeRunDetailId, setActiveRunDetailId] = useState<string | null>(null);

  const pageTitles: Record<string, string> = {
    dashboard: 'Dashboard Overview',
    generate: 'Content Generation Interface',
    history: 'History Runs & Audit Trail',
    comparison: 'Side-by-Side Model Comparison',
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

          {activeTab === 'history' && <HistoryPage />}

          {activeTab === 'comparison' && <ModelComparisonPage />}

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
