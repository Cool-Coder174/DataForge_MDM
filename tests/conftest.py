import os
import sys
from pathlib import Path
import pytest
import importlib.util

# Ensure the repository root and the mdm directory are in sys.path
REPO_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(REPO_ROOT))
sys.path.insert(0, str(REPO_ROOT / "mdm"))

# Set up standard mock environment variables for testing
@pytest.fixture(autouse=True)
def mock_env(monkeypatch):
    monkeypatch.setenv("DATA_BUCKET", "mock-data-bucket")
    monkeypatch.setenv("PROJECT_NAME", "dataforge-test")
    monkeypatch.setenv("ALERT_TOPIC_ARN", "arn:aws:sns:us-east-1:123456789012:dataforge-test-alerts")
    monkeypatch.setenv("RDS_ENDPOINT", "mock-rds.amazonaws.com")
    monkeypatch.setenv("RDS_SECRET_ARN", "arn:aws:secretsmanager:us-east-1:123456789012:secret:dataforge-test-rds")
    monkeypatch.setenv("RDS_DATABASE", "mdm_test")
    monkeypatch.setenv("ENABLE_RDS", "true")
    monkeypatch.setenv("ENABLE_REDSHIFT", "false")
    monkeypatch.setenv("AWS_REGION", "us-east-1")
    monkeypatch.setenv("AWS_ACCESS_KEY_ID", "testing")
    monkeypatch.setenv("AWS_SECRET_ACCESS_KEY", "testing")
    monkeypatch.setenv("AWS_DEFAULT_REGION", "us-east-1")
    monkeypatch.setenv("STAGE", "test")

def import_lambda(module_name: str, file_path: Path):
    """Helper to dynamically import lambda handlers without namespace collision."""
    spec = importlib.util.spec_from_file_location(module_name, str(file_path))
    module = importlib.util.module_from_spec(spec)
    sys.modules[module_name] = module
    spec.loader.exec_module(module)
    return module

@pytest.fixture
def file_validator_mod():
    return import_lambda("file_validator_app", REPO_ROOT / "lambda" / "file_validator" / "app.py")

@pytest.fixture
def alert_handler_mod():
    return import_lambda("alert_handler_app", REPO_ROOT / "lambda" / "alert_handler" / "app.py")

@pytest.fixture
def mdm_api_mod():
    return import_lambda("mdm_api_app", REPO_ROOT / "lambda" / "mdm_api" / "app.py")
