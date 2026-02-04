#!/bin/bash
# Send newsletter script
# Called by cron at 5am and 5pm

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_DIR"

export DATABASE_URL="${DATABASE_URL:-file:./data/state.sqlite}"

EDITION="${1:-auto}"

echo "[$(date '+%Y-%m-%d %H:%M:%S')] Sending newsletter (edition: $EDITION)..."
node dist/cli.js send --all-due --edition "$EDITION"

echo "[$(date '+%Y-%m-%d %H:%M:%S')] Newsletter sent"
