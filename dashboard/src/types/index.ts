export type ScenarioId =
  | 'healthy'
  | 'bad_file'
  | 'schema_drift'
  | 'glue_failed'
  | 'lambda_rejected'
  | 'retry_success'
  | 'rds_conflict'
  | 'athena_failed'
  | 'redshift_failed'
  | 'alarm_triggered'
  | 'permission_denied'
  | 'kms_failure'
  | 'late_data'
  | 'duplicate_file'
  | 'quarantine_review';

export interface Scenario {
  id: ScenarioId;
  name: string;
  description: string;
  category: 'Infrastructure' | 'Data Quality' | 'Processing' | 'Security';
}

export type NodeStatus = 'healthy' | 'warning' | 'failed' | 'skipped' | 'running';

export interface PipelineNode {
  id: string;
  name: string;
  type: string;
  status: NodeStatus;
  lastRun: string;
  recordsProcessed: number;
  recordsFailed: number;
  latencyMs: number;
  retryCount: number;
  error?: string;
  logs: string[];
}

export interface DQRule {
  ruleId: string;
  name: string;
  description: string;
  severity: 'low' | 'medium' | 'high';
  status: 'PASS' | 'FAIL' | 'WARNING';
  failedCount: number;
  suggestedFix: string;
  action: 'reject' | 'quarantine' | 'warn' | 'auto-fix' | 'retry';
}

export interface S3ZoneInfo {
  zone: 'raw' | 'processed' | 'curated' | 'master';
  fileCount: number;
  rowCount: number;
  sizeBytes: number;
  lastUpdated: string;
  schemaVersion: string;
  dqStatus: 'healthy' | 'warning' | 'critical';
  partitions: string[];
  lifecycleStatus: string;
}

export interface GoldenRecord {
  id: number;
  domain: 'vendors' | 'zones';
  naturalKey: number;
  name: string;
  codeOrBorough: string;
  providerOrServiceZone: string;
  contactOrBorough: string;
  sourceSystem: string;
  version: number;
  isCurrent: boolean;
  validFrom: string;
  validTo: string;
  recordHash: string;
}

export interface DuplicateCandidate {
  id: number;
  domain: 'vendors' | 'zones';
  naturalKey: number;
  name: string;
  codeOrBorough: string;
  providerOrServiceZone: string;
  sourceSystem: string;
  matchScore: number;
  duplicateOfId: number;
  reason: string;
}

export interface AuditEvent {
  id: string;
  timestamp: string;
  user: string;
  action: string;
  entity: string;
  status: 'SUCCESS' | 'FAILURE' | 'WARNING';
  details: string;
}

export type AlarmState = 'OK' | 'ALARM' | 'INSUFFICIENT_DATA';

export interface CloudWatchAlarm {
  name: string;
  state: AlarmState;
  metric: string;
  namespace: string;
  threshold: number | null;
  reason: string;
  updatedAt: string;
}

export interface AnalyticsKpis {
  total_trips: number;
  total_revenue: number;
  avg_fare: number;
  avg_distance_mi: number;
}

export interface BoroughDatum {
  pickup_borough: string;
  trips: number;
  revenue: number;
}

export interface VendorDatum {
  vendor_name: string;
  trips: number;
  avg_fare: number;
}

export interface RouteDatum {
  pickup_zone: string;
  dropoff_zone: string;
  trips: number;
  avg_fare?: number;
  avg_tip?: number;
}

export interface DailyTrendDatum {
  pickup_date: string;
  trips: number;
  revenue: number;
}

export interface HourlyDatum {
  pickup_hour: number;
  trips: number;
}

export type AnalyticsName =
  | 'kpis'
  | 'trips_by_borough'
  | 'trips_by_vendor'
  | 'top_routes'
  | 'daily_trend'
  | 'hourly_profile';

export interface AnalyticsResponse<T = Record<string, unknown>> {
  name: string;
  rows: T[];
}
