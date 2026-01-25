/**
 * Priority Keyword Detection
 * Allows users to trigger immediate processing for urgent queries
 */

export const PRIORITY_KEYWORDS = [
  // Direct address to system
  'grimlog',
  'hey grimlog',
  'grimlog what',
  'grimlog how',
  
  // Rules queries (immediate need)
  'what is the rule',
  'what\'s the rule',
  'how does',
  'can i',
  'am i allowed',
  'is it legal',
  
  // Game state queries (need immediate answer)
  'how many cp',
  'how much cp',
  'what phase',
  'what round',
  'how many vp',
  'how many victory points',
  'who controls',
  
  // Urgent corrections
  'wait',
  'actually',
  'correction',
  'i meant',
  'scratch that',
  'never mind',
  'nevermind',
];

/**
 * Check if transcription contains a priority keyword
 * indicating user needs immediate response
 */
export function hasPriorityKeyword(transcription: string): boolean {
  const lowerText = transcription.toLowerCase().trim();
  
  return PRIORITY_KEYWORDS.some(keyword => lowerText.includes(keyword));
}

/**
 * Get priority level based on content
 */
export function getPriorityLevel(transcription: string): 'immediate' | 'normal' {
  if (hasPriorityKeyword(transcription)) {
    return 'immediate';
  }
  
  return 'normal';
}

