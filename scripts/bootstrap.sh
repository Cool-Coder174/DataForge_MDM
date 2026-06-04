#!/usr/bin/env bash
# One-time bootstrap: verify AWS identity and create the deploy bucket used to
# stage nested CloudFormation templates, Lambda zips, and Glue scripts.
set -euo pipefail
source "$(dirname "$0")/_common.sh"

require_cmd aws
require_cmd zip

log "Verifying AWS credentials..."
aws sts get-caller-identity >/dev/null || die "AWS credentials not configured (run 'aws configure')."
ACC=$(account_id)
log "Account: $ACC  Region: $AWS_REGION  Project: $PROJECT_NAME"
log "Deploy bucket: $DEPLOY_BUCKET"

if aws s3api head-bucket --bucket "$DEPLOY_BUCKET" 2>/dev/null; then
  log "Deploy bucket already exists."
else
  log "Creating deploy bucket..."
  if [[ "$AWS_REGION" == "us-east-1" ]]; then
    aws s3api create-bucket --bucket "$DEPLOY_BUCKET" --region "$AWS_REGION"
  else
    aws s3api create-bucket --bucket "$DEPLOY_BUCKET" --region "$AWS_REGION" \
      --create-bucket-configuration LocationConstraint="$AWS_REGION"
  fi
  aws s3api put-bucket-encryption --bucket "$DEPLOY_BUCKET" \
    --server-side-encryption-configuration \
    '{"Rules":[{"ApplyServerSideEncryptionByDefault":{"SSEAlgorithm":"AES256"}}]}'
fi

log "Bootstrap complete. Next: 'make deploy'."
