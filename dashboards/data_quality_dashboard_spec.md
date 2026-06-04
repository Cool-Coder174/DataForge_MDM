# Dashboard 2 — Data Quality Dashboard (QuickSight)

Surfaces pipeline health and data-quality posture.

## Datasets

| Dataset | Source table |
|---|---|
| `dq_run_summary` | `${PROJECT_NAME}_master.dq_run_summary` |
| `dq_results` | `${PROJECT_NAME}_curated.dq_results` |
| `dq_profile` | `${PROJECT_NAME}_curated.fact_trip` (for null profiling) |

Import all to SPICE.

## Calculated fields

| Field | Expression |
|---|---|
| `quality_pct` | `{quality_score} * 100` |
| `is_fail` | `ifelse({status}='FAIL', 1, 0)` |
| `null_vendor` | `sum(ifelse(isNull({vendor_id}),1,0))` |
| `null_fare` | `sum(ifelse(isNull({fare_amount}),1,0))` |
| `null_passengers` | `sum(ifelse(isNull({passenger_count}),1,0))` |

## Visuals

1. **Latest Pipeline Status** — KPI card from `dq_run_summary` newest row
   (`status`), conditional color (green PASS / red FAIL).
2. **Quality Score** — gauge (`quality_pct`), target line at 95%.
3. **Failed Rule Count** — KPI card (`failed_rule_count`, latest run).
4. **Rejected Rows** — KPI card (`rejected_rows`, latest run).
5. **Quality Score Trend** — line chart: x `run_ts`, y `quality_pct`.
6. **Rule Results (latest run)** — table from `dq_results`: `rule_id`,
   `description`, `status`, `failed_rows`; color rows by `status`.
7. **Duplicate Candidate Count** — KPI (from the duplicate query in
   `athena/queries/dq_queries.sql`).
8. **Null Count by Column** — bar chart of `null_vendor`, `null_fare`,
   `null_passengers`.

## Manual setup guide

1. Create the three datasets (Athena → SPICE) as above.
2. Add the calculated fields.
3. New analysis; add visuals 1–8. Use a **relative date** / "latest run" filter
   (filter `run_id` = max, or sort by `run_ts` desc and limit 1) on the KPI cards.
4. Publish as **"DataForge — Data Quality"**.
5. After a **bad** run (`make demo-bad`), refresh SPICE to watch the score drop
   and the failed-rule table light up red — this is the live alert moment.

> Backing queries: `athena/queries/dq_queries.sql`.
