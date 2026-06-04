#!/usr/bin/env bash
# Tear down the platform: empty the data bucket (incl. versions), delete the
# root stack, and optionally remove the deploy bucket.
set -euo pipefail
source "$(dirname "$0")/_common.sh"
require_cmd aws

warn "This will DELETE stack '$STACK_NAME' and EMPTY bucket '$DATA_BUCKET'."
read -r -p "Type 'destroy' to continue: " confirm
[[ "$confirm" == "destroy" ]] || die "Aborted."

empty_versioned_bucket() {
  local b="$1"
  aws s3api head-bucket --bucket "$b" 2>/dev/null || { log "Bucket $b not found, skipping."; return; }
  log "Emptying bucket (objects + versions): $b"
  aws s3 rm "s3://$b" --recursive || true
  # Delete all versions + delete markers.
  aws s3api list-object-versions --bucket "$b" \
    --query '{Objects: Versions[].{Key:Key,VersionId:VersionId}}' --output json 2>/dev/null \
    | jq -c '. as $d | if $d.Objects then {Objects:$d.Objects} else empty end' 2>/dev/null \
    | while read -r batch; do
        [[ -n "$batch" && "$batch" != "null" ]] && aws s3api delete-objects --bucket "$b" --delete "$batch" >/dev/null || true
      done
  aws s3api list-object-versions --bucket "$b" \
    --query '{Objects: DeleteMarkers[].{Key:Key,VersionId:VersionId}}' --output json 2>/dev/null \
    | jq -c '. as $d | if $d.Objects then {Objects:$d.Objects} else empty end' 2>/dev/null \
    | while read -r batch; do
        [[ -n "$batch" && "$batch" != "null" ]] && aws s3api delete-objects --bucket "$b" --delete "$batch" >/dev/null || true
      done
}

empty_versioned_bucket "$DATA_BUCKET"

log "Deleting stack: $STACK_NAME"
aws cloudformation delete-stack --stack-name "$STACK_NAME"
log "Waiting for stack deletion (this can take several minutes)..."
aws cloudformation wait stack-delete-complete --stack-name "$STACK_NAME" || \
  warn "Stack delete wait failed; check the console for stuck resources."

read -r -p "Also delete deploy bucket '$DEPLOY_BUCKET'? [y/N] " del
if [[ "$del" =~ ^[Yy]$ ]]; then
  empty_versioned_bucket "$DEPLOY_BUCKET"
  aws s3api delete-bucket --bucket "$DEPLOY_BUCKET" || true
fi

log "Teardown complete. Double-check Secrets Manager + S3 in the console."
