#!/usr/bin/env python3
"""Build the demo's sample data from the REAL NYC TLC public datasets.

Sources (NYC Taxi & Limousine Commission, public CloudFront mirror):
  - Trip records : yellow_tripdata_2025-08.parquet
  - Zone lookup  : taxi_zone_lookup.csv
  - Data dict.   : data_dictionary_trip_records_yellow.pdf (schema reference)

What it writes into data/sample/:
  - taxi_zones.csv          full 265-zone TLC lookup (+ a few intentionally
                            "dirty" duplicate rows so the MDM fuzzy-matching
                            demo still has something to dedupe).
  - yellow_taxi_sample.parquet / .csv
                            a cleaned, deterministic slice of the real trip
                            file, kept in the native TLC schema (VendorID,
                            tpep_pickup_datetime, PULocationID, ...). Rows are
                            filtered so the GOOD-path data-quality gate passes
                            (valid fares/times, known vendors, known zones,
                            de-duplicated).

The real trip file is ~62 MB / 3.5M rows. Rather than download all of it, we
stream just the bytes pyarrow needs (footer + the first row group) over HTTP
range requests via _remote_parquet.HTTPRangeFile.

Usage:
    python3 data/sample/_generate_taxi_sample.py [num_rows]   # default 2000
"""
from __future__ import annotations

import csv
import io
import pathlib
import sys

import requests

HERE = pathlib.Path(__file__).resolve().parent
ZONES_OUT = HERE / "taxi_zones.csv"
CSV_OUT = HERE / "yellow_taxi_sample.csv"
PARQUET_OUT = HERE / "yellow_taxi_sample.parquet"

TLC_BASE = "https://d37ci6vzurychx.cloudfront.net"
TRIPS_URL = f"{TLC_BASE}/trip-data/yellow_tripdata_2025-08.parquet"
ZONES_URL = f"{TLC_BASE}/misc/taxi_zone_lookup.csv"

# Vendors present in our master (data/sample/vendors.csv + mdm seed).
KNOWN_VENDORS = {1, 2, 6, 7}
# Real "Unknown" / "Outside of NYC" sentinel zones we exclude from clean trips.
EXCLUDED_ZONES = {264, 265}

# A few deliberately messy duplicates appended to the real zone lookup so the
# MDM dedup / fuzzy-match demo has realistic near-duplicate rows to resolve.
DIRTY_ZONE_DUPES = [
    (161, "Manhattan", "Midtown Cntr", "Yellow Zone"),       # abbreviation
    (237, "Manhattan", "UES South", "Yellow Zone"),          # abbreviation
    (7,   "Queens",    "Astoria ", "Boro Zone"),             # trailing space
    (132, "Queens",    "J.F.K. Airport", "Airports"),        # punctuation
]


# --------------------------------------------------------------------------- zones
def build_zones() -> set[int]:
    """Fetch the real TLC zone lookup, write it out, append dirty dupes.

    Returns the set of valid (clean) LocationIDs used to filter trips.
    """
    resp = requests.get(ZONES_URL, timeout=60)
    resp.raise_for_status()
    reader = csv.DictReader(io.StringIO(resp.text))
    rows = list(reader)

    valid_ids: set[int] = set()
    with ZONES_OUT.open("w", newline="") as fh:
        w = csv.writer(fh)
        w.writerow(["LocationID", "Borough", "Zone", "service_zone"])
        for r in rows:
            loc = int(r["LocationID"])
            w.writerow([loc, r["Borough"], r["Zone"], r["service_zone"]])
            if loc not in EXCLUDED_ZONES:
                valid_ids.add(loc)
        for loc, borough, zone, sz in DIRTY_ZONE_DUPES:
            w.writerow([loc, borough, zone, sz])

    print(f"wrote {len(rows)} real zones (+{len(DIRTY_ZONE_DUPES)} dirty dupes) -> {ZONES_OUT}")
    return valid_ids


# --------------------------------------------------------------------------- trips
def build_trips(n: int, valid_zone_ids: set[int]) -> None:
    import pandas as pd
    import pyarrow.parquet as pq

    from _remote_parquet import HTTPRangeFile

    print(f"streaming real trips from {TRIPS_URL} ...")
    src = HTTPRangeFile(TRIPS_URL)
    pf = pq.ParquetFile(src)
    # The first row group (~1M rows) is plenty to draw a clean sample from.
    df = pf.read_row_group(0).to_pandas()
    print(f"  read row group 0: {len(df):,} raw rows")

    pickup = pd.to_datetime(df["tpep_pickup_datetime"])
    dropoff = pd.to_datetime(df["tpep_dropoff_datetime"])

    mask = (
        df["VendorID"].isin(KNOWN_VENDORS)
        & pickup.notna() & dropoff.notna()
        & (dropoff > pickup)
        # keep trips within the file's reference month (Aug 2025)
        & (pickup.dt.year == 2025) & (pickup.dt.month == 8)
        & df["PULocationID"].isin(valid_zone_ids)
        & df["DOLocationID"].isin(valid_zone_ids)
        & df["fare_amount"].notna() & (df["fare_amount"] >= 0)
        & df["total_amount"].notna() & (df["total_amount"] >= 0)
        & df["passenger_count"].notna() & (df["passenger_count"] >= 1)
        & df["trip_distance"].notna() & (df["trip_distance"] > 0)
    )
    clean = df[mask].copy()
    clean = clean.drop_duplicates(
        subset=["VendorID", "tpep_pickup_datetime", "tpep_dropoff_datetime",
                "PULocationID", "DOLocationID"]
    )
    print(f"  {len(clean):,} rows pass the data-quality filters")

    if len(clean) < n:
        raise SystemExit(f"only {len(clean)} clean rows available; lower num_rows")

    sample = clean.sample(n=n, random_state=42).reset_index(drop=True)
    sample = sample.sort_values("tpep_pickup_datetime").reset_index(drop=True)

    # Cast the integer-ish columns back to clean nullable ints.
    sample["VendorID"] = sample["VendorID"].astype("int64")
    sample["passenger_count"] = sample["passenger_count"].astype("int64")
    sample["PULocationID"] = sample["PULocationID"].astype("int64")
    sample["DOLocationID"] = sample["DOLocationID"].astype("int64")
    sample["payment_type"] = sample["payment_type"].astype("int64")

    sample.to_parquet(PARQUET_OUT, index=False)
    print(f"wrote {len(sample):,} real trips -> {PARQUET_OUT}")
    sample.to_csv(CSV_OUT, index=False)
    print(f"wrote {len(sample):,} real trips -> {CSV_OUT}")

    # Quick provenance summary for the demo.
    rev = sample["total_amount"].sum()
    print(f"  vendors={sorted(sample['VendorID'].unique().tolist())} "
          f"revenue=${rev:,.2f} avg_fare=${sample['fare_amount'].mean():.2f}")


def main() -> None:
    n = int(sys.argv[1]) if len(sys.argv) > 1 else 2000
    valid_zone_ids = build_zones()
    build_trips(n, valid_zone_ids)


if __name__ == "__main__":
    main()
