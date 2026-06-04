-- 002_transform_fact_trip.sql
-- Engine: Amazon Athena (Trino/Presto). Builds the analytics fact table with
-- master-data enrichment + derived measures using modular CTEs, and writes it
-- back to S3 as a curated Parquet table via CTAS.

DROP TABLE IF EXISTS ${curated_db}.fact_trip_enriched;

CREATE TABLE ${curated_db}.fact_trip_enriched
WITH (
    format = 'PARQUET',
    external_location = 's3://${data_bucket}/curated/fact_trip_enriched/',
    partitioned_by = ARRAY['pickup_date']
) AS
WITH trips AS (
    SELECT * FROM ${curated_db}.stg_trips
),
-- Enrich with master zone names (pickup + dropoff) from golden reference.
enriched_zone AS (
    SELECT
        t.*,
        z_pu.borough  AS m_pickup_borough,
        z_pu.zone_name AS m_pickup_zone,
        z_do.borough  AS m_dropoff_borough,
        z_do.zone_name AS m_dropoff_zone
    FROM trips t
    LEFT JOIN ${curated_db}.stg_zone z_pu ON t.pu_location_id = z_pu.location_id
    LEFT JOIN ${curated_db}.stg_zone z_do ON t.do_location_id = z_do.location_id
),
-- Enrich with vendor master.
enriched_vendor AS (
    SELECT
        e.*,
        v.vendor_name AS m_vendor_name,
        v.vendor_code AS m_vendor_code
    FROM enriched_zone e
    LEFT JOIN ${curated_db}.stg_vendor v ON e.vendor_id = v.vendor_id
),
-- Derived measures.
measured AS (
    SELECT
        trip_id, vendor_id, m_vendor_name AS vendor_name, m_vendor_code AS vendor_code,
        pickup_datetime, dropoff_datetime,
        passenger_count, trip_distance,
        pu_location_id, do_location_id,
        COALESCE(m_pickup_borough, pickup_borough)   AS pickup_borough,
        COALESCE(m_pickup_zone, pickup_zone)         AS pickup_zone,
        COALESCE(m_dropoff_borough, dropoff_borough) AS dropoff_borough,
        COALESCE(m_dropoff_zone, dropoff_zone)       AS dropoff_zone,
        fare_amount, tip_amount, total_amount,
        trip_duration_min,
        CASE WHEN trip_distance > 0
             THEN ROUND(fare_amount / trip_distance, 2) END AS fare_per_mile,
        CASE WHEN fare_amount > 0
             THEN ROUND(tip_amount / fare_amount, 4) END AS tip_pct,
        pickup_date
    FROM enriched_vendor
)
SELECT * FROM measured;
