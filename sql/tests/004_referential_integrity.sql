-- TEST 004: referential integrity against master tables
--   vendor_id exists in master vendor table
--   pickup_location_id exists in master zone table
--   dropoff_location_id exists in master zone table
-- Engine: Athena. PASS = zero rows.

WITH bad_vendor AS (
    SELECT t.trip_id, 'vendor_id not in master' AS failure_reason
    FROM ${curated_db}.stg_trips t
    LEFT JOIN ${curated_db}.stg_vendor v ON t.vendor_id = v.vendor_id
    WHERE v.vendor_id IS NULL
),
bad_pickup AS (
    SELECT t.trip_id, 'pickup_location_id not in master' AS failure_reason
    FROM ${curated_db}.stg_trips t
    LEFT JOIN ${curated_db}.stg_zone z ON t.pu_location_id = z.location_id
    WHERE z.location_id IS NULL
),
bad_dropoff AS (
    SELECT t.trip_id, 'dropoff_location_id not in master' AS failure_reason
    FROM ${curated_db}.stg_trips t
    LEFT JOIN ${curated_db}.stg_zone z ON t.do_location_id = z.location_id
    WHERE z.location_id IS NULL
)
SELECT 'R04_referential_integrity' AS rule_id, * FROM bad_vendor
UNION ALL SELECT 'R04_referential_integrity', * FROM bad_pickup
UNION ALL SELECT 'R04_referential_integrity', * FROM bad_dropoff;
