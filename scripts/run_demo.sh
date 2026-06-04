#!/usr/bin/env bash
# Start the Step Functions pipeline and tail its status.
# Usage:  run_demo.sh           (good path)
#         run_demo.sh --bad     (bad-data / DQ-failure path)
set -euo pipefail
source "$(dirname "$0")/_common.sh"
require_cmd aws

MODE="${1:-good}"
SM_ARN=$(aws cloudformation describe-stacks --stack-name "$STACK_NAME" \
  --query "Stacks[0].Outputs[?OutputKey=='StateMachineArn'].OutputValue" --output text)
[[ -n "$SM_ARN" && "$SM_ARN" != "None" ]] || die "State machine ARN not found. Did 'make deploy' succeed?"

if [[ "$MODE" == "--bad" ]]; then
  bash "$ROOT_DIR/scripts/upload_sample_data.sh" --bad
  INPUT_KEY="incoming/yellow_taxi/yellow_taxi_bad_sample.csv"
  RUN="bad-$(date +%s)"
else
  bash "$ROOT_DIR/scripts/upload_sample_data.sh"
  if aws s3 ls "s3://$DATA_BUCKET/incoming/yellow_taxi/yellow_taxi_sample.parquet" >/dev/null 2>&1; then
    INPUT_KEY="incoming/yellow_taxi/yellow_taxi_sample.parquet"
  else
    INPUT_KEY="incoming/yellow_taxi/yellow_taxi_sample.csv"
  fi
  RUN="good-$(date +%s)"
fi

INPUT=$(cat <<JSON
{"bucket":"$DATA_BUCKET","trips_key":"$INPUT_KEY","mode":"$MODE","run_id":"$RUN"}
JSON
)

log "Starting execution '$RUN'..."
EXEC_ARN=$(aws stepfunctions start-execution \
  --state-machine-arn "$SM_ARN" --name "$RUN" --input "$INPUT" \
  --query executionArn --output text)

REGION_CONSOLE="https://${AWS_REGION}.console.aws.amazon.com/states/home?region=${AWS_REGION}#/executions/details/${EXEC_ARN}"
log "Execution started. Watch it here:"
echo "  $REGION_CONSOLE"

log "Polling status (Ctrl-C to stop watching; execution keeps running)..."
while true; do
  STATUS=$(aws stepfunctions describe-execution --execution-arn "$EXEC_ARN" \
    --query status --output text)
  printf "  status: %s\n" "$STATUS"
  [[ "$STATUS" == "RUNNING" ]] || break
  sleep 8
done

log "Final status: $STATUS"
aws stepfunctions describe-execution --execution-arn "$EXEC_ARN" \
  --query "{status:status,output:output}" --output json || true
