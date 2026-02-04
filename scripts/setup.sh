#!/bin/bash
# Initial setup script
# Run once after cloning

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_DIR"

echo "Installing dependencies..."
pnpm install

echo "Setting up database..."
mkdir -p data
export DATABASE_URL="file:./data/state.sqlite"
pnpm db:push

echo "Building TypeScript..."
pnpm build

echo "Verifying vector store directory..."
mkdir -p data/vectors

echo ""
echo "Setup complete! You can now run:"
echo "  ./scripts/curate.sh      - Fetch and cluster articles"
echo "  ./scripts/preview.sh     - Preview newsletter"
echo "  ./scripts/send-newsletter.sh - Send newsletter"
echo ""
echo "For cron setup, add these to your crontab:"
echo "  0 * * * * $PROJECT_DIR/scripts/curate.sh"
echo "  0 5 * * * $PROJECT_DIR/scripts/send-newsletter.sh morning"
echo "  0 17 * * * $PROJECT_DIR/scripts/send-newsletter.sh evening"
