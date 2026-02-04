/**
 * Pending items debug command
 */

import { PrismaClient } from '@prisma/client';
import { loadUserConfig } from '../lib/config.js';
import { scoreClusterForUser } from '../lib/score.js';

interface PendingOptions {
  user: string;
  json?: boolean;
}

export async function pending(options: PendingOptions): Promise<void> {
  const prisma = new PrismaClient();
  const userConfig = await loadUserConfig(options.user);
  
  try {
    // Get clusters not yet sent to this user
    const pendingCurations = await prisma.userCuration.findMany({
      where: {
        user: options.user,
        status: 'PENDING'
      },
      include: {
        cluster: {
          include: {
            articles: true
          }
        }
      }
    });
    
    // Also get clusters with no curation record (new)
    const allActiveClusters = await prisma.cluster.findMany({
      where: { status: 'ACTIVE' },
      include: {
        articles: true
      }
    });
    
    const existingIds = new Set(pendingCurations.map(c => c.clusterId));
    const newClusters = allActiveClusters.filter(c => !existingIds.has(c.id));
    
    // Combine and score
    const allPending = [
      ...pendingCurations.map(c => c.cluster),
      ...newClusters
    ].map(cluster => ({
      ...cluster,
      userScore: scoreClusterForUser(cluster, userConfig)
    })).sort((a, b) => b.userScore - a.userScore);
    
    if (options.json) {
      console.log(JSON.stringify(allPending, null, 2));
      return;
    }
    
    console.log(`\nPending items for ${options.user}:\n`);
    
    for (const cluster of allPending.slice(0, 20)) {
      const hasImage = cluster.articles.some(a => a.imageUrl);
      console.log(`[Score: ${cluster.userScore.toFixed(1)}] ${cluster.label} ${hasImage ? '📷' : ''}`);
      console.log(`  Sources: ${cluster.sourceCount} | Articles: ${cluster.articleCount}`);
      console.log(`  Latest: ${cluster.articles[0]?.title.slice(0, 50)}...`);
      console.log();
    }
    
    console.log(`Total pending: ${allPending.length}`);
    
  } finally {
    await prisma.$disconnect();
  }
}
