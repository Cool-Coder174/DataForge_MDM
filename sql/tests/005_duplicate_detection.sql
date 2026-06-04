-- TEST 005: duplicate trip detection + row-count threshold
-- Engine: Athena. PASS = zero rows for duplicates.
-- Natural key = vendor + pickup + dropoff + pickup/dropoff zone.

WITH dup AS (
    SELECT
        vendor_id, pickup_datetime, dropoff_datetime,
        pu_location_id, do_location_id,
        COUNT(*) AS occurrences
    FROM ${curated_db}.stg_trips
    GROUP BY vendor_id, pickup_datetime, dropoff_datetime,
             pu_location_id, do_location_id
    HAVING COUNT(*) > 1
)
SELECT
    'R05_duplicate_detection' AS rule_id,
    vendor_id, pickup_datetime, dropoff_datetime,
    pu_location_id, do_location_id, occurrences,
    'duplicate natural key' AS failure_reason
FROM dup;

-- Companion row-count threshold check (run separately):
--   SELECT CASE WHEN COUNT(*) >= 1 THEN 'PASS' ELSE 'FAIL' END AS row_count_check
--   FROM ${curated_db}.stg_trips;
