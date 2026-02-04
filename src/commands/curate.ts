/**
 * Curation command - hourly cycle
 * 
 * 1. Fetch new articles from FreshRSS
 * 2. Dedupe against seen URLs
 * 3. Generate embeddings and add to vector store
 * 4. Cluster related articles using vector similarity
 * 5. Update cluster statistics
 * 6. Mark stale clusters
 */

import { PrismaClient } from '@prisma/client';
import { fetchFreshRSS } from '../lib/freshrss.js';
import { clusterArticles, updateClusterStats, markStaleClusters } from '../lib/cluster.js';
import { scoreArticle } from '../lib/score.js';
import { loadSettings } from '../lib/config.js';
import { initVectorStore, getArticleCount } from '../lib/vectorstore.js';

interface CurateOptions {
  debug?: boolean;
}

export async function curate(options: CurateOptions): Promise<void> {
  const settings = await loadSettings();
  const prisma = new PrismaClient();
  
  try {
    console.log('[curate] Starting curation cycle...');
    
    // Initialize vector store
    await initVectorStore();
    const vectorCount = await getArticleCount();
    console.log(`[curate] Vector store has ${vectorCount} articles`);
    
    // 1. Fetch new articles from FreshRSS
    const articles = await fetchFreshRSS(settings.freshrss);
    console.log(`[curate] Fetched ${articles.length} articles from FreshRSS`);
    
    // 2. Dedupe and insert new articles
    let newCount = 0;
    const newArticles: any[] = [];
    
    for (const article of articles) {
      const existing = await prisma.seenUrl.findUnique({
        where: { url: article.url }
      });
      
      if (existing) continue;
      
      // Mark as seen
      await prisma.seenUrl.create({
        data: { url: article.url }
      });
      
      // Score the article
      const scored = scoreArticle(article, settings);
      
      // Insert into database
      const dbArticle = await prisma.article.create({
        data: {
          url: article.url,
          title: article.title,
          summary: article.summary,
          content: article.content,
          author: article.author,
          source: article.source,
          sourceUrl: article.sourceUrl,
          publishedAt: article.publishedAt,
          imageUrl: article.imageUrl,
          baseScore: scored.baseScore,
          entities: scored.entities ? JSON.stringify(scored.entities) : null,
        }
      });
      
      newArticles.push(dbArticle);
      newCount++;
    }
    
    console.log(`[curate] Inserted ${newCount} new articles`);
    
    // 3 & 4. Cluster articles using embeddings
    if (newArticles.length > 0) {
      console.log(`[curate] Clustering ${newArticles.length} articles...`);
      await clusterArticles(prisma, newArticles, settings.clustering, settings.embeddings);
    }
    
    // 5. Update cluster stats
    const activeClusters = await prisma.cluster.findMany({
      where: { status: 'ACTIVE' },
      include: { articles: true }
    });
    
    for (const cluster of activeClusters) {
      await updateClusterStats(prisma, cluster);
    }
    console.log(`[curate] Updated ${activeClusters.length} cluster stats`);
    
    // 6. Mark stale clusters
    const staleCount = await markStaleClusters(prisma, settings.clustering);
    if (staleCount > 0) {
      console.log(`[curate] Marked ${staleCount} clusters as stale`);
    }
    
    // Summary
    const finalVectorCount = await getArticleCount();
    console.log(`[curate] Curation complete. Vector store: ${finalVectorCount} articles`);
    
  } catch (error) {
    console.error('[curate] Error:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}
