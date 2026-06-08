import type { ScenarioId, DQRule, S3ZoneInfo, PipelineNode } from '../types';
import { MOCK_DQ_RULES, MOCK_LAKE_ZONES } from './data';

// Canonical "healthy" pipeline topology. Scenario overlays mutate copies of
// this graph so the demo can simulate failures without a live backend.
export const DEFAULT_NODES: PipelineNode[] = [
  { id: 'src', name: 'External Sources', type: 'S3 Ingestion', status: 'healthy', lastRun: '2026-06-08 12:00:00', recordsProcessed: 2000, recordsFailed: 0, latencyMs: 250, retryCount: 0, logs: ['Scanning s3://dataforge-incoming/', 'Discovered yellow_taxi_sample.parquet'] },
  { id: 's3_in', name: 'S3 Incoming', type: 'Storage', status: 'healthy', lastRun: '2026-06-08 12:00:02', recordsProcessed: 2000, recordsFailed: 0, latencyMs: 50, retryCount: 0, logs: ['ObjectCreated event triggered', 'File size: 72KB'] },
  { id: 'ev_bridge', name: 'EventBridge', type: 'Trigger', status: 'healthy', lastRun: '2026-06-08 12:00:03', recordsProcessed: 1, recordsFailed: 0, latencyMs: 15, retryCount: 0, logs: ['Matched S3 upload rule', 'Routing target: Step Functions State Machine'] },
  { id: 'sfn', name: 'Step Functions', type: 'Orchestrator', status: 'healthy', lastRun: '2026-06-08 12:00:04', recordsProcessed: 1, recordsFailed: 0, latencyMs: 40000, retryCount: 0, logs: ['Execution started: run_9f2a', 'State: ValidateIncomingFile'] },
  { id: 'lambda_val', name: 'Lambda Validate', type: 'Compute', status: 'healthy', lastRun: '2026-06-08 12:00:05', recordsProcessed: 2000, recordsFailed: 0, latencyMs: 120, retryCount: 0, logs: ['Action: validate', 'File extension .parquet supported', 'File is not empty'] },
  { id: 's3_raw', name: 'S3 raw/', type: 'Data Lake', status: 'healthy', lastRun: '2026-06-08 12:00:20', recordsProcessed: 2000, recordsFailed: 0, latencyMs: 80, retryCount: 0, logs: ['Preserved incoming folder structure', 'Wrote to raw/yellow_taxi/'] },
  { id: 'glue_crawl', name: 'Glue Crawler', type: 'Catalog', status: 'healthy', lastRun: '2026-06-08 12:02:15', recordsProcessed: 1, recordsFailed: 0, latencyMs: 110000, retryCount: 0, logs: ['Running raw_crawler', 'Updated partition information in Glue Data Catalog'] },
  { id: 'glue_etl', name: 'Glue PySpark ETL', type: 'Processing', status: 'healthy', lastRun: '2026-06-08 12:05:40', recordsProcessed: 2000, recordsFailed: 0, latencyMs: 180000, retryCount: 0, logs: ['Running Spark batch_etl_job', 'All 2,000 trips passed validation (0 rejected)'] },
  { id: 'glue_dq', name: 'Glue Data Quality', type: 'Quality Gate', status: 'healthy', lastRun: '2026-06-08 12:12:35', recordsProcessed: 2000, recordsFailed: 0, latencyMs: 150000, retryCount: 0, logs: ['Running data_quality_job', 'Passed score: 1.0 >= threshold 0.95'] },
  { id: 'athena', name: 'Athena SQL Transformations', type: 'SQL serving', status: 'healthy', lastRun: '2026-06-08 12:14:00', recordsProcessed: 2000, recordsFailed: 0, latencyMs: 12500, retryCount: 0, logs: ['Running analytics queries', 'Rebuilding stage view schemas'] },
  { id: 'glue_scd2', name: 'Glue MDM/SCD2', type: 'Processing', status: 'healthy', lastRun: '2026-06-08 12:15:10', recordsProcessed: 276, recordsFailed: 0, latencyMs: 120000, retryCount: 0, logs: ['Running scd2_upsert_job', 'Created 4 golden vendor records', 'Versioned 1 change'] },
  { id: 'rds', name: 'RDS PostgreSQL (MDM)', type: 'Database', status: 'healthy', lastRun: '2026-06-08 12:15:30', recordsProcessed: 276, recordsFailed: 0, latencyMs: 12, retryCount: 0, logs: ['SCD2 upsert completed', 'Applied schema migrations'] },
  { id: 'redshift', name: 'Redshift Warehouse', type: 'Analytics Server', status: 'healthy', lastRun: '2026-06-08 12:16:30', recordsProcessed: 2000, recordsFailed: 0, latencyMs: 25000, retryCount: 0, logs: ['TRUNCATE tables executed', 'COPY fact_trip from S3 parquet completed'] },
];

export interface ScenarioState {
  rules: DQRule[];
  nodes: PipelineNode[];
  zones: S3ZoneInfo[];
}

// Pure projection of a scenario id onto fresh copies of the baseline data.
export function applyScenario(scenarioId: ScenarioId): ScenarioState {
  let rules = MOCK_DQ_RULES.map((r) => ({ ...r }));
  let nodes = DEFAULT_NODES.map((n) => ({ ...n }));
  let zones = MOCK_LAKE_ZONES.map((z) => ({ ...z }));

  switch (scenarioId) {
    case 'bad_file':
      rules = rules.map((r) => {
        if (r.ruleId === 'R02') return { ...r, status: 'FAIL', failedCount: 12 };
        if (r.ruleId === 'R03') return { ...r, status: 'FAIL', failedCount: 45 };
        if (r.ruleId === 'R05') return { ...r, status: 'WARNING', failedCount: 18 };
        return r;
      });
      nodes = nodes.map((n) => {
        if (n.id === 'glue_dq') return { ...n, status: 'failed', recordsFailed: 75, error: 'Quality score 0.6667 < threshold 0.95' };
        if (n.id === 'glue_etl') return { ...n, status: 'warning', recordsFailed: 75 };
        if (n.id === 'athena' || n.id === 'glue_scd2' || n.id === 'redshift') return { ...n, status: 'skipped' };
        return n;
      });
      zones = zones.map((z) => {
        if (z.zone === 'processed') return { ...z, dqStatus: 'warning', rowCount: 1950 };
        if (z.zone === 'curated' || z.zone === 'master') return { ...z, dqStatus: 'critical', rowCount: 0 };
        return z;
      });
      break;

    case 'schema_drift':
      rules = rules.map((r) => {
        if (r.ruleId === 'R01') return { ...r, status: 'FAIL', failedCount: 2000, description: 'Required fields schema drift (missing rate_code_id, extra passenger_gender)' };
        return r;
      });
      nodes = nodes.map((n) => {
        if (n.id === 'glue_etl') return { ...n, status: 'failed', error: 'SchemaDriftException: Column schema mismatch on rate_code_id' };
        if (n.id === 'glue_dq' || n.id === 'athena' || n.id === 'glue_scd2' || n.id === 'redshift') return { ...n, status: 'skipped' };
        return n;
      });
      zones = zones.map((z) => {
        if (z.zone === 'raw') return { ...z, schemaVersion: 'v1.0.1 (DRIFT)' };
        return z;
      });
      break;

    case 'glue_failed':
      nodes = nodes.map((n) => {
        if (n.id === 'glue_etl') return { ...n, status: 'failed', error: 'java.lang.OutOfMemoryError: Java heap space (Executor loss)' };
        if (n.id === 'glue_dq' || n.id === 'athena' || n.id === 'glue_scd2' || n.id === 'redshift') return { ...n, status: 'skipped' };
        return n;
      });
      break;

    case 'lambda_rejected':
      nodes = nodes.map((n) => {
        if (n.id === 'lambda_val') return { ...n, status: 'failed', error: 'ValueError: Unsupported file extension .xlsx' };
        if (n.id === 's3_raw' || n.id === 'glue_crawl' || n.id === 'glue_etl' || n.id === 'glue_dq' || n.id === 'athena' || n.id === 'glue_scd2' || n.id === 'redshift') return { ...n, status: 'skipped' };
        return n;
      });
      break;

    case 'retry_success':
      nodes = nodes.map((n) => {
        if (n.id === 'glue_crawl') return { ...n, status: 'healthy', retryCount: 1, logs: ['Crawler crawler-raw failed run 1: ConcurrentRunsExceededException', 'Retry scheduled in 10s', 'Crawler crawler-raw run 2: SUCCESS'] };
        return n;
      });
      break;

    case 'athena_failed':
      nodes = nodes.map((n) => {
        if (n.id === 'athena') return { ...n, status: 'failed', error: 'QueryTimeoutException: Query execution 0a1b2c exceeded max limits' };
        if (n.id === 'glue_scd2' || n.id === 'redshift') return { ...n, status: 'skipped' };
        return n;
      });
      break;

    case 'redshift_failed':
      nodes = nodes.map((n) => {
        if (n.id === 'redshift') return { ...n, status: 'failed', error: 'LoadError: String length exceeds DDL length on zone_name (Code: 1205)' };
        return n;
      });
      break;

    case 'permission_denied':
      nodes = nodes.map((n) => {
        if (n.id === 's3_raw') return { ...n, status: 'failed', error: 'AccessDenied: s3:PutObject on arn:aws:s3:::dataforge-test/raw/ (KMS key issue or bucket policy)' };
        if (n.id === 'glue_crawl' || n.id === 'glue_etl' || n.id === 'glue_dq' || n.id === 'athena' || n.id === 'glue_scd2' || n.id === 'redshift') return { ...n, status: 'skipped' };
        return n;
      });
      break;

    case 'kms_failure':
      nodes = nodes.map((n) => {
        if (n.id === 's3_raw') return { ...n, status: 'failed', error: 'KMS.DisabledException: The KMS Key is currently disabled and cannot decrypt S3 raw headers.' };
        if (n.id === 'glue_crawl' || n.id === 'glue_etl' || n.id === 'glue_dq' || n.id === 'athena' || n.id === 'glue_scd2' || n.id === 'redshift') return { ...n, status: 'skipped' };
        return n;
      });
      break;

    // 'healthy', 'rds_conflict', 'alarm_triggered', and the remaining ids use
    // the clean baseline (their effects surface in other panels).
    default:
      break;
  }

  return { rules, nodes, zones };
}
