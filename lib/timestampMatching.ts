// Timestamp Matching Utility
// Matches tool calls to Whisper transcript segments to get accurate event timestamps

interface WhisperSegment {
  id: number;
  seek: number;
  start: number; // Start time in seconds
  end: number;   // End time in seconds
  text: string;
  tokens: number[];
  temperature: number;
  avg_logprob: number;
  compression_ratio: number;
  no_speech_prob: number;
}

/**
 * Match a tool call's context to a Whisper segment
 * Returns the timestamp when that segment was spoken
 * 
 * @param toolCallIndex - Index of the tool call in the batch
 * @param totalToolCalls - Total number of tool calls in this batch
 * @param segments - Whisper segments from transcription
 * @param audioStartTime - When the audio chunk started
 */
export function getToolCallTimestamp(
  toolCallIndex: number,
  totalToolCalls: number,
  segments: WhisperSegment[],
  audioStartTime: Date
): Date {
  // If no segments, use sequential offset (fallback)
  if (!segments || segments.length === 0) {
    const offsetSeconds = toolCallIndex * 2; // 2 seconds per tool call
    return new Date(audioStartTime.getTime() + offsetSeconds * 1000);
  }

  // Distribute tool calls evenly across segments
  // This assumes tool calls roughly correspond to chronological order in speech
  const segmentIndex = Math.floor((toolCallIndex / totalToolCalls) * segments.length);
  const matchedSegment = segments[Math.min(segmentIndex, segments.length - 1)];

  // Use the start time of the matched segment
  const offsetMs = matchedSegment.start * 1000; // Convert seconds to milliseconds
  return new Date(audioStartTime.getTime() + offsetMs);
}

/**
 * Find the segment that best matches a given text string
 * Returns the timestamp for that segment
 * 
 * @param searchText - Text to search for (e.g., tool call description)
 * @param segments - Whisper segments from transcription
 * @param audioStartTime - When the audio chunk started
 */
export function findSegmentByText(
  searchText: string,
  segments: WhisperSegment[],
  audioStartTime: Date
): Date | null {
  if (!segments || segments.length === 0 || !searchText) {
    return null;
  }

  const searchLower = searchText.toLowerCase();
  
  // Find segment that contains the search text
  const matchedSegment = segments.find(seg => 
    seg.text.toLowerCase().includes(searchLower)
  );

  if (matchedSegment) {
    const offsetMs = matchedSegment.start * 1000;
    return new Date(audioStartTime.getTime() + offsetMs);
  }

  return null;
}

/**
 * Get timestamps for all segments
 * Useful for debugging or displaying the full timeline
 */
export function getAllSegmentTimestamps(
  segments: WhisperSegment[],
  audioStartTime: Date
): Array<{ text: string; timestamp: Date; duration: number }> {
  if (!segments || segments.length === 0) {
    return [];
  }

  return segments.map(seg => ({
    text: seg.text.trim(),
    timestamp: new Date(audioStartTime.getTime() + seg.start * 1000),
    duration: seg.end - seg.start
  }));
}

/**
 * Log segment timeline for debugging
 */
export function logSegmentTimeline(
  segments: WhisperSegment[],
  audioStartTime: Date
): void {
  const timeline = getAllSegmentTimestamps(segments, audioStartTime);
  
  if (timeline.length === 0) {
    console.log('📝 No segments to display');
    return;
  }

  console.log('📝 Whisper Segment Timeline:');
  timeline.forEach((seg, idx) => {
    const timeStr = seg.timestamp.toLocaleTimeString();
    console.log(`  [${idx}] ${timeStr} (+${seg.duration.toFixed(1)}s): "${seg.text}"`);
  });
}
