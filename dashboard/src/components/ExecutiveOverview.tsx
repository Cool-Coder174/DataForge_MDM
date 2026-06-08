import React from 'react';
import { useDemoStore } from '../store/demoStore';
import { useDqRules, useLakeZones, usePipelineNodes, useAnalytics } from '../hooks';
import { useChartTheme } from '../hooks/useChartTheme';
import {
  PageHeader,
  MetricCard,
  ProgressBar,
  ChartCard,
  Card,
  SectionHeader,
  StatusBadge,
  Table,
  THead,
  Th,
  Tr,
  Td,
  LoadingState,
  EmptyState,
  ErrorState,
} from './ui';
import {
  CHART_COLORS,
  SERIES,
  CHART_AXIS,
  formatCurrency,
  formatCurrencyCompact,
  formatCompact,
  formatNumber,
  formatBytes,
  toneForStatus,
  type Tone,
} from '../lib/ui';
import { SCENARIOS } from '../mock/data';
import type { AnalyticsKpis, BoroughDatum, DailyTrendDatum, NodeStatus } from '../types';
import {
  AreaChart, Area, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import {
  Activity, DollarSign, CheckCircle2, AlertTriangle, ShieldCheck, FolderArchive, Server,
} from 'lucide-react';

const AWS_ENGINES = [
  { id: 'glue_etl', name: 'AWS Glue (PySpark)', detail: 'Batch ETL & Crawler' },
  { id: 'athena', name: 'Amazon Athena', detail: 'Serverless SQL transforms' },
  { id: 'rds', name: 'RDS PostgreSQL', detail: 'Golden records (MDM)' },
  { id: 'redshift', name: 'Amazon Redshift', detail: 'Dimensional warehouse' },
] as const;

const ENGINE_LABEL: Record<NodeStatus, string> = {
  healthy: 'Active',
  warning: 'Warning',
  failed: 'Failed',
  skipped: 'Skipped',
  running: 'Running',
};

export const ExecutiveOverview: React.FC = () => {
  const activeScenario = useDemoStore((s) => s.activeScenario);
  const dqRules = useDqRules();
  const lakeZones = useLakeZones();
  const pipelineNodes = usePipelineNodes();
  const tooltipStyle = useChartTheme();

  const kpiRes = useAnalytics<AnalyticsKpis>('kpis');
  const trend = useAnalytics<DailyTrendDatum>('daily_trend');
  const borough = useAnalytics<BoroughDatum>('trips_by_borough');

  const scenarioName = SCENARIOS.find((s) => s.id === activeScenario)?.name ?? activeScenario;

  const boroughData = borough.rows.map((b) => ({ name: b.pickup_borough, value: b.trips }));
  const boroughTotal = boroughData.reduce((sum, b) => sum + b.value, 0) || 1;

  // KPIs come from the curated layer (Athena); scenarios overlay a simulated
  // failure posture. Rejected/duplicate counts are scenario-derived.
  const getKpis = () => {
    const isBad = activeScenario === 'bad_file';
    const isDrift = activeScenario === 'schema_drift';
    const isGlueFail = activeScenario === 'glue_failed';

    const base = kpiRes.rows[0];
    let totalTrips = base?.total_trips ?? 0;
    let totalRevenue = base?.total_revenue ?? 0;
    let rejections = 8;
    let duplicates = 42;

    if (isBad) {
      totalTrips = Math.round(totalTrips * 0.94);
      totalRevenue = Math.round(totalRevenue * 0.94);
      rejections = 75;
      duplicates = 112;
    } else if (isDrift || isGlueFail) {
      totalTrips = 0;
      totalRevenue = 0;
      rejections = 0;
      duplicates = 0;
    }

    const totalRules = dqRules.length;
    const passedRules = dqRules.filter((r) => r.status === 'PASS').length;
    const dqScore = totalRules > 0 ? (passedRules / totalRules) * 100 : 100;

    return { totalTrips, totalRevenue, dqScore, rejections, duplicates };
  };

  const kpis = getKpis();
  const dqHealthy = kpis.dqScore >= 90;
  const dqTone: Tone = dqHealthy ? 'success' : kpis.dqScore > 50 ? 'warning' : 'danger';
  const rejectCritical = kpis.rejections > 10;

  const engineStatus = (nodeId: string): { tone: Tone; label: string } => {
    const node = pipelineNodes.find((n) => n.id === nodeId);
    if (!node) return { tone: 'neutral', label: 'Inactive' };
    return { tone: toneForStatus(node.status), label: ENGINE_LABEL[node.status] ?? node.status };
  };

  return (
    <div className="max-w-[1600px] mx-auto p-4 sm:p-6 space-y-6">
      <PageHeader
        title="Executive Overview"
        description="Platform-wide health of the DataForge ingestion, quality, and serving stack at a glance."
        meta={
          <span>
            Last updated <span className="font-medium text-zinc-500 dark:text-zinc-400">Jun 08, 2026 · 12:16 UTC</span>
            {' · '}Scenario: <span className="font-medium text-zinc-500 dark:text-zinc-400">{scenarioName}</span>
          </span>
        }
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <MetricCard
          label="Total Ingested Trips"
          value={formatNumber(kpis.totalTrips)}
          icon={<Activity className="w-[18px] h-[18px]" />}
          trend={{ value: '+12.4%', direction: 'up', tone: 'success' }}
        />
        <MetricCard
          label="Total Fare Revenue"
          value={formatCurrency(kpis.totalRevenue)}
          icon={<DollarSign className="w-[18px] h-[18px]" />}
          trend={{ value: '+8.2%', direction: 'up', tone: 'success' }}
        />
        <MetricCard
          label="Data Quality Score"
          value={`${kpis.dqScore.toFixed(1)}%`}
          icon={
            dqHealthy ? (
              <CheckCircle2 className="w-[18px] h-[18px] text-emerald-500" />
            ) : (
              <AlertTriangle className="w-[18px] h-[18px] text-rose-500" />
            )
          }
          badge={{ label: dqHealthy ? 'PASS' : 'FAIL', tone: dqTone }}
        >
          <ProgressBar value={kpis.dqScore} tone={dqTone} label="Data quality score" />
        </MetricCard>
        <MetricCard
          label="Rejected / Duplicates"
          value={
            <span>
              {kpis.rejections}
              <span className="text-base font-semibold text-zinc-400 dark:text-zinc-500">
                {' '}/ {kpis.duplicates}
              </span>
            </span>
          }
          icon={<AlertTriangle className={`w-[18px] h-[18px] ${rejectCritical ? 'text-rose-500' : ''}`} />}
          badge={{ label: rejectCritical ? 'Critical' : 'Normal', tone: rejectCritical ? 'danger' : 'neutral' }}
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <ChartCard
          title="Trips & Revenue — Daily Profile"
          subtitle="Daily volume and revenue from the curated serving layer"
          className="lg:col-span-2"
          action={
            <div className="flex items-center gap-3 text-xs">
              <span className="flex items-center gap-1.5 text-zinc-500 dark:text-zinc-400">
                <span className="w-2.5 h-2.5 rounded-sm" style={{ background: SERIES.trips }} />Trips
              </span>
              <span className="flex items-center gap-1.5 text-zinc-500 dark:text-zinc-400">
                <span className="w-2.5 h-2.5 rounded-sm" style={{ background: SERIES.revenue }} />Revenue
              </span>
            </div>
          }
        >
          {trend.error ? (
            <ErrorState title="Could not load trend" message={trend.error.message} />
          ) : trend.isLoading ? (
            <LoadingState label="Querying Athena…" />
          ) : trend.rows.length === 0 ? (
            <EmptyState title="No trend data" message="The curated fact_trip table returned no rows." />
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trend.rows} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorTrips" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={SERIES.trips} stopOpacity={0.25} />
                    <stop offset="95%" stopColor={SERIES.trips} stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={SERIES.revenue} stopOpacity={0.25} />
                    <stop offset="95%" stopColor={SERIES.revenue} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={CHART_AXIS.grid} />
                <XAxis dataKey="pickup_date" stroke={CHART_AXIS.tick} fontSize={11} tickLine={false} axisLine={false} tickMargin={8} />
                <YAxis yAxisId="left" stroke={SERIES.trips} fontSize={11} tickLine={false} axisLine={false} tickFormatter={formatCompact} width={44} />
                <YAxis yAxisId="right" orientation="right" stroke={SERIES.revenue} fontSize={11} tickLine={false} axisLine={false} tickFormatter={formatCurrencyCompact} width={52} />
                <Tooltip contentStyle={tooltipStyle} cursor={{ stroke: CHART_AXIS.grid }} />
                <Area yAxisId="left" type="monotone" dataKey="trips" name="Trips" stroke={SERIES.trips} strokeWidth={2} fillOpacity={1} fill="url(#colorTrips)" dot={false} activeDot={{ r: 4 }} />
                <Area yAxisId="right" type="monotone" dataKey="revenue" name="Revenue ($)" stroke={SERIES.revenue} strokeWidth={2} fillOpacity={1} fill="url(#colorRevenue)" dot={false} activeDot={{ r: 4 }} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard
          title="Trips by Pickup Borough"
          subtitle="Share of bookings across NYC boroughs"
        >
          {borough.error ? (
            <ErrorState title="Could not load boroughs" message={borough.error.message} />
          ) : borough.isLoading ? (
            <LoadingState label="Querying Athena…" />
          ) : boroughData.length === 0 ? (
            <EmptyState title="No borough data" message="The curated fact_trip table returned no rows." />
          ) : (
            <div className="flex flex-col h-full">
              <div className="flex-1 min-h-[180px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={boroughData} cx="50%" cy="50%" innerRadius={58} outerRadius={82} paddingAngle={3} dataKey="value" stroke="none">
                      {boroughData.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={tooltipStyle} formatter={(v) => formatNumber(Number(v))} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs pt-2">
                {boroughData.map((b, i) => (
                  <div key={b.name} className="flex items-center gap-1.5 min-w-0">
                    <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }} />
                    <span className="truncate text-zinc-600 dark:text-zinc-400">{b.name}</span>
                    <span className="ml-auto font-semibold text-zinc-700 dark:text-zinc-300 tabular-nums">
                      {Math.round((b.value / boroughTotal) * 100)}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </ChartCard>
      </div>

      {/* Lake zones + AWS engines */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card padding="none" className="lg:col-span-2 overflow-hidden">
          <div className="p-5 pb-3">
            <SectionHeader
              title="S3 Data Lake Zones"
              subtitle="Storage tiers from raw ingestion to mastered golden records"
              icon={<FolderArchive className="w-4 h-4" />}
            />
          </div>
          <Table>
            <THead>
              <Th>S3 Prefix</Th>
              <Th align="right">Files</Th>
              <Th align="right">Rows</Th>
              <Th align="right">Size</Th>
              <Th>Status</Th>
              <Th align="right">Schema</Th>
            </THead>
            <tbody>
              {lakeZones.map((zone) => (
                <Tr key={zone.zone}>
                  <Td>
                    <code className="font-mono font-medium text-brand-600 dark:text-brand-400">
                      s3://{zone.zone}/
                    </code>
                  </Td>
                  <Td align="right">{zone.fileCount}</Td>
                  <Td align="right">{formatNumber(zone.rowCount)}</Td>
                  <Td align="right">{formatBytes(zone.sizeBytes)}</Td>
                  <Td>
                    <StatusBadge status={zone.dqStatus} size="xs" uppercase />
                  </Td>
                  <Td align="right" mono className="text-zinc-500 dark:text-zinc-400">
                    {zone.schemaVersion}
                  </Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        </Card>

        <Card padding="lg">
          <SectionHeader
            title="AWS Platform Engines"
            subtitle="Live execution status"
            icon={<Server className="w-4 h-4" />}
            className="mb-4"
          />
          <ul className="divide-y divide-zinc-100 dark:divide-zinc-800/60">
            {AWS_ENGINES.map((engine) => {
              const status = engineStatus(engine.id);
              return (
                <li key={engine.id} className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100 truncate">{engine.name}</p>
                    <span className="text-xs text-zinc-500 dark:text-zinc-400">{engine.detail}</span>
                  </div>
                  <StatusBadge tone={status.tone} label={status.label} size="xs" dot />
                </li>
              );
            })}
          </ul>
          <div className="mt-4 pt-3 border-t border-zinc-100 dark:border-zinc-800/60 flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
            <span>Step Functions orchestrates each stage end-to-end.</span>
          </div>
        </Card>
      </div>
    </div>
  );
};
