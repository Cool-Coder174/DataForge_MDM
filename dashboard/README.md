# DataForge — Data Platform / MDM Dashboard

An internal, AWS QuickSight-style observability dashboard for a data-engineering
platform. It simulates an end-to-end pipeline built on S3, EventBridge, Step
Functions, Lambda validation, Glue ETL, Athena, Redshift, RDS golden records,
CloudWatch, IAM, KMS, Secrets Manager, and CI/CD — driven entirely by mock data
and a demo-scenario engine (no live backend required).

Built with **React 19 + TypeScript + Vite + Tailwind CSS v4**, charts via
**Recharts**, state via **Zustand**, and data fetching via **SWR**.

---

## Run locally

```bash
cd dashboard
npm install
npm run dev        # start the Vite dev server (http://localhost:5173)
```

Other scripts:

```bash
npm run build      # type-check (tsc -b) + production build
npm run lint       # ESLint
npm run preview    # preview the production build
```

> Live API mode: the data hooks call a backend only when `isLiveMode` is set in
> `src/lib/api.ts` (via env). With no backend configured, everything renders from
> bundled mock data in `src/mock/`.

---

## UI cleanup summary

This dashboard received a full UI/UX polish pass to make it feel like a serious,
demo-ready enterprise product (inspired by AWS Console, Linear, Vercel, Datadog,
and the Stripe dashboard):

- **Refined dark theme** — a calmer cool-neutral palette (near-black canvas,
  elevated card surfaces, one consistent hairline border) instead of pure black.
- **Centralized design tokens** — colors, status→tone mapping, chart palette,
  radii, and shadows live in one place; no more scattered magic values.
- **Reusable UI primitives** — `PageHeader`, `MetricCard`, `StatusBadge`,
  `ChartCard`, `SegmentedTabs`, a styled `Table` set, `EventLogItem`,
  `InfoTooltip`, and consistent loading/empty/error states.
- **Consistent status colors** — "healthy / passed / active / ok" are always
  emerald; "warning / stale" amber; "failed / rejected / quarantined / critical"
  rose; "running / info" blue. One status always looks the same everywhere.
- **Typography** — Inter for UI, JetBrains Mono for code, IDs, and S3 paths, with
  tabular figures for metrics and tables.
- **Cleaner shell** — grouped sidebar with a subtle active state, a breadcrumb
  top bar with a global DQ-gate badge, and a polished user/account block.
- **Responsive** — works at 1440 / 1280 / tablet widths; the sidebar collapses to
  a hamburger drawer on small screens, tables scroll horizontally, charts resize.
- **Accessibility** — visible focus rings, semantic buttons/labels, ARIA on tabs
  and progress bars, table headers, and `prefers-reduced-motion` support.

---

## Project structure

```
dashboard/src/
├── App.tsx                  # App shell: sidebar + topbar + active page
├── index.css                # Global theme, focus rings, scrollbars
├── components/
│   ├── ui/index.tsx         # ★ Reusable UI primitives (design system)
│   ├── Sidebar.tsx          # Grouped nav + mobile drawer
│   ├── Topbar.tsx           # Breadcrumb, DQ gate, global controls
│   ├── ExecutiveOverview.tsx
│   ├── PipelineOperations.tsx
│   ├── DataQuality.tsx
│   ├── DataLakeExplorer.tsx
│   ├── MDMDashboard.tsx
│   ├── AnalyticsReporting.tsx
│   └── AuditCompliance.tsx
├── lib/
│   ├── ui.ts                # ★ Design tokens, status colors, chart palette, formatters
│   └── api.ts               # Endpoints + fetcher (live vs mock)
├── hooks/                   # SWR + scenario-derived data hooks
├── store/demoStore.ts       # Zustand UI state (theme, tab, scenario, sidebar)
├── mock/                    # Mock data, analytics, and scenario engine
└── types/index.ts           # Shared TypeScript types
```

---

## Where the important pieces live

### Design tokens & status colors — `src/lib/ui.ts`

The single source of truth for everything visual that must stay consistent:

- `Tone` — the canonical semantic tones: `success | warning | danger | info | neutral | accent`.
- `toneForStatus(status)` — maps any app status string (`PASS`, `FAILED`,
  `ALARM`, `healthy`, `SUCCESS`, …) to a `Tone`.
- `toneForSeverity(severity)` — `low | medium | high` → tone.
- `TONE_BADGE`, `TONE_SOLID`, `TONE_TEXT` — Tailwind class variants per tone.
- `CHART_COLORS`, `SERIES`, `CHART_AXIS` — the shared chart palette so a series
  reads with the same color on every page.
- `formatCurrency`, `formatCompact`, `formatBytes`, `formatNumber`, … — formatters.

Surface colors, the brand ramp, radii, and shadows are defined in
`tailwind.config.js` (`canvas`, `darkCard`, `darkCard2`, `darkBorder`, `brand`,
`shadow-card`, `shadow-elevated`, `shadow-panel`).

### Reusable components — `src/components/ui/index.tsx`

| Primitive | Purpose |
| --- | --- |
| `PageHeader` | Page title + description + meta (e.g. "Last updated") + actions |
| `SectionHeader` | Card/section title with optional icon, subtitle, action |
| `MetricCard` / `ProgressBar` | KPI cards with trend/badge and optional bar |
| `StatusBadge` | Status pill; pass a `tone` or a raw `status` to auto-resolve |
| `ChartCard` | Chart container with header + fixed-height body |
| `SegmentedTabs` | Accessible segmented tab control |
| `Table`, `THead`, `Th`, `Tr`, `Td` | Consistent table styling (alignment, hover, selected) |
| `EventLogItem` | Timeline / audit-log entry |
| `InfoTooltip` | Accessible hover/focus tooltip for technical terms |
| `Card`, `Skeleton`, `LoadingState`, `EmptyState`, `ErrorState` | Surfaces & states |

---

## How demo scenarios affect the UI

The **Scenario** selector in the top bar drives the whole dashboard. Selecting a
scenario calls `triggerScenario()` in `src/store/demoStore.ts`, which:

1. Sets `activeScenario` in the store.
2. Pushes an audit event (visible in Audit & Compliance and MDM trails).

Each data hook (`useDqRules`, `useLakeZones`, `usePipelineNodes`, …) reads
`activeScenario` and projects it onto fresh copies of the baseline data via
`applyScenario()` in `src/mock/scenarios.ts`. So a single selection ripples
across KPIs, the DQ gate badge, pipeline node health, lake-zone status, alarms,
and audit logs simultaneously — e.g. **Bad Source File Uploaded** drops the DQ
score, fails rules, marks the Glue DQ node as failed, and flips the top-bar gate
to *Critical*.

To add a new scenario: add its id to `ScenarioId` (`src/types/index.ts`), an
entry to `SCENARIOS` (`src/mock/data.ts`), and a `case` in `applyScenario()`.

---

## How to add a new dashboard card or page

**Add a KPI / metric card** to any page:

```tsx
import { MetricCard, ProgressBar } from './ui';

<MetricCard
  label="Data Quality Score"
  value="98.2%"
  badge={{ label: 'PASS', tone: 'success' }}
>
  <ProgressBar value={98.2} tone="success" label="Data quality score" />
</MetricCard>
```

**Add a new page:**

1. Create `src/components/MyPage.tsx`. Start with a `PageHeader`, then lay out
   content using `Card`, `ChartCard`, the `Table` primitives, and `StatusBadge`.
   Pull colors/formatters from `src/lib/ui.ts` — don't hardcode hex values.
2. Register the route in `src/App.tsx` (`renderActiveTabContent` switch).
3. Add a nav entry in `NAV_GROUPS` in `src/components/Sidebar.tsx` and a title in
   `PAGE_TITLES` in `src/components/Topbar.tsx`.

Always resolve status colors through `toneForStatus` / `StatusBadge` so new UI
stays consistent with the rest of the product.
