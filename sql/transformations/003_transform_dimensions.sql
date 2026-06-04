-- 003_transform_dimensions.sql
-- Engine: Amazon Athena (Trino/Presto). Builds conformed dimensions for the
-- star schema: dim_date, plus analytics-friendly views over the SCD2 master
-- snapshots in the master zone (dim_zone_scd2 / dim_vendor_scd2).

-- dim_date derived from observed trip dates.
DROP TABLE IF EXISTS ${curated_db}.dim_date;
CREATE TABLE ${curated_db}.dim_date
WITH (format = 'PARQUET',
      external_location = 's3://${data_bucket}/curated/dim_date_sql/') AS
WITH dates AS (
    SELECT DISTINCT pickup_date AS date_value
    FROM ${curated_db}.stg_trips
    WHERE pickup_date IS NOT NULL
)
SELECT
    CAST(date_format(date_value, '%Y%m%d') AS INTEGER) AS date_key,
    date_value,
    year(date_value)             AS year,
    month(date_value)            AS month,
    day(date_value)              AS day,
    day_of_week(date_value)      AS day_of_week_num,
    date_format(date_value, '%W') AS day_of_week_name,
    day_of_week(date_value) IN (6, 7) AS is_weekend
FROM dates;

-- Current (is_current) view of the SCD2 zone master = golden dimension.
CREATE OR REPLACE VIEW ${master_db}.dim_zone_current AS
SELECT surrogate_key, location_id AS zone_natural_key,
       zone_name, borough, service_zone, valid_from
FROM ${master_db}.dim_zone_scd2
WHERE is_current = true;

CREATE OR REPLACE VIEW ${master_db}.dim_vendor_current AS
SELECT surrogate_key, vendor_id AS vendor_natural_key,
       vendor_name, vendor_code, tech_provider, valid_from
FROM ${master_db}.dim_vendor_scd2
WHERE is_current = true;
