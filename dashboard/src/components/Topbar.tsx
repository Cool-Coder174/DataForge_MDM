import React from 'react';
import { useDemoStore } from '../store/demoStore';
import { useDqRules } from '../hooks';
import { SCENARIOS } from '../mock/data';
import type { ScenarioId } from '../types';
import { StatusBadge, InfoTooltip } from './ui';
import { cx } from '../lib/ui';
import { Sun, Moon, Calendar, Database, Sparkles, Menu, ChevronRight } from 'lucide-react';

const PAGE_TITLES: Record<string, string> = {
  overview: 'Executive Overview',
  pipeline: 'Pipeline Operations',
  quality: 'Data Quality',
  lake: 'Data Lake Explorer',
  mdm: 'Master Data Management',
  analytics: 'Analytics & Reporting',
  audit: 'Audit & Compliance',
};

const CONTROL =
  'flex items-center gap-1.5 h-9 px-2.5 rounded-lg bg-zinc-50 dark:bg-darkCard2 border border-zinc-200 dark:border-darkBorder text-xs font-medium text-zinc-600 dark:text-zinc-300';

export const Topbar: React.FC = () => {
  const {
    theme,
    toggleTheme,
    activeTab,
    activeScenario,
    triggerScenario,
    selectedDataset,
    setDataset,
    setSidebarOpen,
  } = useDemoStore();
  const dqRules = useDqRules();

  const failed = dqRules.filter((r) => r.status === 'FAIL').length;
  const warning = dqRules.filter((r) => r.status === 'WARNING').length;

  const dqGate = failed > 0
    ? { tone: 'danger' as const, label: 'DQ Gate: Critical' }
    : warning > 0
      ? { tone: 'warning' as const, label: 'DQ Gate: Warning' }
      : { tone: 'success' as const, label: 'DQ Gate: Passed' };

  return (
    <header className="bg-white/95 dark:bg-darkCard/95 backdrop-blur border-b border-zinc-200 dark:border-darkBorder sticky top-0 z-40">
      <div className="h-16 px-4 sm:px-6 flex items-center justify-between gap-3">
        {/* Left: menu + breadcrumb + DQ gate */}
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={() => setSidebarOpen(true)}
            aria-label="Open navigation"
            className="lg:hidden p-2 -ml-1 rounded-lg text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/50"
          >
            <Menu className="w-5 h-5" />
          </button>

          <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 min-w-0">
            <span className="hidden sm:inline text-xs font-medium text-zinc-400 dark:text-zinc-500">
              DataForge
            </span>
            <ChevronRight className="hidden sm:inline w-3.5 h-3.5 text-zinc-300 dark:text-zinc-600 shrink-0" aria-hidden="true" />
            <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-50 truncate">
              {PAGE_TITLES[activeTab] ?? 'Dashboard'}
            </span>
          </nav>

          <span className="hidden md:inline-flex">
            <StatusBadge tone={dqGate.tone} label={dqGate.label} dot pulse size="xs" />
          </span>
        </div>

        {/* Right: controls */}
        <div className="flex items-center gap-2">
          {/* Date */}
          <div className={cx(CONTROL, 'hidden md:flex')}>
            <Calendar className="w-3.5 h-3.5 text-zinc-400" aria-hidden="true" />
            <span className="tabular-nums">Jun 08, 2026</span>
          </div>

          {/* Dataset */}
          <label className={cx(CONTROL, 'hidden sm:flex cursor-pointer')}>
            <Database className="w-3.5 h-3.5 text-zinc-400" aria-hidden="true" />
            <span className="sr-only">Active dataset</span>
            <select
              value={selectedDataset}
              onChange={(e) => setDataset(e.target.value as 'yellow_taxi' | 'taxi_zones' | 'vendors')}
              aria-label="Active dataset"
              className="bg-transparent border-none focus:outline-none rounded text-zinc-800 dark:text-zinc-200 font-medium cursor-pointer pr-1"
            >
              <option value="yellow_taxi">yellow_taxi</option>
              <option value="taxi_zones">taxi_zones</option>
              <option value="vendors">vendors</option>
            </select>
          </label>

          {/* Scenario (prominent) */}
          <label className="flex items-center gap-1.5 h-9 px-2.5 rounded-lg bg-brand-500/10 border border-brand-500/25 text-xs font-semibold text-brand-700 dark:text-brand-300 cursor-pointer">
            <Sparkles className="w-3.5 h-3.5 text-brand-500" aria-hidden="true" />
            <span className="hidden sm:inline text-brand-600/80 dark:text-brand-400/80 font-medium">Scenario</span>
            <select
              value={activeScenario}
              onChange={(e) => triggerScenario(e.target.value as ScenarioId)}
              aria-label="Demo scenario"
              className="bg-transparent border-none focus:outline-none rounded text-brand-700 dark:text-brand-300 font-semibold cursor-pointer max-w-[140px] sm:max-w-none"
            >
              {SCENARIOS.map((sc) => (
                <option
                  key={sc.id}
                  value={sc.id}
                  className="bg-white dark:bg-darkCard text-zinc-800 dark:text-zinc-200 font-normal"
                >
                  {sc.name}
                </option>
              ))}
            </select>
          </label>

          <span className="hidden lg:inline-flex items-center">
            <InfoTooltip label="Demo scenarios simulate AWS pipeline failures and recoveries across the dashboard without a live backend." />
          </span>

          {/* Theme toggle */}
          <button
            onClick={toggleTheme}
            aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
            className="grid place-items-center w-9 h-9 rounded-lg bg-zinc-50 dark:bg-darkCard2 border border-zinc-200 dark:border-darkBorder text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-50 transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/50"
          >
            {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </header>
  );
};
