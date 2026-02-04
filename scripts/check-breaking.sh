#!/bin/bash
# Check for breaking news
# Can be called hourly alongside curate

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_DIR"

export DATABASE_URL="${DATABASE_URL:-file:./data/state.sqlite}"

echo "[$(date '+%Y-%m-%d %H:%M:%S')] Checking for breaking news..."
node dist/cli.js breaking --check

echo "[$(date '+%Y-%m-%d %H:%M:%S')] Breaking news check complete"
