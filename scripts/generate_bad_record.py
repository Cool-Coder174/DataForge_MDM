#!/usr/bin/env python3
"""Generate an intentionally-bad NYC taxi sample to trigger DQ failures + alerts.

Writes data/sample/yellow_taxi_bad_sample.csv with rows that each violate one of
the data-quality rules in sql/tests/ and glue_jobs/data_quality.py:
  - null required column (passenger_count)
  - dropoff before pickup
  - negative fare
  - negative passenger count
  - dangling vendor_id (not in master)
  - dangling pickup/dropoff location ids (not in master)
  - duplicate trip rows
"""
from __future__ import annotations

import csv
import pathlib

OUT = pathlib.Path(__file__).resolve().parents[1] / "data" / "sample" / "yellow_taxi_bad_sample.csv"

HEADER = [
    "vendor_id", "tpep_pickup_datetime", "tpep_dropoff_datetime",
    "passenger_count", "trip_distance", "pu_location_id", "do_location_id",
    "fare_amount", "tip_amount", "total_amount", "payment_type",
]

ROWS = [
    # good baseline row
    [1, "2024-01-15 08:00:00", "2024-01-15 08:20:00", 1, 3.2, 142, 236, 14.5, 3.0, 18.3, 1],
    # null required column (passenger_count missing)
    [2, "2024-01-15 09:00:00", "2024-01-15 09:15:00", "", 2.1, 161, 230, 11.0, 2.0, 14.0, 1],
    # dropoff before pickup
    [1, "2024-01-15 10:30:00", "2024-01-15 10:10:00", 2, 5.0, 100, 161, 22.0, 0.0, 24.5, 2],
    # negative fare
    [2, "2024-01-15 11:00:00", "2024-01-15 11:25:00", 1, 4.4, 142, 237, -9.5, 0.0, -7.0, 1],
    # negative passenger count
    [1, "2024-01-15 12:00:00", "2024-01-15 12:18:00", -3, 2.0, 236, 142, 10.0, 1.5, 12.8, 1],
    # dangling vendor_id (99 not in master)
    [99, "2024-01-15 13:00:00", "2024-01-15 13:30:00", 2, 6.7, 161, 230, 28.0, 5.0, 35.0, 1],
    # dangling pickup/dropoff location ids (9990/9991 not in master zone table)
    [1, "2024-01-15 14:00:00", "2024-01-15 14:22:00", 1, 3.9, 9990, 9991, 16.0, 2.0, 20.0, 2],
    # duplicate rows (same natural key) for duplicate-detection test
    [2, "2024-01-15 15:00:00", "2024-01-15 15:20:00", 1, 3.0, 142, 236, 13.0, 2.0, 16.5, 1],
    [2, "2024-01-15 15:00:00", "2024-01-15 15:20:00", 1, 3.0, 142, 236, 13.0, 2.0, 16.5, 1],
]


def main() -> None:
    OUT.parent.mkdir(parents=True, exist_ok=True)
    with OUT.open("w", newline="") as fh:
        w = csv.writer(fh)
        w.writerow(HEADER)
        w.writerows(ROWS)
    print(f"[bad-record] wrote {len(ROWS)} rows -> {OUT}")
    print("[bad-record] upload + run with: bash scripts/run_demo.sh --bad")


if __name__ == "__main__":
    main()
