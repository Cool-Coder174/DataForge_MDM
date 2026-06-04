-- Athena queries powering the Data Quality Dashboard.
-- Replace ${curated_db} / ${master_db}.

-- Latest pipeline run status + quality score
SELECT run_id, run_ts, quality_score, total_rows, rejected_rows,
       failed_rule_count, status
FROM ${master_db}.dq_run_summary
ORDER BY run_ts DESC
LIMIT 1;

-- Quality score trend over time
SELECT run_ts, quality_score, rejected_rows
FROM ${master_db}.dq_run_summary
ORDER BY run_ts;

-- Failed rules in the latest run
WITH latest AS (
    SELECT max(run_id) AS run_id FROM ${curated_db}.dq_results
)
SELECT r.rule_id, r.description, r.status, r.failed_rows
FROM ${curated_db}.dq_results r
JOIN latest l ON r.run_id = l.run_id
ORDER BY r.failed_rows DESC;

-- Rejected rows landed in processed/rejected (count via the rejected table if crawled)
-- SELECT COUNT(*) AS rejected_rows FROM ${curated_db}.rejected_yellow_taxi;

-- Null count by required column (data profiling)
SELECT
    SUM(CASE WHEN vendor_id IS NULL THEN 1 ELSE 0 END)        AS null_vendor_id,
    SUM(CASE WHEN pickup_datetime IS NULL THEN 1 ELSE 0 END)  AS null_pickup,
    SUM(CASE WHEN dropoff_datetime IS NULL THEN 1 ELSE 0 END) AS null_dropoff,
    SUM(CASE WHEN fare_amount IS NULL THEN 1 ELSE 0 END)      AS null_fare,
    SUM(CASE WHEN passenger_count IS NULL THEN 1 ELSE 0 END)  AS null_passengers
FROM ${curated_db}.fact_trip;

-- Duplicate candidate count
SELECT COUNT(*) AS duplicate_groups
FROM (
    SELECT vendor_id, pickup_datetime, dropoff_datetime, pu_location_id, do_location_id
    FROM ${curated_db}.fact_trip
    GROUP BY vendor_id, pickup_datetime, dropoff_datetime, pu_location_id, do_location_id
    HAVING COUNT(*) > 1
);
