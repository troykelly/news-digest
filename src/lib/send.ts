/**
 * Email delivery via Postmark
 */

import { execSync } from 'child_process';
import { Settings } from './config.js';

interface SendOptions {
  to: string;
  subject: string;
  html: string;
  settings: Settings;
}

interface SendResult {
  messageId: string;
}

export async function sendEmail(options: SendOptions): Promise<SendResult> {
  const { to, subject, html, settings } = options;
  
  // Get Postmark token from 1Password
  const token = getPostmarkToken(settings.postmark.tokenOp);
  
  // Use Postmark API directly
  const response = await fetch('https://api.postmarkapp.com/email', {
    method: 'POST',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'X-Postmark-Server-Token': token
    },
    body: JSON.stringify({
      From: settings.postmark.from,
      To: to,
      Subject: subject,
      HtmlBody: html,
      ReplyTo: settings.postmark.replyTo,
      MessageStream: 'outbound'
    })
  });
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Postmark send failed: ${error}`);
  }
  
  const result = await response.json() as { MessageID: string };
  return { messageId: result.MessageID };
}

function getPostmarkToken(opRef: string): string {
  // Check environment variable first
  if (process.env.POSTMARK_TOKEN) {
    return process.env.POSTMARK_TOKEN;
  }
  
  const tokenFile = process.env.OP_SERVICE_ACCOUNT_TOKEN_FILE || '~/.op_service_account_token';
  
  try {
    const result = execSync(
      `OP_SERVICE_ACCOUNT_TOKEN="$(cat ${tokenFile})" op read "${opRef}"`,
      { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }
    );
    return result.trim();
  } catch (error) {
    throw new Error(`Failed to get Postmark token from 1Password: ${error}`);
  }
}
