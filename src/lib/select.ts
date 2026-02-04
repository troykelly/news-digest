/**
 * Content selection for newsletters
 */

import { PrismaClient, Cluster, Article } from '@prisma/client';
import { UserConfig } from './config.js';
import { scoreClusterForUser } from './score.js';

type ClusterWithArticles = Cluster & { articles: Article[] };

export async function selectFeature(
  prisma: PrismaClient,
  username: string,
  userConfig: UserConfig
): Promise<ClusterWithArticles | null> {
  // Get clusters not sent to this user
  const clusters = await getAvailableClusters(prisma, username);
  
  if (clusters.length === 0) return null;
  
  // Score and sort
  const scored = clusters.map(c => ({
    cluster: c,
    score: scoreClusterForUser(c, userConfig)
  })).sort((a, b) => b.score - a.score);
  
  // Best cluster with an image preferred
  const withImage = scored.find(s => s.cluster.articles.some(a => a.imageUrl));
  return (withImage || scored[0])?.cluster || null;
}

export async function selectKeyStories(
  prisma: PrismaClient,
  username: string,
  userConfig: UserConfig
): Promise<ClusterWithArticles[]> {
  const clusters = await getAvailableClusters(prisma, username);
  
  const scored = clusters.map(c => ({
    cluster: c,
    score: scoreClusterForUser(c, userConfig)
  })).sort((a, b) => b.score - a.score);
  
  // Skip the top one (feature) and take next N
  return scored.slice(1, 1 + userConfig.newsletter.keyStoriesCount).map(s => s.cluster);
}

export async function selectQuickfire(
  prisma: PrismaClient,
  username: string,
  userConfig: UserConfig
): Promise<ClusterWithArticles[]> {
  const clusters = await getAvailableClusters(prisma, username);
  
  const scored = clusters.map(c => ({
    cluster: c,
    score: scoreClusterForUser(c, userConfig)
  })).sort((a, b) => b.score - a.score);
  
  // Skip feature + key stories, take remaining
  const skip = 1 + userConfig.newsletter.keyStoriesCount;
  return scored.slice(skip, skip + userConfig.newsletter.quickfireCount).map(s => s.cluster);
}

async function getAvailableClusters(
  prisma: PrismaClient,
  username: string
): Promise<ClusterWithArticles[]> {
  // Get sent cluster IDs for this user
  const sentCurations = await prisma.userCuration.findMany({
    where: {
      user: username,
      status: 'SENT'
    },
    select: { clusterId: true }
  });
  const sentIds = new Set(sentCurations.map(c => c.clusterId));
  
  // Get active clusters
  const clusters = await prisma.cluster.findMany({
    where: { status: 'ACTIVE' },
    include: { articles: true }
  });
  
  // Filter out already sent
  return clusters.filter(c => !sentIds.has(c.id));
}
