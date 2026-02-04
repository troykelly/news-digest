/**
 * LanceDB Vector Store
 * 
 * Stores and searches article embeddings
 */

import * as lancedb from '@lancedb/lancedb';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { mkdir } from 'fs/promises';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH = join(__dirname, '../../data/vectors');

// Embedding dimension for voyage-4-lite
const EMBEDDING_DIM = 1024;

export interface ArticleVector {
  id: string;
  title: string;
  source: string;
  publishedAt: Date;
  embedding: number[];
}

export interface SearchResult {
  id: string;
  title: string;
  source: string;
  publishedAt: Date;
  distance: number;
}

let db: lancedb.Connection | null = null;

/**
 * Initialize LanceDB connection
 */
export async function initVectorStore(): Promise<lancedb.Connection> {
  if (db) return db;
  
  // Ensure directory exists
  await mkdir(DB_PATH, { recursive: true });
  
  db = await lancedb.connect(DB_PATH);
  return db;
}

/**
 * Get or create the articles table
 */
async function getArticlesTable(): Promise<lancedb.Table> {
  const conn = await initVectorStore();
  const tableNames = await conn.tableNames();
  
  if (tableNames.includes('articles')) {
    return conn.openTable('articles');
  }
  
  // Create table with initial data (LanceDB infers schema)
  // Create with a dummy record that we'll delete
  const table = await conn.createTable('articles', [{
    id: '__init__',
    title: 'init',
    source: 'init',
    publishedAt: new Date().toISOString(),
    embedding: new Array(EMBEDDING_DIM).fill(0)
  }]);
  
  // Delete the init record
  await table.delete('id = "__init__"');
  
  return table;
}

/**
 * Add articles with their embeddings to the vector store
 */
export async function addArticles(articles: ArticleVector[]): Promise<void> {
  if (articles.length === 0) return;
  
  const table = await getArticlesTable();
  
  // Convert to LanceDB format
  const rows = articles.map(a => ({
    id: a.id,
    title: a.title,
    source: a.source,
    publishedAt: a.publishedAt.toISOString(),
    embedding: a.embedding
  }));
  
  await table.add(rows);
}

/**
 * Check if an article already exists in the vector store
 */
export async function articleExists(id: string): Promise<boolean> {
  const conn = await initVectorStore();
  const tableNames = await conn.tableNames();
  
  if (!tableNames.includes('articles')) return false;
  
  const table = await conn.openTable('articles');
  const results = await table
    .query()
    .where(`id = '${id}'`)
    .limit(1)
    .toArray();
  
  return results.length > 0;
}

/**
 * Find similar articles by embedding
 */
export async function findSimilar(
  embedding: number[],
  limit: number = 10,
  minSimilarity: number = 0.7
): Promise<SearchResult[]> {
  const conn = await initVectorStore();
  const tableNames = await conn.tableNames();
  
  if (!tableNames.includes('articles')) return [];
  
  const table = await conn.openTable('articles');
  
  // Vector similarity search
  const results = await table
    .vectorSearch(embedding)
    .limit(limit)
    .toArray();
  
  // Filter by similarity threshold and convert
  // LanceDB returns _distance (L2), we want cosine similarity
  // For normalized vectors: similarity = 1 - distance/2
  return results
    .map(r => ({
      id: r.id as string,
      title: r.title as string,
      source: r.source as string,
      publishedAt: new Date(r.publishedAt as string),
      distance: r._distance as number
    }))
    .filter(r => {
      // Convert L2 distance to approximate cosine similarity
      const similarity = 1 - (r.distance / 2);
      return similarity >= minSimilarity;
    });
}

/**
 * Get article by ID
 */
export async function getArticle(id: string): Promise<ArticleVector | null> {
  const conn = await initVectorStore();
  const tableNames = await conn.tableNames();
  
  if (!tableNames.includes('articles')) return null;
  
  const table = await conn.openTable('articles');
  const results = await table
    .query()
    .where(`id = '${id}'`)
    .limit(1)
    .toArray();
  
  if (results.length === 0) return null;
  
  const r = results[0];
  return {
    id: r.id as string,
    title: r.title as string,
    source: r.source as string,
    publishedAt: new Date(r.publishedAt as string),
    embedding: r.embedding as number[]
  };
}

/**
 * Get total count of articles in vector store
 */
export async function getArticleCount(): Promise<number> {
  const conn = await initVectorStore();
  const tableNames = await conn.tableNames();
  
  if (!tableNames.includes('articles')) return 0;
  
  const table = await conn.openTable('articles');
  return table.countRows();
}
