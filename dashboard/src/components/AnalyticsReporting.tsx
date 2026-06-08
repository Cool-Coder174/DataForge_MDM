import React, { useState } from 'react';
import {
  AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { Filter } from 'lucide-react';
import { useAnalytics } from '../hooks';
import { useDemoStore } from '../store/demoStore';
import {
  PageHeader, SegmentedTabs, ChartCard, Card, SectionHeader,
  Table, THead, Th, Tr, Td, LoadingState, EmptyState, ErrorState,
} from './ui';
import { useChartTheme } from '../hooks/useChartTheme';
import { cx, SERIES, CHART_AXIS, formatCompact, formatNumber } from '../lib/ui';
import type { DailyTrendDatum, HourlyDatum, RouteDatum } from '../types';

type View = 'trends' | 'peak' | 'routes';

const VIEW_TABS = [
  { id: 'trends' as const, label: 'Weekly Trends' },
  { id: 'peak' as const, label: 'Hourly Peaks' },
  { id: 'routes' as const, label: 'Top Routes' },
];

export const AnalyticsReporting: React.FC = () => {
  const activeScenario = useDemoStore((s) => s.activeScenario);
  const [activeAnalysis, setActiveAnalysis] = useState<View>('trends');
  const [filterBorough, setFilterBorough] = useState('All');
  const tooltipStyle = useChartTheme();

  const daily = useAnalytics<DailyTrendDatum>('daily_trend');
  const hourly = useAnalytics<HourlyDatum>('hourly_profile');
  const routes = useAnalytics<RouteDatum>('top_routes');

  const dailyData = daily.rows.map((d) => {
    const isWeekendish = activeScenario === 'bad_file' && /(-0[67]|-1[34]|-2[01]|-2[78])$/.test(d.pickup_date);
    return isWeekendish ? { ...d, trips: Math.round(d.trips * 0.7), revenue: Math.round(d.revenue * 0.65) } : d;
  });

  const hourlyData = hourly.rows.map((h) => ({ hour: `${String(h.pickup_hour).padStart(2, '0')}:00`, trips: h.trips }));

  const filterControl = (
    <label className="flex items-center gap-1.5 h-8 px-2.5 rounded-lg bg-zinc-50 dark:bg-darkCard2 border border-zinc-200 dark:border-darkBorder text-xs font-medium cursor-pointer">
      <Filter className="w-3.5 h-3.5 text-zinc-400" />
      <span className="text-zinc-500 dark:text-zinc-400">Borough</span>
      <select
        value={filterBorough}
        onChange={(e) => setFilterBorough(e.target.value)}
        aria-label="Filter by borough"
        className="bg-transparent border-none text-zinc-700 dark:text-zinc-200 font-semibold focus:outline-none rounded cursor-pointer"
      >
        <option value="All">All boroughs</option>
        <option value="Manhattan">Manhattan</option>
        <option value="Queens">Queens</option>
        <option value="Brooklyn">Brooklyn</option>
      </select>
    </label>
  );

  return (
    <div className="max-w-[1600px] mx-auto p-4 sm:p-6 space-y-6">
      <PageHeader
        title="Analytics & Reporting"
        description="QuickSight-style exploration of the curated serving layer — trends, demand profiles, and top routing pairs."
        actions={filterControl}
      />

      <SegmentedTabs items={VIEW_TABS} value={activeAnalysis} onChange={setActiveAnalysis} ariaLabel="Analysis views" />

      {activeAnalysis === 'trends' && (
        <ChartCard title="Revenue & Bookings Trend" subtitle="Daily metrics aggregated at the curated serving layer" height={400}>
          {daily.error ? (
            <ErrorState title="Could not load trend data" message={daily.error.message} />
          ) : daily.isLoading ? (
            <LoadingState label="Querying Athena…" />
          ) : dailyData.length === 0 ? (
            <EmptyState title="No trend data" message="The curated fact_trip table returned no rows." />
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dailyData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barGap={4}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={CHART_AXIS.grid} />
                <XAxis dataKey="pickup_date" stroke={CHART_AXIS.tick} fontSize={11} tickLine={false} axisLine={false} tickMargin={8} />
                <YAxis stroke={CHART_AXIS.tick} fontSize={11} tickLine={false} axisLine={false} tickFormatter={formatCompact} width={44} />
                <Tooltip contentStyle={tooltipStyle} cursor={{ fill: CHART_AXIS.grid }} />
                <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} iconType="circle" />
                <Bar dataKey="trips" name="Trips ingested" fill={SERIES.trips} radius={[4, 4, 0, 0]} maxBarSize={28} />
                <Bar dataKey="revenue" name="Total revenue ($)" fill={SERIES.revenue} radius={[4, 4, 0, 0]} maxBarSize={28} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      )}

      {activeAnalysis === 'peak' && (
        <ChartCard title="Diurnal Peak Demand" subtitle="Time-of-day trip frequency used to model fleet dispatch" height={400}>
          {hourly.error ? (
            <ErrorState title="Could not load demand profile" message={hourly.error.message} />
          ) : hourly.isLoading ? (
            <LoadingState label="Querying Athena…" />
          ) : hourlyData.length === 0 ? (
            <EmptyState title="No demand data" message="The curated fact_trip table returned no rows." />
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={hourlyData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorTripsPeak" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={SERIES.peak} stopOpacity={0.25} />
                    <stop offset="95%" stopColor={SERIES.peak} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={CHART_AXIS.grid} />
                <XAxis dataKey="hour" stroke={CHART_AXIS.tick} fontSize={11} tickLine={false} axisLine={false} tickMargin={8} />
                <YAxis stroke={CHART_AXIS.tick} fontSize={11} tickLine={false} axisLine={false} tickFormatter={formatCompact} width={44} />
                <Tooltip contentStyle={tooltipStyle} cursor={{ stroke: CHART_AXIS.grid }} />
                <Area type="monotone" dataKey="trips" name="Trips booked" stroke={SERIES.peak} strokeWidth={2} fillOpacity={1} fill="url(#colorTripsPeak)" dot={false} activeDot={{ r: 4 }} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      )}

      {activeAnalysis === 'routes' && (
        <Card padding="none" className="overflow-hidden">
          <div className="p-5 pb-3">
            <SectionHeader title="Top In-demand Routing Pairs" subtitle="Volume and financial metrics for the busiest pickup → dropoff keys" />
          </div>
          {routes.error ? (
            <ErrorState title="Could not load routes" message={routes.error.message} />
          ) : routes.isLoading ? (
            <LoadingState label="Querying Athena…" />
          ) : routes.rows.length === 0 ? (
            <EmptyState title="No route data" message="The curated fact_trip table returned no rows." />
          ) : (
            <Table>
              <THead>
                <Th>Pickup zone</Th>
                <Th>Dropoff zone</Th>
                <Th align="center">Total trips</Th>
                <Th align="right">Avg fare</Th>
                <Th align="right">Avg tip</Th>
              </THead>
              <tbody>
                {routes.rows.map((route, idx) => (
                  <Tr key={`${route.pickup_zone}-${route.dropoff_zone}-${idx}`}>
                    <Td className="font-semibold text-zinc-900 dark:text-zinc-100">{route.pickup_zone}</Td>
                    <Td className="font-semibold text-zinc-900 dark:text-zinc-100">{route.dropoff_zone}</Td>
                    <Td align="center" mono>{formatNumber(route.trips)}</Td>
                    <Td align="right" mono>{route.avg_fare != null ? `$${route.avg_fare.toFixed(2)}` : '—'}</Td>
                    <Td align="right" className={cx('font-mono font-semibold', route.avg_tip != null && 'text-brand-600 dark:text-brand-400')}>
                      {route.avg_tip != null ? `$${route.avg_tip.toFixed(2)}` : '—'}
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card>
      )}
    </div>
  );
};
