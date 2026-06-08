import pytest
from unittest.mock import MagicMock, patch

# ==============================================================================
# 1. Unit Tests for file_validator Lambda
# ==============================================================================

def test_file_validator_validate_success(file_validator_mod):
    """Test that a valid parquet file metadata is returned successfully."""
    mock_s3 = MagicMock()
    mock_s3.head_object.return_value = {
        "ContentLength": 1024,
        "ContentType": "application/x-parquet",
    }
    
    with patch("boto3.client", return_value=mock_s3) as mock_client:
        # Re-initialize or override s3 in module
        file_validator_mod.s3 = mock_s3
        
        event = {
            "action": "validate",
            "bucket": "mock-data-bucket",
            "trips_key": "incoming/yellow_taxi/yellow_taxi_sample.parquet"
        }
        res = file_validator_mod.handler(event, None)
        
        assert res["valid"] is True
        assert res["size_bytes"] == 1024
        assert res["content_type"] == "application/x-parquet"
        mock_s3.head_object.assert_called_once_with(
            Bucket="mock-data-bucket",
            Key="incoming/yellow_taxi/yellow_taxi_sample.parquet"
        )


def test_file_validator_validate_unsupported_ext(file_validator_mod):
    """Test that validating an unsupported file extension raises ValueError."""
    event = {
        "action": "validate",
        "bucket": "mock-data-bucket",
        "trips_key": "incoming/yellow_taxi/yellow_taxi_sample.txt"
    }
    with pytest.raises(ValueError, match="unsupported file type"):
        file_validator_mod.handler(event, None)


def test_file_validator_validate_empty_file(file_validator_mod):
    """Test that validating an empty file (size 0) raises ValueError."""
    mock_s3 = MagicMock()
    mock_s3.head_object.return_value = {
        "ContentLength": 0,
        "ContentType": "application/x-parquet",
    }
    file_validator_mod.s3 = mock_s3
    
    event = {
        "action": "validate",
        "bucket": "mock-data-bucket",
        "trips_key": "incoming/yellow_taxi/yellow_taxi_sample.parquet"
    }
    with pytest.raises(ValueError, match="empty file"):
        file_validator_mod.handler(event, None)


def test_file_validator_copy_to_raw(file_validator_mod):
    """Test that files under incoming/ are copied to raw/ preserving names."""
    mock_s3 = MagicMock()
    mock_paginator = MagicMock()
    mock_paginator.paginate.return_value = [
        {
            "Contents": [
                {"Key": "incoming/yellow_taxi/yellow_taxi_sample.parquet"},
                {"Key": "incoming/taxi_zones/taxi_zones.csv"},
                {"Key": "incoming/subfolder/"}  # Directory placeholder, should be skipped
            ]
        }
    ]
    mock_s3.get_paginator.return_value = mock_paginator
    file_validator_mod.s3 = mock_s3
    
    event = {
        "action": "copy_to_raw",
        "bucket": "mock-data-bucket"
    }
    res = file_validator_mod.handler(event, None)
    
    assert res["raw_count"] == 2
    assert "raw/yellow_taxi/yellow_taxi_sample.parquet" in res["copied"]
    assert "raw/taxi_zones/taxi_zones.csv" in res["copied"]
    
    assert mock_s3.copy_object.call_count == 2
    mock_s3.copy_object.assert_any_call(
        Bucket="mock-data-bucket",
        CopySource={"Bucket": "mock-data-bucket", "Key": "incoming/yellow_taxi/yellow_taxi_sample.parquet"},
        Key="raw/yellow_taxi/yellow_taxi_sample.parquet"
    )
    mock_s3.copy_object.assert_any_call(
        Bucket="mock-data-bucket",
        CopySource={"Bucket": "mock-data-bucket", "Key": "incoming/taxi_zones/taxi_zones.csv"},
        Key="raw/taxi_zones/taxi_zones.csv"
    )


# ==============================================================================
# 2. Unit Tests for alert_handler Lambda
# ==============================================================================

def test_alert_handler_sns_triggered(alert_handler_mod):
    """Test when triggered by an SNS notification (logs/echoes message)."""
    event = {
        "Records": [
            {
                "Sns": {
                    "Message": "CloudWatch Alarm: StepFunctionsFailed"
                }
            }
        ]
    }
    res = alert_handler_mod.handler(event, None)
    assert res["handled"] == 1


def test_alert_handler_sfn_triggered_success(alert_handler_mod):
    """Test when invoked by Step Functions on pipeline success."""
    mock_sns = MagicMock()
    alert_handler_mod.sns = mock_sns
    alert_handler_mod.ALERT_TOPIC_ARN = "arn:aws:sns:us-east-1:123456789012:dataforge-test-alerts"
    
    event = {
        "status": "SUCCEEDED",
        "payload": {
            "run_id": "20260608_120000",
            "quality_score": 0.98,
            "rejected_rows": 5
        }
    }
    
    res = alert_handler_mod.handler(event, None)
    
    assert res["published"] is True
    assert "[OK] DataForge pipeline: SUCCEEDED" in res["message"]
    assert "run_id: 20260608_120000" in res["message"]
    assert "quality_score: 0.98" in res["message"]
    assert "rejected_rows: 5" in res["message"]
    
    mock_sns.publish.assert_called_once_with(
        TopicArn="arn:aws:sns:us-east-1:123456789012:dataforge-test-alerts",
        Subject="DataForge SUCCEEDED",
        Message=res["message"]
    )


def test_alert_handler_sfn_triggered_failed(alert_handler_mod):
    """Test when invoked by Step Functions on pipeline failure."""
    mock_sns = MagicMock()
    alert_handler_mod.sns = mock_sns
    alert_handler_mod.ALERT_TOPIC_ARN = "arn:aws:sns:us-east-1:123456789012:dataforge-test-alerts"
    
    event = {
        "status": "FAILED",
        "payload": {
            "run_id": "20260608_120000",
            "error": "GlueETLTaskFailedException"
        }
    }
    
    res = alert_handler_mod.handler(event, None)
    
    assert res["published"] is True
    assert "[ALERT] DataForge pipeline: FAILED" in res["message"]
    assert "error: GlueETLTaskFailedException" in res["message"]
    
    mock_sns.publish.assert_called_once_with(
        TopicArn="arn:aws:sns:us-east-1:123456789012:dataforge-test-alerts",
        Subject="DataForge FAILED",
        Message=res["message"]
    )


# ==============================================================================
# 3. Unit Tests for mdm_api Lambda Endpoints
# ==============================================================================

@pytest.fixture
def mock_store():
    store = MagicMock()
    return store

def test_mdm_api_list_records(mdm_api_mod, mock_store):
    """Test listing records from mdm_api endpoints."""
    mock_store.query.return_value = [
        {"zone_id": 1, "location_id": 7, "zone_name": "Astoria", "borough": "Queens", "service_zone": "Boro Zone"}
    ]
    
    with patch("mdm_api_app.store", return_value=mock_store):
        event = {
            "httpMethod": "GET",
            "path": "/zones",
            "pathParameters": None
        }
        res = mdm_api_mod.handler(event, None)
        
        assert res["statusCode"] == 200
        import json
        body = json.loads(res["body"])
        assert body["count"] == 1
        assert body["items"][0]["zone_name"] == "Astoria"
        mock_store.query.assert_called_once_with("SELECT * FROM mdm.zones ORDER BY zone_id")


def test_mdm_api_create_record(mdm_api_mod, mock_store):
    """Test creating a record in mdm_api."""
    mock_store.execute.return_value = [{"zone_id": 10}]
    
    with patch("mdm_api_app.store", return_value=mock_store):
        event = {
            "httpMethod": "POST",
            "path": "/zones",
            "body": '{"zone_name": "Astoria", "borough": "Queens", "service_zone": "Boro Zone", "location_id": 7}'
        }
        res = mdm_api_mod.handler(event, None)
        
        assert res["statusCode"] == 201
        import json
        body = json.loads(res["body"])
        assert body["zone_id"] == 10
        assert body["created"] is True
        
        # Verify store execute call inserts the record
        mock_store.execute.assert_called_once()


def test_mdm_api_fuzzy_match(mdm_api_mod, mock_store):
    """Test fuzzy-matching endpoints in mdm_api."""
    mock_store.query.return_value = [
        {"zone_id": 1, "location_id": 7, "zone_name": "Astoria", "borough": "Queens", "service_zone": "Boro Zone"},
        {"zone_id": 2, "location_id": 8, "zone_name": "JFK Airport", "borough": "Queens", "service_zone": "Airports"}
    ]
    
    with patch("mdm_api_app.store", return_value=mock_store):
        event = {
            "httpMethod": "POST",
            "path": "/zones/match",
            "body": '{"zone_name": "astoria  "}'
        }
        res = mdm_api_mod.handler(event, None)
        
        assert res["statusCode"] == 200
        import json
        body = json.loads(res["body"])
        assert len(body["candidates"]) == 1
        assert body["candidates"][0]["zone_name"] == "Astoria"
        assert body["candidates"][0]["match_score"] == 1.0  # Perfect normalized match
