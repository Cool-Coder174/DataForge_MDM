"""DataForge MDM - Data Quality checks (PySpark / AWS Glue).

Runs the rule suite over processed/curated trips, writes per-run results to
curated/dq_results/ (+ a roll-up to master/dq_run_summary/), emits CloudWatch
custom metrics, and EXITS NON-ZERO when the quality score is below threshold so
Step Functions routes to the failure/rejected branch.

Rules mirror sql/tests/:
  R01 required columns not null
  R02 pickup < dropoff
  R03 fare_amount >= 0
  R04 passenger_count >= 0
  R05 vendor_id exists in master vendors
  R06 pickup_location_id exists in master zones
  R07 dropoff_location_id exists in master zones
  R08 duplicate trip detection
  R09 row-count threshold
"""
import sys
import datetime as dt

import boto3
from awsglue.context import GlueContext
from awsglue.job import Job
from awsglue.utils import getResolvedOptions
from pyspark.context import SparkContext
from pyspark.sql import functions as F

ARGS = getResolvedOptions(
    sys.argv, ["JOB_NAME", "DATA_BUCKET", "PROJECT_NAME", "DQ_THRESHOLD"]
)
DATA_BUCKET = ARGS["DATA_BUCKET"]
PROJECT = ARGS["PROJECT_NAME"]
THRESHOLD = float(ARGS.get("DQ_THRESHOLD", "0.95"))
MIN_ROWS = 1

sc = SparkContext()
glue = GlueContext(sc)
spark = glue.spark_session
job = Job(glue)
job.init(ARGS["JOB_NAME"], ARGS)


def p(zone, *parts):
    return f"s3://{DATA_BUCKET}/{zone}/" + "/".join(parts)


def read_parquet(path):
    try:
        return spark.read.parquet(path)
    except Exception:  # noqa: BLE001
        return None


trips = read_parquet(p("processed", "yellow_taxi"))
zones = read_parquet(p("processed", "taxi_zones"))
vendors = read_parquet(p("processed", "vendors"))

if trips is None:
    raise SystemExit("[dq] no processed trips found; ETL must run first.")

total = trips.count()
zone_ids = {r["location_id"] for r in zones.select("location_id").distinct().collect()} if zones else set()
vendor_ids = {r["vendor_id"] for r in vendors.select("vendor_id").distinct().collect()} if vendors else set()

REQUIRED = ["vendor_id", "pickup_datetime", "dropoff_datetime",
            "pu_location_id", "do_location_id", "fare_amount"]


def count_fail(cond) -> int:
    return trips.filter(cond).count()


results = []


def add(rule_id, description, failed):
    passed = failed == 0
    results.append({
        "rule_id": rule_id,
        "description": description,
        "failed_rows": int(failed),
        "status": "PASS" if passed else "FAIL",
    })


# R01 required not null
null_cond = F.lit(False)
for c in REQUIRED:
    null_cond = null_cond | F.col(c).isNull()
add("R01", "required columns not null", count_fail(null_cond))

# R02 pickup < dropoff
add("R02", "pickup before dropoff",
    count_fail(F.col("dropoff_datetime") <= F.col("pickup_datetime")))

# R03 fare >= 0
add("R03", "fare_amount >= 0", count_fail(F.col("fare_amount") < 0))

# R04 passenger_count >= 0
add("R04", "passenger_count >= 0",
    count_fail(F.coalesce(F.col("passenger_count"), F.lit(0)) < 0))

# R05 vendor exists
if vendor_ids:
    add("R05", "vendor_id in master",
        count_fail(~F.col("vendor_id").isin(list(vendor_ids))))
else:
    add("R05", "vendor_id in master (no master)", 0)

# R06/R07 zones exist
if zone_ids:
    add("R06", "pickup_location_id in master",
        count_fail(~F.col("pu_location_id").isin(list(zone_ids))))
    add("R07", "dropoff_location_id in master",
        count_fail(~F.col("do_location_id").isin(list(zone_ids))))
else:
    add("R06", "pickup_location_id in master (no master)", 0)
    add("R07", "dropoff_location_id in master (no master)", 0)

# R08 duplicate detection
dup_count = (
    trips.groupBy("vendor_id", "pickup_datetime", "dropoff_datetime",
                  "pu_location_id", "do_location_id")
    .count().filter(F.col("count") > 1)
    .agg(F.sum(F.col("count") - 1)).collect()[0][0] or 0
)
add("R08", "duplicate trip detection", dup_count)

# R09 row count threshold
add("R09", f"row count >= {MIN_ROWS}", 0 if total >= MIN_ROWS else 1)

# ---------------------------------------------------------------- score
passed_rules = sum(1 for r in results if r["status"] == "PASS")
score = round(passed_rules / len(results), 4)
rejected_rows = sum(r["failed_rows"] for r in results)
run_ts = dt.datetime.utcnow().isoformat()
run_id = run_ts.replace(":", "").replace("-", "")[:15]

print(f"[dq] score={score} threshold={THRESHOLD} rejected_rows={rejected_rows}")
for r in results:
    print(f"  {r['rule_id']} {r['status']:4} failed={r['failed_rows']} {r['description']}")

# --------------------------------------------------- write results to S3
res_df = spark.createDataFrame([
    {**r, "run_id": run_id, "run_ts": run_ts, "quality_score": score,
     "total_rows": total} for r in results
])
res_df.write.mode("append").format("parquet").save(p("curated", "dq_results"))

summary = spark.createDataFrame([{
    "run_id": run_id, "run_ts": run_ts, "quality_score": score,
    "total_rows": total, "rejected_rows": int(rejected_rows),
    "failed_rule_count": int(len(results) - passed_rules),
    "status": "PASS" if score >= THRESHOLD else "FAIL",
}])
summary.write.mode("append").format("parquet").save(p("master", "dq_run_summary"))

# --------------------------------------------------- CloudWatch metrics
try:
    cw = boto3.client("cloudwatch")
    cw.put_metric_data(
        Namespace=f"{PROJECT}/DataQuality",
        MetricData=[
            {"MetricName": "QualityScore", "Value": score, "Unit": "None"},
            {"MetricName": "RejectedRows", "Value": float(rejected_rows), "Unit": "Count"},
            {"MetricName": "FailedRuleCount",
             "Value": float(len(results) - passed_rules), "Unit": "Count"},
        ],
    )
except Exception as exc:  # noqa: BLE001
    print(f"[dq] cloudwatch put_metric_data failed: {exc}")

job.commit()

if score < THRESHOLD:
    raise SystemExit(
        f"[dq] FAILED quality gate: score {score} < threshold {THRESHOLD}"
    )
print("[dq] PASSED quality gate.")
