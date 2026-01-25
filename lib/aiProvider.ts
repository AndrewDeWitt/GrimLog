// AI Provider Abstraction
// Handles provider selection and common interfaces for OpenAI and Google Gemini

export type AIProvider = 'openai' | 'google';

/**
 * Get the configured AI provider from environment variables
 * Defaults to OpenAI if not specified or invalid
 */
export function getProvider(): AIProvider {
  const provider = process.env.AI_PROVIDER?.toLowerCase();
  if (provider === 'google') {
    return 'google';
  }
  return 'openai'; // Default to OpenAI
}

/**
 * Validate that the required API key is present for the selected provider
 * Throws an error if the key is missing
 */
export function validateProviderConfig(provider: AIProvider): void {
  if (provider === 'google') {
    if (!process.env.GOOGLE_API_KEY) {
      throw new Error('GOOGLE_API_KEY environment variable is required when AI_PROVIDER=google');
    }
  } else {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY environment variable is required when AI_PROVIDER=openai');
    }
  }
}

/**
 * Get a human-readable model name for the current provider
 */
export function getModelName(provider: AIProvider, type: 'main' | 'intent'): string {
  if (provider === 'google') {
    return 'gemini-2.5-flash';
  } else {
    // OpenAI
    return type === 'main' ? 'gpt-5-mini' : 'gpt-5-nano';
  }
}

/**
 * Common interface for function call responses from both providers
 * This normalizes the response format between OpenAI and Gemini
 */
export interface NormalizedFunctionCall {
  name: string;
  arguments: string; // JSON string of arguments
  call_id: string;
}

/**
 * Extract and normalize function calls from OpenAI response
 */
export function extractOpenAIFunctionCalls(response: any): NormalizedFunctionCall[] {
  const functionCallItems = response.output.filter((item: any) => item.type === 'function_call');
  return functionCallItems.map((fc: any) => ({
    name: fc.name,
    arguments: fc.arguments, // Already a JSON string
    call_id: fc.call_id
  }));
}

/**
 * Extract and normalize function calls from Gemini response
 */
export function extractGeminiFunctionCalls(response: any): NormalizedFunctionCall[] {
  const isDev = process.env.NODE_ENV === 'development';

  if (isDev) {
    console.log('🔍 Extracting Gemini function calls...');
    console.log('📦 Full Gemini response:', JSON.stringify(response, null, 2));
  }

  // Gemini returns function calls in the response content
  const functionCalls: any[] = [];

  // Navigate the Gemini response structure
  if (response.candidates && response.candidates.length > 0) {
    if (isDev) console.log(`   Found ${response.candidates.length} candidate(s)`);
    const candidate = response.candidates[0];

    if (candidate.content && candidate.content.parts) {
      if (isDev) console.log(`   Found ${candidate.content.parts.length} part(s) in content`);
      for (const part of candidate.content.parts) {
        if (isDev) console.log(`   Part type:`, part);
        if (part.functionCall) {
          if (isDev) console.log(`   Found function call:`, part.functionCall);
          functionCalls.push(part.functionCall);
        }
      }
    } else if (isDev) {
      console.log('   No content.parts found in candidate');
    }
  } else if (isDev) {
    console.log('   No candidates found in response');
  }

  if (isDev) console.log(`🎯 Extracted ${functionCalls.length} function call(s)`);
  
  return functionCalls.map((fc: any) => ({
    name: fc.name,
    arguments: JSON.stringify(fc.args), // Gemini has 'args' object, convert to JSON string
    call_id: crypto.randomUUID() // Gemini doesn't provide call IDs, generate one
  }));
}

/**
 * Response interface for intent classification
 */
export interface IntentClassification {
  isGameRelated: boolean;
  intent: string;
  contextTier: string;
  confidence: number;
  reasoning: string;
}

/**
 * Get the configured AI provider for army list parsing
 * Uses ARMY_PARSE_PROVIDER env var, defaults to OpenAI
 */
export function getArmyParseProvider(): AIProvider {
  const provider = process.env.ARMY_PARSE_PROVIDER?.toLowerCase();
  if (provider === 'google') {
    return 'google';
  }
  return 'openai'; // Default to OpenAI
}

/**
 * Get the model name for army list parsing based on provider
 * - Google: gemini-3-flash-preview (fast, good structured output)
 * - OpenAI: gpt-5-mini (default)
 */
export function getArmyParseModel(provider: AIProvider): string {
  return provider === 'google' ? 'gemini-3-flash-preview' : 'gpt-5-mini';
}

/**
 * Get the configured AI provider for game analysis (voice-to-event workflow)
 * Uses ANALYZE_PROVIDER env var, defaults to OpenAI
 */
export function getAnalyzeProvider(): AIProvider {
  const provider = process.env.ANALYZE_PROVIDER?.toLowerCase();
  if (provider === 'google') {
    return 'google';
  }
  return 'openai'; // Default to OpenAI
}

/**
 * Get the model name for game analysis based on provider
 * - Google: gemini-3-flash-preview (fast, good function calling)
 * - OpenAI: gpt-5-mini (main), gpt-5-nano (intent)
 */
export function getAnalyzeModel(provider: AIProvider, type: 'main' | 'intent'): string {
  if (provider === 'google') {
    return 'gemini-3-flash-preview';
  }
  return type === 'main' ? 'gpt-5-mini' : 'gpt-5-nano';
}

