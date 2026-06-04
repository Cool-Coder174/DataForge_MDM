#!/usr/bin/env bash
# Upload demo sample data to the S3 incoming/ landing prefixes.
set -euo pipefail
source "$(dirname "$0")/_common.sh"
require_cmd aws

SAMPLE="$ROOT_DIR/data/sample"
BAD="${1:-}"

upload() {
  local file="$1" prefix="$2"
  [[ -f "$file" ]] || { warn "missing $file, skipping"; return; }
  log "Uploading $(basename "$file") -> s3://$DATA_BUCKET/$prefix"
  aws s3 cp "$file" "s3://$DATA_BUCKET/$prefix"
}

if [[ "$BAD" == "--bad" ]]; then
  log "Uploading BAD taxi sample to trigger a data-quality failure."
  upload "$SAMPLE/yellow_taxi_bad_sample.csv" "incoming/yellow_taxi/yellow_taxi_bad_sample.csv"
else
  # Prefer parquet if present, else fall back to csv.
  if [[ -f "$SAMPLE/yellow_taxi_sample.parquet" ]]; then
    upload "$SAMPLE/yellow_taxi_sample.parquet" "incoming/yellow_taxi/yellow_taxi_sample.parquet"
  else
    upload "$SAMPLE/yellow_taxi_sample.csv" "incoming/yellow_taxi/yellow_taxi_sample.csv"
  fi
fi

upload "$SAMPLE/taxi_zones.csv" "incoming/taxi_zones/taxi_zones.csv"
upload "$SAMPLE/vendors.csv"    "incoming/vendors/vendors.csv"

log "Upload complete. Incoming layout:"
aws s3 ls "s3://$DATA_BUCKET/incoming/" --recursive || true
