-- 004_load_redshift.sql
-- Engine: Amazon Redshift. Loads the dimensional model from curated/master S3
-- outputs using COPY. Run after warehouse_schema.sql has created the tables.
-- Replace ${data_bucket} and ${redshift_role_arn} (an IAM role attached to the
-- cluster with S3 read access).

-- Idempotent reload: truncate then COPY (small demo volumes).
TRUNCATE TABLE fact_trip;
TRUNCATE TABLE dim_date;

-- fact_trip from the enriched curated Parquet.
COPY fact_trip
FROM 's3://${data_bucket}/curated/fact_trip_enriched/'
IAM_ROLE '${redshift_role_arn}'
FORMAT AS PARQUET;

-- dim_date.
COPY dim_date
FROM 's3://${data_bucket}/curated/dim_date_sql/'
IAM_ROLE '${redshift_role_arn}'
FORMAT AS PARQUET;

-- SCD2 dims load from the master zone snapshots.
TRUNCATE TABLE dim_zone_scd2;
COPY dim_zone_scd2
FROM 's3://${data_bucket}/master/dim_zone_scd2/'
IAM_ROLE '${redshift_role_arn}'
FORMAT AS PARQUET;

TRUNCATE TABLE dim_vendor_scd2;
COPY dim_vendor_scd2
FROM 's3://${data_bucket}/master/dim_vendor_scd2/'
IAM_ROLE '${redshift_role_arn}'
FORMAT AS PARQUET;

-- Refresh DQ summary for the warehouse-side dashboard.
TRUNCATE TABLE dq_run_summary;
COPY dq_run_summary
FROM 's3://${data_bucket}/master/dq_run_summary/'
IAM_ROLE '${redshift_role_arn}'
FORMAT AS PARQUET;

-- Quick sanity counts after load.
SELECT 'fact_trip' AS tbl, COUNT(*) AS rows FROM fact_trip
UNION ALL SELECT 'dim_date', COUNT(*) FROM dim_date
UNION ALL SELECT 'dim_zone_scd2', COUNT(*) FROM dim_zone_scd2
UNION ALL SELECT 'dim_vendor_scd2', COUNT(*) FROM dim_vendor_scd2;
