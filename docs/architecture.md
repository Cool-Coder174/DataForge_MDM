# DataForge MDM — Architecture

## 1. Overview

DataForge is an end-to-end AWS data platform for NYC Yellow Taxi data. It covers
ingestion, a zoned data lake, Spark/Glue processing, version-controlled SQL
transformations + data-quality tests, a Master Data Management layer (REST API +
fuzzy matching + SCD Type 2), orchestration with Step Functions, serving via
Athena + Redshift, QuickSight dashboards, CloudWatch monitoring, and CI/CD.

## 2. Component diagram (logical)

```
                                   ┌───────────────────────────────────────────┐
                                   │           AWS Step Functions                │
                                   │  ValidateIncomingFile → CopyToRaw →         │
                                   │  RunGlueCrawler → GlueETL → DataQuality →   │
   incoming/ (S3)                  │  RunSqlTransformations → UpdateMasterSCD2 → │
   ├─ yellow_taxi/  ───────────────┤  LoadRedshift → RefreshDashboard →          │
   ├─ taxi_zones/                  │  NotifySuccess     (DQ fail → rejected+SNS) │
   └─ vendors/                     └───────────────────────────────────────────┘
        │                                          │
        ▼  (file_validator Lambda)                 ▼
   raw/ (immutable, versioned)  ──►  Glue ETL (PySpark)  ──►  processed/  ──►  curated/
        │                              standardize, validate,        (fact_trip, dim_date,
        │                              enrich w/ zone+vendor master   dim_zone, dim_vendor,
        │                                                             dq_results)  + rejected/
        │                                                                   │
        │                              Glue DQ job ──► dq_run_summary + CloudWatch metrics
        │                              Glue SCD2 job ──► master/dim_*_scd2
        │                                                                   │
        ▼                                                                   ▼
   Glue Data Catalog (curated_db, master_db)            Athena  ◄── QuickSight (3 dashboards)
        │                                                   │
        └──────────────────────────────────────────────────┴──►  Redshift (opt-in, COPY)

   MDM operational plane:
   API Gateway (/zones, /vendors CRUD, /match, /merge, /history)
        └──► mdm_api Lambda ──► RDS PostgreSQL (zones, vendors, dim_*_scd2, merge_history)
                 │                    (SQLite fallback when RDS disabled)
                 └──► matching engine (mdm/matching): normalize + token + fuzzy + survivorship

   Monitoring: CloudWatch dashboard + alarms ──► SNS topic ──► email + alert_handler Lambda
   CI/CD: GitHub Actions ──► validate/test/package ──► CloudFormation deploy
```

## 3. Data lake zones

| Zone | Prefix | Contents | Format |
|---|---|---|---|
| Incoming | `incoming/` | landing area for source files | parquet/csv |
| Raw | `raw/` | immutable verbatim copy (bucket versioned) | as-landed |
| Processed | `processed/` | cleaned + validated; `rejected/` for failures | Parquet |
| Curated | `curated/` | analytics-ready fact/dim + `dq_results` | Parquet (Delta optional) |
| Master | `master/` | golden records + SCD2 snapshots + `dq_run_summary` | Parquet (Delta optional) |

## 4. Processing

- **AWS Glue (PySpark)** for ETL, data quality, and SCD2. Jobs are small (2×
  G.1X) for cost. `--USE_DELTA` flips Parquet ↔ Delta Lake; default Parquet.
- **Lambda** for lightweight validation (`file_validator`), the MDM API
  (`mdm_api`), and alert formatting (`alert_handler`).
- **Glue Data Catalog** + **Crawlers** provide metadata for Athena.

## 5. Transformation

- SQL transformations: `sql/transformations/00x_*.sql` (CTE-modular, Athena CTAS).
- SQL DQ tests: `sql/tests/00x_*.sql` — each returns violating rows (empty = pass).
- Results recorded to `curated/dq_results` and `master/dq_run_summary`.

## 6. Master Data Management

- Domains: **taxi zones**, **vendors**.
- Store: **RDS PostgreSQL** (operational), with current (Type 1) tables, SCD2
  history tables, SCD2 upsert procedures, and a `merge_history` audit trail.
- Matching engine: normalization (lowercase/punct/whitespace), exact, token-set
  (Jaccard), fuzzy (SequenceMatcher), composite score + reason.
- Survivorship: fewer-nulls → trusted-source → most-recent; preserves source IDs.
- API: API Gateway proxy → `mdm_api` Lambda (CRUD + match + merge + history).

## 7. Serving

- **Athena** over `curated/`+`master/` (default; serverless, cheap).
- **Redshift** dimensional warehouse (opt-in): `fact_trip`, `dim_date`,
  `dim_zone_scd2`, `dim_vendor_scd2`, `dq_run_summary` with DISTKEY/SORTKEY tuning.

## 8. Orchestration

- Step Functions state machine (`stepfunctions/pipeline.asl.json`) with retries,
  per-state `Catch`, a data-quality failure branch (rejected + SNS), and demo-
  readable state names.

## 9. Monitoring & alerting

- CloudWatch dashboard `${PROJECT_NAME}-platform`.
- Alarms: Step Functions failures, Glue failures, Lambda errors, API 4xx/5xx,
  DQ score < threshold, rejected rows > threshold, Redshift load failure.
- SNS topic → email + `alert_handler`.

## 10. CI/CD

- GitHub Actions (`.github/workflows/deploy.yml`): validate templates, run Python
  unit tests, SQL lint, package Lambdas, deploy CloudFormation, sync Glue + ASL.

## 11. Security notes (demo vs production)

- Demo uses default VPC + public RDS/Redshift and open security groups for
  simplicity. For production: private subnets, SG scoping, IAM least-privilege,
  KMS encryption, Secrets Manager rotation, and API auth (Cognito/IAM/API keys).

## 12. Draw.io

Recreate the logical diagram above in Draw.io for the deck, grouping by:
Ingestion → Storage (zones) → Processing → Transformation → Serving →
Orchestration → MDM → Monitoring → CI/CD.
