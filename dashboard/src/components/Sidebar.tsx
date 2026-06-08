import React from 'react';
import { useDemoStore } from '../store/demoStore';
import { cx } from '../lib/ui';
import {
  LayoutDashboard,
  GitBranch,
  CheckCircle,
  Database,
  Award,
  BarChart3,
  ShieldAlert,
  X,
  type LucideIcon,
} from 'lucide-react';

interface NavItem {
  id: string;
  name: string;
  icon: LucideIcon;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    label: 'Platform',
    items: [
      { id: 'overview', name: 'Executive Overview', icon: LayoutDashboard },
      { id: 'pipeline', name: 'Pipeline Operations', icon: GitBranch },
      { id: 'quality', name: 'Data Quality', icon: CheckCircle },
    ],
  },
  {
    label: 'Data & Mastering',
    items: [
      { id: 'lake', name: 'Data Lake Explorer', icon: Database },
      { id: 'mdm', name: 'Master Data Management', icon: Award },
      { id: 'analytics', name: 'Analytics & Reporting', icon: BarChart3 },
    ],
  },
  {
    label: 'Governance',
    items: [{ id: 'audit', name: 'Audit & Compliance', icon: ShieldAlert }],
  },
];

const SidebarContent: React.FC = () => {
  const { activeTab, setActiveTab, setSidebarOpen } = useDemoStore();

  return (
    <>
      {/* Brand / Logo */}
      <div className="h-16 px-5 flex items-center justify-between border-b border-zinc-200 dark:border-darkBorder shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center text-white font-bold text-sm shadow-sm shadow-brand-500/20">
            DF
          </div>
          <div className="leading-tight">
            <h1 className="text-sm font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
              DataForge
            </h1>
            <span className="text-[11px] text-zinc-500 dark:text-zinc-400">Data Platform · MDM</span>
          </div>
        </div>
        <button
          onClick={() => setSidebarOpen(false)}
          aria-label="Close navigation"
          className="lg:hidden p-1.5 rounded-md text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/50"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-5 overflow-y-auto" aria-label="Primary">
        {NAV_GROUPS.map((group) => (
          <div key={group.label}>
            <p className="px-3 mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
              {group.label}
            </p>
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => setActiveTab(item.id)}
                    aria-current={isActive ? 'page' : undefined}
                    className={cx(
                      'group relative w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/50',
                      isActive
                        ? 'bg-brand-500/10 text-brand-700 dark:text-brand-300'
                        : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800/60 hover:text-zinc-900 dark:hover:text-zinc-100',
                    )}
                  >
                    {isActive && (
                      <span
                        className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-0.5 rounded-r-full bg-brand-500"
                        aria-hidden="true"
                      />
                    )}
                    <Icon
                      className={cx(
                        'w-[18px] h-[18px] shrink-0',
                        isActive ? 'text-brand-500' : 'text-zinc-400 dark:text-zinc-500 group-hover:text-zinc-600 dark:group-hover:text-zinc-300',
                      )}
                    />
                    <span className="truncate">{item.name}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Footer / Account */}
      <div className="p-3 border-t border-zinc-200 dark:border-darkBorder shrink-0">
        <div className="flex items-center gap-3 rounded-lg p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800/60 transition-colors">
          <div className="w-8 h-8 rounded-full bg-zinc-200 dark:bg-zinc-700 flex items-center justify-center text-xs font-semibold text-zinc-700 dark:text-zinc-200 shrink-0">
            IH
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-zinc-900 dark:text-zinc-50 truncate leading-tight">
              Isaac Hernandez
            </p>
            <span className="text-[11px] text-zinc-500 dark:text-zinc-400 truncate block">
              admin@dataforge.io
            </span>
          </div>
          <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" aria-label="Online" title="Online" />
        </div>
      </div>
    </>
  );
};

export const Sidebar: React.FC = () => {
  const { sidebarOpen, setSidebarOpen } = useDemoStore();

  return (
    <>
      {/* Desktop: static rail */}
      <aside className="hidden lg:flex w-64 shrink-0 bg-white dark:bg-darkCard border-r border-zinc-200 dark:border-darkBorder flex-col h-screen sticky top-0">
        <SidebarContent />
      </aside>

      {/* Mobile: overlay drawer */}
      {sidebarOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <button
            aria-label="Close navigation overlay"
            onClick={() => setSidebarOpen(false)}
            className="absolute inset-0 bg-zinc-950/50 backdrop-blur-sm motion-safe:animate-fade-in"
          />
          <aside className="relative w-64 max-w-[80%] bg-white dark:bg-darkCard border-r border-zinc-200 dark:border-darkBorder flex flex-col h-full shadow-elevated motion-safe:animate-fade-in">
            <SidebarContent />
          </aside>
        </div>
      )}
    </>
  );
};
