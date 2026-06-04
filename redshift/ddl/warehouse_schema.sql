-- Amazon Redshift dimensional warehouse schema (star schema).
-- Distribution + sort keys chosen for the NYC taxi access patterns:
--   fact_trip: DISTKEY on pickup zone (common join/group), SORTKEY on date.
--   small dims: DISTSTYLE ALL (broadcast to every node) for fast joins.

-- ----------------------------------------------------------------- dim_date
CREATE TABLE IF NOT EXISTS dim_date (
    date_key     INTEGER       NOT NULL,
    date_value   DATE          NOT NULL,
    year         SMALLINT,
    month        SMALLINT,
    day          SMALLINT,
    day_of_week  VARCHAR(12),
    is_weekend   BOOLEAN,
    PRIMARY KEY (date_key)
) DISTSTYLE ALL SORTKEY (date_key);

-- ------------------------------------------------------------ dim_zone_scd2
CREATE TABLE IF NOT EXISTS dim_zone_scd2 (
    surrogate_key BIGINT       NOT NULL,
    natural_key   INTEGER      NOT NULL,   -- LocationID
    borough       VARCHAR(64),
    zone_name     VARCHAR(128),
    service_zone  VARCHAR(64),
    valid_from    TIMESTAMP,
    valid_to      TIMESTAMP,
    is_current    BOOLEAN,
    record_hash   VARCHAR(64),
    created_at    TIMESTAMP,
    updated_at    TIMESTAMP,
    PRIMARY KEY (surrogate_key)
) DISTSTYLE ALL SORTKEY (natural_key, valid_from);

-- ---------------------------------------------------------- dim_vendor_scd2
CREATE TABLE IF NOT EXISTS dim_vendor_scd2 (
    surrogate_key BIGINT       NOT NULL,
    natural_key   INTEGER      NOT NULL,   -- VendorID
    vendor_name   VARCHAR(128),
    vendor_code   VARCHAR(32),
    tech_provider VARCHAR(128),
    valid_from    TIMESTAMP,
    valid_to      TIMESTAMP,
    is_current    BOOLEAN,
    record_hash   VARCHAR(64),
    created_at    TIMESTAMP,
    updated_at    TIMESTAMP,
    PRIMARY KEY (surrogate_key)
) DISTSTYLE ALL SORTKEY (natural_key, valid_from);

-- ----------------------------------------------------------------- fact_trip
CREATE TABLE IF NOT EXISTS fact_trip (
    trip_id           VARCHAR(64)  NOT NULL,
    vendor_id         INTEGER,
    vendor_name       VARCHAR(128),
    vendor_code       VARCHAR(32),
    pickup_datetime   TIMESTAMP,
    dropoff_datetime  TIMESTAMP,
    passenger_count   INTEGER,
    trip_distance     DECIMAL(8,2),
    pu_location_id    INTEGER,
    do_location_id    INTEGER,
    pickup_borough    VARCHAR(64),
    pickup_zone       VARCHAR(128),
    dropoff_borough   VARCHAR(64),
    dropoff_zone      VARCHAR(128),
    fare_amount       DECIMAL(10,2),
    tip_amount        DECIMAL(10,2),
    total_amount      DECIMAL(10,2),
    trip_duration_min DECIMAL(10,2),
    fare_per_mile     DECIMAL(10,2),
    tip_pct           DECIMAL(6,4),
    pickup_date       DATE
) DISTKEY (pu_location_id) SORTKEY (pickup_date);

-- ------------------------------------------------------------- dq_run_summary
CREATE TABLE IF NOT EXISTS dq_run_summary (
    run_id            VARCHAR(32),
    run_ts            VARCHAR(32),
    quality_score     DECIMAL(5,4),
    total_rows        BIGINT,
    rejected_rows     BIGINT,
    failed_rule_count INTEGER,
    status            VARCHAR(8)
) DISTSTYLE ALL SORTKEY (run_ts);
