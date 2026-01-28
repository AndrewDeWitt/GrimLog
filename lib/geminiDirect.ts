/**
 * Direct Gemini API Client
 *
 * Wrapper around @google/genai SDK for direct Gemini API calls.
 * Eliminates Vercel AI SDK abstraction for better control over:
 * - System instruction placement (critical for implicit caching)
 * - Token usage and cache hit tracking
 * - Request format consistency
 *
 * Supports both Google AI Studio (API key) and Vertex AI (WIF) authentication.
 */

import { GoogleGenAI, GenerateContentResponse } from '@google/genai';
import { getProvider, isGeminiProvider } from './aiProvider';

// Singleton clients
let googleAIClient: GoogleGenAI | null = null;
let vertexAIClient: GoogleGenAI | null = null;

/**
 * Get the appropriate Gemini client based on provider setting
 */
export function getGeminiDirectClient(): GoogleGenAI {
  const provider = getProvider();
  
  if (provider === 'vertex') {
    if (!vertexAIClient) {
      // For Vertex AI, we need to configure for the Vertex endpoint
      // This requires project ID and location
      const projectId = process.env.GCP_PROJECT_ID;
      const location = process.env.GCP_LOCATION || 'global';
      
      if (!projectId) {
        throw new Error('GCP_PROJECT_ID is required for Vertex AI');
      }
      
      vertexAIClient = new GoogleGenAI({
        vertexai: true,
        project: projectId,
        location: location,
        // ADC will be used automatically for local dev
        // WIF will be used in Vercel - but we need to handle this differently
      });
    }
    return vertexAIClient;
  }
  
  // Google AI Studio (default)
  if (!googleAIClient) {
    const apiKey = process.env.GOOGLE_API_KEY;
    if (!apiKey) {
      throw new Error('GOOGLE_API_KEY is required for Google AI Studio');
    }
    googleAIClient = new GoogleGenAI({ apiKey });
  }
  return googleAIClient;
}

/**
 * Token usage from Gemini response
 */
export interface GeminiTokenUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  // Cache-specific fields
  cachedContentTokenCount: number;
  cacheReadInputTokens: number;
  cacheCreationInputTokens: number;
  // Computed
  cacheHitRate: number;
}

/**
 * Extract token usage from Gemini response
 */
export function extractTokenUsage(response: GenerateContentResponse): GeminiTokenUsage {
  const metadata = response.usageMetadata;
  
  const inputTokens = metadata?.promptTokenCount || 0;
  const outputTokens = metadata?.candidatesTokenCount || 0;
  const totalTokens = metadata?.totalTokenCount || (inputTokens + outputTokens);
  
  // Cache tokens - these are the key fields for implicit caching
  const cachedContentTokenCount = metadata?.cachedContentTokenCount || 0;
  // For newer API versions, these might be named differently
  const cacheReadInputTokens = (metadata as any)?.cacheReadInputTokens || cachedContentTokenCount;
  const cacheCreationInputTokens = (metadata as any)?.cacheCreationInputTokens || 0;
  
  // Calculate hit rate
  const cacheHitRate = inputTokens > 0 
    ? Math.round((cacheReadInputTokens / inputTokens) * 100) 
    : 0;
  
  return {
    inputTokens,
    outputTokens,
    totalTokens,
    cachedContentTokenCount,
    cacheReadInputTokens,
    cacheCreationInputTokens,
    cacheHitRate,
  };
}

/**
 * Format cache stats for logging
 */
export function formatCacheLog(usage: GeminiTokenUsage): string {
  if (usage.cacheReadInputTokens > 0) {
    return `💾 Cache hit: ${usage.cacheReadInputTokens}/${usage.inputTokens} tokens cached (${usage.cacheHitRate}% hit rate)`;
  } else if (usage.cacheCreationInputTokens > 0) {
    return `💾 Cache primed: ${usage.cacheCreationInputTokens} tokens written to cache`;
  } else {
    return `💾 Cache miss: 0/${usage.inputTokens} tokens cached (tracking for future hits)`;
  }
}

/**
 * Options for generateContent
 */
export interface GenerateContentOptions {
  model: string;
  systemInstruction: string;
  contents: string;
  responseSchema?: Record<string, any>;
  maxOutputTokens?: number;
  thinkingBudget?: number;
  temperature?: number;
  /**
   * If true, request JSON output but don't send schema to API.
   * Use this for complex schemas that exceed Google's nesting depth limit.
   * The schema will be included in the system prompt instead.
   */
  schemaInPrompt?: boolean;
}

/**
 * Result from generateContent
 */
export interface GenerateContentResult<T = any> {
  object: T;
  text: string;
  usage: GeminiTokenUsage;
  finishReason: string;
}

/**
 * Generate structured content (non-streaming)
 * 
 * @param options Generation options
 * @returns Parsed object and metadata
 */
export async function generateContent<T = any>(
  options: GenerateContentOptions
): Promise<GenerateContentResult<T>> {
  const client = getGeminiDirectClient();
  
  // Build system instruction - may include schema if schemaInPrompt is true
  let systemInstruction = options.systemInstruction;
  if (options.responseSchema && options.schemaInPrompt) {
    // Include schema in system instruction for complex schemas that exceed API nesting limits
    systemInstruction = `${options.systemInstruction}

## OUTPUT FORMAT
You MUST respond with valid JSON matching this schema:
\`\`\`json
${JSON.stringify(options.responseSchema, null, 2)}
\`\`\`

Respond ONLY with the JSON object, no additional text.`;
  }
  
  const config: any = {
    systemInstruction,
    maxOutputTokens: options.maxOutputTokens,
  };
  
  // Add JSON schema if provided (unless schemaInPrompt is true)
  if (options.responseSchema) {
    config.responseMimeType = 'application/json';
    // Only send schema to API if not using schemaInPrompt mode
    if (!options.schemaInPrompt) {
      config.responseJsonSchema = options.responseSchema;
    }
  }
  
  // Add thinking config
  if (options.thinkingBudget !== undefined) {
    config.thinkingConfig = { thinkingBudget: options.thinkingBudget };
  }
  
  // Add temperature if specified
  if (options.temperature !== undefined) {
    config.temperature = options.temperature;
  }
  
  const response = await client.models.generateContent({
    model: options.model,
    contents: options.contents,
    config,
  });
  
  const usage = extractTokenUsage(response);
  const text = response.text || '';
  const finishReason = response.candidates?.[0]?.finishReason || 'unknown';
  
  // Parse JSON if schema was provided
  let object: T;
  if (options.responseSchema) {
    try {
      object = JSON.parse(text);
    } catch (e) {
      // Try to sanitize and parse
      const sanitized = sanitizeJsonString(text);
      object = JSON.parse(sanitized);
    }
  } else {
    object = text as any;
  }
  
  return {
    object,
    text,
    usage,
    finishReason,
  };
}

/**
 * Options for streaming generateContent
 */
export interface StreamContentOptions extends GenerateContentOptions {
  onChunk?: (partialText: string, chunkIndex: number) => void;
  onProgress?: (chunkCount: number, elapsedMs: number) => void;
}

/**
 * Generate structured content with streaming
 * 
 * @param options Generation options with streaming callbacks
 * @returns Parsed object and metadata
 */
export async function streamContent<T = any>(
  options: StreamContentOptions
): Promise<GenerateContentResult<T>> {
  const client = getGeminiDirectClient();
  
  // Build system instruction - may include schema if schemaInPrompt is true
  let systemInstruction = options.systemInstruction;
  if (options.responseSchema && options.schemaInPrompt) {
    // Include schema in system instruction for complex schemas that exceed API nesting limits
    systemInstruction = `${options.systemInstruction}

## OUTPUT FORMAT
You MUST respond with valid JSON matching this schema:
\`\`\`json
${JSON.stringify(options.responseSchema, null, 2)}
\`\`\`

Respond ONLY with the JSON object, no additional text.`;
  }
  
  const config: any = {
    systemInstruction,
    maxOutputTokens: options.maxOutputTokens,
  };
  
  // Add JSON schema if provided (unless schemaInPrompt is true)
  if (options.responseSchema) {
    config.responseMimeType = 'application/json';
    // Only send schema to API if not using schemaInPrompt mode
    if (!options.schemaInPrompt) {
      config.responseJsonSchema = options.responseSchema;
    }
  }
  
  // Add thinking config
  if (options.thinkingBudget !== undefined) {
    config.thinkingConfig = { thinkingBudget: options.thinkingBudget };
  }
  
  // Add temperature if specified
  if (options.temperature !== undefined) {
    config.temperature = options.temperature;
  }
  
  const startTime = Date.now();
  let chunkCount = 0;
  let accumulatedText = '';
  let lastResponse: GenerateContentResponse | null = null;
  
  const stream = await client.models.generateContentStream({
    model: options.model,
    contents: options.contents,
    config,
  });
  
  // Consume stream
  for await (const chunk of stream) {
    chunkCount++;
    lastResponse = chunk;
    
    const chunkText = chunk.candidates?.[0]?.content?.parts?.[0]?.text || '';
    accumulatedText += chunkText;
    
    if (options.onChunk) {
      options.onChunk(chunkText, chunkCount);
    }
    
    if (options.onProgress) {
      options.onProgress(chunkCount, Date.now() - startTime);
    }
  }
  
  // Extract usage from last chunk (contains full usage)
  // Debug: log raw metadata to understand cache fields
  if (lastResponse?.usageMetadata) {
    console.log(`📊 [Debug] Raw usageMetadata:`, JSON.stringify(lastResponse.usageMetadata, null, 2));
  }
  
  const usage = lastResponse ? extractTokenUsage(lastResponse) : {
    inputTokens: 0,
    outputTokens: 0,
    totalTokens: 0,
    cachedContentTokenCount: 0,
    cacheReadInputTokens: 0,
    cacheCreationInputTokens: 0,
    cacheHitRate: 0,
  };
  
  const finishReason = lastResponse?.candidates?.[0]?.finishReason || 'unknown';
  
  // Parse JSON if schema was provided
  let object: T;
  if (options.responseSchema) {
    try {
      object = JSON.parse(accumulatedText);
    } catch (e) {
      // Try to sanitize and parse
      const sanitized = sanitizeJsonString(accumulatedText);
      try {
        object = JSON.parse(sanitized);
      } catch (e2) {
        console.error('Failed to parse JSON response:', e2);
        throw new Error(`Failed to parse JSON response: ${(e2 as Error).message}`);
      }
    }
  } else {
    object = accumulatedText as any;
  }
  
  return {
    object,
    text: accumulatedText,
    usage,
    finishReason,
  };
}

/**
 * Sanitize JSON string by removing control characters
 */
function sanitizeJsonString(text: string): string {
  return text
    // Replace various dash-like control characters with proper em-dash
    .replace(/[\x13\x14\x15\x16\x17]/g, '–')
    // Replace other control characters (except tab, newline, carriage return) with space
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, ' ')
    // Clean up any double spaces created
    .replace(/  +/g, ' ');
}

/**
 * Clear cached clients (useful for testing)
 */
export function clearGeminiDirectClients(): void {
  googleAIClient = null;
  vertexAIClient = null;
}
