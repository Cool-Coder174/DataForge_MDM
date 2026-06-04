# =============================================================================
# DataForge MDM Demo - Makefile
# Thin, demo-friendly wrappers around the scripts/ directory.
# Everything reads configuration from .env (copy from .env.example first).
# =============================================================================

SHELL := /bin/bash
.DEFAULT_GOAL := help

# Load .env if present so variables are available to make + sub-shells.
ifneq (,$(wildcard ./.env))
	include .env
	export
endif

PY ?= python3

.PHONY: help
help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) \
		| sort \
		| awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-22s\033[0m %s\n", $$1, $$2}'

# ---------------------------------------------------------------------------
# Setup
# ---------------------------------------------------------------------------
.PHONY: venv
venv: ## Create local Python venv and install dev/test deps
	$(PY) -m venv .venv
	. .venv/bin/activate && pip install --upgrade pip && \
		pip install -r requirements-dev.txt

.PHONY: bootstrap
bootstrap: ## One-time AWS bootstrap (create deploy bucket, validate creds)
	bash scripts/bootstrap.sh

# ---------------------------------------------------------------------------
# Tests / quality (CI runs these too)
# ---------------------------------------------------------------------------
.PHONY: test
test: ## Run Python unit tests (matching engine + helpers)
	. .venv/bin/activate 2>/dev/null; $(PY) -m pytest -q

.PHONY: lint
lint: ## Lint Python + (best-effort) SQL
	. .venv/bin/activate 2>/dev/null; $(PY) -m pyflakes mdm lambda glue_jobs scripts || true
	@echo "SQL lint is best-effort; see CI for sqlfluff."

.PHONY: validate
validate: ## Validate CloudFormation templates (requires AWS CLI)
	bash scripts/validate_templates.sh

# ---------------------------------------------------------------------------
# Deploy / teardown
# ---------------------------------------------------------------------------
.PHONY: deploy
deploy: ## Package + deploy all CloudFormation stacks
	bash scripts/deploy.sh

.PHONY: destroy
destroy: ## Tear down all stacks + empty the data bucket
	bash scripts/destroy.sh

# ---------------------------------------------------------------------------
# Data / demo
# ---------------------------------------------------------------------------
.PHONY: upload-data
upload-data: ## Upload sample data to the S3 incoming/ prefixes
	bash scripts/upload_sample_data.sh

.PHONY: seed-mdm
seed-mdm: ## Seed RDS PostgreSQL with master + SCD2 schema and seed rows
	$(PY) scripts/seed_master_data.py

.PHONY: demo
demo: ## Run the scripted end-to-end demo (good path)
	bash scripts/run_demo.sh

.PHONY: demo-bad
demo-bad: ## Generate a bad record + trigger a DQ-failure pipeline run
	$(PY) scripts/generate_bad_record.py
	bash scripts/run_demo.sh --bad

.PHONY: clean
clean: ## Remove local build artifacts
	rm -rf build dist cfn-packaged *.zip .pytest_cache
	find . -name '__pycache__' -type d -prune -exec rm -rf {} +
