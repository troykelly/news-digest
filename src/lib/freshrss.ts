/**
 * FreshRSS API client
 * 
 * Uses GReader API for feed access
 */

import { execSync } from 'child_process';

export interface RawArticle {
  url: string;
  title: string;
  summary?: string;
  content?: string;
  author?: string;
  source: string;
  sourceUrl?: string;
  publishedAt: Date;
  imageUrl?: string;
}

interface FreshRSSConfig {
  baseUrl: string;
  credentials: {
    op: string;
    usernameField: string;
    passwordField: string;
  };
}

export async function fetchFreshRSS(config: FreshRSSConfig): Promise<RawArticle[]> {
  // Get credentials from 1Password
  const creds = getCredentials(config.credentials.op);
  
  // Authenticate to get SID
  const sid = await authenticate(config.baseUrl, creds.username, creds.password);
  
  // Fetch unread items from all feeds
  const items = await fetchUnreadItems(config.baseUrl, sid);
  
  // Transform to our format
  return items.map(transformItem);
}

function getCredentials(opRef: string): { username: string; password: string } {
  // Use 1Password CLI to get credentials
  const tokenFile = process.env.OP_SERVICE_ACCOUNT_TOKEN_FILE || '~/.op_service_account_token';
  
  try {
    // Read username
    const username = execSync(
      `OP_SERVICE_ACCOUNT_TOKEN="$(cat ${tokenFile})" op read "${opRef}/username"`,
      { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }
    ).trim();
    
    // Read API password
    const password = execSync(
      `OP_SERVICE_ACCOUNT_TOKEN="$(cat ${tokenFile})" op read "${opRef}/api password"`,
      { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }
    ).trim();
    
    return { username, password };
  } catch (error) {
    throw new Error(`Failed to get FreshRSS credentials from 1Password: ${error}`);
  }
}

async function authenticate(baseUrl: string, username: string, password: string): Promise<string> {
  const authUrl = `${baseUrl}/accounts/ClientLogin`;
  
  const response = await fetch(authUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      Email: username,
      Passwd: password,
      output: 'json'
    })
  });
  
  if (!response.ok) {
    throw new Error(`FreshRSS auth failed: ${response.status}`);
  }
  
  const text = await response.text();
  const match = text.match(/Auth=([^\s]+)/);
  if (!match) {
    throw new Error('Failed to extract auth token from FreshRSS response');
  }
  
  return match[1];
}

async function fetchUnreadItems(baseUrl: string, sid: string): Promise<any[]> {
  const url = `${baseUrl}/reader/api/0/stream/contents/user/-/state/com.google/reading-list`;
  
  const response = await fetch(`${url}?n=500&xt=user/-/state/com.google/read`, {
    headers: {
      'Authorization': `GoogleLogin auth=${sid}`
    }
  });
  
  if (!response.ok) {
    throw new Error(`FreshRSS fetch failed: ${response.status}`);
  }
  
  const data = await response.json() as { items?: any[] };
  return data.items || [];
}

function transformItem(item: any): RawArticle {
  // Extract image from enclosure, media:content, or content
  let imageUrl: string | undefined;
  
  if (item.enclosure?.[0]?.href) {
    const enc = item.enclosure[0];
    if (enc.type?.startsWith('image/')) {
      imageUrl = enc.href;
    }
  }
  
  if (!imageUrl && item.content?.content) {
    // Try to extract first image from content
    const imgMatch = item.content.content.match(/<img[^>]+src=["']([^"']+)["']/i);
    if (imgMatch) {
      imageUrl = imgMatch[1];
    }
  }
  
  return {
    url: item.canonical?.[0]?.href || item.alternate?.[0]?.href || item.id,
    title: item.title || 'Untitled',
    summary: item.summary?.content,
    content: item.content?.content,
    author: item.author,
    source: item.origin?.title || 'Unknown',
    sourceUrl: item.origin?.streamId,
    publishedAt: new Date(item.published * 1000),
    imageUrl
  };
}
