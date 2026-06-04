-- Amazon Redshift analytics queries for the dimensional warehouse.
-- Mirror the Athena analytics set but use the star-schema joins + SCD2 dims.

-- KPI headline
SELECT COUNT(*) AS total_trips,
       SUM(total_amount) AS total_revenue,
       AVG(fare_amount)  AS avg_fare
FROM fact_trip;

-- Trips by borough with conformed date dimension
SELECT f.pickup_borough,
       d.year, d.month,
       COUNT(*) AS trips,
       SUM(f.total_amount) AS revenue
FROM fact_trip f
JOIN dim_date d ON f.pickup_date = d.date_value
GROUP BY f.pickup_borough, d.year, d.month
ORDER BY trips DESC;

-- Vendor performance using CURRENT SCD2 vendor master
SELECT v.vendor_name,
       COUNT(*) AS trips,
       AVG(f.fare_amount) AS avg_fare,
       SUM(f.tip_amount)  AS total_tips
FROM fact_trip f
JOIN dim_vendor_scd2 v
  ON f.vendor_id = v.natural_key AND v.is_current = TRUE
GROUP BY v.vendor_name
ORDER BY trips DESC;

-- Point-in-time analysis: which zone master was effective on a given date?
-- (Demonstrates SCD2 temporal querying.)
SELECT z.natural_key, z.zone_name, z.borough, z.service_zone,
       z.valid_from, z.valid_to
FROM dim_zone_scd2 z
WHERE TIMESTAMP '2024-02-01 00:00:00' >= z.valid_from
  AND TIMESTAMP '2024-02-01 00:00:00' <  z.valid_to
ORDER BY z.natural_key;

-- SCD2 change history (all versions per zone)
SELECT natural_key, zone_name, service_zone, is_current, valid_from, valid_to
FROM dim_zone_scd2
ORDER BY natural_key, valid_from;

-- Latest data quality posture
SELECT * FROM dq_run_summary ORDER BY run_ts DESC LIMIT 5;
