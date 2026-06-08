import React, { useEffect } from 'react';
import { useDemoStore } from './store/demoStore';
import { Sidebar } from './components/Sidebar';
import { Topbar } from './components/Topbar';
import { ExecutiveOverview } from './components/ExecutiveOverview';
import { PipelineOperations } from './components/PipelineOperations';
import { DataQuality } from './components/DataQuality';
import { DataLakeExplorer } from './components/DataLakeExplorer';
import { MDMDashboard } from './components/MDMDashboard';
import { AnalyticsReporting } from './components/AnalyticsReporting';
import { AuditCompliance } from './components/AuditCompliance';

export const App: React.FC = () => {
  const { activeTab, theme } = useDemoStore();

  // Initialize theme class on document body/html on mount
  useEffect(() => {
    const root = window.document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [theme]);

  const renderActiveTabContent = () => {
    switch (activeTab) {
      case 'overview':
        return <ExecutiveOverview />;
      case 'pipeline':
        return <PipelineOperations />;
      case 'quality':
        return <DataQuality />;
      case 'lake':
        return <DataLakeExplorer />;
      case 'mdm':
        return <MDMDashboard />;
      case 'analytics':
        return <AnalyticsReporting />;
      case 'audit':
        return <AuditCompliance />;
      default:
        return <ExecutiveOverview />;
    }
  };

  return (
    <div className="flex bg-zinc-50 dark:bg-canvas text-zinc-900 dark:text-zinc-100 min-h-screen">
      {/* Left Sidebar Navigation */}
      <Sidebar />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        {/* Top Control Header */}
        <Topbar />

        {/* Dynamic Tab Body */}
        <main className="flex-1 overflow-y-auto">
          {renderActiveTabContent()}
        </main>
      </div>
    </div>
  );
};

export default App;
