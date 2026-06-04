-- 001_create_staging_tables.sql
-- Engine: Amazon Athena (Trino/Presto SQL) over the Glue Data Catalog.
-- Creates analytics-ready staging views from the curated S3 tables produced by
-- the Glue ETL job. Replace ${curated_db} with e.g. dataforge_curated.
-- Modular CTE style; views are cheap to (re)create and keep logic in version control.

-- Staging view: typed, standardized trip rows.
CREATE OR REPLACE VIEW ${curated_db}.stg_trips AS
WITH typed AS (
    SELECT
        trip_id,
        CAST(vendor_id AS INTEGER)               AS vendor_id,
        CAST(pickup_datetime AS TIMESTAMP)       AS pickup_datetime,
        CAST(dropoff_datetime AS TIMESTAMP)      AS dropoff_datetime,
        CAST(passenger_count AS INTEGER)         AS passenger_count,
        CAST(trip_distance AS DOUBLE)            AS trip_distance,
        CAST(pu_location_id AS INTEGER)          AS pu_location_id,
        CAST(do_location_id AS INTEGER)          AS do_location_id,
        CAST(fare_amount AS DOUBLE)              AS fare_amount,
        CAST(tip_amount AS DOUBLE)               AS tip_amount,
        CAST(total_amount AS DOUBLE)             AS total_amount,
        pickup_borough, pickup_zone,
        dropoff_borough, dropoff_zone,
        vendor_name,
        CAST(trip_duration_min AS DOUBLE)        AS trip_duration_min,
        CAST(pickup_date AS DATE)                AS pickup_date
    FROM ${curated_db}.fact_trip
)
SELECT * FROM typed;

-- Staging view: master zone + vendor reference (current/golden).
CREATE OR REPLACE VIEW ${curated_db}.stg_zone AS
SELECT CAST(location_id AS INTEGER) AS location_id, borough, zone_name, service_zone
FROM ${curated_db}.dim_zone;

CREATE OR REPLACE VIEW ${curated_db}.stg_vendor AS
SELECT CAST(vendor_id AS INTEGER) AS vendor_id, vendor_name, vendor_code
FROM ${curated_db}.dim_vendor;
