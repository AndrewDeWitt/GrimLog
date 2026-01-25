/**
 * Speech Recognition Manager
 * Uses Web Speech API (Chrome/Edge/Safari) for real-time transcription
 * Replaces Whisper-based audio capture for better quality and zero cost
 */

// Browser compatibility types
interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}

interface SpeechRecognitionResultList {
  length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionResult {
  length: number;
  item(index: number): SpeechRecognitionAlternative;
  [index: number]: SpeechRecognitionAlternative;
  isFinal: boolean;
}

interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
  message: string;
}

interface ISpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onstart: ((this: ISpeechRecognition, ev: Event) => any) | null;
  onend: ((this: ISpeechRecognition, ev: Event) => any) | null;
  onerror: ((this: ISpeechRecognition, ev: SpeechRecognitionErrorEvent) => any) | null;
  onresult: ((this: ISpeechRecognition, ev: SpeechRecognitionEvent) => any) | null;
}

declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

import { hasCompletionPhrase } from '@/lib/analysisTriggers';
import { applyAllCorrections } from '@/lib/warhammerCorrections';

export interface SpeechRecognitionConfig {
  onInterimTranscript?: (text: string) => void; // Real-time partial results
  onFinalTranscript: (text: string) => void; // Completed sentence
  onStatusChange?: (status: 'idle' | 'listening' | 'processing') => void;
  onError?: (error: string) => void;
  language?: string; // Default: 'en-US'
  continuous?: boolean; // Default: true
}

export class SpeechRecognitionManager {
  private recognition: ISpeechRecognition | null = null;
  private config: SpeechRecognitionConfig;
  private isActive = false;
  private restartTimeout: NodeJS.Timeout | null = null;
  private flushTimeout: NodeJS.Timeout | null = null;
  
  // Accumulated transcripts since last analysis
  private accumulatedTranscripts: string[] = [];
  private lastAnalysisTime: number = 0;
  
  // Buffer for combining small final segments into larger sentences
  private partialBuffer: string = '';
  
  constructor(config: SpeechRecognitionConfig) {
    this.config = config;
  }

  /**
   * Check if browser supports Speech Recognition
   */
  static isSupported(): boolean {
    return !!(window.SpeechRecognition || window.webkitSpeechRecognition);
  }

  /**
   * Get browser type for specific handling
   */
  static getBrowserType(): 'chrome' | 'safari' | 'edge' | 'unsupported' {
    const ua = navigator.userAgent.toLowerCase();
    if (ua.includes('edg/')) return 'edge';
    if (ua.includes('safari') && !ua.includes('chrome')) return 'safari';
    if (ua.includes('chrome')) return 'chrome';
    return 'unsupported';
  }

  /**
   * Initialize and start speech recognition
   */
  async initialize(): Promise<void> {
    if (!SpeechRecognitionManager.isSupported()) {
      const error = 'Speech Recognition not supported in this browser. Please use Chrome or Edge.';
      this.config.onError?.(error);
      throw new Error(error);
    }

    // Create recognition instance
    const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognitionAPI();
    this.recognition = recognition;

    // Configure recognition
    recognition.continuous = this.config.continuous ?? true;
    recognition.interimResults = true; // Get real-time results
    recognition.lang = this.config.language || 'en-US';
    recognition.maxAlternatives = 1;

    // Set up event handlers
    recognition.onstart = () => {
      console.log('🎤 Speech recognition started');
      this.isActive = true;
      this.config.onStatusChange?.('listening');
    };

    recognition.onend = () => {
      console.log('🎤 Speech recognition ended');
      
      // Auto-restart if still active (for continuous mode)
      if (this.isActive && this.config.continuous) {
        console.log('🔄 Auto-restarting speech recognition...');
        this.restartTimeout = setTimeout(() => {
          this.start();
        }, 100);
      } else {
        this.config.onStatusChange?.('idle');
      }
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      console.error('Speech recognition error:', event.error, event.message);
      
      // Handle specific errors
      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        const error = 'Microphone access denied. Please allow microphone permissions.';
        this.config.onError?.(error);
        this.stop();
      } else if (event.error === 'no-speech') {
        console.log('No speech detected, continuing...');
        // Don't stop, just keep listening
      } else if (event.error === 'network') {
        const error = 'Network error. Speech recognition requires internet connection.';
        this.config.onError?.(error);
      } else {
        this.config.onError?.(`Speech recognition error: ${event.error}`);
      }
    };

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      // Chrome often delivers multiple results; aggregate from resultIndex → end
      const results = event.results;
      let sawFinal = false;
      let interimConcat = '';

      for (let i = event.resultIndex; i < results.length; i++) {
        const res = results[i];
        const text = (res[0] && res[0].transcript ? res[0].transcript : '').trim();
        if (!text) continue;

        if (res.isFinal) {
          sawFinal = true;
          this.partialBuffer = this.partialBuffer ? `${this.partialBuffer} ${text}` : text;
        } else {
          interimConcat += interimConcat ? ` ${text}` : text;
        }
      }

      // Live preview = buffered finals + any interim tail
      // Apply Warhammer vocabulary corrections for better display
      const preview = [this.partialBuffer, interimConcat].filter(Boolean).join(' ');
      if (preview) {
        const correctedPreview = applyAllCorrections(preview);
        this.config.onInterimTranscript?.(correctedPreview);
      }

      if (sawFinal) {
        // Decide when to flush the buffer
        const endsWithPunctuation = /[\.!?]$/.test(this.partialBuffer);
        const wordCount = this.partialBuffer.split(/\s+/).filter(Boolean).length;
        const hasCompletion = hasCompletionPhrase(this.partialBuffer);

        const shouldFlushImmediate = endsWithPunctuation || hasCompletion || wordCount >= 12;

        if (shouldFlushImmediate) {
          this.flushBufferedFinal();
        } else {
          // Debounce flush to allow next final piece to arrive
          // Reduced from 1200ms to 1000ms - frontend handles additional accumulation
          if (this.flushTimeout) clearTimeout(this.flushTimeout);
          this.flushTimeout = setTimeout(() => this.flushBufferedFinal(), 1000);
        }
      }
    };

    // Start recognition
    this.start();
  }

  /**
   * Start recognition
   */
  private start(): void {
    if (!this.recognition) {
      throw new Error('Recognition not initialized');
    }

    try {
      this.recognition.start();
      this.isActive = true;
    } catch (error) {
      // Already started, ignore
      if (error instanceof Error && error.message.includes('already started')) {
        console.log('Recognition already started');
      } else {
        console.error('Failed to start recognition:', error);
        this.config.onError?.('Failed to start speech recognition');
      }
    }
  }

  /**
   * Stop recognition
   */
  stop(): void {
    console.log('🛑 Stopping speech recognition');
    this.isActive = false;
    
    if (this.restartTimeout) {
      clearTimeout(this.restartTimeout);
      this.restartTimeout = null;
    }
    if (this.flushTimeout) {
      clearTimeout(this.flushTimeout);
      this.flushTimeout = null;
    }
    
    if (this.recognition) {
      try {
        this.recognition.stop();
      } catch (error) {
        console.error('Error stopping recognition:', error);
      }
    }
    
    this.config.onStatusChange?.('idle');
  }

  /**
   * Get accumulated transcripts since last analysis
   */
  getAccumulatedTranscripts(): string[] {
    return [...this.accumulatedTranscripts];
  }

  /**
   * Add a transcript to accumulated list (for manual tracking)
   */
  addTranscript(transcript: string): void {
    this.accumulatedTranscripts.push(transcript);
  }

  /**
   * Reset accumulated transcripts (after analysis)
   */
  resetAccumulatedTranscripts(): void {
    console.log('🔄 Resetting accumulated transcripts');
    this.accumulatedTranscripts = [];
    this.lastAnalysisTime = Date.now();
    this.partialBuffer = '';
  }

  /**
   * Get time since last analysis
   */
  getTimeSinceLastAnalysis(): number {
    return Date.now() - this.lastAnalysisTime;
  }

  /**
   * Check if recognition is currently active
   */
  isListening(): boolean {
    return this.isActive;
  }

  /**
   * Flush any buffered partial sentence as a final transcript
   * Applies Warhammer vocabulary corrections before emitting
   */
  private flushBufferedFinal(): void {
    if (!this.partialBuffer) return;
    const rawText = this.partialBuffer.trim();
    this.partialBuffer = '';
    if (this.flushTimeout) {
      clearTimeout(this.flushTimeout);
      this.flushTimeout = null;
    }
    
    // Apply Warhammer 40K vocabulary corrections
    const correctedText = applyAllCorrections(rawText);
    
    // Log both raw and corrected for debugging
    if (rawText !== correctedText) {
      console.log('🔧 Vocabulary correction applied:');
      console.log('   Raw:', rawText);
      console.log('   Corrected:', correctedText);
    } else {
      console.log('✅ Final (buffered) transcript:', correctedText);
    }
    
    this.accumulatedTranscripts.push(correctedText);
    this.config.onFinalTranscript(correctedText);
    // Clear interim once emitted
    this.config.onInterimTranscript?.('');
  }
}
