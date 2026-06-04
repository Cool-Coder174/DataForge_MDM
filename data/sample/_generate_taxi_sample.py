#!/usr/bin/env python3
"""Generate a small, realistic NYC Yellow Taxi sample.

Always writes yellow_taxi_sample.csv. Also writes yellow_taxi_sample.parquet when
pyarrow is available (preferred input for the Glue ETL). All vendor_id and
location ids reference rows present in vendors.csv / taxi_zones.csv so the
GOOD-path run passes referential-integrity checks.

Usage:  python3 data/sample/_generate_taxi_sample.py [num_rows]
"""
from __future__ import annotations

import csv
import datetime as dt
import pathlib
import random
import sys

HERE = pathlib.Path(__file__).resolve().parent
CSV_OUT = HERE / "yellow_taxi_sample.csv"
PARQUET_OUT = HERE / "yellow_taxi_sample.parquet"

VENDOR_IDS = [1, 2, 6, 7]
ZONE_IDS = [4, 13, 24, 41, 43, 48, 68, 79, 87, 90, 100, 107, 113, 125, 137,
            140, 141, 142, 143, 144, 148, 161, 162, 163, 164, 170, 186, 230,
            231, 234, 236, 237, 238, 239, 7, 70, 138, 132, 33, 65, 255]
PAYMENT_TYPES = [1, 2, 3, 4]

HEADER = [
    "vendor_id", "tpep_pickup_datetime", "tpep_dropoff_datetime",
    "passenger_count", "trip_distance", "pu_location_id", "do_location_id",
    "fare_amount", "tip_amount", "total_amount", "payment_type",
]


def generate(n: int):
    rng = random.Random(42)  # deterministic
    base = dt.datetime(2024, 1, 15, 0, 0, 0)
    rows = []
    for _ in range(n):
        pickup = base + dt.timedelta(minutes=rng.randint(0, 60 * 24 * 5))
        dur = rng.randint(3, 55)
        dropoff = pickup + dt.timedelta(minutes=dur)
        dist = round(rng.uniform(0.4, 18.0), 2)
        fare = round(3.0 + dist * rng.uniform(2.0, 3.5), 2)
        tip = round(fare * rng.choice([0, 0, 0.1, 0.15, 0.2, 0.25]), 2)
        total = round(fare + tip + 1.0, 2)  # +mta/improvement surcharge
        rows.append([
            rng.choice(VENDOR_IDS),
            pickup.strftime("%Y-%m-%d %H:%M:%S"),
            dropoff.strftime("%Y-%m-%d %H:%M:%S"),
            rng.randint(1, 5),
            dist,
            rng.choice(ZONE_IDS),
            rng.choice(ZONE_IDS),
            fare,
            tip,
            total,
            rng.choice(PAYMENT_TYPES),
        ])
    return rows


def main() -> None:
    n = int(sys.argv[1]) if len(sys.argv) > 1 else 500
    rows = generate(n)

    with CSV_OUT.open("w", newline="") as fh:
        w = csv.writer(fh)
        w.writerow(HEADER)
        w.writerows(rows)
    print(f"wrote {len(rows)} rows -> {CSV_OUT}")

    try:
        import pandas as pd
        df = pd.DataFrame(rows, columns=HEADER)
        df["tpep_pickup_datetime"] = pd.to_datetime(df["tpep_pickup_datetime"])
        df["tpep_dropoff_datetime"] = pd.to_datetime(df["tpep_dropoff_datetime"])
        df.to_parquet(PARQUET_OUT, index=False)
        print(f"wrote parquet -> {PARQUET_OUT}")
    except Exception as exc:  # noqa: BLE001
        print(f"(parquet skipped: {exc}; CSV fallback will be used)")


if __name__ == "__main__":
    main()
