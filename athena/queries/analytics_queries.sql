-- Athena analytics queries powering the Analytics Dashboard.
-- Run individually. Replace ${curated_db}.

-- KPIs: total trips, total fare revenue, average fare
SELECT
    COUNT(*)               AS total_trips,
    ROUND(SUM(total_amount), 2) AS total_revenue,
    ROUND(AVG(fare_amount), 2)  AS avg_fare,
    ROUND(AVG(trip_distance), 2) AS avg_distance_mi
FROM ${curated_db}.fact_trip;

-- Trips by borough (pickup)
SELECT pickup_borough,
       COUNT(*) AS trips,
       ROUND(SUM(total_amount), 2) AS revenue
FROM ${curated_db}.fact_trip
GROUP BY pickup_borough
ORDER BY trips DESC;

-- Trips by vendor
SELECT vendor_name,
       COUNT(*) AS trips,
       ROUND(AVG(fare_amount), 2) AS avg_fare
FROM ${curated_db}.fact_trip
GROUP BY vendor_name
ORDER BY trips DESC;

-- Top pickup -> dropoff zone pairs
SELECT pickup_zone, dropoff_zone,
       COUNT(*) AS trips
FROM ${curated_db}.fact_trip
GROUP BY pickup_zone, dropoff_zone
ORDER BY trips DESC
LIMIT 15;

-- Daily trip volume + revenue trend
SELECT pickup_date,
       COUNT(*) AS trips,
       ROUND(SUM(total_amount), 2) AS revenue
FROM ${curated_db}.fact_trip
GROUP BY pickup_date
ORDER BY pickup_date;

-- Hourly demand profile
SELECT hour(pickup_datetime) AS pickup_hour,
       COUNT(*) AS trips
FROM ${curated_db}.fact_trip
GROUP BY hour(pickup_datetime)
ORDER BY pickup_hour;
