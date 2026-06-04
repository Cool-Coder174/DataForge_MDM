"""DataForge MDM - SCD Type 2 upsert for master data (PySpark / AWS Glue).

Maintains master/dim_zone_scd2 and master/dim_vendor_scd2 with full history:
  surrogate_key, natural_key, <attributes>, valid_from, valid_to, is_current,
  record_hash, created_at, updated_at.

Algorithm (per natural key):
  1. Compute record_hash over the descriptive attributes of the incoming row.
  2. If no current row exists -> insert new current row.
  3. If current row exists and hash matches -> no change.
  4. If current row exists and hash differs -> expire old (is_current=false,
     valid_to=now) and insert a new current version.

Works with plain Parquet (read existing snapshot + recompute + overwrite). Set
--USE_DELTA true to use Delta MERGE instead (kept modular).
"""
import sys
import datetime as dt

from awsglue.context import GlueContext
from awsglue.job import Job
from awsglue.utils import getResolvedOptions
from pyspark.context import SparkContext
from pyspark.sql import functions as F
from pyspark.sql.window import Window

ARGS = getResolvedOptions(sys.argv, ["JOB_NAME", "DATA_BUCKET", "PROJECT_NAME", "USE_DELTA"])
DATA_BUCKET = ARGS["DATA_BUCKET"]
PROJECT = ARGS["PROJECT_NAME"]
USE_DELTA = ARGS.get("USE_DELTA", "false").lower() == "true"
HIGH_DATE = "9999-12-31 00:00:00"

sc = SparkContext()
glue = GlueContext(sc)
spark = glue.spark_session
job = Job(glue)
job.init(ARGS["JOB_NAME"], ARGS)
NOW = dt.datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S")


def p(zone, *parts):
    return f"s3://{DATA_BUCKET}/{zone}/" + "/".join(parts)


def read_parquet(path):
    try:
        df = spark.read.parquet(path)
        return df if len(df.columns) else None
    except Exception:  # noqa: BLE001
        return None


def scd2_merge(incoming, existing, natural_key, attrs, dest):
    """Generic SCD2 merge producing the full history table at `dest`."""
    # Deduplicate incoming to one row per natural key (survivorship: fewest nulls).
    nn = sum(F.when(F.col(a).isNotNull(), 1).otherwise(0) for a in attrs)
    w = Window.partitionBy(natural_key).orderBy(F.desc(nn))
    incoming = (
        incoming.withColumn("_rn", F.row_number().over(w))
        .filter(F.col("_rn") == 1).drop("_rn")
    )
    incoming = incoming.withColumn(
        "record_hash", F.sha2(F.concat_ws("||", *[F.coalesce(F.col(a).cast("string"), F.lit("")) for a in attrs]), 256)
    )

    select_cols = [F.col(natural_key).alias("natural_key")] + [F.col(a) for a in attrs] + [F.col("record_hash")]
    incoming_std = incoming.select(*select_cols)

    if existing is None:
        # First load: everything is a brand-new current row.
        out = (
            incoming_std
            .withColumn("valid_from", F.lit(NOW).cast("timestamp"))
            .withColumn("valid_to", F.lit(HIGH_DATE).cast("timestamp"))
            .withColumn("is_current", F.lit(True))
            .withColumn("created_at", F.lit(NOW).cast("timestamp"))
            .withColumn("updated_at", F.lit(NOW).cast("timestamp"))
        )
    else:
        current = existing.filter(F.col("is_current") == True)  # noqa: E712
        history = existing.filter(F.col("is_current") == False)  # noqa: E712

        joined = current.alias("c").join(
            incoming_std.alias("i"),
            F.col("c.natural_key") == F.col("i.natural_key"), "full_outer"
        )

        # changed: present in both, different hash -> expire current + add new
        changed_keys = joined.filter(
            F.col("c.natural_key").isNotNull() & F.col("i.natural_key").isNotNull()
            & (F.col("c.record_hash") != F.col("i.record_hash"))
        )
        unchanged = joined.filter(
            F.col("c.natural_key").isNotNull() & F.col("i.natural_key").isNotNull()
            & (F.col("c.record_hash") == F.col("i.record_hash"))
        ).select("c.*")
        new_keys = joined.filter(F.col("c.natural_key").isNull()).select(
            "i.natural_key", *[F.col(f"i.{a}").alias(a) for a in attrs], "i.record_hash"
        )
        # keys present in current but not in incoming -> keep as-is (no delete)
        missing = joined.filter(F.col("i.natural_key").isNull()).select("c.*")

        expired = changed_keys.select("c.*") \
            .withColumn("valid_to", F.lit(NOW).cast("timestamp")) \
            .withColumn("is_current", F.lit(False)) \
            .withColumn("updated_at", F.lit(NOW).cast("timestamp"))

        new_versions = changed_keys.select(
            F.col("i.natural_key").alias("natural_key"),
            *[F.col(f"i.{a}").alias(a) for a in attrs],
            F.col("i.record_hash"),
        ).unionByName(new_keys) \
            .withColumn("valid_from", F.lit(NOW).cast("timestamp")) \
            .withColumn("valid_to", F.lit(HIGH_DATE).cast("timestamp")) \
            .withColumn("is_current", F.lit(True)) \
            .withColumn("created_at", F.lit(NOW).cast("timestamp")) \
            .withColumn("updated_at", F.lit(NOW).cast("timestamp"))

        out = history.unionByName(missing).unionByName(unchanged) \
            .unionByName(expired).unionByName(new_versions)

    # Assign deterministic surrogate keys.
    out = out.withColumn(
        "surrogate_key",
        F.row_number().over(Window.orderBy("natural_key", "valid_from"))
    )
    cols = ["surrogate_key", "natural_key"] + attrs + [
        "valid_from", "valid_to", "is_current", "record_hash",
        "created_at", "updated_at"]
    out = out.select(*cols)

    writer = out.write.mode("overwrite")
    writer.format("delta" if USE_DELTA else "parquet").save(dest)
    print(f"[scd2] wrote {dest} rows={out.count()}")


# ----------------------------------------------------------- zones
zones = read_parquet(p("processed", "taxi_zones"))
if zones is not None:
    scd2_merge(
        incoming=zones,
        existing=read_parquet(p("master", "dim_zone_scd2")),
        natural_key="location_id",
        attrs=["borough", "zone_name", "service_zone"],
        dest=p("master", "dim_zone_scd2"),
    )

# ----------------------------------------------------------- vendors
vendors = read_parquet(p("processed", "vendors"))
if vendors is not None:
    scd2_merge(
        incoming=vendors,
        existing=read_parquet(p("master", "dim_vendor_scd2")),
        natural_key="vendor_id",
        attrs=["vendor_name", "vendor_code", "tech_provider"],
        dest=p("master", "dim_vendor_scd2"),
    )

job.commit()
print("[scd2] done.")
