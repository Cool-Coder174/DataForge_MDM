"""DataForge MDM - Batch ETL (PySpark / AWS Glue).

raw -> processed -> curated for NYC Yellow Taxi trips.

Steps:
  1. Read trips from raw/ (parquet or csv), zones + vendors from raw/.
  2. Standardize column names + types, validate schema.
  3. Write cleaned/validated data to processed/.
  4. Enrich trips with zone master (pickup + dropoff) and vendor master.
  5. Build fact_trip + dim_date + dim_zone + dim_vendor in curated/.

Output format is Parquet by default; set --USE_DELTA true to write Delta Lake
(requires the Glue Delta connector / delta-spark on the job). The code is modular
so flipping the flag is the only change required.
"""
import sys

from awsglue.context import GlueContext
from awsglue.job import Job
from awsglue.utils import getResolvedOptions
from pyspark.context import SparkContext
from pyspark.sql import DataFrame, SparkSession
from pyspark.sql import functions as F
from pyspark.sql.types import (DoubleType, IntegerType, TimestampType)

# --------------------------------------------------------------------------- args
ARGS = getResolvedOptions(
    sys.argv, ["JOB_NAME", "DATA_BUCKET", "PROJECT_NAME", "USE_DELTA"]
)
DATA_BUCKET = ARGS["DATA_BUCKET"]
PROJECT = ARGS["PROJECT_NAME"]
USE_DELTA = ARGS.get("USE_DELTA", "false").lower() == "true"

sc = SparkContext()
glue = GlueContext(sc)
spark: SparkSession = glue.spark_session
job = Job(glue)
job.init(ARGS["JOB_NAME"], ARGS)


def path(zone: str, *parts: str) -> str:
    return f"s3://{DATA_BUCKET}/{zone}/" + "/".join(parts)


def write(df: DataFrame, dest: str, partition_by=None) -> None:
    """Write Parquet (default) or Delta depending on USE_DELTA."""
    writer = df.write.mode("overwrite")
    if partition_by:
        writer = writer.partitionBy(*partition_by)
    if USE_DELTA:
        writer.format("delta").save(dest)
    else:
        writer.format("parquet").save(dest)


# --------------------------------------------------------------- 1. read raw
def read_trips() -> DataFrame:
    """Read trips from raw/, supporting either parquet or csv landings."""
    base = path("raw", "yellow_taxi")
    try:
        df = spark.read.parquet(base)
        if len(df.columns) > 0:
            return df
    except Exception:  # noqa: BLE001
        pass
    return (
        spark.read.option("header", "true").option("inferSchema", "true").csv(base)
    )


trips_raw = read_trips()
zones_raw = (
    spark.read.option("header", "true").option("inferSchema", "true")
    .csv(path("raw", "taxi_zones"))
)
vendors_raw = (
    spark.read.option("header", "true").option("inferSchema", "true")
    .csv(path("raw", "vendors"))
)


# --------------------------------------------------------- 2. standardize names
def std_columns(df: DataFrame, mapping: dict) -> DataFrame:
    for src, dst in mapping.items():
        if src in df.columns and src != dst:
            df = df.withColumnRenamed(src, dst)
    # lower_snake everything else
    for c in df.columns:
        df = df.withColumnRenamed(c, c.strip().lower().replace(" ", "_"))
    return df


trips = std_columns(trips_raw, {
    "VendorID": "vendor_id",
    "tpep_pickup_datetime": "pickup_datetime",
    "tpep_dropoff_datetime": "dropoff_datetime",
    "PULocationID": "pu_location_id",
    "DOLocationID": "do_location_id",
    "pu_location_id": "pu_location_id",
    "do_location_id": "do_location_id",
})

zones = std_columns(zones_raw, {
    "LocationID": "location_id",
    "Borough": "borough",
    "Zone": "zone_name",
    "service_zone": "service_zone",
})
vendors = std_columns(vendors_raw, {})

# Cast trip types defensively.
trips = (
    trips
    .withColumn("vendor_id", F.col("vendor_id").cast(IntegerType()))
    .withColumn("pickup_datetime", F.col("pickup_datetime").cast(TimestampType()))
    .withColumn("dropoff_datetime", F.col("dropoff_datetime").cast(TimestampType()))
    .withColumn("passenger_count", F.col("passenger_count").cast(IntegerType()))
    .withColumn("trip_distance", F.col("trip_distance").cast(DoubleType()))
    .withColumn("pu_location_id", F.col("pu_location_id").cast(IntegerType()))
    .withColumn("do_location_id", F.col("do_location_id").cast(IntegerType()))
    .withColumn("fare_amount", F.col("fare_amount").cast(DoubleType()))
    .withColumn("tip_amount", F.col("tip_amount").cast(DoubleType()))
    .withColumn("total_amount", F.col("total_amount").cast(DoubleType()))
)

# --------------------------------------------------- 3. validate -> processed
REQUIRED = ["vendor_id", "pickup_datetime", "dropoff_datetime",
            "pu_location_id", "do_location_id", "fare_amount"]

valid_cond = (
    F.col("pickup_datetime").isNotNull()
    & F.col("dropoff_datetime").isNotNull()
    & (F.col("dropoff_datetime") > F.col("pickup_datetime"))
    & (F.col("fare_amount") >= 0)
    & (F.coalesce(F.col("passenger_count"), F.lit(0)) >= 0)
)
for c in REQUIRED:
    valid_cond = valid_cond & F.col(c).isNotNull()

trips_valid = trips.filter(valid_cond)
trips_rejected = trips.filter(~valid_cond).withColumn(
    "_rejected_at", F.current_timestamp()
)

write(trips_valid, path("processed", "yellow_taxi"))
if trips_rejected.limit(1).count() > 0:
    (trips_rejected.write.mode("append").format("parquet")
     .save(path("processed", "rejected", "yellow_taxi")))

# Master/reference copies into processed.
write(zones, path("processed", "taxi_zones"))
write(vendors, path("processed", "vendors"))

# --------------------------------------------------- 4. enrich + 5. curated
# Deduplicate zone/vendor masters to their best row before joining (golden-ish).
zones_dim = (
    zones.groupBy("location_id")
    .agg(F.first("borough", ignorenulls=True).alias("borough"),
         F.first("zone_name", ignorenulls=True).alias("zone_name"),
         F.first("service_zone", ignorenulls=True).alias("service_zone"))
)
vendors_dim = (
    vendors.groupBy("vendor_id")
    .agg(F.first("vendor_name", ignorenulls=True).alias("vendor_name"),
         F.first("vendor_code", ignorenulls=True).alias("vendor_code"))
)

pu = zones_dim.select(
    F.col("location_id").alias("pu_location_id"),
    F.col("borough").alias("pickup_borough"),
    F.col("zone_name").alias("pickup_zone"),
)
do = zones_dim.select(
    F.col("location_id").alias("do_location_id"),
    F.col("borough").alias("dropoff_borough"),
    F.col("zone_name").alias("dropoff_zone"),
)

fact_trip = (
    trips_valid
    .join(F.broadcast(pu), "pu_location_id", "left")
    .join(F.broadcast(do), "do_location_id", "left")
    .join(F.broadcast(vendors_dim), "vendor_id", "left")
    .withColumn("trip_duration_min",
                (F.col("dropoff_datetime").cast("long")
                 - F.col("pickup_datetime").cast("long")) / 60.0)
    .withColumn("pickup_date", F.to_date("pickup_datetime"))
    .withColumn("trip_id", F.sha2(F.concat_ws("|",
                F.col("vendor_id"), F.col("pickup_datetime"),
                F.col("dropoff_datetime"), F.col("pu_location_id"),
                F.col("do_location_id"), F.col("fare_amount")), 256))
)

write(fact_trip, path("curated", "fact_trip"), partition_by=["pickup_date"])

# dim_date from observed dates
dim_date = (
    fact_trip.select("pickup_date").distinct()
    .withColumn("date_key", F.date_format("pickup_date", "yyyyMMdd").cast(IntegerType()))
    .withColumn("year", F.year("pickup_date"))
    .withColumn("month", F.month("pickup_date"))
    .withColumn("day", F.dayofmonth("pickup_date"))
    .withColumn("day_of_week", F.date_format("pickup_date", "EEEE"))
    .withColumn("is_weekend", F.dayofweek("pickup_date").isin(1, 7))
)
write(dim_date, path("curated", "dim_date"))
write(zones_dim, path("curated", "dim_zone"))
write(vendors_dim, path("curated", "dim_vendor"))

print(f"[batch_etl] valid trips written. delta={USE_DELTA}")
job.commit()
