/**
 * Story clustering using embeddings
 * 
 * Groups related articles using vector similarity
 */

import { PrismaClient, Article, Cluster } from '@prisma/client';
import { embedTexts, cosineSimilarity } from './embeddings.js';
import { addArticles, findSimilar, articleExists } from './vectorstore.js';

interface ClusteringConfig {
  similarityThreshold: number;
  minSourcesForTrending: number;
  clusterWindowHours: number;
  staleAfterHours: number;
}

interface EmbeddingsConfig {
  provider: string;
  model: string;
  op: string;
}

/**
 * Cluster articles using embedding similarity
 */
export async function clusterArticles(
  prisma: PrismaClient,
  articles: Article[],
  config: ClusteringConfig,
  embeddingsConfig?: EmbeddingsConfig
): Promise<void> {
  if (articles.length === 0) return;
  
  // Filter out articles already in vector store
  const newArticles: Article[] = [];
  for (const article of articles) {
    const exists = await articleExists(article.id);
    if (!exists) {
      newArticles.push(article);
    }
  }
  
  if (newArticles.length === 0) {
    console.log('[cluster] No new articles to embed');
    return;
  }
  
  console.log(`[cluster] Embedding ${newArticles.length} new articles...`);
  
  // Create embedding text: title + summary for better semantic matching
  const texts = newArticles.map(a => 
    `${a.title}${a.summary ? '. ' + a.summary : ''}`
  );
  
  // Generate embeddings
  const embeddings = await embedTexts(texts, embeddingsConfig?.op);
  
  // Add to vector store
  await addArticles(newArticles.map((article, i) => ({
    id: article.id,
    title: article.title,
    source: article.source,
    publishedAt: article.publishedAt,
    embedding: embeddings[i]
  })));
  
  console.log(`[cluster] Added ${newArticles.length} articles to vector store`);
  
  // Cluster each new article
  for (let i = 0; i < newArticles.length; i++) {
    const article = newArticles[i];
    const embedding = embeddings[i];
    
    // Find similar existing articles
    const similar = await findSimilar(
      embedding,
      5,
      config.similarityThreshold
    );
    
    // Filter to different sources only (same story = different outlets)
    const differentSourceMatches = similar.filter(s => 
      s.source !== article.source && s.id !== article.id
    );
    
    if (differentSourceMatches.length > 0) {
      // Find the cluster of the best match
      const bestMatch = differentSourceMatches[0];
      const matchedArticle = await prisma.article.findUnique({
        where: { id: bestMatch.id },
        select: { clusterId: true }
      });
      
      if (matchedArticle?.clusterId) {
        // Add to existing cluster
        await prisma.article.update({
          where: { id: article.id },
          data: { clusterId: matchedArticle.clusterId }
        });
        console.log(`[cluster] Added "${article.title.slice(0, 40)}..." to existing cluster`);
        continue;
      }
    }
    
    // Check if this article already has a cluster
    const existingArticle = await prisma.article.findUnique({
      where: { id: article.id },
      select: { clusterId: true }
    });
    
    if (!existingArticle?.clusterId) {
      // Create new cluster
      const cluster = await prisma.cluster.create({
        data: {
          label: article.title,
          keywords: JSON.stringify(extractKeywords(article.title)),
          articles: { connect: { id: article.id } }
        }
      });
      console.log(`[cluster] Created new cluster: "${article.title.slice(0, 40)}..."`);
    }
  }
}

/**
 * Update cluster statistics
 */
export async function updateClusterStats(
  prisma: PrismaClient,
  cluster: Cluster & { articles: Article[] }
): Promise<void> {
  const sources = new Set(cluster.articles.map(a => a.source));
  
  // Calculate velocity (articles per hour in last hour)
  const now = Date.now();
  const hourAgo = now - 3600000;
  const recentCount = cluster.articles.filter(
    a => a.publishedAt.getTime() > hourAgo
  ).length;
  
  // Update label to most recent article if cluster has grown
  const latestArticle = cluster.articles.reduce((latest, a) => 
    a.publishedAt > latest.publishedAt ? a : latest
  );
  
  await prisma.cluster.update({
    where: { id: cluster.id },
    data: {
      label: latestArticle.title,
      sourceCount: sources.size,
      articleCount: cluster.articles.length,
      peakVelocity: Math.max(cluster.peakVelocity, recentCount),
      lastUpdated: new Date()
    }
  });
}

/**
 * Merge clusters that have become similar
 */
export async function mergeRelatedClusters(
  prisma: PrismaClient,
  config: ClusteringConfig
): Promise<number> {
  // Get active clusters
  const clusters = await prisma.cluster.findMany({
    where: { status: 'ACTIVE' },
    include: { articles: true },
    orderBy: { articleCount: 'desc' }
  });
  
  let mergeCount = 0;
  const mergedIds = new Set<string>();
  
  for (const cluster of clusters) {
    if (mergedIds.has(cluster.id)) continue;
    
    // Get embedding for cluster's representative article
    const repArticle = cluster.articles[0];
    if (!repArticle) continue;
    
    const similar = await findSimilar(
      [], // Would need to get embedding - skip for now
      5,
      config.similarityThreshold
    );
    
    // TODO: Implement cluster merging based on article overlap
  }
  
  return mergeCount;
}

/**
 * Mark stale clusters
 */
export async function markStaleClusters(
  prisma: PrismaClient,
  config: ClusteringConfig
): Promise<number> {
  const staleThreshold = new Date(
    Date.now() - config.staleAfterHours * 60 * 60 * 1000
  );
  
  const result = await prisma.cluster.updateMany({
    where: {
      status: 'ACTIVE',
      lastUpdated: { lt: staleThreshold }
    },
    data: { status: 'STALE' }
  });
  
  return result.count;
}

/**
 * Extract keywords from text
 */
function extractKeywords(title: string): string[] {
  const stopwords = new Set([
    'the', 'a', 'an', 'is', 'are', 'was', 'were', 'in', 'on', 'at', 
    'to', 'for', 'of', 'and', 'or', 'but', 'as', 'by', 'with', 'from',
    'that', 'this', 'it', 'be', 'have', 'has', 'had', 'do', 'does',
    'will', 'would', 'could', 'should', 'may', 'might', 'can'
  ]);
  
  return title
    .toLowerCase()
    .split(/\W+/)
    .filter(w => w.length > 3 && !stopwords.has(w));
}
