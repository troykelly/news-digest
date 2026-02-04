# news-digest

**Personal news digest with editorial voice, story clustering, and breaking alerts.**

Pulls from FreshRSS firehose, curates throughout the day, sends twice-daily newsletters with LLM-generated commentary reflecting user preferences. Supports multi-user environments with per-user topic filters and political lens.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                         CURATION CYCLE (hourly)                     │
│  FreshRSS → Ingest → Dedupe → Cluster → Score → Track Evolution    │
│                              ↓                                      │
│                    SQLite (articles, clusters, scores)              │
│                              ↓                                      │
│            [if urgency > threshold] → Breaking Alert                │
└─────────────────────────────────────────────────────────────────────┘
                               ↓
┌─────────────────────────────────────────────────────────────────────┐
│                      NEWSLETTER SEND (5am / 5pm)                    │
│  Select Feature → LLM Analysis → Pick Key Stories → Quick-fire     │
│                              ↓                                      │
│              Render HTML (responsive) → Postmark → User             │
└─────────────────────────────────────────────────────────────────────┘
```

## Usage

### CLI Commands

```bash
# Run hourly curation (typically via cron)
news-digest curate

# Send newsletter now (for specific user or all due users)
news-digest send --user username
news-digest send --all-due

# Preview next newsletter (dry-run, outputs HTML to stdout)
news-digest preview --user username

# Force breaking news check
news-digest breaking --check

# Manage user preferences
news-digest prefs --user username --show
news-digest prefs --user username --exclude-topic sport
news-digest prefs --user username --boost-topic ai,tech
news-digest prefs --user username --set-lens "left-leaning, critical of right-wing politics"

# Debug: show story clusters
news-digest clusters --since 12h

# Debug: show curated items pending for next send
news-digest pending --user username
```

### Cron Setup

Add to OpenClaw cron (or system crontab):

```yaml
# Hourly curation
- schedule: { kind: cron, expr: "0 * * * *", tz: "Australia/Sydney" }
  payload: { kind: systemEvent, text: "Run news-digest curate" }
  sessionTarget: main

# 5am newsletter
- schedule: { kind: cron, expr: "0 5 * * *", tz: "Australia/Sydney" }
  payload: { kind: systemEvent, text: "Run news-digest send --all-due --edition morning" }
  sessionTarget: main

# 5pm newsletter  
- schedule: { kind: cron, expr: "0 17 * * *", tz: "Australia/Sydney" }
  payload: { kind: systemEvent, text: "Run news-digest send --all-due --edition evening" }
  sessionTarget: main
```

## Configuration

### Global Config (`config/settings.json`)

```json
{
  "freshrss": {
    "baseUrl": "https://freshrss.example.com/api/greader.php",
    "credentialsOp": "op://YourVault/FreshRSS/credential"
  },
  "postmark": {
    "from": "news@execdesk.ai",
    "replyTo": "news@execdesk.ai"
  },
  "breaking": {
    "enabled": true,
    "maxPerDay": 2,
    "quietHours": { "start": 22, "end": 7 },
    "urgencyThreshold": 0.85
  },
  "clustering": {
    "similarityThreshold": 0.7,
    "minSourcesForTrending": 3
  },
  "llm": {
    "model": "anthropic/claude-sonnet-4-20250514",
    "maxTokens": 1500
  }
}
```

### User Preferences (`config/users/<username>.json`)

```json
{
  "email": "user@example.com",
  "schedule": {
    "morning": 5,
    "evening": 17,
    "timezone": "Australia/Sydney"
  },
  "topics": {
    "exclude": ["sport", "celebrity", "lifestyle"],
    "boost": ["tech", "ai", "politics", "science", "australia"],
    "boostAustralia": true,
    "boostNSW": true
  },
  "breaking": {
    "enabled": true,
    "categories": ["world", "politics", "australia", "nsw", "tech-major"]
  },
  "editorial": {
    "lens": "Left-leaning progressive perspective. Critical of right-wing politics, conservative media spin, and corporate greenwashing. Appreciates evidence-based policy, climate action, and social justice. Australian context.",
    "tone": "Intelligent, slightly sardonic, well-informed. Like a sharp friend who reads widely.",
    "signoff": "Stay curious."
  },
  "newsletter": {
    "featureCount": 1,
    "keyStoriesCount": 5,
    "quickfireCount": 8,
    "includeSourceCounts": true
  }
}
```

## Newsletter Structure

### Morning Edition (5am)
- **Feature Story**: Biggest overnight development with 2-3 paragraph analysis
- **Key Stories** (5): One paragraph each with editorial perspective
- **Quick-fire** (8): Headlines with one-line take
- **Overnight Movers**: Stories that evolved significantly

### Evening Edition (5pm)  
- **Feature Story**: Day's most significant development
- **Key Stories** (5): What happened and why it matters
- **Quick-fire** (8): Afternoon developments
- **Tomorrow Watch**: Stories likely to develop overnight

### Breaking Alert
- Single story focus
- Why it's urgent
- What we know so far
- What to watch for
- Sources (3+ for credibility)

## Story Clustering

Articles are clustered using:
1. **Title similarity** (TF-IDF cosine similarity)
2. **Entity extraction** (names, orgs, locations)
3. **Temporal proximity** (stories within 6h window)
4. **Source diversity** (same story from multiple outlets = higher signal)

Clusters are scored by:
- Number of unique sources covering it
- Recency of latest article
- User topic preferences
- Evolution velocity (new developments)

## Breaking News Detection

Urgency score (0-1) based on:
- **Velocity**: Multiple sources within 1h
- **Freshness**: Published in last 2h
- **Keywords**: emergency, breaking, urgent, death, disaster, attack
- **Category match**: User's breaking categories
- **Source authority**: Major outlets > blogs

Triggers alert if:
- Score > threshold (0.85 default)
- Not in quiet hours (unless score > 0.95)
- Under daily limit
- User has breaking alerts enabled

## Database Schema

```sql
-- Articles from RSS
CREATE TABLE articles (
  id TEXT PRIMARY KEY,
  url TEXT UNIQUE,
  title TEXT,
  summary TEXT,
  content TEXT,
  author TEXT,
  source TEXT,
  published_at INTEGER,
  fetched_at INTEGER,
  image_url TEXT,
  cluster_id TEXT,
  urgency_score REAL,
  FOREIGN KEY (cluster_id) REFERENCES clusters(id)
);

-- Story clusters
CREATE TABLE clusters (
  id TEXT PRIMARY KEY,
  label TEXT,
  first_seen INTEGER,
  last_updated INTEGER,
  source_count INTEGER,
  peak_velocity REAL,
  status TEXT  -- 'active', 'sent', 'stale'
);

-- Per-user curation state
CREATE TABLE user_curation (
  user TEXT,
  cluster_id TEXT,
  status TEXT,  -- 'pending', 'featured', 'key', 'quick', 'sent', 'skipped'
  edition TEXT, -- 'morning', 'evening', 'breaking'
  sent_at INTEGER,
  PRIMARY KEY (user, cluster_id)
);

-- Breaking alerts sent
CREATE TABLE breaking_sent (
  id TEXT PRIMARY KEY,
  user TEXT,
  cluster_id TEXT,
  sent_at INTEGER,
  article_ids TEXT  -- JSON array
);

-- Dedupe tracking
CREATE TABLE seen_urls (
  url TEXT PRIMARY KEY,
  first_seen INTEGER
);
```

## LLM Prompts

### Feature Analysis

```
You are writing the feature story for a personal news digest.

Editorial lens: {user.editorial.lens}
Tone: {user.editorial.tone}

Story cluster: {cluster.label}
Articles:
{articles as markdown list with source, title, summary}

Write a 2-3 paragraph analysis covering:
1. What happened (facts, sourced)
2. Why it matters (context, implications)  
3. Your take (through the editorial lens)

Keep it sharp, not preachy. Cite sources inline.
```

### Key Story Summary

```
Summarise this story in one paragraph for a news digest.

Editorial lens: {user.editorial.lens}

Story: {article.title}
Source: {article.source}
Content: {article.summary}

Include: what happened, why it matters, your brief take.
Be concise but not dry.
```

### Breaking Alert

```
Write a breaking news alert for:

{cluster.label}

Sources (use all):
{articles}

Structure:
- WHY THIS IS URGENT (1 sentence)
- WHAT WE KNOW (bullet points, sourced)
- WHAT TO WATCH (1-2 sentences)

Lens: {user.editorial.lens}
Be urgent but not alarmist. Facts first.
```

## HTML Template Requirements

- **Mobile-first**: Single column, large tap targets
- **Responsive**: Wider layout on tablet/desktop
- **Dark mode**: `prefers-color-scheme` support
- **Typography**: System fonts, good line height, readable sizes
- **Images**: Lazy loading, max-width constrained, fallback backgrounds
- **Sections**: Clear visual hierarchy, collapsible quick-fire on mobile
- **Footer**: Preferences link, unsubscribe (even if it just emails back)

Template location: `templates/newsletter.html`, `templates/breaking.html`

## Dependencies

- `better-sqlite3` - Local state
- `node-fetch` - RSS fetching  
- `cheerio` - HTML parsing for images
- `postmark` - Email delivery (via postmark-tool)
- OpenClaw LLM access for analysis

## File Structure

```
skills/news-digest/
├── SKILL.md                    # This file
├── package.json
├── tsconfig.json
├── config/
│   ├── settings.json           # Global settings
│   └── users/
│       ├── user.json
│       └── user2.json
├── src/
│   ├── cli.ts                  # CLI entry point
│   ├── commands/
│   │   ├── curate.ts           # Hourly curation
│   │   ├── send.ts             # Newsletter generation + send
│   │   ├── preview.ts          # Dry-run preview
│   │   ├── breaking.ts         # Breaking news check
│   │   ├── prefs.ts            # User preference management
│   │   ├── clusters.ts         # Debug: show clusters
│   │   └── pending.ts          # Debug: show pending items
│   ├── lib/
│   │   ├── freshrss.ts         # FreshRSS API client
│   │   ├── cluster.ts          # Story clustering
│   │   ├── score.ts            # Article/cluster scoring
│   │   ├── urgency.ts          # Breaking news detection
│   │   ├── llm.ts              # LLM commentary generation
│   │   ├── render.ts           # HTML template rendering
│   │   └── send.ts             # Postmark delivery
│   ├── db/
│   │   ├── schema.ts           # Database schema
│   │   └── queries.ts          # Common queries
│   └── types.ts                # TypeScript types
├── templates/
│   ├── newsletter.html         # Main digest template
│   ├── breaking.html           # Breaking alert template
│   └── partials/
│       ├── feature.html
│       ├── key-story.html
│       ├── quick-item.html
│       └── footer.html
├── prisma/
│   └── schema.prisma           # If using Prisma instead of raw SQL
└── data/
    └── state.sqlite            # Runtime state (gitignored)
```

## Migration from tools/news-digest

The existing `tools/news-digest` provides:
- FreshRSS fetching (reusable)
- Basic keyword scoring (extend, don't replace)
- SQLite state tracking (migrate schema)
- Postmark integration (via postmark-tool, keep)

Migration path:
1. Copy existing state.sqlite
2. Run schema migration to add new tables
3. Import user prefs from rules.json
4. Existing seen_urls data preserved

## Notes

- Images must be real, sourced from articles — no AI generation
- Breaking alerts respect quiet hours unless truly critical
- Each user gets independent curation state
- Newsletters are personal — never CC multiple users
- All LLM calls should be logged for debugging
