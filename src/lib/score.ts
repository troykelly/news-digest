/**
 * Article and cluster scoring
 */

import { Article, Cluster } from '@prisma/client';
import { Settings, UserConfig } from './config.js';

interface ScoredArticle {
  url: string;
  title: string;
  summary?: string;
  content?: string;
  author?: string;
  source: string;
  sourceUrl?: string;
  publishedAt: Date;
  imageUrl?: string;
  baseScore: number;
  entities?: { people: string[]; orgs: string[]; locations: string[] };
}

export function scoreArticle(article: any, settings: Settings): ScoredArticle {
  let score = 1;
  
  // Image bonus
  if (article.imageUrl) score += 2;
  
  // Recency bonus (max 2 points for articles < 2h old)
  const ageHours = (Date.now() - article.publishedAt.getTime()) / (1000 * 60 * 60);
  if (ageHours < 2) score += 2;
  else if (ageHours < 6) score += 1;
  
  // Extract entities (simplified)
  const entities = extractEntities(article.title + ' ' + (article.summary || ''));
  
  return {
    ...article,
    baseScore: score,
    entities
  };
}

export function scoreClusterForUser(
  cluster: Cluster & { articles: Article[] },
  userConfig: UserConfig
): number {
  let score = 0;
  
  // Source diversity bonus
  score += cluster.sourceCount * 3;
  
  // Article count bonus (diminishing returns)
  score += Math.log2(cluster.articleCount + 1) * 2;
  
  // Velocity bonus
  score += cluster.peakVelocity * 2;
  
  // Apply user topic boosts/penalties
  const text = (cluster.label + ' ' + cluster.keywords).toLowerCase();
  
  for (const topic of userConfig.topics.boost) {
    if (text.includes(topic.toLowerCase())) {
      score += 5;
    }
  }
  
  for (const topic of userConfig.topics.exclude) {
    if (text.includes(topic.toLowerCase())) {
      score -= 100; // Effectively exclude
    }
  }
  
  // Australia/NSW boost
  if (userConfig.topics.boostAustralia) {
    if (/australia|australian|canberra|sydney|melbourne|brisbane|perth|adelaide/i.test(text)) {
      score += 3;
    }
  }
  
  if (userConfig.topics.boostNSW) {
    if (/nsw|new south wales|sydney|wollongong|newcastle/i.test(text)) {
      score += 2;
    }
  }
  
  // Image availability bonus
  const hasImage = cluster.articles.some(a => a.imageUrl);
  if (hasImage) score += 2;
  
  return score;
}

function extractEntities(text: string): { people: string[]; orgs: string[]; locations: string[] } {
  // Simplified entity extraction
  // In production, use a proper NER model
  const words = text.split(/\s+/);
  const capitalized = words.filter(w => /^[A-Z][a-z]+$/.test(w));
  
  return {
    people: [],
    orgs: [],
    locations: capitalized.slice(0, 5)
  };
}
