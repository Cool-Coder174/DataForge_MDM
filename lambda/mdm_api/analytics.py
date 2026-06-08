"""Athena analytics for the MDM API (backend-for-frontend).

Runs a fixed registry of named analytics queries against the curated Glue
database and returns JSON rows the dashboard chart widgets consume directly.
The query set mirrors athena/queries/analytics_queries.sql.

Endpoints (routed by app.handler):
  GET /analytics          -> list available query names
  GET /analytics/{name}   -> {"name": ..., "rows": [ {col: value, ...}, ... ]}
"""
from __future__ import annotations

import os
import time

CURATED_DB = os.environ.get("CURATED_DB", "dataforge_curated")
DATA_BUCKET = os.environ.get("DATA_BUCKET", "").strip()
ATHENA_OUTPUT = (
    os.environ.get("ATHENA_OUTPUT", "").strip()
    or (f"s3://{DATA_BUCKET}/athena-results/" if DATA_BUCKET else "")
)
ATHENA_WORKGROUP = os.environ.get("ATHENA_WORKGROUP", "primary")

# Named query registry. {db} is substituted with CURATED_DB at run time.
QUERIES = {
    "kpis": (
        "SELECT COUNT(*) AS total_trips, "
        "ROUND(SUM(total_amount), 2) AS total_revenue, "
        "ROUND(AVG(fare_amount), 2) AS avg_fare, "
        "ROUND(AVG(trip_distance), 2) AS avg_distance_mi "
        "FROM {db}.fact_trip"
    ),
    "trips_by_borough": (
        "SELECT pickup_borough, COUNT(*) AS trips, "
        "ROUND(SUM(total_amount), 2) AS revenue "
        "FROM {db}.fact_trip GROUP BY pickup_borough ORDER BY trips DESC"
    ),
    "trips_by_vendor": (
        "SELECT vendor_name, COUNT(*) AS trips, "
        "ROUND(AVG(fare_amount), 2) AS avg_fare "
        "FROM {db}.fact_trip GROUP BY vendor_name ORDER BY trips DESC"
    ),
    "top_routes": (
        "SELECT pickup_zone, dropoff_zone, COUNT(*) AS trips "
        "FROM {db}.fact_trip GROUP BY pickup_zone, dropoff_zone "
        "ORDER BY trips DESC LIMIT 15"
    ),
    "daily_trend": (
        "SELECT pickup_date, COUNT(*) AS trips, "
        "ROUND(SUM(total_amount), 2) AS revenue "
        "FROM {db}.fact_trip GROUP BY pickup_date ORDER BY pickup_date"
    ),
    "hourly_profile": (
        "SELECT hour(pickup_datetime) AS pickup_hour, COUNT(*) AS trips "
        "FROM {db}.fact_trip GROUP BY hour(pickup_datetime) ORDER BY pickup_hour"
    ),
}

_CLIENT = None


def _client():
    global _CLIENT
    if _CLIENT is None:
        import boto3

        _CLIENT = boto3.client("athena")
    return _CLIENT


def available_queries():
    return list(QUERIES)


def run_named_query(name, timeout_s=25, poll_interval=0.6):
    """Execute a named query and return parsed rows. Raises KeyError for an
    unknown name, RuntimeError if the Athena query does not succeed in time."""
    if name not in QUERIES:
        raise KeyError(name)
    if not ATHENA_OUTPUT:
        raise RuntimeError("ATHENA_OUTPUT/DATA_BUCKET not configured for Athena results")

    client = _client()
    sql = QUERIES[name].format(db=CURATED_DB)
    started = client.start_query_execution(
        QueryString=sql,
        QueryExecutionContext={"Database": CURATED_DB},
        ResultConfiguration={"OutputLocation": ATHENA_OUTPUT},
        WorkGroup=ATHENA_WORKGROUP,
    )
    qid = started["QueryExecutionId"]

    deadline = time.time() + timeout_s
    state, reason = "RUNNING", ""
    while time.time() < deadline:
        status = client.get_query_execution(QueryExecutionId=qid)["QueryExecution"]["Status"]
        state = status["State"]
        if state in ("SUCCEEDED", "FAILED", "CANCELLED"):
            reason = status.get("StateChangeReason", "")
            break
        time.sleep(poll_interval)

    if state != "SUCCEEDED":
        raise RuntimeError(f"Athena query '{name}' {state}: {reason or 'timed out'}")

    return _collect_rows(client, qid)


def _collect_rows(client, qid):
    rows, header = [], None
    paginator = client.get_paginator("get_query_results")
    for page in paginator.paginate(QueryExecutionId=qid):
        for row in page["ResultSet"]["Rows"]:
            values = [cell.get("VarCharValue") for cell in row["Data"]]
            if header is None:
                header = values  # Athena returns the column names as the first row.
                continue
            rows.append({col: _coerce(val) for col, val in zip(header, values)})
    return rows


def _coerce(value):
    """Best-effort numeric coercion so chart widgets get numbers, not strings."""
    if value is None:
        return None
    try:
        return float(value) if ("." in value or "e" in value.lower()) else int(value)
    except (ValueError, AttributeError):
        return value
