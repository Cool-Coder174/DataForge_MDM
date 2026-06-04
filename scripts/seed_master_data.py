#!/usr/bin/env python3
"""Seed the MDM PostgreSQL store with schema + SCD2 tables + seed rows.

Reads connection info from AWS Secrets Manager (created by the RDS stack) and the
RDS endpoint from the CloudFormation stack outputs. Applies, in order:
  mdm/schema/postgres_schema.sql
  mdm/schema/scd2_tables.sql
  mdm/schema/seed_data.sql

If ENABLE_RDS=false or the stack/secret can't be found, prints guidance and exits
0 so the demo flow isn't blocked (the API has a SQLite fallback).
"""
from __future__ import annotations

import json
import os
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parents[1]
SCHEMA_DIR = ROOT / "mdm" / "schema"
SQL_FILES = ["postgres_schema.sql", "scd2_tables.sql", "seed_data.sql"]


def load_env() -> dict:
    env = dict(os.environ)
    dotenv = ROOT / ".env"
    if dotenv.exists():
        for line in dotenv.read_text().splitlines():
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            k, v = line.split("=", 1)
            env.setdefault(k.strip(), v.strip())
    return env


def main() -> int:
    env = load_env()
    project = env.get("PROJECT_NAME", "dataforge")
    region = env.get("AWS_REGION", "us-east-1")
    stack = env.get("STACK_NAME", "dataforge-mdm-demo")
    db = env.get("RDS_DATABASE", "mdm")

    if env.get("ENABLE_RDS", "true").lower() != "true":
        print("[seed] ENABLE_RDS=false -> skipping RDS seeding. "
              "The MDM API will use its SQLite fallback.")
        return 0

    try:
        import boto3  # noqa
        import psycopg2  # noqa
    except ImportError:
        print("[seed] boto3/psycopg2 not installed. `pip install -r requirements-dev.txt`.",
              file=sys.stderr)
        return 0

    import boto3
    import psycopg2

    cfn = boto3.client("cloudformation", region_name=region)
    sm = boto3.client("secretsmanager", region_name=region)

    try:
        outputs = {o["OutputKey"]: o["OutputValue"]
                   for o in cfn.describe_stacks(StackName=stack)["Stacks"][0].get("Outputs", [])}
    except Exception as exc:  # noqa: BLE001
        print(f"[seed] Could not read stack outputs ({exc}). Deploy first.", file=sys.stderr)
        return 0

    # RDS endpoint is exported by the nested rds stack; fall back to convention.
    try:
        secret = sm.get_secret_value(SecretId=f"{project}/rds/master")["SecretString"]
        creds = json.loads(secret)
    except Exception as exc:  # noqa: BLE001
        print(f"[seed] Could not read RDS secret ({exc}).", file=sys.stderr)
        return 0

    # Endpoint: pull from the rds nested stack export.
    try:
        endpoint = cfn.list_exports()  # paginated; small for demo
        ep = None
        for e in endpoint.get("Exports", []):
            if e["Name"] == f"{project}-rds-endpoint":
                ep = e["Value"]
                break
        if not ep:
            raise RuntimeError("export not found")
    except Exception as exc:  # noqa: BLE001
        print(f"[seed] Could not resolve RDS endpoint ({exc}).", file=sys.stderr)
        return 0

    print(f"[seed] Connecting to {ep}/{db} as {creds['username']} ...")
    conn = psycopg2.connect(host=ep, dbname=db, user=creds["username"],
                            password=creds["password"], port=5432, connect_timeout=10)
    conn.autocommit = True
    try:
        with conn.cursor() as cur:
            for fname in SQL_FILES:
                path = SCHEMA_DIR / fname
                print(f"[seed] Applying {fname} ...")
                cur.execute(path.read_text())
        print("[seed] Done. Master + SCD2 tables created and seeded.")
    finally:
        conn.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
