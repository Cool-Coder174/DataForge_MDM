-- Athena external table DDL for the MASTER zone (golden records + SCD2 + DQ summary).
-- Replace ${master_db} / ${data_bucket}.

CREATE DATABASE IF NOT EXISTS ${master_db};

-- SCD Type 2 zone master snapshot (written by glue_jobs/scd2_upsert.py).
CREATE EXTERNAL TABLE IF NOT EXISTS ${master_db}.dim_zone_scd2 (
    surrogate_key  BIGINT,
    natural_key    INT,
    borough        STRING,
    zone_name      STRING,
    service_zone   STRING,
    valid_from     TIMESTAMP,
    valid_to       TIMESTAMP,
    is_current     BOOLEAN,
    record_hash    STRING,
    created_at     TIMESTAMP,
    updated_at     TIMESTAMP
)
STORED AS PARQUET
LOCATION 's3://${data_bucket}/master/dim_zone_scd2/';

CREATE EXTERNAL TABLE IF NOT EXISTS ${master_db}.dim_vendor_scd2 (
    surrogate_key  BIGINT,
    natural_key    INT,
    vendor_name    STRING,
    vendor_code    STRING,
    tech_provider  STRING,
    valid_from     TIMESTAMP,
    valid_to       TIMESTAMP,
    is_current     BOOLEAN,
    record_hash    STRING,
    created_at     TIMESTAMP,
    updated_at     TIMESTAMP
)
STORED AS PARQUET
LOCATION 's3://${data_bucket}/master/dim_vendor_scd2/';

-- Per-run DQ roll-up.
CREATE EXTERNAL TABLE IF NOT EXISTS ${master_db}.dq_run_summary (
    run_id             STRING,
    run_ts             STRING,
    quality_score      DOUBLE,
    total_rows         BIGINT,
    rejected_rows      BIGINT,
    failed_rule_count  BIGINT,
    status             STRING
)
STORED AS PARQUET
LOCATION 's3://${data_bucket}/master/dq_run_summary/';
