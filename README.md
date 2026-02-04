# news-digest

Personal news digest with editorial voice, story clustering, and breaking alerts.

Pulls from FreshRSS firehose, curates throughout the day using AI embeddings for semantic clustering, and sends twice-daily newsletters with LLM-generated commentary reflecting your preferences.

## Features

- **Semantic Clustering** — Groups related articles using Voyage AI embeddings
- **Multi-Source Detection** — Same story from different outlets = higher signal
- **Editorial Voice** — LLM-generated commentary with your political lens
- **Breaking Alerts** — Urgent news detection with rate limiting
- **Multi-User** — Per-user preferences for topics, tone, and schedule
- **Responsive Templates** — Dark mode, mobile-first email design

## Quick Start

```bash
# Clone and install
git clone https://github.com/troykelly/news-digest.git
cd news-digest
pnpm install

# Copy and configure settings
cp config/settings.example.json config/settings.json
cp config/users/user.example.json config/users/yourname.json
# Edit both files with your settings

# Initialize database
mkdir -p data
export DATABASE_URL="file:./data/state.sqlite"
pnpm db:push

# Build
pnpm build

# Run curation (fetches, embeds, clusters)
./scripts/curate.sh

# Preview newsletter
./scripts/preview.sh yourname
```

## Configuration

### Settings (`config/settings.json`)

Copy from `config/settings.example.json` and configure:

- **freshrss** — Your FreshRSS instance URL and 1Password reference for credentials
- **postmark** — Email sender settings and 1Password reference for API token
- **embeddings** — Voyage AI 1Password reference for API key
- **clustering** — Similarity thresholds for grouping articles
- **breaking** — Breaking news detection settings

### User Preferences (`config/users/<username>.json`)

Copy from `config/users/user.example.json` and configure:

- **email** — Where to send newsletters
- **schedule** — Morning/evening send times and timezone
- **topics.exclude** — Topics to filter out (e.g., sport, celebrity)
- **topics.boost** — Topics to prioritize (e.g., tech, politics)
- **editorial.lens** — Your worldview for commentary generation
- **editorial.tone** — Writing style preference

## Environment Variables

Instead of 1Password references, you can set environment variables:

```bash
export VOYAGE_API_KEY="your-voyage-api-key"
export POSTMARK_TOKEN="your-postmark-token"
export FRESHRSS_USERNAME="your-username"
export FRESHRSS_API_PASSWORD="your-api-password"
```

For 1Password integration, set:
```bash
export OP_SERVICE_ACCOUNT_TOKEN_FILE="/path/to/token/file"
```

## CLI Commands

| Command | Description |
|---------|-------------|
| `curate` | Run hourly curation cycle (fetch, embed, cluster) |
| `send --user <name>` | Generate and send newsletter |
| `preview --user <name>` | Dry-run newsletter to stdout |
| `breaking --check` | Check for urgent stories |
| `prefs --user <name> --show` | View user preferences |
| `clusters --since 12h` | Debug: show story clusters |
| `pending --user <name>` | Debug: show items for next send |
| `backfill --limit 500` | Embed existing articles |

## Scripts

| Script | Description |
|--------|-------------|
| `scripts/setup.sh` | Initial setup (install, build, init DB) |
| `scripts/curate.sh` | Run curation cycle |
| `scripts/send-newsletter.sh` | Send newsletter to due users |
| `scripts/check-breaking.sh` | Check for breaking news |
| `scripts/preview.sh <user>` | Preview newsletter |

## Cron Setup

```bash
# Hourly curation
0 * * * * /path/to/news-digest/scripts/curate.sh

# 5am newsletter
0 5 * * * /path/to/news-digest/scripts/send-newsletter.sh morning

# 5pm newsletter  
0 17 * * * /path/to/news-digest/scripts/send-newsletter.sh evening
```

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         CURATION CYCLE (hourly)                     │
│  FreshRSS → Fetch → Embed (Voyage AI) → Cluster → Score            │
│                              ↓                                      │
│              SQLite (metadata) + LanceDB (vectors)                  │
│                              ↓                                      │
│            [if urgency > threshold] → Breaking Alert                │
└─────────────────────────────────────────────────────────────────────┘
                               ↓
┌─────────────────────────────────────────────────────────────────────┐
│                      NEWSLETTER SEND (5am / 5pm)                    │
│  Select Feature → LLM Analysis → Key Stories → Quick-fire          │
│                              ↓                                      │
│              Render HTML (responsive) → Postmark → User             │
└─────────────────────────────────────────────────────────────────────┘
```

## Stack

- **Storage**: SQLite (Prisma) for metadata, LanceDB for embeddings
- **Embeddings**: Voyage AI (`voyage-4-lite`)
- **Email**: Postmark
- **Feeds**: FreshRSS (GReader API)
- **Templates**: Handlebars HTML

## License

MIT
