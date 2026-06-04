"""file_validator Lambda - Step Functions step 1 + copy-to-raw helper.

Two responsibilities (selected by event["action"]):
  - "validate": confirm the incoming object exists, is non-empty, and has an
    expected extension. Returns metadata used by later states.
  - "copy_to_raw": copy incoming/<...> objects into the immutable raw/ zone.

Designed to be invoked by the state machine; raising on hard failures lets the
ASL Catch route to the failure/notify branch.
"""
import os
import urllib.parse

import boto3

s3 = boto3.client("s3")
DATA_BUCKET = os.environ.get("DATA_BUCKET", "")
ALLOWED_EXT = (".parquet", ".csv", ".json")


def _head(bucket, key):
    return s3.head_object(Bucket=bucket, Key=key)


def _validate(event):
    bucket = event.get("bucket", DATA_BUCKET)
    key = urllib.parse.unquote_plus(event["trips_key"])
    if not key.lower().endswith(ALLOWED_EXT):
        raise ValueError(f"unsupported file type: {key}")
    meta = _head(bucket, key)
    size = meta["ContentLength"]
    if size == 0:
        raise ValueError(f"empty file: {key}")
    return {
        "valid": True,
        "bucket": bucket,
        "trips_key": key,
        "size_bytes": size,
        "content_type": meta.get("ContentType", "unknown"),
    }


def _copy_to_raw(event):
    """Copy the three incoming sources into raw/ preserving folder names."""
    bucket = event.get("bucket", DATA_BUCKET)
    copied = []
    # Enumerate everything under incoming/ and mirror into raw/.
    paginator = s3.get_paginator("list_objects_v2")
    for page in paginator.paginate(Bucket=bucket, Prefix="incoming/"):
        for obj in page.get("Contents", []):
            src_key = obj["Key"]
            if src_key.endswith("/"):
                continue
            dst_key = "raw/" + src_key[len("incoming/"):]
            s3.copy_object(
                Bucket=bucket,
                CopySource={"Bucket": bucket, "Key": src_key},
                Key=dst_key,
            )
            copied.append(dst_key)
    return {"copied": copied, "raw_count": len(copied), "bucket": bucket}


def handler(event, _context):
    action = event.get("action", "validate")
    if action == "validate":
        return _validate(event)
    if action == "copy_to_raw":
        return _copy_to_raw(event)
    raise ValueError(f"unknown action: {action}")
