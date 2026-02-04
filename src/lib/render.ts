/**
 * Template rendering
 */

import { readFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import Handlebars from 'handlebars';
import { format } from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';
import { Cluster, Article } from '@prisma/client';
import { UserConfig, Settings } from './config.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const TEMPLATES_DIR = join(__dirname, '../../templates');

type ClusterWithArticles = Cluster & { articles: Article[] };

interface NewsletterData {
  edition: 'morning' | 'evening';
  feature: { cluster: ClusterWithArticles; analysis: string } | null;
  keyStories: Array<{ cluster: ClusterWithArticles; summary: string }>;
  quickfire: ClusterWithArticles[];
  userConfig: UserConfig;
  settings: Settings;
}

interface BreakingData {
  cluster: ClusterWithArticles;
  analysis: string;
  userConfig: UserConfig;
  settings: Settings;
}

export async function renderNewsletter(data: NewsletterData): Promise<string> {
  const templatePath = join(TEMPLATES_DIR, 'newsletter.html');
  const templateSource = await readFile(templatePath, 'utf-8');
  const template = Handlebars.compile(templateSource);
  
  const formattedDate = formatInTimeZone(
    new Date(),
    data.userConfig.schedule.timezone,
    'EEEE, d MMMM yyyy'
  );
  
  return template({
    brandName: data.settings.digest.brandName,
    edition: data.edition === 'morning' ? 'Morning' : 'Evening',
    formattedDate,
    signoff: data.userConfig.editorial.signoff,
    replyTo: data.settings.postmark.replyTo,
    feature: data.feature ? {
      title: data.feature.cluster.label,
      url: data.feature.cluster.articles[0]?.url,
      imageUrl: data.feature.cluster.articles.find(a => a.imageUrl)?.imageUrl,
      source: data.feature.cluster.articles[0]?.source,
      sourceCount: data.feature.cluster.sourceCount > 1 ? data.feature.cluster.sourceCount - 1 : null,
      analysis: data.feature.analysis
    } : null,
    keyStories: data.keyStories.map(k => ({
      title: k.cluster.label,
      url: k.cluster.articles[0]?.url,
      imageUrl: k.cluster.articles.find(a => a.imageUrl)?.imageUrl,
      source: k.cluster.articles[0]?.source,
      summary: k.summary
    })),
    quickfire: data.quickfire.map(q => ({
      title: q.label,
      url: q.articles[0]?.url,
      source: q.articles[0]?.source
    }))
  });
}

export async function renderBreakingAlert(data: BreakingData): Promise<string> {
  const templatePath = join(TEMPLATES_DIR, 'breaking.html');
  const templateSource = await readFile(templatePath, 'utf-8');
  const template = Handlebars.compile(templateSource);
  
  const formattedTime = formatInTimeZone(
    new Date(),
    data.userConfig.schedule.timezone,
    'h:mm a, d MMM'
  );
  
  return template({
    brandName: data.settings.digest.brandName,
    headline: data.cluster.label,
    formattedTime,
    urgencyReason: `Multiple sources reporting: ${data.cluster.sourceCount} outlets covering this story.`,
    analysis: data.analysis,
    sources: data.cluster.articles.slice(0, 5).map(a => ({
      source: a.source,
      title: a.title,
      url: a.url
    })),
    replyTo: data.settings.postmark.replyTo
  });
}
