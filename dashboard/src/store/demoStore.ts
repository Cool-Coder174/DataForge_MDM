import { create } from 'zustand';
import type { ScenarioId, GoldenRecord, DQRule, AuditEvent } from '../types';
import { SCENARIOS } from '../mock/data';

// UI-only state. Server data (golden records, analytics, alarms) is fetched via
// SWR hooks in src/hooks; see src/lib/api.ts. The only data the store keeps is
// `localEvents`: client-generated demo audit events, since there is no
// server-side audit store yet.

type NewEvent = Omit<AuditEvent, 'id' | 'timestamp' | 'user'> & { user?: string };

interface DemoState {
  theme: 'light' | 'dark';
  activeTab: string;
  activeScenario: ScenarioId;
  dateRange: { start: string; end: string };
  selectedDataset: 'yellow_taxi' | 'taxi_zones' | 'vendors';

  selectedMDMRecord: GoldenRecord | null;
  selectedDQRule: DQRule | null;

  localEvents: AuditEvent[];

  /** Mobile navigation drawer visibility (ignored on lg+ screens). */
  sidebarOpen: boolean;

  toggleTheme: () => void;
  setSidebarOpen: (open: boolean) => void;
  setActiveTab: (tab: string) => void;
  setDataset: (dataset: 'yellow_taxi' | 'taxi_zones' | 'vendors') => void;
  triggerScenario: (scenarioId: ScenarioId) => void;
  setSelectedMDMRecord: (rec: GoldenRecord | null) => void;
  setSelectedDQRule: (rule: DQRule | null) => void;
  pushEvent: (event: NewEvent) => void;
}

const STORAGE_KEY = 'dataforge-theme';

function initialTheme(): 'light' | 'dark' {
  if (typeof window === 'undefined') return 'dark';
  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (stored === 'light' || stored === 'dark') return stored;
  return window.matchMedia?.('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

function applyThemeClass(theme: 'light' | 'dark') {
  if (typeof window === 'undefined') return;
  const root = window.document.documentElement;
  root.classList.toggle('dark', theme === 'dark');
  window.localStorage.setItem(STORAGE_KEY, theme);
}

function nowStamp(): string {
  return new Date().toISOString().replace('T', ' ').substring(0, 19);
}

export const useDemoStore = create<DemoState>((set) => ({
  theme: initialTheme(),
  activeTab: 'overview',
  activeScenario: 'healthy',
  dateRange: { start: '2026-06-08', end: '2026-06-08' },
  selectedDataset: 'yellow_taxi',

  selectedMDMRecord: null,
  selectedDQRule: null,

  localEvents: [],

  sidebarOpen: false,

  toggleTheme: () =>
    set((state) => {
      const nextTheme = state.theme === 'light' ? 'dark' : 'light';
      applyThemeClass(nextTheme);
      return { theme: nextTheme };
    }),

  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  setActiveTab: (tab) => set({ activeTab: tab, sidebarOpen: false }),
  setDataset: (dataset) => set({ selectedDataset: dataset }),
  setSelectedMDMRecord: (rec) => set({ selectedMDMRecord: rec }),
  setSelectedDQRule: (rule) => set({ selectedDQRule: rule }),

  pushEvent: (event) =>
    set((state) => ({
      localEvents: [
        {
          id: `aud_${Date.now()}`,
          timestamp: nowStamp(),
          user: event.user ?? 'isaac_admin',
          action: event.action,
          entity: event.entity,
          status: event.status,
          details: event.details,
        },
        ...state.localEvents,
      ],
    })),

  triggerScenario: (scenarioId) =>
    set((state) => {
      const matched = SCENARIOS.find((s) => s.id === scenarioId);
      const event: AuditEvent = {
        id: `aud_scenario_${Date.now()}`,
        timestamp: nowStamp(),
        user: 'Demo Control Panel',
        action: 'SCENARIO_TRIGGER',
        entity: matched?.name || scenarioId,
        status: scenarioId === 'healthy' || scenarioId === 'retry_success' ? 'SUCCESS' : 'WARNING',
        details: matched?.description || '',
      };
      return { activeScenario: scenarioId, localEvents: [event, ...state.localEvents] };
    }),
}));
