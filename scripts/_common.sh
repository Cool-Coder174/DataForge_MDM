#!/usr/bin/env bash
# Shared helpers sourced by the other scripts. Loads .env and exports vars.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

if [[ -f "$ROOT_DIR/.env" ]]; then
  # shellcheck disable=SC1091
  set -a; source "$ROOT_DIR/.env"; set +a
else
  echo "WARNING: no .env found. Copy .env.example to .env first." >&2
fi

: "${AWS_REGION:=us-east-1}"
: "${PROJECT_NAME:=dataforge}"
: "${STACK_NAME:=dataforge-mdm-demo}"
: "${ENABLE_RDS:=true}"
: "${ENABLE_REDSHIFT:=false}"
: "${ENABLE_QUICKSIGHT:=false}"
: "${USE_DELTA:=false}"

# Deploy bucket holds nested templates + Lambda zips + Glue scripts + ASL.
account_id() { aws sts get-caller-identity --query Account --output text; }
DEPLOY_BUCKET="${DEPLOY_BUCKET:-${PROJECT_NAME}-deploy-$(account_id 2>/dev/null || echo acct)-${AWS_REGION}}"

log()  { printf "\033[1;36m[dataforge]\033[0m %s\n" "$*"; }
warn() { printf "\033[1;33m[warn]\033[0m %s\n" "$*" >&2; }
die()  { printf "\033[1;31m[error]\033[0m %s\n" "$*" >&2; exit 1; }

require_cmd() { command -v "$1" >/dev/null 2>&1 || die "missing required command: $1"; }
