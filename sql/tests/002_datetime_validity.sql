-- TEST 002: pickup datetime must be strictly before dropoff datetime
-- Engine: Athena. PASS = zero rows.

SELECT
    'R02_datetime_validity' AS rule_id,
    trip_id,
    pickup_datetime,
    dropoff_datetime,
    'dropoff not after pickup' AS failure_reason
FROM ${curated_db}.stg_trips
WHERE dropoff_datetime <= pickup_datetime;
