import json
import pytest
import sqlite3
from unittest.mock import MagicMock, patch, mock_open
import sys
from pathlib import Path

# Import the seed script and api module
import scripts.seed_master_data as seed_script


def test_postgres_store_secrets_manager_connection(mdm_api_mod):
    """Test that PostgresStore fetches the database credential secret from Secrets Manager and connects."""
    mock_sm = MagicMock()
    mock_sm.get_secret_value.return_value = {
        "SecretString": json.dumps({"username": "dbuser", "password": "dbpassword"})
    }
    
    mock_conn = MagicMock()
    
    with patch("boto3.client", return_value=mock_sm) as mock_boto, \
         patch("psycopg2.connect", return_value=mock_conn) as mock_connect:
        
        # Instantiate PostgresStore
        store = mdm_api_mod.PostgresStore()
        
        # Verify Secrets Manager API call
        mock_boto.assert_any_call("secretsmanager")
        mock_sm.get_secret_value.assert_called_once_with(SecretId=mdm_api_mod.RDS_SECRET_ARN)
        
        # Verify psycopg2 connection parameters
        mock_connect.assert_called_once_with(
            host=mdm_api_mod.RDS_ENDPOINT,
            dbname="mdm_test",
            user="dbuser",
            password="dbpassword",
            port=5432,
            connect_timeout=8
        )
        assert store._conn == mock_conn


def test_seed_master_data_script_execution():
    """Test the seed_master_data.py execution, mocking CFN, Secrets Manager, and psycopg2."""
    mock_cfn = MagicMock()
    mock_cfn.describe_stacks.return_value = {
        "Stacks": [{"Outputs": [{"OutputKey": "RdsEndpoint", "OutputValue": "stack-rds.amazonaws.com"}]}]
    }
    mock_cfn.list_exports.return_value = {
        "Exports": [{"Name": "dataforge-rds-endpoint", "Value": "exported-rds.amazonaws.com"}]
    }
    
    mock_sm = MagicMock()
    mock_sm.get_secret_value.return_value = {
        "SecretString": json.dumps({"username": "admin", "password": "secretpassword"})
    }
    
    mock_conn = MagicMock()
    mock_cursor = MagicMock()
    mock_conn.cursor.return_value.__enter__.return_value = mock_cursor
    
    # Mocking files in mdm/schema/*.sql
    sql_content = "CREATE TABLE dummy_table;"
    
    with patch("boto3.client") as mock_boto, \
         patch("psycopg2.connect", return_value=mock_conn) as mock_connect, \
         patch("pathlib.Path.read_text", return_value=sql_content) as mock_read:
        
        # Set up boto3 client dispatching
        def boto_client_side(service, *args, **kwargs):
            if service == "cloudformation":
                return mock_cfn
            if service == "secretsmanager":
                return mock_sm
            return MagicMock()
        
        mock_boto.side_effect = boto_client_side
        
        env = {
            "ENABLE_RDS": "true",
            "PROJECT_NAME": "dataforge",
            "AWS_REGION": "us-east-1",
            "STACK_NAME": "dataforge-mdm-demo",
            "RDS_DATABASE": "mdm"
        }
        
        with patch.dict("os.environ", env):
            res = seed_script.main()
            
            assert res == 0
            # Verify boto3 client instantiations
            mock_boto.assert_any_call("cloudformation", region_name="us-east-1")
            mock_boto.assert_any_call("secretsmanager", region_name="us-east-1")
            
            # Verify endpoint and secret retrieval
            mock_sm.get_secret_value.assert_called_once_with(SecretId="dataforge/rds/master")
            mock_cfn.list_exports.assert_called_once()
            
            # Verify DB connection and cursor execute
            mock_connect.assert_called_once_with(
                host="exported-rds.amazonaws.com",
                dbname="mdm",
                user="admin",
                password="secretpassword",
                port=5432,
                connect_timeout=10
            )
            # Verify SQL scripts were executed (3 sql files)
            assert mock_cursor.execute.call_count == 3
            mock_cursor.execute.assert_any_call(sql_content)


def test_sqlite_fallback_bootstrap_and_queries(mdm_api_mod):
    """Test SqliteStore's fallback bootstrapping, SQL translation, and querying."""
    # Ensure temporary DB is fresh
    import os
    if os.path.exists("/tmp/mdm_fallback.db"):
        try:
            os.remove("/tmp/mdm_fallback.db")
        except PermissionError:
            pass
            
    # Reset bootstrapped status
    mdm_api_mod.SqliteStore._BOOTSTRAPPED = False
    
    # Initialize SQLite store
    store = mdm_api_mod.SqliteStore()
    
    # Verify tables exist and were seeded
    zones = store.query("SELECT * FROM mdm.zones")
    assert len(zones) > 0
    assert zones[0]["zone_name"] == "Astoria"
    
    vendors = store.query("SELECT * FROM mdm.vendors")
    assert len(vendors) > 0
    
    # Verify SQL translator translates mdm. schema prefixes and %s parameter markers
    translated = store._translate("SELECT * FROM mdm.zones WHERE zone_id = %s")
    assert translated == "SELECT * FROM zones WHERE zone_id = ?"


def test_sqlite_fallback_scd2_procedure(mdm_api_mod):
    """Test the Python emulation of scd2 upsert procedures inside SqliteStore."""
    # Reset bootstrapped status and initialize store
    mdm_api_mod.SqliteStore._BOOTSTRAPPED = False
    store = mdm_api_mod.SqliteStore()
    
    # Clean tables
    store.execute("DELETE FROM dim_zone_scd2")
    
    # Step 1: Insert fresh new location
    # Args: natural_key, zone_name, borough, service_zone
    res1 = store.call_scd2("mdm.scd2_upsert_zone", [120, "Long Island City", "Queens", "Boro Zone"])
    assert res1[0]["result"] == "inserted_new"
    
    # Verify first version is current
    rows = store.query("SELECT * FROM dim_zone_scd2 WHERE location_id = 120")
    assert len(rows) == 1
    assert rows[0]["is_current"] == 1
    assert rows[0]["zone_name"] == "Long Island City"
    
    # Step 2: Call again with identical attributes (should yield "no_change")
    res2 = store.call_scd2("mdm.scd2_upsert_zone", [120, "Long Island City", "Queens", "Boro Zone"])
    assert res2[0]["result"] == "no_change"
    
    # Step 3: Call with modified attributes (should version: expire old, insert new current)
    res3 = store.call_scd2("mdm.scd2_upsert_zone", [120, "LIC Waterfront", "Queens", "Boro Zone"])
    assert res3[0]["result"] == "versioned"
    
    # Verify history is preserved (1 historical, 1 current)
    rows_after = store.query("SELECT * FROM dim_zone_scd2 WHERE location_id = 120 ORDER BY valid_to ASC")
    assert len(rows_after) == 2
    assert rows_after[0]["is_current"] == 0
    assert rows_after[0]["zone_name"] == "Long Island City"
    assert rows_after[1]["is_current"] == 1
    assert rows_after[1]["zone_name"] == "LIC Waterfront"
