/**
 * Shared types for news-digest
 */

import { Article, Cluster } from '@prisma/client';

// Flexible article type for partial selects
export type PartialArticle = Pick<Article, 'id' | 'title' | 'source' | 'publishedAt' | 'imageUrl'> & 
  Partial<Omit<Article, 'id' | 'title' | 'source' | 'publishedAt' | 'imageUrl'>>;

export type ClusterWithArticles = Cluster & { 
  articles: Article[];
  urgencyScore?: number;
};

export type ClusterWithPartialArticles = Cluster & {
  articles: PartialArticle[];
  urgencyScore?: number;
};

export interface RawArticle {
  url: string;
  title: string;
  summary?: string;
  content?: string;
  author?: string;
  source: string;
  sourceUrl?: string;
  publishedAt: Date;
  imageUrl?: string;
}

export interface ScoredArticle extends RawArticle {
  baseScore: number;
  entities?: {
    people: string[];
    orgs: string[];
    locations: string[];
  };
}

export interface NewsletterContent {
  edition: 'morning' | 'evening';
  feature: {
    cluster: ClusterWithArticles;
    analysis: string;
  } | null;
  keyStories: Array<{
    cluster: ClusterWithArticles;
    summary: string;
  }>;
  quickfire: ClusterWithArticles[];
}

export interface SendResult {
  messageId: string;
}
