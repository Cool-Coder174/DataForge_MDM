# DataForge MDM — End-to-End AWS Data Platform Demo

A complete, demoable AWS data-engineering platform built around **NYC Yellow Taxi**
data. It showcases batch ingestion, a zoned S3 data lake, Glue/Spark ETL, SQL
transformations with data-quality tests, a Master Data Management (MDM) layer
(REST API + fuzzy matching + SCD Type 2), Step Functions orchestration, Redshift +
Athena serving, QuickSight dashboards, CloudWatch monitoring, and CI/CD with
GitHub Actions + CloudFormation.

> Built for a **20-minute live demo**. Optimized for "works and is understandable"
> over enterprise perfection. See [`docs/demo_script.md`](docs/demo_script.md).

---

## 1. Project overview

The platform ingests three sources into S3, refines them through lake zones, builds
a dimensional model, and manages reference/master data (taxi zones + vendors) with
golden records and full history.

| Capability | Implementation |
|---|---|
| Ingestion | Batch upload to `s3://$DATA_BUCKET/incoming/...` |
| Storage | S3 lake zones: `raw/`, `processed/`, `curated/`, `master/` |
| Processing | AWS Glue (PySpark) + Lambda helpers |
| Catalog | Glue Data Catalog + Crawlers |
| Transformation | Version-controlled SQL (`sql/transformations`, `sql/tests`) |
| Data Quality | Glue DQ job + SQL tests → `dq_run_summary` |
| MDM | API Gateway + Lambda + RDS PostgreSQL, fuzzy matching, SCD2 |
| Serving | Athena (S3) + Redshift (dimensional warehouse) |
| Orchestration | AWS Step Functions |
| Monitoring | CloudWatch dashboards + alarms + SNS email |
| CI/CD | GitHub Actions → CloudFormation |

## 2. Architecture summary

```
                 ┌──────────────────────── Orchestration: Step Functions ───────────────────────┐
                 │  Validate → Copy→raw → Crawler → Glue ETL → DQ → SQL xform → MDM/SCD2 →        │
                 │  Load Redshift → Refresh dashboards → Notify (SNS)        (failure → rejected) │
                 └──────────────────────────────────────────────────────────────────────────────┘

  incoming/ ──► [Lambda validate] ──► raw/ ──► [Glue ETL Spark] ──► processed/ ──► curated/ (fact/dim Parquet|Delta)
   (S3)                                 (immutable)                                   │
                                                                                      ├─► Athena (external tables)
                                                                                      └─► Redshift COPY (warehouse)

  MDM:  API Gateway ──► Lambda (mdm_api) ──► RDS PostgreSQL (zones, vendors, dim_*_scd2)
        matching engine (mdm/matching) → candidate dupes → merge → golden record + SCD2 history

  Monitoring: CloudWatch dashboards/alarms ──► SNS ──► email + alert_handler Lambda
```

Full detail in [`docs/architecture.md`](docs/architecture.md).

## 3. Prerequisites

- An AWS account (Free Tier friendly, but Redshift/RDS/Glue/QuickSight cost money — see §Cost).
- **AWS CLI v2** configured (`aws configure`) with admin-ish permissions for the demo.
- **Python 3.11+**, `make`, `bash`, `zip`, `jq`.
- Optional: `psql` client for RDS seeding/inspection.
- A GitHub repo (for the CI/CD portion).

## 4. AWS CLI setup assumptions

- Credentials resolve via the default chain (`aws configure`, `AWS_PROFILE`, or env vars).
- The caller can create/update CloudFormation stacks, S3, IAM, Glue, Lambda, Step
  Functions, API Gateway, RDS, Redshift, CloudWatch, SNS, and Secrets Manager.
- Region is taken from `AWS_REGION` in `.env` (default `us-east-1`).

Verify with:

```bash
aws sts get-caller-identity
```

## 5. ⚠️ Cost warning

This stack can incur real charges. The biggest offenders:

| Resource | Why it costs | Mitigation |
|---|---|---|
| **Redshift** | Cluster runs 24/7 | `ENABLE_REDSHIFT=false` (default) → use Athena instead |
| **RDS PostgreSQL** | db.t3.micro still bills | `ENABLE_RDS=true` uses smallest instance; destroy after demo |
| **Glue jobs** | Per-DPU-hour | Jobs use 2 small workers, auto-stop |
| **QuickSight** | Per-user subscription | `ENABLE_QUICKSIGHT=false` (default) → manual setup guide |
| **NAT/VPC** | If created | Templates use default VPC + public subnet to avoid NAT |

**Always run `make destroy` after the demo.** See §15 Cleanup.

## 6. Environment variables

Copy and edit:

```bash
cp .env.example .env
# edit DATA_BUCKET (must be globally unique), ALERT_EMAIL, region, toggles
```

Key variables: `AWS_REGION`, `PROJECT_NAME`, `DATA_BUCKET`, `ALERT_EMAIL`,
`REDSHIFT_DATABASE`, `REDSHIFT_USER`, `RDS_DATABASE`, `RDS_USER`, `STACK_NAME`,
plus cost toggles `ENABLE_RDS`, `ENABLE_REDSHIFT`, `ENABLE_QUICKSIGHT`.

## 7. Deployment instructions

```bash
# 0. one-time: local tooling + AWS bootstrap (deploy bucket, confirm identity)
make venv
make bootstrap

# 1. deploy all infrastructure (CloudFormation, ~10-15 min first time)
make deploy

# 2. confirm the SNS subscription email AWS just sent to $ALERT_EMAIL
```

`make deploy` packages Lambda code, uploads Glue scripts + nested templates to the
deploy bucket, and deploys the root stack `infrastructure/cloudformation/main.yml`,
which wires up all nested stacks.

## 8. Sample data upload

```bash
make upload-data        # pushes data/sample/* to s3://$DATA_BUCKET/incoming/...
```

Layout created:

```
incoming/yellow_taxi/yellow_taxi_sample.parquet
incoming/taxi_zones/taxi_zones.csv
incoming/vendors/vendors.csv
```

## 9. How to run the demo

```bash
make seed-mdm           # load RDS master schema + seed zones/vendors (if ENABLE_RDS)
make demo               # good-path: upload + start Step Functions + tail status
```

The scripted walk-through (with timings) is in [`docs/demo_script.md`](docs/demo_script.md).

## 10. Trigger a GOOD pipeline run

```bash
make upload-data
make demo               # starts the state machine, prints the execution URL
# or directly:
bash scripts/run_demo.sh
```

Watch it in the **Step Functions** console — each state is named for readability
(`ValidateIncomingFile`, `CopyToRaw`, `RunGlueCrawler`, `GlueETL`, `DataQuality`, …).

## 11. Trigger a BAD data-quality run (alert demo)

```bash
make demo-bad
```

This generates `data/sample/yellow_taxi_bad_sample.csv` (negative fares, null
required fields, dropoff-before-pickup, dangling vendor/zone IDs), uploads it, and
starts the pipeline. The DQ step fails the quality gate, writes rejects to
`s3://$DATA_BUCKET/processed/rejected/`, and fires an SNS alert email.

## 12. Call the MDM API with curl

After deploy, the API base URL is an output of the `apigateway` stack:

```bash
API=$(aws cloudformation describe-stacks --stack-name $STACK_NAME-apigateway \
  --query "Stacks[0].Outputs[?OutputKey=='ApiBaseUrl'].OutputValue" --output text)

# Zones
curl -s $API/zones | jq
curl -s -X POST $API/zones -H 'content-type: application/json' \
  -d '{"zone_name":"Astoria","borough":"Queens","service_zone":"Boro Zone"}' | jq
curl -s $API/zones/1 | jq
curl -s -X PUT $API/zones/1 -H 'content-type: application/json' \
  -d '{"borough":"Queens","service_zone":"Boro Zone"}' | jq

# Matching + merge (dedup → golden record)
curl -s -X POST $API/zones/match -H 'content-type: application/json' \
  -d '{"zone_name":"astoria  "}' | jq
curl -s -X POST $API/zones/merge -H 'content-type: application/json' \
  -d '{"survivor_id":1,"duplicate_ids":[42]}' | jq

# SCD2 history
curl -s $API/zones/1/history | jq

# Vendors (same shape)
curl -s $API/vendors | jq
```

Full endpoint reference: [`docs/data_dictionary.md`](docs/data_dictionary.md) and the
inline docstrings in [`lambda/mdm_api/app.py`](lambda/mdm_api/app.py).

## 13. View Athena / Redshift outputs

**Athena** (always available):

```bash
# Run a packaged analytics query
aws athena start-query-execution \
  --query-string "$(cat athena/queries/analytics_queries.sql | head -40)" \
  --result-configuration OutputLocation=s3://$DATA_BUCKET/athena-results/ \
  --query-execution-context Database=${PROJECT_NAME}_curated
```

Or use the Athena console → database `${PROJECT_NAME}_curated` / `${PROJECT_NAME}_master`.
DDL lives in [`athena/ddl/`](athena/ddl/).

**Redshift** (only if `ENABLE_REDSHIFT=true`): use the Redshift Query Editor v2,
run [`redshift/ddl/warehouse_schema.sql`](redshift/ddl/warehouse_schema.sql) then
[`redshift/queries/dashboard_queries.sql`](redshift/queries/dashboard_queries.sql).

## 14. Set up QuickSight dashboards

QuickSight signup can't be fully automated. Follow the manual guides:

- Analytics: [`dashboards/quicksight_dashboard_spec.md`](dashboards/quicksight_dashboard_spec.md)
- Data Quality: [`dashboards/data_quality_dashboard_spec.md`](dashboards/data_quality_dashboard_spec.md)
- MDM: [`dashboards/mdm_dashboard_spec.md`](dashboards/mdm_dashboard_spec.md)

Each spec lists the dataset (Athena table), calculated fields, and the exact visuals.

## 15. View CloudWatch monitoring

- Dashboard: CloudWatch → Dashboards → `${PROJECT_NAME}-platform`.
- Alarms: Step Functions failures, Glue failures, Lambda errors, API 4xx/5xx,
  DQ score < threshold, rejected rows > threshold, Redshift load failure.
- Alerts publish to SNS topic `${PROJECT_NAME}-alerts` → your `ALERT_EMAIL`.

See [`docs/operations_runbook.md`](docs/operations_runbook.md).

## 16. CI/CD deployment in action

`.github/workflows/deploy.yml` validates templates, runs Python + SQL tests,
packages Lambda, and deploys CloudFormation on push to `main`.

Demo flow (see [`docs/demo_script.md`](docs/demo_script.md) §17:00):

```bash
# tiny change, e.g. bump a version string in lambda/alert_handler/app.py
git commit -am "demo: tweak alert footer"
git push
# watch the Actions tab → green deploy → change live in AWS
```

## 17. Cleanup

```bash
make destroy            # deletes all stacks and empties the data bucket
```

This also removes RDS/Redshift if they were enabled. Double-check the S3 bucket and
Secrets Manager secrets are gone in the console to avoid lingering charges.

---

## Repository layout

```
infrastructure/cloudformation/   # nested CFN templates (IaC)
scripts/                         # bootstrap/deploy/destroy/demo helpers
data/sample/                     # realistic sample + intentionally-bad data
glue_jobs/                       # PySpark ETL, DQ, SCD2
lambda/                          # file_validator, mdm_api, alert_handler
mdm/                             # matching engine, survivorship, schema, tests
sql/transformations  sql/tests   # version-controlled SQL + DQ tests
athena/  redshift/               # DDL + queries for both serving engines
stepfunctions/pipeline.asl.json  # state machine definition
dashboards/                      # QuickSight specs (3 dashboards)
docs/                            # architecture, demo script, runbook, dictionary, governance
.github/workflows/deploy.yml     # CI/CD
```

## Assumptions made (opinionated defaults)

1. Project is built at the repo root (not nested under `aws-data-platform-mdm-demo/`)
   since the repo is already `DataForge_MDM`.
2. **Parquet is the default** curated format; Delta Lake is supported via a
   `USE_DELTA` flag in the Glue jobs (off by default to keep Glue setup light).
3. **Athena is the default serving layer**; Redshift is opt-in (`ENABLE_REDSHIFT`)
   to control cost.
4. RDS PostgreSQL is the MDM store (`ENABLE_RDS=true`); a local-SQLite/DynamoDB
   fallback path is documented for offline/local mode in `lambda/mdm_api/app.py`.
5. Networking uses the **default VPC + public subnet** (no NAT gateway) to keep the
   demo cheap; tighten for production.
6. Sample taxi data is a small synthetic Parquet/CSV slice so the whole pipeline
   runs in minutes and within Free Tier-ish limits.
```
