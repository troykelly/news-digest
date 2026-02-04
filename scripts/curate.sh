#!/bin/bash
# Hourly curation script
# Fetches articles, generates embeddings, clusters stories

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_DIR"

export DATABASE_URL="${DATABASE_URL:-file:./data/state.sqlite}"

echo "[$(date '+%Y-%m-%d %H:%M:%S')] Starting curation..."
node dist/cli.js curate

echo "[$(date '+%Y-%m-%d %H:%M:%S')] Curation complete"
