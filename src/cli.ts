#!/usr/bin/env node
/**
 * news-digest CLI
 * 
 * Personal news digest with editorial voice, story clustering, and breaking alerts.
 */

import { Command } from 'commander';
import { curate } from './commands/curate.js';
import { send } from './commands/send.js';
import { preview } from './commands/preview.js';
import { breaking } from './commands/breaking.js';
import { prefs } from './commands/prefs.js';
import { clusters } from './commands/clusters.js';
import { pending } from './commands/pending.js';
import { backfill } from './commands/backfill.js';

const program = new Command();

program
  .name('news-digest')
  .description('Personal news digest with editorial voice and breaking alerts')
  .version('0.1.0');

program
  .command('curate')
  .description('Run curation cycle (fetch, cluster, score)')
  .option('--debug', 'Show debug output')
  .action(curate);

program
  .command('send')
  .description('Generate and send newsletter')
  .option('--user <username>', 'Send to specific user')
  .option('--all-due', 'Send to all users due for their scheduled edition')
  .option('--edition <edition>', 'Force specific edition (morning|evening)', 'auto')
  .option('--dry-run', 'Generate but do not send')
  .action(send);

program
  .command('preview')
  .description('Preview next newsletter (HTML to stdout)')
  .requiredOption('--user <username>', 'User to preview for')
  .option('--edition <edition>', 'Edition to preview (morning|evening)', 'auto')
  .action(preview);

program
  .command('breaking')
  .description('Check for breaking news')
  .option('--check', 'Run breaking news detection')
  .option('--force', 'Send alert even if below threshold (for testing)')
  .option('--user <username>', 'Check for specific user only')
  .action(breaking);

program
  .command('prefs')
  .description('Manage user preferences')
  .requiredOption('--user <username>', 'User to manage')
  .option('--show', 'Show current preferences')
  .option('--exclude-topic <topics...>', 'Add topics to exclude list')
  .option('--boost-topic <topics...>', 'Add topics to boost list')
  .option('--set-lens <lens>', 'Set editorial lens')
  .option('--set-tone <tone>', 'Set editorial tone')
  .action(prefs);

program
  .command('clusters')
  .description('Show story clusters (debug)')
  .option('--since <duration>', 'Show clusters from last N hours', '12h')
  .option('--status <status>', 'Filter by status (active|sent|stale)')
  .option('--json', 'Output as JSON')
  .action(clusters);

program
  .command('pending')
  .description('Show items pending for next newsletter')
  .requiredOption('--user <username>', 'User to check')
  .option('--json', 'Output as JSON')
  .action(pending);

program
  .command('backfill')
  .description('Embed existing articles not yet in vector store')
  .option('--limit <n>', 'Max articles to process', '500')
  .option('--debug', 'Show debug output')
  .action(backfill);

program.parse();
