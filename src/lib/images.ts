/**
 * Image fetching and embedding for email
 * 
 * Fetches images, converts to base64, generates CID references
 */

import { createHash } from 'crypto';

export interface EmbeddedImage {
  cid: string;
  base64: string;
  contentType: string;
  name: string;
}

export interface ImageFetchResult {
  url: string;
  success: boolean;
  embedded?: EmbeddedImage;
  error?: string;
}

/**
 * Fetch an image and convert to embeddable format
 */
export async function fetchAndEmbed(url: string): Promise<ImageFetchResult> {
  if (!url) {
    return { url, success: false, error: 'No URL provided' };
  }
  
  try {
    // Generate a unique CID from the URL
    const hash = createHash('md5').update(url).digest('hex').slice(0, 12);
    const cid = `img-${hash}@execdesk.ai`;
    
    // Fetch the image
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; ExecDesk/1.0; +https://execdesk.ai)',
        'Accept': 'image/*'
      },
      signal: AbortSignal.timeout(10000) // 10s timeout
    });
    
    if (!response.ok) {
      return { url, success: false, error: `HTTP ${response.status}` };
    }
    
    // Check content type
    const contentType = response.headers.get('content-type') || 'image/jpeg';
    if (!contentType.startsWith('image/')) {
      return { url, success: false, error: `Not an image: ${contentType}` };
    }
    
    // Get the image data
    const buffer = await response.arrayBuffer();
    const base64 = Buffer.from(buffer).toString('base64');
    
    // Check size (Postmark limit is ~10MB total, keep individual images reasonable)
    if (buffer.byteLength > 2 * 1024 * 1024) {
      return { url, success: false, error: 'Image too large (>2MB)' };
    }
    
    // Determine file extension
    const ext = contentType.split('/')[1]?.split(';')[0] || 'jpg';
    const name = `${hash}.${ext}`;
    
    return {
      url,
      success: true,
      embedded: {
        cid,
        base64,
        contentType: contentType.split(';')[0], // Remove charset etc
        name
      }
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { url, success: false, error: message };
  }
}

/**
 * Fetch multiple images in parallel
 */
export async function fetchAndEmbedMany(urls: string[]): Promise<Map<string, ImageFetchResult>> {
  const results = new Map<string, ImageFetchResult>();
  
  // Filter out duplicates and empty URLs
  const uniqueUrls = [...new Set(urls.filter(u => u))];
  
  if (uniqueUrls.length === 0) {
    return results;
  }
  
  console.log(`[images] Fetching ${uniqueUrls.length} images...`);
  
  // Fetch in parallel with concurrency limit
  const concurrency = 5;
  for (let i = 0; i < uniqueUrls.length; i += concurrency) {
    const batch = uniqueUrls.slice(i, i + concurrency);
    const batchResults = await Promise.all(batch.map(fetchAndEmbed));
    
    for (const result of batchResults) {
      results.set(result.url, result);
      if (result.success) {
        console.log(`[images] ✓ ${result.url.slice(0, 60)}...`);
      } else {
        console.log(`[images] ✗ ${result.url.slice(0, 60)}... (${result.error})`);
      }
    }
  }
  
  const successCount = [...results.values()].filter(r => r.success).length;
  console.log(`[images] Fetched ${successCount}/${uniqueUrls.length} successfully`);
  
  return results;
}

/**
 * Replace image URLs with CID references in HTML
 */
export function replaceWithCids(html: string, images: Map<string, ImageFetchResult>): string {
  let result = html;
  
  for (const [url, fetchResult] of images) {
    if (fetchResult.success && fetchResult.embedded) {
      // Replace src="url" with src="cid:xxx"
      result = result.replace(
        new RegExp(`src=["']${escapeRegex(url)}["']`, 'g'),
        `src="cid:${fetchResult.embedded.cid}"`
      );
    }
  }
  
  return result;
}

/**
 * Get Postmark attachments array from fetched images
 */
export function toPostmarkAttachments(images: Map<string, ImageFetchResult>): Array<{
  Name: string;
  Content: string;
  ContentType: string;
  ContentID: string;
}> {
  const attachments = [];
  
  for (const [, fetchResult] of images) {
    if (fetchResult.success && fetchResult.embedded) {
      attachments.push({
        Name: fetchResult.embedded.name,
        Content: fetchResult.embedded.base64,
        ContentType: fetchResult.embedded.contentType,
        ContentID: fetchResult.embedded.cid
      });
    }
  }
  
  return attachments;
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
