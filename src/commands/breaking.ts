/**
 * Breaking news command
 * 
 * Check for urgent stories and send alerts
 */

import { PrismaClient } from '@prisma/client';
import { loadSettings, loadUserConfig, listUsers } from '../lib/config.js';
import { checkBreakingCandidates, isInQuietHours, canSendBreaking } from '../lib/urgency.js';
import { generateBreakingAnalysis } from '../lib/llm.js';
import { renderBreakingAlert } from '../lib/render.js';
import { sendEmail } from '../lib/send.js';

interface BreakingOptions {
  check?: boolean;
  force?: boolean;
  user?: string;
}

export async function breaking(options: BreakingOptions): Promise<void> {
  const settings = await loadSettings();
  const prisma = new PrismaClient();
  
  try {
    if (!options.check) {
      console.log('Use --check to run breaking news detection');
      return;
    }
    
    const candidates = await checkBreakingCandidates(prisma, settings);
    
    if (candidates.length === 0) {
      console.log('[breaking] No breaking news candidates');
      return;
    }
    
    console.log(`[breaking] Found ${candidates.length} candidates`);
    
    // Get target users
    const users = options.user 
      ? [options.user] 
      : await listUsers();
    
    for (const cluster of candidates) {
      for (const username of users) {
        const userConfig = await loadUserConfig(username);
        
        // Skip if user has breaking disabled
        if (!userConfig.breaking.enabled) continue;
        
        // Check quiet hours (unless force or critical)
        if (!options.force && (cluster.urgencyScore ?? 0) < settings.breaking.criticalOverrideThreshold) {
          if (isInQuietHours(userConfig.schedule.timezone, settings.breaking.quietHours)) {
            console.log(`[breaking] Skipping ${username} - quiet hours`);
            continue;
          }
        }
        
        // Check daily limit
        if (!options.force && !await canSendBreaking(prisma, username, settings)) {
          console.log(`[breaking] Skipping ${username} - daily limit reached`);
          continue;
        }
        
        // Generate alert content
        console.log(`[breaking] Generating alert for ${username}...`);
        const analysis = await generateBreakingAnalysis(cluster, userConfig);
        
        // Render and send
        const html = await renderBreakingAlert({
          cluster,
          analysis,
          userConfig,
          settings
        });
        
        const result = await sendEmail({
          to: userConfig.email,
          subject: `🚨 ${settings.digest.brandName}: ${cluster.label}`,
          html,
          settings
        });
        
        console.log(`[breaking] Sent alert to ${userConfig.email}`);
        
        // Record the alert
        await prisma.breakingAlert.create({
          data: {
            user: username,
            clusterId: cluster.id,
            headline: cluster.label,
            analysis,
            articleIds: JSON.stringify(cluster.articles.map(a => a.id))
          }
        });
      }
    }
    
  } finally {
    await prisma.$disconnect();
  }
}
