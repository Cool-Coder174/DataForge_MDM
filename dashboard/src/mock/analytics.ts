import type {
  AnalyticsKpis,
  BoroughDatum,
  VendorDatum,
  RouteDatum,
  DailyTrendDatum,
  HourlyDatum,
  CloudWatchAlarm,
  ScenarioId,
} from '../types';

// Mock analytics payloads keyed by the same names the Athena BFF route serves
// (GET /analytics/{name}). Each value mirrors the `rows` array shape the live
// endpoint returns, so components consume both modes identically.
//
// Values below are computed from a real 2,000-trip slice of the NYC TLC
// yellow_tripdata_2025-08.parquet file (see data/sample/_generate_taxi_sample.py).
export const MOCK_KPIS: AnalyticsKpis = {
  total_trips: 2000,
  total_revenue: 57194.62,
  avg_fare: 19.23,
  avg_distance_mi: 3.47,
};

export const MOCK_TRIPS_BY_BOROUGH: BoroughDatum[] = [
  { pickup_borough: 'Manhattan', trips: 1770, revenue: 42233.55 },
  { pickup_borough: 'Queens', trips: 199, revenue: 13929.89 },
  { pickup_borough: 'Brooklyn', trips: 24, revenue: 824.4 },
  { pickup_borough: 'Bronx', trips: 7, revenue: 206.78 },
];

export const MOCK_TRIPS_BY_VENDOR: VendorDatum[] = [
  { vendor_name: 'VeriFone Inc', trips: 1574, avg_fare: 19.26 },
  { vendor_name: 'Creative Mobile Technologies LLC', trips: 426, avg_fare: 19.1 },
];

export const MOCK_TOP_ROUTES: RouteDatum[] = [
  { pickup_zone: 'Upper East Side North', dropoff_zone: 'Upper East Side South', trips: 14, avg_fare: 8.95, avg_tip: 2.25 },
  { pickup_zone: 'Upper East Side South', dropoff_zone: 'Upper East Side South', trips: 10, avg_fare: 7.9, avg_tip: 2.65 },
  { pickup_zone: 'Upper East Side South', dropoff_zone: 'Upper East Side North', trips: 10, avg_fare: 8.74, avg_tip: 1.46 },
  { pickup_zone: 'Penn Station/Madison Sq West', dropoff_zone: 'Times Sq/Theatre District', trips: 9, avg_fare: 13.58, avg_tip: 2.06 },
  { pickup_zone: 'Lenox Hill East', dropoff_zone: 'Yorkville East', trips: 8, avg_fare: 9.12, avg_tip: 1.95 },
];

export const MOCK_DAILY_TREND: DailyTrendDatum[] = [
  { pickup_date: '2025-08-01', trips: 160, revenue: 4643 },
  { pickup_date: '2025-08-02', trips: 134, revenue: 3710 },
  { pickup_date: '2025-08-03', trips: 163, revenue: 4709 },
  { pickup_date: '2025-08-04', trips: 162, revenue: 4297 },
  { pickup_date: '2025-08-05', trips: 181, revenue: 5105 },
  { pickup_date: '2025-08-06', trips: 197, revenue: 5901 },
  { pickup_date: '2025-08-07', trips: 174, revenue: 4723 },
];

export const MOCK_HOURLY_PROFILE: HourlyDatum[] = [
  { pickup_hour: 0, trips: 40 }, { pickup_hour: 2, trips: 26 },
  { pickup_hour: 4, trips: 12 }, { pickup_hour: 6, trips: 20 },
  { pickup_hour: 8, trips: 75 }, { pickup_hour: 10, trips: 88 },
  { pickup_hour: 12, trips: 119 }, { pickup_hour: 14, trips: 116 },
  { pickup_hour: 16, trips: 135 }, { pickup_hour: 18, trips: 128 },
  { pickup_hour: 20, trips: 113 }, { pickup_hour: 22, trips: 113 },
];

export const MOCK_ANALYTICS: Record<string, unknown[]> = {
  kpis: [MOCK_KPIS],
  trips_by_borough: MOCK_TRIPS_BY_BOROUGH,
  trips_by_vendor: MOCK_TRIPS_BY_VENDOR,
  top_routes: MOCK_TOP_ROUTES,
  daily_trend: MOCK_DAILY_TREND,
  hourly_profile: MOCK_HOURLY_PROFILE,
};

// Baseline alarm posture (all healthy). Mirrors the alarms defined in
// infrastructure/cloudformation/monitoring.yml.
const BASE_ALARMS: CloudWatchAlarm[] = [
  { name: 'dataforge-stepfunctions-failed', state: 'OK', metric: 'ExecutionsFailed', namespace: 'AWS/States', threshold: 1, reason: 'No failed executions in the evaluation window.', updatedAt: '2026-06-08 12:16:30' },
  { name: 'dataforge-glue-etl-failed', state: 'OK', metric: 'glue.driver.aggregate.numFailedTasks', namespace: 'Glue', threshold: 1, reason: 'ETL job completed with zero failed tasks.', updatedAt: '2026-06-08 12:05:40' },
  { name: 'dataforge-lambda-errors', state: 'OK', metric: 'Errors', namespace: 'AWS/Lambda', threshold: 1, reason: 'No Lambda errors detected.', updatedAt: '2026-06-08 12:15:30' },
  { name: 'dataforge-api-5xx', state: 'OK', metric: '5XXError', namespace: 'AWS/ApiGateway', threshold: 1, reason: 'No 5XX responses from the API.', updatedAt: '2026-06-08 12:14:00' },
  { name: 'dataforge-api-4xx', state: 'OK', metric: '4XXError', namespace: 'AWS/ApiGateway', threshold: 10, reason: '4XX rate within threshold.', updatedAt: '2026-06-08 12:14:00' },
  { name: 'dataforge-dq-score-low', state: 'OK', metric: 'QualityScore', namespace: 'dataforge/DataQuality', threshold: 0.95, reason: 'Quality score 1.0 >= 0.95.', updatedAt: '2026-06-08 12:12:35' },
  { name: 'dataforge-rejected-rows-high', state: 'OK', metric: 'RejectedRows', namespace: 'dataforge/DataQuality', threshold: 100, reason: 'Rejected rows below threshold.', updatedAt: '2026-06-08 12:12:35' },
  { name: 'dataforge-redshift-load-failed', state: 'OK', metric: 'RedshiftLoadFailures', namespace: 'dataforge/Warehouse', threshold: 1, reason: 'Redshift COPY succeeded.', updatedAt: '2026-06-08 12:16:30' },
];

// Map a demo scenario to the alarms it would trip, so mock mode mirrors the
// dynamic CloudWatch behavior wired up in live mode.
const SCENARIO_ALARMS: Partial<Record<ScenarioId, Record<string, string>>> = {
  bad_file: {
    'dataforge-dq-score-low': 'Quality score 0.6667 < threshold 0.95.',
    'dataforge-rejected-rows-high': 'RejectedRows 75 approaching threshold.',
  },
  glue_failed: { 'dataforge-glue-etl-failed': 'numFailedTasks 1 >= threshold 1 (OOM).' },
  schema_drift: { 'dataforge-glue-etl-failed': 'SchemaDriftException raised numFailedTasks.' },
  athena_failed: { 'dataforge-stepfunctions-failed': 'Athena step failed; execution aborted.' },
  redshift_failed: { 'dataforge-redshift-load-failed': 'RedshiftLoadFailures 1 >= threshold 1.' },
  alarm_triggered: { 'dataforge-rejected-rows-high': 'RejectedRows exceeded 5% threshold.' },
  lambda_rejected: { 'dataforge-lambda-errors': 'Validation Lambda raised an error.' },
  permission_denied: { 'dataforge-stepfunctions-failed': 'AccessDenied aborted the execution.' },
  kms_failure: { 'dataforge-stepfunctions-failed': 'KMS.DisabledException aborted the execution.' },
};

export function mockAlarms(scenarioId: ScenarioId): CloudWatchAlarm[] {
  const overlay = SCENARIO_ALARMS[scenarioId];
  if (!overlay) return BASE_ALARMS.map((a) => ({ ...a }));
  return BASE_ALARMS.map((a) =>
    overlay[a.name] ? { ...a, state: 'ALARM', reason: overlay[a.name] } : { ...a },
  );
}
