#!/usr/bin/env bash
# Package Lambda code + Glue scripts + nested templates + Step Functions ASL,
# upload everything to the deploy bucket, then deploy the root CloudFormation stack.
set -euo pipefail
source "$(dirname "$0")/_common.sh"

require_cmd aws
require_cmd zip

BUILD_DIR="$ROOT_DIR/build"
rm -rf "$BUILD_DIR"; mkdir -p "$BUILD_DIR/lambda"

# --------------------------------------------------------------------------
# 1. Package Lambda functions (vendor deps with pip into the zip).
# --------------------------------------------------------------------------
package_lambda() {
  local name="$1"; local src="$ROOT_DIR/lambda/$name"
  local stage="$BUILD_DIR/stage_$name"
  log "Packaging lambda: $name"
  rm -rf "$stage"; mkdir -p "$stage"
  cp -r "$src"/. "$stage"/
  if [[ -f "$src/requirements.txt" && -s "$src/requirements.txt" ]]; then
    pip install -q -r "$src/requirements.txt" -t "$stage" --only-binary=:all: 2>/dev/null \
      || warn "pip install for $name had issues (continuing; pure-python deps still bundled)."
  fi
  # mdm_api also needs the shared matching engine.
  if [[ "$name" == "mdm_api" ]]; then
    cp -r "$ROOT_DIR/mdm/matching" "$stage/matching"
  fi
  (cd "$stage" && zip -qr "$BUILD_DIR/lambda/$name.zip" .)
}
package_lambda file_validator
package_lambda mdm_api
package_lambda alert_handler

# --------------------------------------------------------------------------
# 2. Upload artifacts to the deploy bucket.
# --------------------------------------------------------------------------
log "Uploading nested templates..."
aws s3 cp "$ROOT_DIR/infrastructure/cloudformation/" "s3://$DEPLOY_BUCKET/cfn/" \
  --recursive --exclude "*" --include "*.yml"

log "Uploading Lambda zips..."
aws s3 cp "$BUILD_DIR/lambda/" "s3://$DEPLOY_BUCKET/lambda/" --recursive

log "Uploading Glue scripts..."
aws s3 cp "$ROOT_DIR/glue_jobs/" "s3://$DEPLOY_BUCKET/glue-scripts/" \
  --recursive --exclude "*" --include "*.py"

log "Uploading Step Functions definition..."
aws s3 cp "$ROOT_DIR/stepfunctions/pipeline.asl.json" \
  "s3://$DEPLOY_BUCKET/stepfunctions/pipeline.asl.json"

# --------------------------------------------------------------------------
# 3. Deploy the root stack.
# --------------------------------------------------------------------------
TEMPLATE_BASE_URL="https://${DEPLOY_BUCKET}.s3.${AWS_REGION}.amazonaws.com/cfn"

log "Deploying root stack: $STACK_NAME"
aws cloudformation deploy \
  --region "$AWS_REGION" \
  --stack-name "$STACK_NAME" \
  --template-file "$ROOT_DIR/infrastructure/cloudformation/main.yml" \
  --capabilities CAPABILITY_NAMED_IAM \
  --parameter-overrides \
    ProjectName="$PROJECT_NAME" \
    DataBucketName="$DATA_BUCKET" \
    AlertEmail="${ALERT_EMAIL:-you@example.com}" \
    RdsDatabase="${RDS_DATABASE:-mdm}" \
    RdsUser="${RDS_USER:-mdm_admin}" \
    RedshiftDatabase="${REDSHIFT_DATABASE:-dataforge}" \
    RedshiftUser="${REDSHIFT_USER:-dataforge_admin}" \
    DeployBucket="$DEPLOY_BUCKET" \
    TemplateBaseUrl="$TEMPLATE_BASE_URL" \
    EnableRds="$ENABLE_RDS" \
    EnableRedshift="$ENABLE_REDSHIFT" \
    EnableQuickSight="$ENABLE_QUICKSIGHT" \
    UseDelta="$USE_DELTA"

log "Stack outputs:"
aws cloudformation describe-stacks --stack-name "$STACK_NAME" \
  --query "Stacks[0].Outputs" --output table || true

log "Deploy complete. Confirm the SNS subscription email sent to ${ALERT_EMAIL:-<ALERT_EMAIL>}."
