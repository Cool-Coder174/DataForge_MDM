# Dashboard 1 — Analytics Dashboard (QuickSight)

Visualizes NYC taxi trip analytics from the curated zone via Athena.

## Data source & dataset

- **Data source:** Athena (`primary` workgroup). If `ENABLE_QUICKSIGHT=true`, the
  CloudFormation `quicksight` stack creates a data source named `<project>-athena`.
- **Dataset:** `analytics_fact_trip`
  - Table: `${PROJECT_NAME}_curated.fact_trip` (or `fact_trip_enriched`)
  - Import to **SPICE** for fast demo refresh (small dataset).

## Calculated fields

| Field | Expression |
|---|---|
| `revenue` | `sum({total_amount})` |
| `avg_fare` | `avg({fare_amount})` |
| `tip_rate` | `sum({tip_amount}) / sum({fare_amount})` |
| `pickup_hour` | `extract('HH', {pickup_datetime})` |
| `trip_count` | `count({trip_id})` |

## Visuals

1. **KPIs (3 cards):** Total Trips (`trip_count`), Total Revenue (`revenue`),
   Average Fare (`avg_fare`).
2. **Trips by Borough** — horizontal bar: dimension `pickup_borough`, value `trip_count`.
3. **Trips by Vendor** — donut: group `vendor_name`, value `trip_count`.
4. **Daily Trip Volume** — line chart: x `pickup_date`, y `trip_count` (+ `revenue` on secondary axis).
5. **Top Pickup→Dropoff Zones** — table: rows `pickup_zone`, `dropoff_zone`, value `trip_count`, sorted desc, top 15.
6. **Hourly Demand** — vertical bar: x `pickup_hour`, y `trip_count`.
7. **Pickup Borough Heat** — filled map or bar by `pickup_borough` revenue share.

## Manual setup guide

1. Sign in to **QuickSight** (Standard or Enterprise). First-time: enable
   QuickSight and grant access to **Athena** and the **S3 data bucket**
   (`QuickSight → Manage QuickSight → Security & permissions`).
2. **Datasets → New dataset → Athena** → pick the `<project>-athena` source (or
   create one) → database `${PROJECT_NAME}_curated` → table `fact_trip` →
   **Import to SPICE**.
3. Create the calculated fields above (`Dataset → Add calculated field`).
4. **New analysis** from the dataset; add visuals 1–7 per the list.
5. Publish as dashboard **"DataForge — Taxi Analytics"**.
6. Refresh SPICE after each pipeline run (`Datasets → … → Refresh now`), or
   schedule a refresh.

> Backing queries are in `athena/queries/analytics_queries.sql`.
