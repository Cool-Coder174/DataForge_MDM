"""mdm_api Lambda - RESTful Master Data Management API (API Gateway proxy).

Domains: zones, vendors. Endpoints (per domain):
  GET    /zones                 list golden records
  POST   /zones                 create
  GET    /zones/{id}            read one
  PUT    /zones/{id}            update (also writes SCD2 history)
  POST   /zones/match           fuzzy-match a candidate -> duplicate candidates
  POST   /zones/merge           merge duplicates -> golden record (survivorship)
  GET    /zones/{id}/history    SCD2 version history
  ...and the same shape for /vendors.

Storage backends (auto-selected):
  - RDS PostgreSQL via psycopg2 when RDS_ENDPOINT + RDS_SECRET_ARN are set.
  - SQLite fallback (file under /tmp) otherwise, so the API always demos. The
    fallback is seeded with the same sample master data and a tiny SCD2 table.

The fuzzy matching + survivorship logic is shared with batch jobs via the
`matching` package (bundled at deploy time).
"""
from __future__ import annotations

import json
import os

from matching import find_candidates, build_golden_record, match_score

# --------------------------------------------------------------------------- config
RDS_ENDPOINT = os.environ.get("RDS_ENDPOINT", "").strip()
RDS_SECRET_ARN = os.environ.get("RDS_SECRET_ARN", "").strip()
PROJECT = os.environ.get("PROJECT_NAME", "dataforge")
USE_RDS = bool(RDS_ENDPOINT and RDS_SECRET_ARN)

# Domain metadata drives generic CRUD/match/merge.
DOMAINS = {
    "zones": {
        "table": "mdm.zones",
        "id_col": "zone_id",
        "nk_col": "location_id",
        "match_field": "zone_name",
        "attrs": ["zone_name", "borough", "service_zone"],
        "scd2_table": "mdm.dim_zone_scd2",
        "scd2_proc": "mdm.scd2_upsert_zone",
        "scd2_nk": "location_id",
        "scd2_attrs": ["zone_name", "borough", "service_zone"],
    },
    "vendors": {
        "table": "mdm.vendors",
        "id_col": "vendor_pk",
        "nk_col": "vendor_id",
        "match_field": "vendor_name",
        "attrs": ["vendor_name", "vendor_code", "tech_provider", "contact_email"],
        "scd2_table": "mdm.dim_vendor_scd2",
        "scd2_proc": "mdm.scd2_upsert_vendor",
        "scd2_nk": "vendor_id",
        "scd2_attrs": ["vendor_name", "vendor_code", "tech_provider"],
    },
}


# =========================================================================== Stores
class PostgresStore:
    """RDS PostgreSQL backend (psycopg2)."""

    def __init__(self):
        import boto3
        import psycopg2
        import psycopg2.extras

        secret = boto3.client("secretsmanager").get_secret_value(
            SecretId=RDS_SECRET_ARN)["SecretString"]
        creds = json.loads(secret)
        self._conn = psycopg2.connect(
            host=RDS_ENDPOINT, dbname=os.environ.get("RDS_DATABASE", "mdm"),
            user=creds["username"], password=creds["password"], port=5432,
            connect_timeout=8)
        self._conn.autocommit = True
        self._extras = psycopg2.extras

    def query(self, sql, params=None):
        with self._conn.cursor(cursor_factory=self._extras.RealDictCursor) as cur:
            cur.execute(sql, params or ())
            return [dict(r) for r in cur.fetchall()]

    def execute(self, sql, params=None):
        with self._conn.cursor(cursor_factory=self._extras.RealDictCursor) as cur:
            cur.execute(sql, params or ())
            try:
                return [dict(r) for r in cur.fetchall()]
            except Exception:  # noqa: BLE001 - non-returning statements
                return []

    def call_scd2(self, proc, args):
        placeholders = ", ".join(["%s"] * len(args))
        return self.execute(f"SELECT {proc}({placeholders}) AS result", args)


class SqliteStore:
    """Local SQLite fallback so the API demos without RDS."""

    _BOOTSTRAPPED = False

    def __init__(self):
        import sqlite3

        self._sqlite3 = sqlite3
        self._path = "/tmp/mdm_fallback.db"
        self._conn = sqlite3.connect(self._path)
        self._conn.row_factory = sqlite3.Row
        if not SqliteStore._BOOTSTRAPPED:
            self._bootstrap()
            SqliteStore._BOOTSTRAPPED = True

    def _bootstrap(self):
        c = self._conn
        c.executescript(
            """
            CREATE TABLE IF NOT EXISTS zones (
              zone_id INTEGER PRIMARY KEY AUTOINCREMENT, location_id INTEGER,
              zone_name TEXT, borough TEXT, service_zone TEXT,
              source_system TEXT DEFAULT 'manual_entry',
              created_at TEXT DEFAULT CURRENT_TIMESTAMP,
              updated_at TEXT DEFAULT CURRENT_TIMESTAMP);
            CREATE TABLE IF NOT EXISTS vendors (
              vendor_pk INTEGER PRIMARY KEY AUTOINCREMENT, vendor_id INTEGER,
              vendor_name TEXT, vendor_code TEXT, tech_provider TEXT,
              contact_email TEXT, source_system TEXT DEFAULT 'manual_entry',
              created_at TEXT DEFAULT CURRENT_TIMESTAMP,
              updated_at TEXT DEFAULT CURRENT_TIMESTAMP);
            CREATE TABLE IF NOT EXISTS dim_zone_scd2 (
              surrogate_key INTEGER PRIMARY KEY AUTOINCREMENT, location_id INTEGER,
              zone_name TEXT, borough TEXT, service_zone TEXT,
              valid_from TEXT DEFAULT CURRENT_TIMESTAMP, valid_to TEXT DEFAULT '9999-12-31',
              is_current INTEGER DEFAULT 1, record_hash TEXT);
            CREATE TABLE IF NOT EXISTS dim_vendor_scd2 (
              surrogate_key INTEGER PRIMARY KEY AUTOINCREMENT, vendor_id INTEGER,
              vendor_name TEXT, vendor_code TEXT, tech_provider TEXT,
              valid_from TEXT DEFAULT CURRENT_TIMESTAMP, valid_to TEXT DEFAULT '9999-12-31',
              is_current INTEGER DEFAULT 1, record_hash TEXT);
            CREATE TABLE IF NOT EXISTS merge_history (
              merge_id INTEGER PRIMARY KEY AUTOINCREMENT, domain TEXT,
              survivor_id INTEGER, duplicate_ids TEXT, match_score REAL,
              reason TEXT, merged_at TEXT DEFAULT CURRENT_TIMESTAMP);
            """
        )
        if not c.execute("SELECT 1 FROM zones LIMIT 1").fetchone():
            c.executemany(
                "INSERT INTO zones (location_id, zone_name, borough, service_zone, source_system) VALUES (?,?,?,?,?)",
                [(7, "Astoria", "Queens", "Boro Zone", "tlc_registry"),
                 (161, "Midtown Center", "Manhattan", "Yellow Zone", "tlc_registry"),
                 (236, "Upper East Side North", "Manhattan", "Yellow Zone", "tlc_registry"),
                 (237, "Upper East Side South", "Manhattan", "Yellow Zone", "tlc_registry"),
                 (132, "JFK Airport", "Queens", "Airports", "tlc_registry")])
            c.executemany(
                "INSERT INTO vendors (vendor_id, vendor_name, vendor_code, tech_provider, contact_email, source_system) VALUES (?,?,?,?,?,?)",
                [(1, "Creative Mobile Technologies LLC", "CMT", "Creative Mobile Technologies", "ops@cmtnyc.com", "tlc_registry"),
                 (2, "VeriFone Inc", "VTS", "VeriFone", "support@verifone.com", "tlc_registry"),
                 (6, "Myle Technologies Inc", "MYLE", "Myle", "hello@myle.com", "tlc_registry")])
            # Seed SCD2 current rows + one historical change for vendor 2.
            c.executemany(
                "INSERT INTO dim_zone_scd2 (location_id, zone_name, borough, service_zone, record_hash) VALUES (?,?,?,?,?)",
                [(7, "Astoria", "Queens", "Boro Zone", "h1"),
                 (161, "Midtown Center", "Manhattan", "Yellow Zone", "h2")])
            c.execute("INSERT INTO dim_vendor_scd2 (vendor_id, vendor_name, vendor_code, tech_provider, valid_to, is_current, record_hash) VALUES (2,'Verifone','VTS','VeriFone','2024-02-12 00:00:00',0,'old')")
            c.execute("INSERT INTO dim_vendor_scd2 (vendor_id, vendor_name, vendor_code, tech_provider, record_hash) VALUES (2,'VeriFone Inc','VTS','VeriFone','new')")
            c.commit()

    def _translate(self, sql):
        return sql.replace("mdm.", "").replace("%s", "?")

    def query(self, sql, params=None):
        cur = self._conn.execute(self._translate(sql), params or ())
        return [dict(r) for r in cur.fetchall()]

    def execute(self, sql, params=None):
        cur = self._conn.execute(self._translate(sql), params or ())
        # Fetch any RETURNING rows BEFORE committing (sqlite can't commit while a
        # statement still has pending results).
        try:
            rows = [dict(r) for r in cur.fetchall()]
        except Exception:  # noqa: BLE001
            rows = []
        self._conn.commit()
        return rows

    def call_scd2(self, proc, args):
        # Emulate the Postgres SCD2 procedure in Python.
        import hashlib
        if "zone" in proc:
            tbl, nk, cols = "dim_zone_scd2", "location_id", ["zone_name", "borough", "service_zone"]
        else:
            tbl, nk, cols = "dim_vendor_scd2", "vendor_id", ["vendor_name", "vendor_code", "tech_provider"]
        nk_val, vals = args[0], args[1:]
        h = hashlib.md5("||".join("" if v is None else str(v) for v in vals).encode()).hexdigest()
        cur = self._conn.execute(
            f"SELECT record_hash FROM {tbl} WHERE {nk}=? AND is_current=1", (nk_val,)).fetchone()
        if cur is None:
            self._conn.execute(
                f"INSERT INTO {tbl} ({nk},{','.join(cols)},record_hash) VALUES (?,?,?,?,?)",
                (nk_val, *vals, h))
            res = "inserted_new"
        elif cur["record_hash"] == h:
            res = "no_change"
        else:
            self._conn.execute(
                f"UPDATE {tbl} SET is_current=0, valid_to=CURRENT_TIMESTAMP WHERE {nk}=? AND is_current=1", (nk_val,))
            self._conn.execute(
                f"INSERT INTO {tbl} ({nk},{','.join(cols)},record_hash) VALUES (?,?,?,?,?)",
                (nk_val, *vals, h))
            res = "versioned"
        self._conn.commit()
        return [{"result": res}]


_STORE = None


def store():
    global _STORE
    if _STORE is None:
        try:
            _STORE = PostgresStore() if USE_RDS else SqliteStore()
        except Exception as exc:  # noqa: BLE001
            print(f"[mdm_api] RDS unavailable ({exc}); using SQLite fallback.")
            _STORE = SqliteStore()
    return _STORE


# =========================================================================== handlers
def _resp(code, body):
    return {"statusCode": code,
            "headers": {"content-type": "application/json"},
            "body": json.dumps(body, default=str)}


def list_records(domain):
    d = DOMAINS[domain]
    rows = store().query(f"SELECT * FROM {d['table']} ORDER BY {d['id_col']}")
    return _resp(200, {"count": len(rows), "items": rows})


def get_record(domain, rid):
    d = DOMAINS[domain]
    rows = store().query(f"SELECT * FROM {d['table']} WHERE {d['id_col']} = %s", (rid,))
    return _resp(200, rows[0]) if rows else _resp(404, {"error": "not found"})


def create_record(domain, body):
    d = DOMAINS[domain]
    cols = [d["nk_col"]] + d["attrs"] + ["source_system"]
    present = [c for c in cols if c in body]
    if not present:
        return _resp(400, {"error": "no recognized fields"})
    placeholders = ", ".join(["%s"] * len(present))
    sql = (f"INSERT INTO {d['table']} ({', '.join(present)}) VALUES ({placeholders}) "
           f"RETURNING {d['id_col']}")
    try:
        rows = store().execute(sql, tuple(body[c] for c in present))
    except Exception as exc:  # noqa: BLE001
        # SQLite has no RETURNING on older versions; fall back to last id.
        store().execute(sql.split(" RETURNING")[0], tuple(body[c] for c in present))
        rows = store().query(f"SELECT MAX({d['id_col']}) AS {d['id_col']} FROM {d['table']}")
    new_id = rows[0][d["id_col"]] if rows else None
    return _resp(201, {"created": True, d["id_col"]: new_id})


def update_record(domain, rid, body):
    d = DOMAINS[domain]
    sets = [c for c in d["attrs"] if c in body]
    if not sets:
        return _resp(400, {"error": "no updatable fields"})
    assignments = ", ".join(f"{c} = %s" for c in sets)
    store().execute(
        f"UPDATE {d['table']} SET {assignments} WHERE {d['id_col']} = %s",
        tuple(body[c] for c in sets) + (rid,))
    # Write SCD2 history for the change.
    rows = store().query(f"SELECT * FROM {d['table']} WHERE {d['id_col']} = %s", (rid,))
    if rows:
        rec = rows[0]
        args = [rec.get(d["scd2_nk"])] + [rec.get(a) for a in d["scd2_attrs"]]
        scd = store().call_scd2(d["scd2_proc"], args)
        return _resp(200, {"updated": True, "scd2": scd[0] if scd else None, "record": rec})
    return _resp(404, {"error": "not found"})


def match_records(domain, body):
    d = DOMAINS[domain]
    rows = store().query(f"SELECT * FROM {d['table']}")
    query = {d["match_field"]: body.get(d["match_field"]), d["id_col"]: body.get(d["id_col"])}
    threshold = float(body.get("threshold", 0.80))
    candidates = find_candidates(query, rows, key_field=d["match_field"],
                                 id_field=d["id_col"], threshold=threshold)
    return _resp(200, {"query": body.get(d["match_field"]),
                       "threshold": threshold, "candidates": candidates})


def merge_records(domain, body):
    d = DOMAINS[domain]
    survivor_id = body.get("survivor_id")
    dup_ids = body.get("duplicate_ids", [])
    if survivor_id is None or not dup_ids:
        return _resp(400, {"error": "survivor_id and duplicate_ids required"})
    ids = [survivor_id] + list(dup_ids)
    placeholders = ", ".join(["%s"] * len(ids))
    recs = store().query(
        f"SELECT * FROM {d['table']} WHERE {d['id_col']} IN ({placeholders})", tuple(ids))
    if not recs:
        return _resp(404, {"error": "no records found"})

    golden = build_golden_record(recs, attrs=d["attrs"], id_field=d["id_col"])
    # Best match score among the duplicates vs survivor (for the audit trail).
    survivor = next((r for r in recs if r[d["id_col"]] == survivor_id), recs[0])
    best_score, reason = 0.0, ""
    for r in recs:
        if r[d["id_col"]] == survivor_id:
            continue
        sc, rs = match_score(survivor.get(d["match_field"]), r.get(d["match_field"]))
        if sc > best_score:
            best_score, reason = sc, rs

    # Update survivor with golden attribute values.
    assignments = ", ".join(f"{a} = %s" for a in d["attrs"])
    store().execute(
        f"UPDATE {d['table']} SET {assignments} WHERE {d['id_col']} = %s",
        tuple(golden.get(a) for a in d["attrs"]) + (survivor_id,))
    # Delete merged duplicates.
    dup_placeholders = ", ".join(["%s"] * len(dup_ids))
    store().execute(
        f"DELETE FROM {d['table']} WHERE {d['id_col']} IN ({dup_placeholders})", tuple(dup_ids))
    # Record merge audit.
    store().execute(
        "INSERT INTO mdm.merge_history (domain, survivor_id, duplicate_ids, match_score, reason) "
        "VALUES (%s, %s, %s, %s, %s)",
        (domain, survivor_id, json.dumps(dup_ids), best_score, reason))
    # Refresh SCD2 for the survivor's golden state.
    survivor_now = store().query(
        f"SELECT * FROM {d['table']} WHERE {d['id_col']} = %s", (survivor_id,))[0]
    args = [survivor_now.get(d["scd2_nk"])] + [survivor_now.get(a) for a in d["scd2_attrs"]]
    store().call_scd2(d["scd2_proc"], args)

    return _resp(200, {"merged": True, "survivor_id": survivor_id,
                       "merged_ids": dup_ids, "match_score": best_score,
                       "golden_record": golden})


def history(domain, rid):
    d = DOMAINS[domain]
    # rid here is the natural key for SCD2 lookups; also accept golden id.
    rows = store().query(
        f"SELECT * FROM {d['scd2_table']} WHERE {d['scd2_nk']} = %s "
        f"ORDER BY valid_from", (rid,))
    if not rows:
        # Maybe caller passed the golden id; resolve to natural key.
        golden = store().query(
            f"SELECT {d['nk_col']} AS nk FROM {d['table']} WHERE {d['id_col']} = %s", (rid,))
        if golden:
            rows = store().query(
                f"SELECT * FROM {d['scd2_table']} WHERE {d['scd2_nk']} = %s ORDER BY valid_from",
                (golden[0]["nk"],))
    return _resp(200, {"natural_key": rid, "versions": rows})


# =========================================================================== router
def handler(event, _context):
    method = (event.get("httpMethod") or "GET").upper()
    raw_path = event.get("path") or "/"
    path = raw_path.strip("/")
    parts = path.split("/") if path else []
    body = {}
    if event.get("body"):
        try:
            body = json.loads(event["body"])
        except (ValueError, TypeError):
            return _resp(400, {"error": "invalid JSON body"})

    try:
        if not parts:
            return _resp(200, {"service": f"{PROJECT}-mdm-api",
                               "backend": "rds" if USE_RDS else "sqlite",
                               "domains": list(DOMAINS)})

        domain = parts[0]
        if domain not in DOMAINS:
            return _resp(404, {"error": f"unknown domain '{domain}'"})

        # /{domain}
        if len(parts) == 1:
            if method == "GET":
                return list_records(domain)
            if method == "POST":
                return create_record(domain, body)

        # /{domain}/match  or  /{domain}/merge
        if len(parts) == 2 and parts[1] in ("match", "merge"):
            if method != "POST":
                return _resp(405, {"error": "use POST"})
            return match_records(domain, body) if parts[1] == "match" else merge_records(domain, body)

        # /{domain}/{id}
        if len(parts) == 2:
            rid = parts[1]
            if method == "GET":
                return get_record(domain, rid)
            if method == "PUT":
                return update_record(domain, rid, body)

        # /{domain}/{id}/history
        if len(parts) == 3 and parts[2] == "history" and method == "GET":
            return history(domain, parts[1])

        return _resp(405, {"error": f"unsupported {method} {raw_path}"})
    except Exception as exc:  # noqa: BLE001
        print(f"[mdm_api] error: {exc}")
        return _resp(500, {"error": str(exc)})
