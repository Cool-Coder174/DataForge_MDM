import type { Scenario, DQRule, S3ZoneInfo, GoldenRecord, DuplicateCandidate, AuditEvent } from '../types';

export const SCENARIOS: Scenario[] = [
  {
    id: 'healthy',
    name: 'Healthy Pipeline Run',
    description: 'All S3 data ingests successfully, data quality score is 1.0 (PASS), golden records are updated, and Redshift loads clean dimensions.',
    category: 'Processing'
  },
  {
    id: 'bad_file',
    name: 'Bad Source File Uploaded',
    description: 'A raw Parquet file contains negative fares, dropoff dates before pickup, and invalid vendor IDs, causing a low data quality score.',
    category: 'Data Quality'
  },
  {
    id: 'schema_drift',
    name: 'Schema Drift Detected',
    description: 'Incoming taxi CSV contains an unexpected extra column ("passenger_gender") and is missing a required column ("rate_code_id").',
    category: 'Data Quality'
  },
  {
    id: 'glue_failed',
    name: 'Glue ETL Job Failure',
    description: 'The PySpark ETL job crashes due to an out-of-memory error when processing a larger batch size, triggering a CloudWatch alarm.',
    category: 'Processing'
  },
  {
    id: 'lambda_rejected',
    name: 'Lambda Validation Rejections',
    description: 'File validator Lambda rejects incoming files that are empty (0 bytes) or use unsupported file formats (.xlsx).',
    category: 'Processing'
  },
  {
    id: 'retry_success',
    name: 'Step Functions Retry Succeeded',
    description: 'Glue crawler initially fails due to a ConcurrentRunsExceededException, but Step Functions retries and succeeds on the second attempt.',
    category: 'Processing'
  },
  {
    id: 'rds_conflict',
    name: 'RDS Golden Record Conflict',
    description: 'Fuzzy matcher finds multiple matching candidates for the same zone with contradictory borough codes, raising an MDM merge conflict flag.',
    category: 'Infrastructure'
  },
  {
    id: 'athena_failed',
    name: 'Athena Query Timeout',
    description: 'An Athena query execution times out after exceeding the DDL query run limit, leaving curated staging tables unpopulated.',
    category: 'Processing'
  },
  {
    id: 'redshift_failed',
    name: 'Redshift Load Rejected Rows',
    description: 'Redshift COPY statement fails with error 1025 (string length overflow) because of unescaped text in the zones source file.',
    category: 'Processing'
  },
  {
    id: 'alarm_triggered',
    name: 'CloudWatch Alarm Triggered',
    description: 'The RejectedRows metric exceeds the threshold of 5%, sending a critical alarm via SNS to the operations team.',
    category: 'Infrastructure'
  },
  {
    id: 'permission_denied',
    name: 'IAM Permission Denied',
    description: 'The Glue service role lacks S3GetObject permissions on the raw/ S3 prefix, causing access denied exceptions.',
    category: 'Security'
  },
  {
    id: 'kms_failure',
    name: 'KMS Decryption Failure',
    description: 'Step Functions fails to decrypt raw S3 payloads because the CMK key has been disabled or deleted from KMS.',
    category: 'Security'
  }
];

// Real trips drawn from NYC TLC yellow_tripdata_2025-08.parquet, enriched with
// the TLC zone lookup (see data/sample/_generate_taxi_sample.py).
export const MOCK_GOOD_TRIPS = [
  { trip_id: 'ft_001', vendor_id: 2, vendor_name: 'VeriFone Inc', pickup_datetime: '2025-08-03 13:24:10', dropoff_datetime: '2025-08-03 14:17:49', passenger_count: 4, trip_distance: 17.41, pu_location_id: 132, pickup_zone: 'JFK Airport', pickup_borough: 'Queens', do_location_id: 230, dropoff_zone: 'Times Sq/Theatre District', dropoff_borough: 'Manhattan', fare_amount: 120.00, tip_amount: 24.85, total_amount: 150.85, trip_duration_min: 53.65 },
  { trip_id: 'ft_002', vendor_id: 2, vendor_name: 'VeriFone Inc', pickup_datetime: '2025-08-13 07:50:00', dropoff_datetime: '2025-08-13 08:13:09', passenger_count: 1, trip_distance: 16.73, pu_location_id: 50, pickup_zone: 'Clinton West', pickup_borough: 'Manhattan', do_location_id: 1, dropoff_zone: 'Newark Airport', dropoff_borough: 'EWR', fare_amount: 112.90, tip_amount: 20.00, total_amount: 157.11, trip_duration_min: 23.15 },
  { trip_id: 'ft_003', vendor_id: 2, vendor_name: 'VeriFone Inc', pickup_datetime: '2025-08-12 09:40:07', dropoff_datetime: '2025-08-12 11:34:11', passenger_count: 1, trip_distance: 27.09, pu_location_id: 164, pickup_zone: 'Midtown South', pickup_borough: 'Manhattan', do_location_id: 164, dropoff_zone: 'Midtown South', dropoff_borough: 'Manhattan', fare_amount: 138.10, tip_amount: 44.94, total_amount: 194.73, trip_duration_min: 114.07 }
];

export const MOCK_BAD_TRIPS = [
  { trip_id: 'ft_bad_01', vendor_id: 99, vendor_name: 'Unknown', pickup_datetime: '2026-06-08 14:00:00', dropoff_datetime: '2026-06-08 13:45:00', passenger_count: -1, trip_distance: -2.5, pu_location_id: 999, pickup_zone: 'Unknown', pickup_borough: 'Unknown', do_location_id: 888, dropoff_zone: 'Unknown', dropoff_borough: 'Unknown', fare_amount: -15.00, tip_amount: 50.00, total_amount: 35.00, error_reason: 'Negative passengers, Negative fare, Dropoff before pickup, Unknown vendor' },
  { trip_id: 'ft_bad_02', vendor_id: 1, vendor_name: 'Creative Mobile Technologies', pickup_datetime: '2026-06-08 15:30:00', dropoff_datetime: '2026-06-08 15:50:00', passenger_count: 0, trip_distance: 0.0, pu_location_id: 7, pickup_zone: 'Astoria', pickup_borough: 'Queens', do_location_id: 161, dropoff_zone: 'Midtown Center', dropoff_borough: 'Manhattan', fare_amount: 120.00, tip_amount: 200.00, total_amount: 320.00, error_reason: 'Zero trip distance, Fare too high ($120 for 0 miles), Tip greater than fare' },
  { trip_id: 'ft_bad_03', vendor_id: null, vendor_name: 'Missing', pickup_datetime: '2026-06-08 16:00:00', dropoff_datetime: '2026-06-08 16:15:00', passenger_count: null, trip_distance: 1.2, pu_location_id: null, pickup_zone: 'Missing', pickup_borough: 'Missing', do_location_id: 161, dropoff_zone: 'Midtown Center', dropoff_borough: 'Manhattan', fare_amount: null, tip_amount: 0.00, total_amount: 0.00, error_reason: 'Missing vendor ID, Missing pickup location, Missing fare amount' }
];

export const MOCK_DQ_RULES = [
  { ruleId: 'R01', name: 'Required fields not null', description: 'Checks that critical columns like vendor_id, pickup_datetime, fare_amount are not null', severity: 'high', status: 'PASS', failedCount: 0, suggestedFix: 'Verify source payload parsing or discard corrupt rows', action: 'reject' },
  { ruleId: 'R02', name: 'Pickup before dropoff', description: 'Validates that dropoff_datetime is chronologically after pickup_datetime', severity: 'high', status: 'PASS', failedCount: 0, suggestedFix: 'Flip columns if inverted, or quarantine event', action: 'quarantine' },
  { ruleId: 'R03', name: 'Fare amount non-negative', description: 'Ensures fare_amount is greater than or equal to 0', severity: 'high', status: 'PASS', failedCount: 0, suggestedFix: 'Reject negative fare records or convert absolute value', action: 'reject' },
  { ruleId: 'R04', name: 'Passenger count non-negative', description: 'Validates passenger_count is greater than or equal to 0', severity: 'low', status: 'PASS', failedCount: 0, suggestedFix: 'Default null or negative counts to 0 or 1', action: 'auto-fix' },
  { ruleId: 'R05', name: 'Referential integrity - Vendors', description: 'Ensures vendor_id exists in reference vendor master catalog', severity: 'medium', status: 'PASS', failedCount: 0, suggestedFix: 'Flag unknown vendors for reference metadata seeding', action: 'warn' },
  { ruleId: 'R06', name: 'Referential integrity - Pickup Zone', description: 'Ensures pu_location_id maps to a valid zone in master zone lookups', severity: 'medium', status: 'PASS', failedCount: 0, suggestedFix: 'Map unknown zones to a default "Unknown/Boro Zone"', action: 'warn' },
  { ruleId: 'R07', name: 'Referential integrity - Dropoff Zone', description: 'Ensures do_location_id maps to a valid zone in master zone lookups', severity: 'medium', status: 'PASS', failedCount: 0, suggestedFix: 'Map unknown zones to a default "Unknown/Boro Zone"', action: 'warn' },
  { ruleId: 'R08', name: 'Duplicate record check', description: 'Identifies exact duplicate trip logs (same vendor, times, locations, and fare)', severity: 'medium', status: 'PASS', failedCount: 0, suggestedFix: 'Deduplicate using row_number window functions', action: 'auto-fix' },
  { ruleId: 'R09', name: 'Row-count validation', description: 'Validates that the batch size meets the minimum expected threshold of rows', severity: 'high', status: 'PASS', failedCount: 0, suggestedFix: 'Halt pipeline if size is suspiciously low or empty', action: 'reject' }
] as DQRule[];

export const MOCK_LAKE_ZONES = [
  { zone: 'raw', fileCount: 3, rowCount: 2000, sizeBytes: 74094, lastUpdated: '2026-06-08 12:02:15', schemaVersion: 'v1.0.0', dqStatus: 'healthy', partitions: ['year=2025/month=08'], lifecycleStatus: 'Active (Archive in 30d)' },
  { zone: 'processed', fileCount: 3, rowCount: 2000, sizeBytes: 70210, lastUpdated: '2026-06-08 12:05:40', schemaVersion: 'v1.0.0', dqStatus: 'healthy', partitions: ['year=2025/month=08'], lifecycleStatus: 'Active (Archive in 90d)' },
  { zone: 'curated', fileCount: 6, rowCount: 2000, sizeBytes: 65820, lastUpdated: '2026-06-08 12:12:35', schemaVersion: 'v1.1.0', dqStatus: 'healthy', partitions: ['pickup_date=2025-08-01 … 2025-08-13'], lifecycleStatus: 'Active' },
  { zone: 'master', fileCount: 4, rowCount: 276, sizeBytes: 10875, lastUpdated: '2026-06-08 12:15:10', schemaVersion: 'v1.0.1', dqStatus: 'healthy', partitions: ['No Partition'], lifecycleStatus: 'Active' }
] as S3ZoneInfo[];

export const MOCK_GOLDEN_VENDORS = [
  { id: 1, domain: 'vendors', naturalKey: 1, name: 'Creative Mobile Technologies LLC', codeOrBorough: 'CMT', providerOrServiceZone: 'Creative Mobile Technologies', contactOrBorough: 'ops@cmtnyc.com', sourceSystem: 'tlc_registry', version: 2, isCurrent: true, validFrom: '2024-01-01', validTo: '9999-12-31', recordHash: 'h_vend1' },
  { id: 2, domain: 'vendors', naturalKey: 2, name: 'VeriFone Inc', codeOrBorough: 'VTS', providerOrServiceZone: 'VeriFone', contactOrBorough: 'support@verifone.com', sourceSystem: 'tlc_registry', version: 3, isCurrent: true, validFrom: '2024-02-12', validTo: '9999-12-31', recordHash: 'h_vend2' },
  { id: 3, domain: 'vendors', naturalKey: 6, name: 'Myle Technologies Inc', codeOrBorough: 'MYLE', providerOrServiceZone: 'Myle', contactOrBorough: 'hello@myle.com', sourceSystem: 'tlc_registry', version: 1, isCurrent: true, validFrom: '2024-05-10', validTo: '9999-12-31', recordHash: 'h_vend3' }
] as GoldenRecord[];

export const MOCK_GOLDEN_ZONES = [
  { id: 10, domain: 'zones', naturalKey: 7, name: 'Astoria', codeOrBorough: 'Queens', providerOrServiceZone: 'Boro Zone', contactOrBorough: 'manual_entry', version: 1, isCurrent: true, validFrom: '2024-01-01', validTo: '9999-12-31', recordHash: 'h_zone7' },
  { id: 11, domain: 'zones', naturalKey: 132, name: 'JFK Airport', codeOrBorough: 'Queens', providerOrServiceZone: 'Airports', contactOrBorough: 'manual_entry', version: 1, isCurrent: true, validFrom: '2024-01-01', validTo: '9999-12-31', recordHash: 'h_zone132' },
  { id: 12, domain: 'zones', naturalKey: 161, name: 'Midtown Center', codeOrBorough: 'Manhattan', providerOrServiceZone: 'Yellow Zone', contactOrBorough: 'manual_entry', version: 2, isCurrent: true, validFrom: '2024-03-10', validTo: '9999-12-31', recordHash: 'h_zone161' },
  { id: 13, domain: 'zones', naturalKey: 236, name: 'Upper East Side North', codeOrBorough: 'Manhattan', providerOrServiceZone: 'Yellow Zone', contactOrBorough: 'manual_entry', version: 1, isCurrent: true, validFrom: '2024-01-01', validTo: '9999-12-31', recordHash: 'h_zone236' }
] as GoldenRecord[];

export const MOCK_DUPLICATES = [
  { id: 101, domain: 'vendors', naturalKey: 1, name: 'CMT LLC', codeOrBorough: 'CMT', providerOrServiceZone: 'Creative Mobile Tech', sourceSystem: 'finance_billing', matchScore: 0.92, duplicateOfId: 1, reason: 'Name normalized match score high (CMT LLC vs Creative Mobile Technologies LLC)' },
  { id: 102, domain: 'vendors', naturalKey: 2, name: 'Verifone Corp', codeOrBorough: 'VTS', providerOrServiceZone: 'VeriFone', sourceSystem: 'telematics_feed', matchScore: 0.89, duplicateOfId: 2, reason: 'Typo in name (Verifone vs VeriFone)' },
  { id: 103, domain: 'zones', naturalKey: 7, name: 'astoria  ', codeOrBorough: 'Queens', providerOrServiceZone: 'Boro Zone', sourceSystem: 'trip_logs', matchScore: 1.00, duplicateOfId: 10, reason: 'Exact match after whitespace trimming and lowercasing' },
  { id: 104, domain: 'zones', naturalKey: 161, name: 'Midtown Ctr', codeOrBorough: 'Manhattan', providerOrServiceZone: 'Yellow Zone', sourceSystem: 'trip_logs', matchScore: 0.85, duplicateOfId: 12, reason: 'Abbreviation match (Ctr vs Center)' }
] as DuplicateCandidate[];

export const MOCK_AUDIT_LOGS = [
  { id: 'aud_001', timestamp: '2026-06-08 12:00:05', user: 'System (S3 Event)', action: 'VALIDATION', entity: 'incoming/yellow_taxi_sample.parquet', status: 'SUCCESS', details: 'File size: 72KB. Contains 2,000 rows (NYC TLC yellow_tripdata_2025-08).' },
  { id: 'aud_002', timestamp: '2026-06-08 12:00:20', user: 'System (SFN)', action: 'COPY_TO_RAW', entity: 'raw/yellow_taxi/', status: 'SUCCESS', details: 'Copied incoming/ files into S3 raw/ zone.' },
  { id: 'aud_003', timestamp: '2026-06-08 12:02:15', user: 'System (Glue Crawler)', action: 'SCHEMA_UPDATE', entity: 'raw_crawler', status: 'SUCCESS', details: 'Crawler detected no schema changes. Partition updated.' },
  { id: 'aud_004', timestamp: '2026-06-08 12:05:40', user: 'System (Glue ETL)', action: 'PROCESSING', entity: 'batch_etl_job', status: 'SUCCESS', details: 'Processed 2,000 raw rows. Written 2,000 valid rows, 0 rejected.' },
  { id: 'aud_005', timestamp: '2026-06-08 12:12:35', user: 'System (Glue DQ)', action: 'DATA_QUALITY', entity: 'data_quality_job', status: 'SUCCESS', details: 'DQ score: 1.0 (Passed all 9 rules). Custom metrics published.' },
  { id: 'aud_006', timestamp: '2026-06-08 12:15:10', user: 'System (Glue SCD2)', action: 'MDM_UPSERT', entity: 'scd2_upsert_job', status: 'SUCCESS', details: 'Vendor 2 versioned due to contact details change. Zone 7 remains unchanged.' },
  { id: 'aud_007', timestamp: '2026-06-08 12:15:30', user: 'arn:aws:iam::123456789012:role/DataForgeStepFunctions', action: 'API_GET_SECRET', entity: 'SecretsManager', status: 'SUCCESS', details: 'Retrieved secret dataforge/rds/master successfully.' },
  { id: 'aud_008', timestamp: '2026-06-08 12:18:22', user: 'isaac_admin', action: 'MDM_MANUAL_MERGE', entity: 'zones/Astoria', status: 'SUCCESS', details: 'Merged duplicate candidate 103 ("astoria") into golden record 10.' }
] as AuditEvent[];
