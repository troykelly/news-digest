/**
 * Breaking news detection
 */

import { PrismaClient, Cluster, Article } from '@prisma/client';
import { Settings, UserConfig } from './config.js';
import { getTimeInTimezone } from './time.js';

type ClusterWithArticles = Cluster & { articles: Article[]; urgencyScore?: number };

export async function checkBreakingCandidates(
  prisma: PrismaClient,
  settings: Settings
): Promise<ClusterWithArticles[]> {
  // Get active clusters with high velocity
  const clusters = await prisma.cluster.findMany({
    where: {
      status: 'ACTIVE',
      sourceCount: { gte: settings.clustering.minSourcesForTrending }
    },
    include: { articles: true },
    orderBy: { peakVelocity: 'desc' },
    take: 10
  });
  
  // Calculate urgency scores
  const candidates: ClusterWithArticles[] = [];
  
  for (const cluster of clusters) {
    const urgency = calculateUrgency(cluster, settings);
    
    if (urgency >= settings.breaking.urgencyThreshold) {
      const candidateCluster: ClusterWithArticles = {
        ...cluster,
        urgencyScore: urgency
      };
      candidates.push(candidateCluster);
    }
  }
  
  return candidates;
}

function calculateUrgency(cluster: ClusterWithArticles, settings: Settings): number {
  let score = 0;
  
  // Velocity factor (0-0.3)
  score += Math.min(0.3, cluster.peakVelocity / 10);
  
  // Source diversity (0-0.3)
  score += Math.min(0.3, cluster.sourceCount / 10);
  
  // Freshness (0-0.2)
  const latestArticle = cluster.articles.reduce((latest, a) => 
    a.publishedAt > latest.publishedAt ? a : latest
  );
  const ageHours = (Date.now() - latestArticle.publishedAt.getTime()) / (1000 * 60 * 60);
  if (ageHours < 1) score += 0.2;
  else if (ageHours < 2) score += 0.1;
  
  // Breaking keywords (0-0.2)
  const text = cluster.label.toLowerCase();
  const breakingTerms = ['breaking', 'urgent', 'emergency', 'death', 'attack', 'crash', 'disaster'];
  if (breakingTerms.some(t => text.includes(t))) {
    score += 0.2;
  }
  
  return score;
}

export function isInQuietHours(timezone: string, quietHours: { start: number; end: number }): boolean {
  const now = getTimeInTimezone(timezone);
  const hour = now.getHours();
  
  if (quietHours.start < quietHours.end) {
    return hour >= quietHours.start && hour < quietHours.end;
  } else {
    // Wraps around midnight
    return hour >= quietHours.start || hour < quietHours.end;
  }
}

export async function canSendBreaking(
  prisma: PrismaClient,
  username: string,
  settings: Settings
): Promise<boolean> {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  
  const todayCount = await prisma.breakingAlert.count({
    where: {
      user: username,
      sentAt: { gte: todayStart }
    }
  });
  
  return todayCount < settings.breaking.maxPerDay;
}
