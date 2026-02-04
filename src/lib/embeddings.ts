/**
 * Voyage AI Embeddings Service
 * 
 * Generates text embeddings for article clustering
 */

import { execSync } from 'child_process';

const VOYAGE_API_URL = 'https://api.voyageai.com/v1/embeddings';
const MODEL = 'voyage-4-lite'; // Fast, cost-effective, 1024 dims
const BATCH_SIZE = 128; // Max texts per request

export interface EmbeddingResult {
  text: string;
  embedding: number[];
}

let cachedApiKey: string | null = null;

/**
 * Get API key from environment or 1Password
 * Set VOYAGE_API_KEY env var, or pass opRef to read from 1Password
 */
export function getApiKey(opRef?: string): string {
  if (cachedApiKey) return cachedApiKey;
  
  // Check environment variable first
  if (process.env.VOYAGE_API_KEY) {
    cachedApiKey = process.env.VOYAGE_API_KEY;
    return cachedApiKey;
  }
  
  // Fall back to 1Password
  if (!opRef) {
    throw new Error('VOYAGE_API_KEY not set and no 1Password reference provided');
  }
  
  const tokenFile = process.env.OP_SERVICE_ACCOUNT_TOKEN_FILE || '~/.op_service_account_token';
  
  try {
    cachedApiKey = execSync(
      `OP_SERVICE_ACCOUNT_TOKEN="$(cat ${tokenFile})" op read "${opRef}"`,
      { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }
    ).trim();
    return cachedApiKey;
  } catch (error) {
    throw new Error(`Failed to get Voyage AI API key: ${error}`);
  }
}

/**
 * Generate embeddings for a batch of texts
 */
export async function embedTexts(texts: string[], opRef?: string): Promise<number[][]> {
  if (texts.length === 0) return [];
  
  const apiKey = getApiKey(opRef);
  const allEmbeddings: number[][] = [];
  
  // Process in batches
  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE);
    
    const response = await fetch(VOYAGE_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        input: batch,
        model: MODEL,
        input_type: 'document' // Optimized for retrieval
      })
    });
    
    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Voyage AI API error: ${response.status} - ${error}`);
    }
    
    const result = await response.json() as {
      data: Array<{ embedding: number[] }>;
    };
    
    allEmbeddings.push(...result.data.map(d => d.embedding));
  }
  
  return allEmbeddings;
}

/**
 * Generate embedding for a single text
 */
export async function embedText(text: string): Promise<number[]> {
  const [embedding] = await embedTexts([text]);
  return embedding;
}

/**
 * Calculate cosine similarity between two vectors
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error('Vectors must have same length');
  }
  
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  
  if (normA === 0 || normB === 0) return 0;
  
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}
