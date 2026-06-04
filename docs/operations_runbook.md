# DataForge MDM — Operations Runbook

## Daily / per-demo operations

| Task | Command |
|---|---|
| Deploy / update | `make deploy` |
| Upload sample data | `make upload-data` |
| Seed MDM (RDS) | `make seed-mdm` |
| Good pipeline run | `make demo` |
| Bad / DQ-failure run | `make demo-bad` |
| Tear down | `make destroy` |

## Triggering the pipeline manually

```bash
SM=$(aws cloudformation describe-stacks --stack-name $STACK_NAME \
  --query "Stacks[0].Outputs[?OutputKey=='StateMachineArn'].OutputValue" --output text)
aws stepfunctions start-execution --state-machine-arn "$SM" \
  --input '{"bucket":"'$DATA_BUCKET'","trips_key":"incoming/yellow_taxi/yellow_taxi_sample.parquet","mode":"good","run_id":"manual-1"}'
```

## Monitoring

- **Dashboard:** CloudWatch → Dashboards → `${PROJECT_NAME}-platform`.
- **Alarms** (→ SNS `${PROJECT_NAME}-alerts`):
  - `*-stepfunctions-failed`, `*-glue-etl-failed`, `*-lambda-errors`,
    `*-api-4xx`, `*-api-5xx`, `*-dq-score-low`, `*-rejected-rows-high`,
    `*-redshift-load-failed`.
- **Logs:** CloudWatch Log Groups: `/aws/lambda/${PROJECT_NAME}-*`,
  `/aws-glue/jobs/output`, Step Functions execution history.

## Incident playbook

| Symptom | Likely cause | Action |
|---|---|---|
| DQ score < 0.95 alarm | Bad/dirty source data | Inspect `master.dq_run_summary` + `curated.dq_results`; check `processed/rejected/`; fix source, re-run. |
| Glue ETL failed | Schema drift / bad file | Open Glue run logs; validate incoming schema; re-upload; re-run. |
| API 5xx | RDS unreachable / Lambda error | Check `mdm_api` logs. The function falls back to SQLite — verify RDS SG + secret if you need persistence. |
| Step Functions failed | Any task error | Open execution graph; failed state shows the error; check the `Catch` → `NotifyFailure` path. |
| Redshift load failed | COPY error / role | Check `dq_run_summary`; verify the cluster IAM role has S3 read; re-run `004_load_redshift.sql`. |

## Data quality demo mode

`make demo-bad` (or `python3 scripts/generate_bad_record.py` + `run_demo.sh --bad`)
injects records that violate each rule, forcing a FAIL, writing rejects to
`processed/rejected/`, and firing the SNS alert.

## Reprocessing

Raw is immutable + versioned. To reprocess, re-run the ETL/DQ Glue jobs (or the
whole state machine). To roll back curated outputs, delete the relevant
`curated/<table>/` prefix and re-run (or restore a prior raw object version).

## Cost hygiene

- Default config: `ENABLE_REDSHIFT=false`, `ENABLE_QUICKSIGHT=false`.
- RDS is `db.t3.micro`; **destroy after the demo** (`make destroy`).
- S3 lifecycle expires `athena-results/` (7d), `processed/rejected/` (30d), and
  old `raw/` versions (30d).
- Verify Secrets Manager secrets + S3 buckets are gone after teardown.
