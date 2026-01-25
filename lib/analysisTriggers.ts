/**
 * Context-Aware Analysis Triggers
 * Determines when to analyze accumulated transcripts based on content, not just time
 */

/**
 * Phrases that indicate end of an action or natural break point
 */
const ACTION_COMPLETION_PHRASES = [
  // End of phase/turn markers
  'that\'s my',
  'end of my',
  'done with',
  'finished with',
  'that\'s it for',
  'moving to',
  'going to',
  
  // Natural conversation breaks
  'okay so',
  'alright',
  'so anyway',
  'anyway',
  'let me see',
  
  // Phase transitions
  'command phase',
  'movement phase',
  'shooting phase',
  'charge phase',
  'fight phase',
  
  // Turn markers
  'my turn',
  'your turn',
  'opponent\'s turn',
  'opponents turn',
  'next round',
  'round',
  
  // Game actions completed
  'destroyed',
  'wiped out',
  'killed',
  'failed',
  'passed',
  'saved',
  'wounded',
  'models lost',
  'took damage',
  
  // Completion indicators
  'that\'s everything',
  'that\'s all',
  'done',
];

/**
 * Keywords that indicate immediate analysis needed
 */
const PRIORITY_KEYWORDS = [
  // Direct system address
  'grimlog',
  'hey grimlog',
  
  // Questions requiring immediate answers
  'how many cp',
  'how much cp',
  'what phase',
  'what round',
  'how many vp',
  'who controls',
  
  // Rules queries
  'what is the rule',
  'what\'s the rule',
  'how does',
  'can i',
  'am i allowed',
  
  // Corrections/urgent
  'wait',
  'actually',
  'correction',
  'i meant',
  'scratch that',
  'never mind',
  'nevermind',
  
  // Secondary objectives
  'secondary',
  'secondaries',
  'assassination',
  'assassinate',
  'behind enemy lines',
  'bring it down',
  'cull the horde',
  'marked for death',
  'no prisoners',
  'sabotage',
  'overwhelming force',
  'storm hostile',
  'engage on all fronts',
  'cleanse',
  'establish locus',
  'defend stronghold',
  'secure no man',
  'recover assets',
  'tempting target',
  'extend battle lines',
  'area denial',
  'display of might',
];

/**
 * Check if transcription contains an action completion phrase
 */
export function hasCompletionPhrase(transcription: string): boolean {
  const lowerText = transcription.toLowerCase().trim();
  
  return ACTION_COMPLETION_PHRASES.some(phrase => lowerText.includes(phrase));
}

/**
 * Check if transcription contains a priority keyword
 */
export function hasPriorityKeyword(transcription: string): boolean {
  const lowerText = transcription.toLowerCase().trim();
  
  return PRIORITY_KEYWORDS.some(keyword => lowerText.includes(keyword));
}

/**
 * Analyze accumulated transcripts to determine if analysis should be triggered
 */
export interface AnalysisTriggerResult {
  shouldAnalyze: boolean;
  reason: string;
  confidence: number; // 0-1
}

export function checkAnalysisTriggers(
  recentTranscripts: string[],
  timeSinceLastAnalysis: number,
  timeSinceLastSpeech: number
): AnalysisTriggerResult {
  
  // Trigger 1: Priority keyword in most recent transcript
  if (recentTranscripts.length > 0) {
    const latest = recentTranscripts[recentTranscripts.length - 1];
    if (hasPriorityKeyword(latest)) {
      return {
        shouldAnalyze: true,
        reason: 'Priority keyword detected',
        confidence: 1.0
      };
    }
  }
  
  // Trigger 2: Action completion phrase (but only with enough context)
  const MIN_TRANSCRIPTS_FOR_COMPLETION = 2; // Need at least 2 sentences before completion phrase counts
  if (recentTranscripts.length >= MIN_TRANSCRIPTS_FOR_COMPLETION) {
    const latest = recentTranscripts[recentTranscripts.length - 1];
    if (hasCompletionPhrase(latest)) {
      return {
        shouldAnalyze: true,
        reason: `Action completion phrase detected (${recentTranscripts.length} transcripts ready)`,
        confidence: 0.9
      };
    }
  }
  
  // Trigger 3: Long silence (real break in conversation)
  const LONG_SILENCE_THRESHOLD = 8000; // 8 seconds of no speech (reduced from 10)
  if (timeSinceLastSpeech > LONG_SILENCE_THRESHOLD && recentTranscripts.length > 0) {
    return {
      shouldAnalyze: true,
      reason: `Long silence detected (${(timeSinceLastSpeech / 1000).toFixed(1)}s, ${recentTranscripts.length} transcripts ready)`,
      confidence: 0.85
    };
  }
  
  // Trigger 4: Accumulated enough transcripts + reasonable time
  const MIN_TRANSCRIPTS_FOR_BATCH = 4; // Increased from 3 for better context
  const MIN_TIME_FOR_BATCH = 5000; // Reduced from 8000 for faster response
  if (recentTranscripts.length >= MIN_TRANSCRIPTS_FOR_BATCH && timeSinceLastAnalysis > MIN_TIME_FOR_BATCH) {
    return {
      shouldAnalyze: true,
      reason: `Accumulated ${recentTranscripts.length} transcripts (min ${MIN_TRANSCRIPTS_FOR_BATCH})`,
      confidence: 0.8
    };
  }
  
  // Trigger 5: Word count threshold (enough content regardless of sentence count)
  const totalWords = recentTranscripts.join(' ').split(/\s+/).length;
  const MIN_WORDS_FOR_ANALYSIS = 15; // About 2-3 sentences worth
  if (totalWords >= MIN_WORDS_FOR_ANALYSIS && timeSinceLastAnalysis > 3000) {
    return {
      shouldAnalyze: true,
      reason: `Accumulated ${totalWords} words (min ${MIN_WORDS_FOR_ANALYSIS})`,
      confidence: 0.75
    };
  }
  
  // Trigger 6: Maximum time limit (safety)
  const MAX_TIME_BETWEEN_ANALYSES = 20000; // 20 seconds (reduced from 30 for better responsiveness)
  if (timeSinceLastAnalysis > MAX_TIME_BETWEEN_ANALYSES && recentTranscripts.length > 0) {
    return {
      shouldAnalyze: true,
      reason: `Maximum time limit reached (${(timeSinceLastAnalysis / 1000).toFixed(1)}s, ${recentTranscripts.length} transcripts)`,
      confidence: 0.6
    };
  }
  
  // No triggers met - continue accumulating
  return {
    shouldAnalyze: false,
    reason: `Accumulating context (${recentTranscripts.length} transcripts, ${(timeSinceLastAnalysis / 1000).toFixed(1)}s since last analysis)`,
    confidence: 0
  };
}

