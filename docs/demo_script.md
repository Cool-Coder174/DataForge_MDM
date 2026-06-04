# DataForge MDM — 20-Minute Live Demo Script

> Pre-demo checklist (do this BEFORE you present):
> - `cp .env.example .env` and fill in `DATA_BUCKET`, `ALERT_EMAIL`, region.
> - `make venv && make bootstrap && make deploy` (allow ~15 min first time).
> - Confirm the SNS subscription email.
> - `make seed-mdm` (if `ENABLE_RDS=true`).
> - Open tabs: Step Functions, S3 bucket, Glue jobs, CloudWatch dashboard,
>   QuickSight, GitHub Actions, and a terminal.
> - Have `API=$(...)` exported (README §12) for the MDM curl calls.

---

## 0:00–2:00 — Architecture overview

- Show `docs/architecture.md` diagram (or the Draw.io version).
- One sentence per layer: ingest → lake zones → Glue/Spark → SQL + DQ → MDM
  (matching, SCD2) → Athena/Redshift → QuickSight → Step Functions →
  CloudWatch → CI/CD.
- Talking point: "Parquet by default, Delta-ready; Athena by default,
  Redshift opt-in — all cost-controlled."

## 2:00–5:00 — Upload batch data & start the pipeline

```bash
make demo        # uploads sample data and starts the Step Functions execution
```

- Open the printed Step Functions execution URL.
- Walk the graph: `ValidateIncomingFile → CopyToRaw → RunGlueCrawler → GlueETL →
  DataQuality → RunSqlTransformations → UpdateMasterDataSCD2 → LoadRedshift →
  RefreshDashboard → NotifySuccess`.
- Show the S3 bucket: `incoming/` populated, `raw/` being mirrored (immutable).

## 5:00–8:00 — Glue/Spark ETL: raw → processed → curated

- Open the `${PROJECT_NAME}-batch-etl` Glue job run + its CloudWatch logs.
- Explain the transforms: standardize columns, validate schema, enrich trips with
  **zone master** (pickup/dropoff) and **vendor master**, derive measures, build
  `fact_trip` + dims.
- In S3 show the new `processed/` and `curated/fact_trip/` (partitioned by date)
  and `processed/rejected/` (empty on the good run).

## 8:00–11:00 — SQL transformations & data-quality tests

- Show `sql/transformations/` (CTE-modular) and `sql/tests/` in the repo (version
  control!).
- In Athena, run a couple of queries from `athena/queries/analytics_queries.sql`
  and a DQ test from `sql/tests/`.
- Show `master.dq_run_summary` latest row: `quality_score`, `status=PASS`,
  `rejected_rows=0`.

## 11:00–15:00 — MDM: CRUD, dedup/merge, SCD2 history

```bash
curl -s $API/zones | jq '.count'
curl -s -X POST $API/zones -H 'content-type: application/json' \
  -d '{"location_id":7,"zone_name":"astoria  ","borough":"Queens","service_zone":"Boro Zone"}' | jq
# matching engine finds the near-duplicate:
curl -s -X POST $API/zones/match -H 'content-type: application/json' \
  -d '{"zone_name":"Astoria"}' | jq
# merge into a golden record (survivorship):
curl -s -X POST $API/zones/merge -H 'content-type: application/json' \
  -d '{"survivor_id":1,"duplicate_ids":[<dup_id_from_match>]}' | jq
# SCD2 history (note the new version after an update):
curl -s -X PUT $API/vendors/2 -H 'content-type: application/json' \
  -d '{"vendor_name":"Verifone Incorporated"}' | jq
curl -s $API/vendors/2/history | jq
```

- Narrate: normalization + fuzzy score + reason; survivorship rules; golden
  record; SCD2 expire-old/insert-new with `valid_from/valid_to/is_current`.

## 15:00–17:00 — QuickSight analytics + DQ dashboards

- Open **DataForge — Taxi Analytics**: KPIs, trips by borough/vendor, daily
  volume, zone trends (spec: `dashboards/quicksight_dashboard_spec.md`).
- Open **DataForge — Data Quality**: latest status, quality gauge, failed-rule
  table, null profiling (spec: `dashboards/data_quality_dashboard_spec.md`).
- (Optional) **MDM** dashboard: golden counts, merge history, SCD2 over time.

## 17:00–19:00 — CI/CD deployment in action

```bash
# make a tiny visible change:
#   bump VERSION = "v1.0" -> "v1.1" in lambda/alert_handler/app.py
git commit -am "demo: alert footer v1.1"
git push
```

- Open the **GitHub Actions** run: validate → tests → package → deploy.
- After green, show the new Lambda version live (e.g. trigger an alert and show
  the `v1.1` footer, or check the function in the console).

## 19:00–20:00 — Monitoring & alerting (the bad run)

```bash
make demo-bad     # uploads bad records; DQ gate fails on purpose
```

- Show the Step Functions execution routing to `HandleDataQualityFailure`.
- Show the **CloudWatch dashboard** (`${PROJECT_NAME}-platform`): QualityScore
  dips, RejectedRows spikes; the `dq-score-low` alarm goes ALARM.
- Show the **alert email** from SNS.
- Show `s3://$DATA_BUCKET/processed/rejected/` now contains the bad rows.
- Close: "Self-monitoring, alerting platform — fully reproducible via CI/CD."

---

### Fallback talking points (if something is slow)
- Glue cold start can take 1–2 min — narrate the architecture while it warms.
- If RDS isn't reachable, the MDM API auto-falls back to SQLite and still demos
  every endpoint.
- If QuickSight isn't set up, screen-share the Athena query results instead.
