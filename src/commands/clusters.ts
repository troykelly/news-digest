/**
 * Clusters debug command
 */

import { PrismaClient } from '@prisma/client';
import { subHours } from 'date-fns';

interface ClustersOptions {
  since?: string;
  status?: string;
  json?: boolean;
}

export async function clusters(options: ClustersOptions): Promise<void> {
  const prisma = new PrismaClient();
  
  try {
    // Parse duration (e.g., "12h", "24h")
    const hours = parseInt(options.since?.replace('h', '') || '12');
    const since = subHours(new Date(), hours);
    
    const where: any = {
      lastUpdated: { gte: since }
    };
    
    if (options.status) {
      where.status = options.status.toUpperCase();
    }
    
    const clusterList = await prisma.cluster.findMany({
      where,
      include: {
        articles: {
          select: {
            id: true,
            title: true,
            source: true,
            publishedAt: true
          }
        }
      },
      orderBy: { sourceCount: 'desc' }
    });
    
    if (options.json) {
      console.log(JSON.stringify(clusterList, null, 2));
      return;
    }
    
    console.log(`\nClusters (last ${hours}h):\n`);
    
    for (const cluster of clusterList) {
      console.log(`[${cluster.status}] ${cluster.label}`);
      console.log(`  Sources: ${cluster.sourceCount} | Articles: ${cluster.articleCount} | Velocity: ${cluster.peakVelocity.toFixed(2)}/h`);
      console.log(`  Articles:`);
      for (const article of cluster.articles.slice(0, 3)) {
        console.log(`    - ${article.source}: ${article.title.slice(0, 60)}...`);
      }
      if (cluster.articles.length > 3) {
        console.log(`    ... and ${cluster.articles.length - 3} more`);
      }
      console.log();
    }
    
    console.log(`Total: ${clusterList.length} clusters`);
    
  } finally {
    await prisma.$disconnect();
  }
}
