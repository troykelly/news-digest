/**
 * LLM-powered content generation
 * 
 * Uses OpenClaw's model access for generating commentary
 */

import { Cluster, Article } from '@prisma/client';
import { UserConfig } from './config.js';

type ClusterWithArticles = Cluster & { articles: Article[] };

export async function generateFeatureAnalysis(
  cluster: ClusterWithArticles,
  userConfig: UserConfig
): Promise<string> {
  const prompt = buildFeaturePrompt(cluster, userConfig);
  
  // TODO: Call LLM via OpenClaw or direct API
  // For now, return placeholder
  return `<p><strong>Analysis:</strong> ${cluster.label}</p>
<p>This story has been covered by ${cluster.sourceCount} sources, indicating significant interest.</p>
<p>${userConfig.editorial.signoff}</p>`;
}

export async function generateKeySummary(
  cluster: ClusterWithArticles,
  userConfig: UserConfig
): Promise<string> {
  const article = cluster.articles[0];
  
  // TODO: Call LLM
  return article.summary || `${article.title} — from ${article.source}`;
}

export async function generateBreakingAnalysis(
  cluster: ClusterWithArticles,
  userConfig: UserConfig
): Promise<string> {
  // TODO: Call LLM
  return `<p><strong>What we know:</strong></p>
<ul>
<li>${cluster.articles.map(a => a.title).slice(0, 3).join('</li><li>')}</li>
</ul>
<p><strong>What to watch:</strong> This story is developing rapidly.</p>`;
}

function buildFeaturePrompt(cluster: ClusterWithArticles, userConfig: UserConfig): string {
  return `You are writing the feature story for a personal news digest.

Editorial lens: ${userConfig.editorial.lens}
Tone: ${userConfig.editorial.tone}

Story cluster: ${cluster.label}
Articles:
${cluster.articles.map(a => `- ${a.source}: ${a.title}\n  ${a.summary || ''}`).join('\n')}

Write a 2-3 paragraph analysis covering:
1. What happened (facts, sourced)
2. Why it matters (context, implications)
3. Your take (through the editorial lens)

Keep it sharp, not preachy. Cite sources inline.`;
}
