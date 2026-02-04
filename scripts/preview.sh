#!/bin/bash
# Preview newsletter for a user
# Usage: ./scripts/preview.sh <username>

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_DIR"

export DATABASE_URL="${DATABASE_URL:-file:./data/state.sqlite}"

USER="${1:-default}"

echo "[$(date '+%Y-%m-%d %H:%M:%S')] Generating preview for $USER..."
node dist/cli.js preview --user "$USER"
