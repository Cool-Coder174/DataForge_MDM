#!/usr/bin/env bash
# Validate all CloudFormation templates. Prefers cfn-lint (no AWS creds needed);
# falls back to `aws cloudformation validate-template`.
set -euo pipefail
source "$(dirname "$0")/_common.sh"

CFN_DIR="$ROOT_DIR/infrastructure/cloudformation"
status=0

if command -v cfn-lint >/dev/null 2>&1; then
  log "Linting templates with cfn-lint..."
  cfn-lint "$CFN_DIR"/*.yml || status=$?
else
  warn "cfn-lint not installed; falling back to aws validate-template."
  require_cmd aws
  for t in "$CFN_DIR"/*.yml; do
    log "Validating $(basename "$t")..."
    aws cloudformation validate-template --template-body "file://$t" >/dev/null || status=1
  done
fi

[[ $status -eq 0 ]] && log "Templates OK." || warn "Template validation reported issues."
exit $status
