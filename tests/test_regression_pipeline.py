import sys
import pytest
from unittest.mock import MagicMock, patch

# Mock out PySpark and AWS Glue modules globally for testing script imports
class MockColumn:
    def __init__(self, *args, **kwargs): pass
    def __gt__(self, other): return self
    def __lt__(self, other): return self
    def __ge__(self, other): return self
    def __le__(self, other): return self
    def __eq__(self, other): return self
    def __ne__(self, other): return self
    def __and__(self, other): return self
    def __or__(self, other): return self
    def __invert__(self): return self
    def __add__(self, other): return self
    def __sub__(self, other): return self
    def __mul__(self, other): return self
    def __truediv__(self, other): return self
    def isNotNull(self): return self
    def isNull(self): return self
    def cast(self, *args): return self
    def alias(self, *args): return self
    def isin(self, *args): return self
    def otherwise(self, *args): return self
    def over(self, *args): return self

class MockWindow:
    @classmethod
    def partitionBy(cls, *args): return cls()
    def orderBy(self, *args): return self

class MockFunctions:
    def __getattr__(self, name):
        if name == "col":
            return lambda val: MockColumn()
        return lambda *args, **kwargs: MockColumn()

class MockRow(list):
    def __getitem__(self, key):
        if isinstance(key, int):
            try:
                return super().__getitem__(key)
            except IndexError:
                return 0
        # Emulate dictionary lookup, e.g. row["location_id"] or row["vendor_id"]
        return 1

class MockGroupedData:
    def __init__(self, *args, **kwargs): pass
    def count(self, *args, **kwargs): return MockDataFrame()
    def agg(self, *args, **kwargs): return MockDataFrame()

class MockDataFrame:
    def __init__(self, is_filtered=False):
        self.is_filtered = is_filtered
        self.columns = ["vendor_id", "pickup_datetime", "dropoff_datetime", "pu_location_id", "do_location_id", "fare_amount", "location_id"]
    def withColumnRenamed(self, *args): return self
    def withColumn(self, *args): return self
    def filter(self, *args): return MockDataFrame(is_filtered=True)
    def limit(self, *args): return self
    def count(self): return 0 if self.is_filtered else 100
    def select(self, *args): return self
    def groupBy(self, *args): return MockGroupedData()
    def agg(self, *args): return self
    def join(self, *args, **kwargs): return self
    def distinct(self): return self
    def unionByName(self, *args): return self
    def collect(self): return [MockRow([0])]
    @property
    def write(self):
        m = MagicMock()
        m.mode.return_value = m
        m.format.return_value = m
        m.partitionBy.return_value = m
        return m

class MockDataFrameReader:
    def option(self, *args, **kwargs): return self
    def csv(self, *args, **kwargs): return MockDataFrame()
    def parquet(self, *args, **kwargs): return MockDataFrame()

class MockSparkSession:
    def __init__(self):
        self.read = MockDataFrameReader()
    def createDataFrame(self, *args, **kwargs):
        return MockDataFrame()

class MockSparkContext:
    def __init__(self, *args, **kwargs): pass

class MockGlueContext:
    def __init__(self, spark_context, *args, **kwargs):
        self.spark_session = MockSparkSession()

class MockJob:
    def __init__(self, glue_context, *args, **kwargs): pass
    def init(self, *args, **kwargs): pass
    def commit(self, *args, **kwargs): pass

sys.modules["awsglue"] = MagicMock()
sys.modules["awsglue.context"] = MagicMock()
sys.modules["awsglue.context"].GlueContext = MockGlueContext
sys.modules["awsglue.job"] = MagicMock()
sys.modules["awsglue.job"].Job = MockJob
sys.modules["awsglue.utils"] = MagicMock()

sys.modules["pyspark"] = MagicMock()
sys.modules["pyspark.context"] = MagicMock()
sys.modules["pyspark.context"].SparkContext = MockSparkContext

mock_pyspark_sql = MagicMock()
mock_pyspark_sql.SparkSession = MockSparkSession
mock_pyspark_sql.DataFrame = MockDataFrame
mock_pyspark_sql.functions = MockFunctions()

sys.modules["pyspark.sql"] = mock_pyspark_sql

sys.modules["pyspark.sql.types"] = MagicMock()
mock_pyspark_sql.types = sys.modules["pyspark.sql.types"]

sys.modules["pyspark.sql.functions"] = mock_pyspark_sql.functions

sys.modules["pyspark.sql.window"] = MagicMock()
sys.modules["pyspark.sql.window"].Window = MockWindow
mock_pyspark_sql.window = sys.modules["pyspark.sql.window"]


def test_glue_jobs_argument_parsing():
    """Verify that Glue PySpark jobs define and resolve their command-line arguments correctly."""
    mock_args = {
        "JOB_NAME": "test-etl-job",
        "DATA_BUCKET": "mock-data-bucket",
        "PROJECT_NAME": "dataforge-test",
        "USE_DELTA": "false",
        "DQ_THRESHOLD": "0.90"
    }
    
    # Mock getResolvedOptions to return our arguments
    sys.modules["awsglue.utils"].getResolvedOptions.return_value = mock_args
    
    with patch("boto3.client") as mock_boto:
        # We can patch sys.argv and load the glue job module to verify it parses correctly
        with patch("sys.argv", ["batch_etl.py"]):
            import glue_jobs.batch_etl as batch_etl
            assert batch_etl.DATA_BUCKET == "mock-data-bucket"
            assert batch_etl.PROJECT == "dataforge-test"
            assert batch_etl.USE_DELTA is False
            
        with patch("sys.argv", ["data_quality.py"]):
            import glue_jobs.data_quality as data_quality
            assert data_quality.DATA_BUCKET == "mock-data-bucket"
            assert data_quality.THRESHOLD == 0.90


class StepFunctionsPipelineSimulator:
    """Simulates the state transitions in stepfunctions/pipeline.asl.json."""

    def __init__(self, file_validator, alert_handler, dq_threshold=0.95):
        self.file_validator = file_validator
        self.alert_handler = alert_handler
        self.dq_threshold = dq_threshold
        self.history = []

    def execute(self, bucket: str, trips_key: str, quality_score: float) -> dict:
        """Simulate the execution flow of the Step Functions state machine."""
        self.history.clear()
        state = "ValidateIncomingFile"
        run_id = "20260608_120000"
        context = {
            "bucket": bucket,
            "trips_key": trips_key,
            "run_id": run_id
        }
        
        try:
            # 1. ValidateIncomingFile
            self.history.append("ValidateIncomingFile")
            val_res = self.file_validator.handler({
                "action": "validate",
                "bucket": context["bucket"],
                "trips_key": context["trips_key"]
            }, None)
            context["validate"] = val_res
            
            # 2. CopyToRaw
            self.history.append("CopyToRaw")
            copy_res = self.file_validator.handler({
                "action": "copy_to_raw",
                "bucket": context["bucket"]
            }, None)
            context["raw"] = copy_res
            
            # 3. RunGlueCrawler
            self.history.append("RunGlueCrawler")
            context["crawler"] = {"status": "started"}
            
            # 4. GlueETL
            self.history.append("GlueETL")
            context["etl"] = {"status": "SUCCEEDED"}
            
            # 5. DataQuality (determines good path vs bad path)
            self.history.append("DataQuality")
            if quality_score < self.dq_threshold:
                # Catch block routes to HandleDataQualityFailure
                self.history.append("HandleDataQualityFailure")
                # Trigger alert_handler for FAILED or SNS publish directly
                alert_res = self.alert_handler.handler({
                    "status": "FAILED",
                    "payload": {
                        "run_id": run_id,
                        "error": f"Data quality score {quality_score} < threshold {self.dq_threshold}"
                    }
                }, None)
                context["notify"] = alert_res
                self.history.append("PipelineFailed")
                return {"status": "FAILED", "history": self.history, "context": context}
            
            context["dq"] = {"status": "SUCCEEDED", "score": quality_score}
            
            # 6. RunSqlTransformations
            self.history.append("RunSqlTransformations")
            context["sql"] = {"status": "applied"}
            
            # 7. UpdateMasterDataSCD2
            self.history.append("UpdateMasterDataSCD2")
            context["scd2"] = {"status": "SUCCEEDED"}
            
            # 8. LoadRedshift
            self.history.append("LoadRedshift")
            context["redshift"] = {"status": "skipped_or_copied"}
            
            # 9. RefreshDashboard
            self.history.append("RefreshDashboard")
            context["dashboard"] = {"status": "dashboard_ready"}
            
            # 10. NotifySuccess
            self.history.append("NotifySuccess")
            alert_res = self.alert_handler.handler({
                "status": "SUCCEEDED",
                "payload": {
                    "run_id": run_id,
                    "quality_score": quality_score
                }
            }, None)
            context["notify"] = alert_res
            
            return {"status": "SUCCEEDED", "history": self.history, "context": context}
            
        except Exception as exc:
            self.history.append("NotifyFailure")
            alert_res = self.alert_handler.handler({
                "status": "FAILED",
                "payload": {
                    "run_id": run_id,
                    "error": str(exc)
                }
            }, None)
            context["notify"] = alert_res
            self.history.append("PipelineFailed")
            return {"status": "FAILED", "history": self.history, "context": context}


def test_pipeline_good_path_regression(file_validator_mod, alert_handler_mod):
    """Regression test: simulate a fully successful state machine execution run."""
    # Mock S3 dependencies for validator
    mock_s3 = MagicMock()
    mock_s3.head_object.return_value = {"ContentLength": 500, "ContentType": "parquet"}
    
    mock_paginator = MagicMock()
    mock_paginator.paginate.return_value = [{"Contents": [{"Key": "incoming/taxi_zones.csv"}]}]
    mock_s3.get_paginator.return_value = mock_paginator
    file_validator_mod.s3 = mock_s3
    
    # Mock SNS client for alert handler
    mock_sns = MagicMock()
    alert_handler_mod.sns = mock_sns
    alert_handler_mod.ALERT_TOPIC_ARN = "arn:aws:sns:us-east-1:123456789012:test-topic"
    
    pipeline = StepFunctionsPipelineSimulator(file_validator_mod, alert_handler_mod)
    res = pipeline.execute(
        bucket="mock-data-bucket",
        trips_key="incoming/yellow_taxi/yellow_taxi_sample.parquet",
        quality_score=0.98
    )
    
    assert res["status"] == "SUCCEEDED"
    assert "ValidateIncomingFile" in res["history"]
    assert "CopyToRaw" in res["history"]
    assert "GlueETL" in res["history"]
    assert "DataQuality" in res["history"]
    assert "RunSqlTransformations" in res["history"]
    assert "UpdateMasterDataSCD2" in res["history"]
    assert "LoadRedshift" in res["history"]
    assert "NotifySuccess" in res["history"]
    
    # Verify SNS publish was triggered for success
    mock_sns.publish.assert_called_once()
    args, kwargs = mock_sns.publish.call_args
    assert kwargs["Subject"] == "DataForge SUCCEEDED"
    assert "quality_score: 0.98" in kwargs["Message"]


def test_pipeline_bad_dq_path_regression(file_validator_mod, alert_handler_mod):
    """Regression test: simulate a pipeline failure run due to low data quality score."""
    # Mock S3 dependencies for validator
    mock_s3 = MagicMock()
    mock_s3.head_object.return_value = {"ContentLength": 500, "ContentType": "parquet"}
    
    mock_paginator = MagicMock()
    mock_paginator.paginate.return_value = [{"Contents": [{"Key": "incoming/taxi_zones.csv"}]}]
    mock_s3.get_paginator.return_value = mock_paginator
    file_validator_mod.s3 = mock_s3
    
    # Mock SNS client for alert handler
    mock_sns = MagicMock()
    alert_handler_mod.sns = mock_sns
    alert_handler_mod.ALERT_TOPIC_ARN = "arn:aws:sns:us-east-1:123456789012:test-topic"
    
    pipeline = StepFunctionsPipelineSimulator(file_validator_mod, alert_handler_mod)
    res = pipeline.execute(
        bucket="mock-data-bucket",
        trips_key="incoming/yellow_taxi/yellow_taxi_sample.parquet",
        quality_score=0.85  # Fails the 0.95 default threshold
    )
    
    assert res["status"] == "FAILED"
    assert "ValidateIncomingFile" in res["history"]
    assert "DataQuality" in res["history"]
    assert "HandleDataQualityFailure" in res["history"]
    assert "PipelineFailed" in res["history"]
    
    # Check that SQL transform, SCD2, Redshift steps were skipped
    assert "RunSqlTransformations" not in res["history"]
    assert "UpdateMasterDataSCD2" not in res["history"]
    assert "LoadRedshift" not in res["history"]
    
    # Verify SNS publish was triggered for failure
    mock_sns.publish.assert_called_once()
    args, kwargs = mock_sns.publish.call_args
    assert kwargs["Subject"] == "DataForge FAILED"
    assert "Data quality score 0.85" in kwargs["Message"]
