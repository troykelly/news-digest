/**
 * Backfill command - embed existing articles
 * 
 * For articles already in the database but not in the vector store
 */

import { PrismaClient } from '@prisma/client';
import { embedTexts } from '../lib/embeddings.js';
import { addArticles, articleExists, initVectorStore, getArticleCount } from '../lib/vectorstore.js';
import { loadSettings } from '../lib/config.js';

interface BackfillOptions {
  limit?: number;
  debug?: boolean;
}

export async function backfill(options: BackfillOptions): Promise<void> {
  const settings = await loadSettings();
  const prisma = new PrismaClient();
  const limit = typeof options.limit === 'string' ? parseInt(options.limit, 10) : (options.limit || 500);
  
  try {
    console.log('[backfill] Starting embedding backfill...');
    
    // Initialize vector store
    await initVectorStore();
    const initialCount = await getArticleCount();
    console.log(`[backfill] Vector store has ${initialCount} articles`);
    
    // Get articles from database
    const articles = await prisma.article.findMany({
      orderBy: { publishedAt: 'desc' },
      take: limit
    });
    
    console.log(`[backfill] Found ${articles.length} articles in database`);
    
    // Filter to those not already embedded
    const toEmbed = [];
    for (const article of articles) {
      const exists = await articleExists(article.id);
      if (!exists) {
        toEmbed.push(article);
      }
    }
    
    if (toEmbed.length === 0) {
      console.log('[backfill] All articles already embedded');
      return;
    }
    
    console.log(`[backfill] Embedding ${toEmbed.length} articles...`);
    
    // Batch embed
    const texts = toEmbed.map(a => 
      `${a.title}${a.summary ? '. ' + a.summary : ''}`
    );
    
    const embeddings = await embedTexts(texts, settings.embeddings?.op);
    
    // Add to vector store
    await addArticles(toEmbed.map((article, i) => ({
      id: article.id,
      title: article.title,
      source: article.source,
      publishedAt: article.publishedAt,
      embedding: embeddings[i]
    })));
    
    const finalCount = await getArticleCount();
    console.log(`[backfill] Done. Vector store now has ${finalCount} articles`);
    
  } catch (error) {
    console.error('[backfill] Error:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}
