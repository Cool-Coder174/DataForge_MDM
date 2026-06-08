#!/usr/bin/env bash
set -eo pipefail

# Script to verify that TypeScript builds, ESLint, and python tests all pass successfully.

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo "=============================================="
echo "Starting E2E Platform Verification Checks..."
echo "=============================================="

# 1. Check Python virtual environment and run Pytest
echo -e "\n[1/3] Running Python Backend Simulation Tests..."
if [ -f "./.venv/bin/pytest" ]; then
  ./.venv/bin/pytest
  echo -e "${GREEN}✓ All Python tests passed successfully.${NC}"
else
  echo -e "${RED}✗ Python virtual environment or pytest not found. Run 'make venv' first.${NC}"
  exit 1
fi

# 2. Check React Dashboard Linting
echo -e "\n[2/3] Running React Frontend Linter..."
cd dashboard
npm run lint
echo -e "${GREEN}✓ ESLint checks passed successfully.${NC}"

# 3. Check React Dashboard Build
echo -e "\n[3/3] Building React Frontend Production Bundle..."
npm run build
echo -e "${GREEN}✓ TypeScript compilation and Vite build succeeded.${NC}"

echo -e "\n=============================================="
echo -e "${GREEN}★ SUCCESS: All verification checks passed! ★${NC}"
echo "=============================================="
