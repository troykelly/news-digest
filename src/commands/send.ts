/**
 * Send command - generate and deliver newsletter
 * 
 * 1. Determine which users are due
 * 2. For each user:
 *    - Select feature cluster (highest score, not sent)
 *    - Generate LLM analysis for feature
 *    - Select key stories
 *    - Generate brief summaries
 *    - Compile quick-fire list
 *    - Render HTML template
 *    - Send via Postmark
 *    - Mark clusters as sent
 */

import { PrismaClient } from '@prisma/client';
import { loadSettings, loadUserConfig, listUsers } from '../lib/config.js';
import { selectFeature, selectKeyStories, selectQuickfire } from '../lib/select.js';
import { generateFeatureAnalysis, generateKeySummary } from '../lib/llm.js';
import { renderNewsletter } from '../lib/render.js';
import { sendEmail } from '../lib/send.js';
import { getTimeInTimezone, getCurrentEdition } from '../lib/time.js';

interface SendOptions {
  user?: string;
  allDue?: boolean;
  edition?: 'morning' | 'evening' | 'auto';
  dryRun?: boolean;
}

export async function send(options: SendOptions): Promise<void> {
  const settings = await loadSettings();
  const prisma = new PrismaClient();
  
  try {
    // Determine target users
    let users: string[];
    if (options.user) {
      users = [options.user];
    } else if (options.allDue) {
      users = await getDueUsers(settings);
    } else {
      console.error('Must specify --user or --all-due');
      process.exit(1);
    }
    
    for (const username of users) {
      console.log(`[send] Processing newsletter for ${username}...`);
      
      const userConfig = await loadUserConfig(username);
      const edition = options.edition === 'auto' 
        ? getCurrentEdition(userConfig.schedule)
        : options.edition as 'morning' | 'evening';
      
      // Select content
      const feature = await selectFeature(prisma, username, userConfig);
      const keyStories = await selectKeyStories(prisma, username, userConfig);
      const quickfire = await selectQuickfire(prisma, username, userConfig);
      
      if (!feature && keyStories.length === 0) {
        console.log(`[send] No content for ${username}, skipping`);
        continue;
      }
      
      // Generate LLM content
      let featureAnalysis: string | null = null;
      if (feature) {
        console.log(`[send] Generating feature analysis...`);
        featureAnalysis = await generateFeatureAnalysis(feature, userConfig);
      }
      
      const keySummaries = await Promise.all(
        keyStories.map(async (cluster) => ({
          cluster,
          summary: await generateKeySummary(cluster, userConfig)
        }))
      );
      
      // Render HTML
      const html = await renderNewsletter({
        edition,
        feature: feature ? { cluster: feature, analysis: featureAnalysis! } : null,
        keyStories: keySummaries,
        quickfire,
        userConfig,
        settings
      });
      
      if (options.dryRun) {
        console.log('[send] Dry run - HTML output:');
        console.log(html);
        continue;
      }
      
      // Send email
      const subject = edition === 'morning'
        ? `${settings.digest.brandName} Morning Briefing`
        : `${settings.digest.brandName} Evening Update`;
      
      const result = await sendEmail({
        to: userConfig.email,
        subject,
        html,
        settings
      });
      
      console.log(`[send] Sent to ${userConfig.email} (${result.messageId})`);
      
      // Mark clusters as sent
      const clusterIds = [
        feature?.id,
        ...keyStories.map(c => c.id),
        ...quickfire.map(c => c.id)
      ].filter(Boolean) as string[];
      
      await prisma.userCuration.updateMany({
        where: {
          user: username,
          clusterId: { in: clusterIds }
        },
        data: {
          status: 'SENT',
          sentAt: new Date(),
          edition: edition === 'morning' ? 'MORNING' : 'EVENING'
        }
      });
      
      // Log send
      await prisma.sendLog.create({
        data: {
          user: username,
          edition: edition === 'morning' ? 'MORNING' : 'EVENING',
          success: true,
          messageId: result.messageId,
          featureClusterId: feature?.id,
          keyClusterIds: JSON.stringify(keyStories.map(c => c.id)),
          quickClusterIds: JSON.stringify(quickfire.map(c => c.id))
        }
      });
    }
    
    console.log('[send] Done');
    
  } finally {
    await prisma.$disconnect();
  }
}

async function getDueUsers(settings: any): Promise<string[]> {
  const users = await listUsers();
  const due: string[] = [];
  
  for (const username of users) {
    const config = await loadUserConfig(username);
    const now = getTimeInTimezone(config.schedule.timezone);
    const hour = now.getHours();
    
    // Check if current hour matches morning or evening schedule
    if (hour === config.schedule.morning || hour === config.schedule.evening) {
      due.push(username);
    }
  }
  
  return due;
}
