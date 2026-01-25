// Request Deduplication System
// Tracks analysis requests and allows newer requests to supersede older ones
// Frontend handles abort via AbortController; backend tracks for logging/cleanup

interface RequestToken {
  id: string;
  transcriptIds: string[];
  startTime: number;
}

// In-memory tracking of active analysis requests
const inFlightRequests = new Map<string, RequestToken>();
const transcriptProcessingMap = new Map<string, string>(); // transcriptId -> requestId

// Timeout for cleanup (if request takes longer than 30s, assume it failed)
const REQUEST_TIMEOUT_MS = 30000;

/**
 * Start a new analysis request
 * Newer requests supersede older ones (frontend handles abort via AbortController)
 * Always returns a token - no blocking
 */
export function startAnalysisRequest(transcriptIds: string[]): RequestToken | null {
  // Check if any transcripts have in-flight requests and supersede them
  const supersededRequests = new Set<string>();
  
  for (const transcriptId of transcriptIds) {
    if (transcriptProcessingMap.has(transcriptId)) {
      const existingRequestId = transcriptProcessingMap.get(transcriptId)!;
      const existingRequest = inFlightRequests.get(existingRequestId);
      
      if (existingRequest && Date.now() - existingRequest.startTime < REQUEST_TIMEOUT_MS) {
        // Mark for superseding (newer request has more complete context)
        supersededRequests.add(existingRequestId);
        console.log(`🔄 Newer request supersedes ${existingRequestId} (more complete context)`);
      } else if (existingRequest) {
        // Request timed out, clean it up
        console.log(`⚠️ Request ${existingRequestId} timed out, cleaning up`);
        completeAnalysisRequest(existingRequest);
      }
    }
  }
  
  // Clean up superseded requests' transcript mappings
  // (The actual HTTP requests will be aborted by frontend AbortController)
  for (const supersededId of supersededRequests) {
    const supersededRequest = inFlightRequests.get(supersededId);
    if (supersededRequest) {
      // Remove transcript mappings for superseded request
      for (const transcriptId of supersededRequest.transcriptIds) {
        const currentMapping = transcriptProcessingMap.get(transcriptId);
        if (currentMapping === supersededId) {
          transcriptProcessingMap.delete(transcriptId);
        }
      }
      // Remove from in-flight map
      inFlightRequests.delete(supersededId);
      console.log(`🗑️ Cleaned up superseded request ${supersededId}`);
    }
  }
  
  // Create new request token
  const token: RequestToken = {
    id: generateRequestId(),
    transcriptIds,
    startTime: Date.now()
  };
  
  // Register this request
  inFlightRequests.set(token.id, token);
  
  // Map each transcript to this request
  for (const transcriptId of transcriptIds) {
    transcriptProcessingMap.set(transcriptId, token.id);
  }
  
  console.log(`✅ Analysis request ${token.id} started for ${transcriptIds.length} transcript(s)`);
  
  return token;
}

/**
 * Mark an analysis request as complete and clean up
 */
export function completeAnalysisRequest(token: RequestToken): void {
  // Remove request from in-flight map
  inFlightRequests.delete(token.id);
  
  // Remove transcript mappings
  for (const transcriptId of token.transcriptIds) {
    const mappedRequestId = transcriptProcessingMap.get(transcriptId);
    if (mappedRequestId === token.id) {
      transcriptProcessingMap.delete(transcriptId);
    }
  }
  
  const duration = Date.now() - token.startTime;
  console.log(`✅ Analysis request ${token.id} completed in ${duration}ms`);
}

/**
 * Check if a specific transcript is currently being processed
 */
export function isTranscriptBeingProcessed(transcriptId: string): boolean {
  return transcriptProcessingMap.has(transcriptId);
}

/**
 * Get information about an in-flight request
 */
export function getRequestInfo(requestId: string): RequestToken | undefined {
  return inFlightRequests.get(requestId);
}

/**
 * Get all in-flight requests (for debugging)
 */
export function getInFlightRequests(): RequestToken[] {
  return Array.from(inFlightRequests.values());
}

/**
 * Clean up stale requests (called periodically or on startup)
 */
export function cleanupStaleRequests(): number {
  const now = Date.now();
  let cleaned = 0;
  
  for (const [requestId, token] of inFlightRequests.entries()) {
    if (now - token.startTime > REQUEST_TIMEOUT_MS) {
      console.log(`🧹 Cleaning up stale request ${requestId}`);
      completeAnalysisRequest(token);
      cleaned++;
    }
  }
  
  return cleaned;
}

// Generate a unique request ID
function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// Periodic cleanup of stale requests (every 60 seconds)
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const cleaned = cleanupStaleRequests();
    if (cleaned > 0) {
      console.log(`🧹 Cleaned up ${cleaned} stale request(s)`);
    }
  }, 60000);
}


