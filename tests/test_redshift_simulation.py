from __future__ import annotations
import os
import re
import pytest
import sqlite3
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]

class RedshiftSimulator:
    """Helper to simulate Amazon Redshift schemas and copy operations in SQLite."""

    def __init__(self):
        self.conn = sqlite3.connect(":memory:")
        self.conn.row_factory = sqlite3.Row

    def translate_ddl(self, ddl: str) -> str:
        """Translate Redshift-specific DDL syntax to standard SQLite syntax."""
        # Remove DISTSTYLE, SORTKEY, DISTKEY clauses
        ddl = re.sub(r"DISTSTYLE\s+\w+", "", ddl, flags=re.IGNORECASE)
        ddl = re.sub(r"SORTKEY\s*\([^)]*\)", "", ddl, flags=re.IGNORECASE)
        ddl = re.sub(r"DISTKEY\s*\([^)]*\)", "", ddl, flags=re.IGNORECASE)
        ddl = re.sub(r"DISTKEY\s+\w+", "", ddl, flags=re.IGNORECASE)
        
        # Replace BIGSERIAL with INTEGER PRIMARY KEY AUTOINCREMENT
        ddl = re.sub(r"BIGSERIAL\s+PRIMARY\s+KEY", "INTEGER PRIMARY KEY AUTOINCREMENT", ddl, flags=re.IGNORECASE)
        # SQLite doesn't require TIMESTAMPTZ, translate to TIMESTAMP/TEXT
        ddl = ddl.replace("TIMESTAMPTZ", "TIMESTAMP")
        return ddl

    def execute_ddl(self, ddl_path: Path):
        """Execute the translated DDL script to create the simulated schema."""
        content = ddl_path.read_text()
        # Remove line-by-line SQL comments
        content = re.sub(r"--.*$", "", content, flags=re.MULTILINE)
        translated = self.translate_ddl(content)
        # Split by semicolon and run each statement
        statements = translated.split(";")
        for stmt in statements:
            stmt = stmt.strip()
            if stmt and "SET search_path" not in stmt:
                try:
                    self.conn.execute(stmt)
                except sqlite3.OperationalError as exc:
                    raise sqlite3.OperationalError(f"Error running simulated DDL:\n{stmt}\nError: {exc}") from exc
        self.conn.commit()

    def parse_copy_commands(self, sql_path: Path, data_bucket: str, redshift_role: str) -> list[dict]:
        """Parse 004_load_redshift.sql and extract COPY statements details."""
        content = sql_path.read_text()
        # Replace template parameters
        content = content.replace("${data_bucket}", data_bucket)
        content = content.replace("${redshift_role_arn}", redshift_role)
        
        # Extract COPY commands using regex
        copy_pattern = re.compile(
            r"COPY\s+(\w+)\s+FROM\s+'([^']+)'\s+IAM_ROLE\s+'([^']+)'(?:\s+FORMAT\s+AS\s+(\w+))?",
            re.IGNORECASE | re.MULTILINE
        )
        
        matches = copy_pattern.findall(content)
        commands = []
        for table, s3_path, role, fmt in matches:
            commands.append({
                "table": table,
                "s3_path": s3_path,
                "role_arn": role,
                "format": fmt or "PARQUET"
            })
        return commands


def test_redshift_schema_compiles_in_simulator():
    """Verify that the Redshift DDL is syntax-valid and runs in our simulated environment."""
    sim = RedshiftSimulator()
    ddl_path = REPO_ROOT / "redshift" / "ddl" / "warehouse_schema.sql"
    
    assert ddl_path.exists(), "Redshift schema DDL file not found!"
    sim.execute_ddl(ddl_path)
    
    # Check that all tables were created successfully in SQLite
    cursor = sim.conn.execute("SELECT name FROM sqlite_master WHERE type='table'")
    tables = [row["name"] for row in cursor.fetchall()]
    
    expected_tables = ["dim_date", "dim_zone_scd2", "dim_vendor_scd2", "fact_trip", "dq_run_summary"]
    for table in expected_tables:
        assert table in tables, f"Expected table {table} not found in simulated Redshift database!"


def test_redshift_load_script_parsing():
    """Test that the redshift COPY statements parse correctly with proper variables."""
    sim = RedshiftSimulator()
    load_sql_path = REPO_ROOT / "sql" / "transformations" / "004_load_redshift.sql"
    
    assert load_sql_path.exists(), "Redshift load SQL file not found!"
    
    bucket = "my-test-dataforge-bucket"
    role = "arn:aws:iam::123456789012:role/RedshiftS3ReadRole"
    
    copies = sim.parse_copy_commands(load_sql_path, data_bucket=bucket, redshift_role=role)
    
    assert len(copies) == 5, "Expected 5 COPY commands in 004_load_redshift.sql"
    
    # Assert specific copy actions
    tables_copied = [c["table"] for c in copies]
    assert "fact_trip" in tables_copied
    assert "dim_date" in tables_copied
    assert "dim_zone_scd2" in tables_copied
    assert "dim_vendor_scd2" in tables_copied
    assert "dq_run_summary" in tables_copied
    
    for copy in copies:
        assert copy["role_arn"] == role
        assert copy["format"].upper() == "PARQUET"
        assert copy["s3_path"].startswith(f"s3://{bucket}/")


def test_read_budget_warnings(recwarn):
    """Read .env or .env.example configuration and warn if expensive AWS resources are enabled."""
    env_file = REPO_ROOT / ".env"
    if not env_file.exists():
        env_file = REPO_ROOT / ".env.example"
        
    assert env_file.exists(), "No .env or .env.example file found!"
    
    lines = env_file.read_text().splitlines()
    config = {}
    for line in lines:
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        config[k.strip()] = v.strip().lower()
        
    enable_redshift = config.get("ENABLE_REDSHIFT", "false") == "true"
    enable_rds = config.get("ENABLE_RDS", "true") == "true"
    enable_quicksight = config.get("ENABLE_QUICKSIGHT", "false") == "true"
    
    # Emit warning if Redshift is enabled (highest charge hazard)
    if enable_redshift:
        import warnings
        warnings.warn(
            "BUDGET WARNING: ENABLE_REDSHIFT=true is enabled! "
            "An Amazon Redshift cluster runs 24/7 and can incur significant charges. "
            "Set ENABLE_REDSHIFT=false in .env and use Athena instead if not actively demonstrating.",
            UserWarning
        )
        
    # Emit warning if RDS is enabled
    if enable_rds:
        import warnings
        warnings.warn(
            "COST ADVISORY: ENABLE_RDS=true is enabled. "
            "The PostgreSQL RDS instance (db.t3.micro) incurs hourly charges. "
            "Always run 'make destroy' immediately after finishing your demo.",
            UserWarning
        )
        
    # Check that defaults in .env.example are cheap
    if "example" in env_file.name:
        assert config.get("ENABLE_REDSHIFT") == "false", "Default in .env.example should have ENABLE_REDSHIFT=false"
        assert config.get("ENABLE_QUICKSIGHT") == "false", "Default in .env.example should have ENABLE_QUICKSIGHT=false"
