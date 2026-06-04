-- Athena external table DDL for the CURATED zone.
-- These let Athena query the Parquet output of the Glue ETL job directly.
-- Note: the Glue crawler can also create these automatically; this DDL is the
-- explicit/version-controlled alternative. Replace ${curated_db} / ${data_bucket}.

CREATE DATABASE IF NOT EXISTS ${curated_db};

-- fact_trip (partitioned by pickup_date)
CREATE EXTERNAL TABLE IF NOT EXISTS ${curated_db}.fact_trip (
    trip_id            STRING,
    vendor_id          INT,
    pickup_datetime    TIMESTAMP,
    dropoff_datetime   TIMESTAMP,
    passenger_count    INT,
    trip_distance      DOUBLE,
    pu_location_id     INT,
    do_location_id     INT,
    pickup_borough     STRING,
    pickup_zone        STRING,
    dropoff_borough    STRING,
    dropoff_zone       STRING,
    vendor_name        STRING,
    fare_amount        DOUBLE,
    tip_amount         DOUBLE,
    total_amount       DOUBLE,
    trip_duration_min  DOUBLE
)
PARTITIONED BY (pickup_date DATE)
STORED AS PARQUET
LOCATION 's3://${data_bucket}/curated/fact_trip/';

-- After creating, discover partitions:
--   MSCK REPAIR TABLE ${curated_db}.fact_trip;

CREATE EXTERNAL TABLE IF NOT EXISTS ${curated_db}.dim_date (
    date_key         INT,
    pickup_date      DATE,
    year             INT,
    month            INT,
    day              INT,
    day_of_week      STRING,
    is_weekend       BOOLEAN
)
STORED AS PARQUET
LOCATION 's3://${data_bucket}/curated/dim_date/';

CREATE EXTERNAL TABLE IF NOT EXISTS ${curated_db}.dim_zone (
    location_id   INT,
    borough       STRING,
    zone_name     STRING,
    service_zone  STRING
)
STORED AS PARQUET
LOCATION 's3://${data_bucket}/curated/dim_zone/';

CREATE EXTERNAL TABLE IF NOT EXISTS ${curated_db}.dim_vendor (
    vendor_id    INT,
    vendor_name  STRING,
    vendor_code  STRING
)
STORED AS PARQUET
LOCATION 's3://${data_bucket}/curated/dim_vendor/';

-- Data quality results (per-rule, per-run) written by the DQ Glue job.
CREATE EXTERNAL TABLE IF NOT EXISTS ${curated_db}.dq_results (
    rule_id        STRING,
    description    STRING,
    failed_rows    BIGINT,
    status         STRING,
    run_id         STRING,
    run_ts         STRING,
    quality_score  DOUBLE,
    total_rows     BIGINT
)
STORED AS PARQUET
LOCATION 's3://${data_bucket}/curated/dq_results/';
