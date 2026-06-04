-- TEST 001: required columns not null
-- Engine: Athena. Convention: a test PASSES when it returns ZERO rows.
-- Each row returned is a violating record (used to build data_quality_results).

SELECT
    'R01_required_fields' AS rule_id,
    trip_id,
    'null required column' AS failure_reason
FROM ${curated_db}.stg_trips
WHERE vendor_id        IS NULL
   OR pickup_datetime  IS NULL
   OR dropoff_datetime IS NULL
   OR pu_location_id   IS NULL
   OR do_location_id   IS NULL
   OR fare_amount      IS NULL;
