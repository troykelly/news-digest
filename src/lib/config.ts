/**
 * Configuration loading and management
 */

import { readFile, writeFile, readdir } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CONFIG_DIR = join(__dirname, '../../config');

export interface Settings {
  freshrss: {
    baseUrl: string;
    credentials: {
      op: string;
      usernameField: string;
      passwordField: string;
    };
  };
  postmark: {
    from: string;
    replyTo: string;
    tokenOp: string;
  };
  breaking: {
    enabled: boolean;
    maxPerDay: number;
    quietHours: { start: number; end: number };
    urgencyThreshold: number;
    criticalOverrideThreshold: number;
  };
  clustering: {
    similarityThreshold: number;
    minSourcesForTrending: number;
    clusterWindowHours: number;
    staleAfterHours: number;
  };
  embeddings: {
    provider: string;
    model: string;
    op: string;
  };
  llm: {
    model: string;
    maxTokensFeature: number;
    maxTokensKey: number;
    maxTokensBreaking: number;
  };
  digest: {
    brandName: string;
    tagline: string;
  };
}

export interface UserConfig {
  email: string;
  schedule: {
    morning: number;
    evening: number;
    timezone: string;
  };
  topics: {
    exclude: string[];
    boost: string[];
    boostAustralia: boolean;
    boostNSW: boolean;
  };
  breaking: {
    enabled: boolean;
    categories: string[];
  };
  editorial: {
    lens: string;
    tone: string;
    signoff: string;
  };
  newsletter: {
    featureCount: number;
    keyStoriesCount: number;
    quickfireCount: number;
    includeSourceCounts: boolean;
  };
}

export async function loadSettings(): Promise<Settings> {
  const path = join(CONFIG_DIR, 'settings.json');
  const content = await readFile(path, 'utf-8');
  return JSON.parse(content);
}

export async function loadUserConfig(username: string): Promise<UserConfig> {
  const path = join(CONFIG_DIR, 'users', `${username}.json`);
  const content = await readFile(path, 'utf-8');
  return JSON.parse(content);
}

export async function saveUserConfig(username: string, config: UserConfig): Promise<void> {
  const path = join(CONFIG_DIR, 'users', `${username}.json`);
  await writeFile(path, JSON.stringify(config, null, 2));
}

export async function listUsers(): Promise<string[]> {
  const usersDir = join(CONFIG_DIR, 'users');
  const files = await readdir(usersDir);
  return files
    .filter(f => f.endsWith('.json') && !f.endsWith('.example'))
    .map(f => f.replace('.json', ''));
}
