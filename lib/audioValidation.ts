/**
 * Multi-layer audio validation to avoid wasting API calls
 * on silence or meaningless audio
 */

/**
 * Layer 1: Pre-Whisper Audio File Validation
 * Checks raw audio blob before sending to Whisper API
 */
export interface AudioValidationResult {
  isValid: boolean;
  reason?: string;
  confidence: number; // 0-1 scale
}

/**
 * Validate audio blob before sending to Whisper
 */
export async function validateAudioBlob(audioBlob: Blob): Promise<AudioValidationResult> {
  // Check 1: File size (too small = likely silence)
  const MIN_AUDIO_SIZE = 1000; // 1KB minimum (very conservative)
  const MAX_AUDIO_SIZE = 25 * 1024 * 1024; // 25MB maximum (Whisper limit)
  
  if (audioBlob.size < MIN_AUDIO_SIZE) {
    return {
      isValid: false,
      reason: `Audio file too small (${audioBlob.size} bytes) - likely silence`,
      confidence: 0.9
    };
  }
  
  if (audioBlob.size > MAX_AUDIO_SIZE) {
    return {
      isValid: false,
      reason: `Audio file too large (${audioBlob.size} bytes) - exceeds Whisper limit`,
      confidence: 1.0
    };
  }
  
  // Check 2: Analyze audio content using Web Audio API
  try {
    const hasSignificantAudio = await analyzeAudioContent(audioBlob);
    if (!hasSignificantAudio) {
      return {
        isValid: false,
        reason: 'Audio appears to be silence or too quiet',
        confidence: 0.85
      };
    }
  } catch (error) {
    console.warn('Failed to analyze audio content:', error);
    // Don't block on analysis failure - let Whisper decide
  }
  
  // All checks passed
  return {
    isValid: true,
    confidence: 0.8 // Reasonable confidence, but not certain
  };
}

/**
 * Analyze audio content to detect if there's actual speech/sound
 */
async function analyzeAudioContent(audioBlob: Blob): Promise<boolean> {
  try {
    // Convert blob to ArrayBuffer
    const arrayBuffer = await audioBlob.arrayBuffer();
    
    // Create audio context
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    
    // Decode audio data
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
    
    // Analyze audio samples
    const channelData = audioBuffer.getChannelData(0); // Get first channel
    const sampleRate = audioBuffer.sampleRate;
    const duration = audioBuffer.duration;
    
    // Check minimum duration (too short = likely noise)
    const MIN_DURATION = 0.3; // 300ms minimum
    if (duration < MIN_DURATION) {
      console.log('Audio too short:', duration, 'seconds');
      return false;
    }
    
    // Calculate RMS (Root Mean Square) energy
    let sum = 0;
    let peakAmplitude = 0;
    
    for (let i = 0; i < channelData.length; i++) {
      const sample = Math.abs(channelData[i]);
      sum += sample * sample;
      peakAmplitude = Math.max(peakAmplitude, sample);
    }
    
    const rms = Math.sqrt(sum / channelData.length);
    const rmsDb = 20 * Math.log10(rms);
    
    console.log('Audio analysis:', {
      duration: duration.toFixed(2) + 's',
      rms: rms.toFixed(4),
      rmsDb: rmsDb.toFixed(2) + 'dB',
      peakAmplitude: peakAmplitude.toFixed(4)
    });
    
    // Thresholds for significant audio
    const MIN_RMS = 0.01; // Minimum RMS amplitude
    const MIN_RMS_DB = -40; // Minimum RMS in dB
    const MIN_PEAK = 0.05; // Minimum peak amplitude
    
    // Check if audio meets thresholds
    if (rms < MIN_RMS || rmsDb < MIN_RMS_DB || peakAmplitude < MIN_PEAK) {
      console.log('Audio below thresholds - appears to be silence');
      return false;
    }
    
    // Close audio context
    audioContext.close();
    
    return true;
  } catch (error) {
    console.error('Error analyzing audio content:', error);
    // Return true on error to avoid false negatives
    return true;
  }
}

/**
 * Layer 2: Post-Whisper Transcription Validation
 * Checks if transcribed text is meaningful
 */
export interface TranscriptionValidationResult {
  isValid: boolean;
  reason?: string;
  confidence: number; // 0-1 scale
}

/**
 * Validate transcription text to filter out noise/gibberish
 */
export function validateTranscription(text: string): TranscriptionValidationResult {
  // Check 1: Empty or whitespace only
  if (!text || text.trim().length === 0) {
    return {
      isValid: false,
      reason: 'Transcription is empty',
      confidence: 1.0
    };
  }
  
  const trimmed = text.trim();
  
  // Check 2: Too short (likely noise)
  const MIN_LENGTH = 3; // At least 3 characters
  if (trimmed.length < MIN_LENGTH) {
    return {
      isValid: false,
      reason: `Transcription too short (${trimmed.length} chars)`,
      confidence: 0.9
    };
  }
  
  // Check 3: Only punctuation or special characters
  const alphanumericCount = (trimmed.match(/[a-zA-Z0-9]/g) || []).length;
  if (alphanumericCount === 0) {
    return {
      isValid: false,
      reason: 'Transcription contains no alphanumeric characters',
      confidence: 0.95
    };
  }
  
  // Check 4: Common noise/filler patterns
  const noisePatterns = [
    /^(uh+|um+|ah+|eh+|mh+m+)$/i,
    /^(\.\.\.|…|\*+|\-+)$/,
    /^(\[.*?\]|\(.*?\))$/,
    /^(background noise|static|silence|music)$/i,
  ];
  
  for (const pattern of noisePatterns) {
    if (pattern.test(trimmed)) {
      return {
        isValid: false,
        reason: `Transcription appears to be noise: "${trimmed}"`,
        confidence: 0.85
      };
    }
  }
  
  // Check 5: Mostly repeated characters (e.g., "aaaaaaa")
  const uniqueChars = new Set(trimmed.toLowerCase().replace(/\s/g, '')).size;
  if (trimmed.length > 5 && uniqueChars <= 2) {
    return {
      isValid: false,
      reason: 'Transcription appears to be repetitive noise',
      confidence: 0.8
    };
  }
  
  // Check 6: Very long single "word" (likely gibberish)
  const words = trimmed.split(/\s+/);
  const hasVeryLongWord = words.some(word => word.length > 50);
  if (hasVeryLongWord) {
    return {
      isValid: false,
      reason: 'Transcription contains unusually long word (possible gibberish)',
      confidence: 0.75
    };
  }
  
  // Check 7: Minimum word count (optional - can be adjusted)
  const MIN_WORD_COUNT = 1; // At least 1 word
  if (words.length < MIN_WORD_COUNT) {
    return {
      isValid: false,
      reason: `Too few words (${words.length})`,
      confidence: 0.7
    };
  }
  
  // All checks passed - transcription appears valid
  return {
    isValid: true,
    confidence: 0.9
  };
}

/**
 * Helper: Check if transcription is a common Whisper hallucination
 * Whisper sometimes generates repetitive or nonsense text for silence
 */
export function isWhisperHallucination(text: string): boolean {
  const trimmed = text.trim().toLowerCase();
  
  // Common hallucination patterns
  const hallucinations = [
    'thank you',
    'thanks for watching',
    'please subscribe',
    'thank you for watching',
    'you',
    'the',
    'okay',
    'bye',
    'thank',
  ];
  
  // Check if text is exactly one of these common hallucinations
  if (hallucinations.includes(trimmed)) {
    return true;
  }
  
  // Check for repetitive patterns (e.g., "the the the the")
  const words = trimmed.split(/\s+/);
  if (words.length >= 3) {
    const uniqueWords = new Set(words);
    if (uniqueWords.size === 1) {
      return true; // All words are the same
    }
  }
  
  return false;
}

/**
 * Layer 3: LLM-Based Gatekeeper Validation
 * Uses GPT-4o-mini to quickly check if transcription is game-related
 * before sending to expensive full analysis
 */
export interface GatekeeperValidationResult {
  isGameRelated: boolean;
  reason: string;
  confidence: number; // 0-1 scale
}

/**
 * Quick LLM check to determine if transcription is Warhammer 40K game-related
 * Uses GPT-5-mini for cost-effective gating
 */
export async function validateGameRelevance(
  transcription: string,
  conversationContext?: string[],
  langfuseGeneration?: any // Optional Langfuse generation to log input/output
): Promise<GatekeeperValidationResult> {
  try {
    // Dynamic import to avoid circular dependencies
    const OpenAI = (await import('openai')).default;
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    // Build context from recent conversation
    const contextText = conversationContext && conversationContext.length > 0
      ? `Recent conversation:\n${conversationContext.slice(-5).join('\n')}\n\n`
      : '';

    const systemPrompt = 'You are a quick, accurate filter that determines if speech is related to an active Warhammer 40K game. Respond only with JSON.';
    
    const userPrompt = `${contextText}Current transcription: "${transcription}"

You are a quick filter for a Warhammer 40K game tracking system.

Determine if the transcription above is related to actively playing a Warhammer 40K game.

GAME-RELATED includes:
- Game mechanics (phases, turns, rounds, damage, attacks, saves, movement)
- Unit actions (shooting, charging, fighting, moving)
- Resources (CP, VP, objectives, stratagems)
- Unit names, abilities, or status
- Game state queries ("how many CP?", "what phase?")
- Combat results (damage dealt, models lost, units destroyed)

NOT GAME-RELATED includes:
- General conversation, small talk, casual chat
- Non-game discussion (weather, plans, jokes)
- Greetings without context ("hey", "thanks", "okay")
- Background noise interpretations
- Meta-discussion about the rules not in game context
- Setup/teardown talk before/after game

Consider the recent conversation context when available.

Respond with a JSON object only:
{
  "isGameRelated": true/false,
  "reason": "Brief explanation",
  "confidence": 0.0-1.0
}`;

    const messages = [
      {
        role: 'system' as const,
        content: systemPrompt
      },
      {
        role: 'user' as const,
        content: userPrompt
      }
    ];

    // Log input to Langfuse if generation provided
    if (langfuseGeneration) {
      langfuseGeneration.update({
        input: messages,
        model: 'gpt-5-nano',
        modelParameters: {
          response_format: 'json_object'
        }
      });
    }

    const response = await openai.chat.completions.create({
      model: 'gpt-5-nano',
      messages: messages,
      response_format: { type: 'json_object' }
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No response from gatekeeper LLM');
    }

    const result = JSON.parse(content) as GatekeeperValidationResult;
    
    const gatekeeperResult = {
      isGameRelated: result.isGameRelated,
      reason: result.reason,
      confidence: result.confidence
    };

    // Log output to Langfuse if generation provided
    if (langfuseGeneration) {
      langfuseGeneration.update({
        output: {
          response: content,
          parsed: gatekeeperResult
        },
        usage: {
          input: response.usage?.prompt_tokens || 0,
          output: response.usage?.completion_tokens || 0,
          total: response.usage?.total_tokens || 0
        }
      });
    }
    
    return gatekeeperResult;

  } catch (error) {
    console.error('Gatekeeper validation error:', error);
    
    // Log error to Langfuse if generation provided
    if (langfuseGeneration) {
      langfuseGeneration.update({
        level: 'ERROR' as const,
        statusMessage: error instanceof Error ? error.message : 'Unknown error'
      });
    }
    
    // On error, default to allowing (fail open)
    // This prevents blocking legitimate game content if the gatekeeper fails
    return {
      isGameRelated: true,
      reason: 'Gatekeeper check failed, allowing through',
      confidence: 0.5
    };
  }
}

/**
 * Combined validation: Check both audio and transcription
 */
export interface CombinedValidationResult {
  shouldProcess: boolean;
  audioValidation: AudioValidationResult;
  transcriptionValidation?: TranscriptionValidationResult;
  reason?: string;
}

/**
 * Validate audio blob and optionally transcription
 */
export async function validateAudioPipeline(
  audioBlob: Blob,
  transcription?: string
): Promise<CombinedValidationResult> {
  // Layer 1: Validate audio blob
  const audioValidation = await validateAudioBlob(audioBlob);
  
  if (!audioValidation.isValid) {
    return {
      shouldProcess: false,
      audioValidation,
      reason: audioValidation.reason
    };
  }
  
  // Layer 2: Validate transcription (if provided)
  if (transcription !== undefined) {
    const transcriptionValidation = validateTranscription(transcription);
    
    if (!transcriptionValidation.isValid) {
      return {
        shouldProcess: false,
        audioValidation,
        transcriptionValidation,
        reason: transcriptionValidation.reason
      };
    }
    
    // Check for hallucinations
    if (isWhisperHallucination(transcription)) {
      return {
        shouldProcess: false,
        audioValidation,
        transcriptionValidation: {
          isValid: false,
          reason: 'Transcription appears to be Whisper hallucination',
          confidence: 0.85
        },
        reason: 'Transcription appears to be Whisper hallucination'
      };
    }
    
    return {
      shouldProcess: true,
      audioValidation,
      transcriptionValidation
    };
  }
  
  // Only audio validated
  return {
    shouldProcess: true,
    audioValidation
  };
}

