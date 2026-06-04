-- TEST 003: fare_amount >= 0 AND passenger_count >= 0
-- Engine: Athena. PASS = zero rows.

SELECT
    'R03_fare_validity' AS rule_id,
    trip_id,
    fare_amount,
    passenger_count,
    CASE
        WHEN fare_amount < 0 THEN 'negative fare'
        WHEN passenger_count < 0 THEN 'negative passenger_count'
    END AS failure_reason
FROM ${curated_db}.stg_trips
WHERE fare_amount < 0
   OR passenger_count < 0;
