// Voice Activity Detection and Audio Capture

import { validateAudioBlob } from './audioValidation';

export class AudioCaptureManager {
  private mediaRecorder: MediaRecorder | null = null;
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private silenceStart: number | null = null;
  private speechStart: number | null = null; // Track when speech was first detected
  private isRecording = false;
  private audioChunks: Blob[] = [];
  private lastDebugLog: number = 0;
  private isActive = false; // Track if VAD should be running
  private lastAnalysisTime: number = 0; // Track when last full analysis happened
  private lastSpeechTime: number = 0; // Track when user last spoke (for long silence detection)
  private transcriptsSinceLastAnalysis: string[] = []; // Accumulated transcripts
  
  // VAD configuration
  private silenceThreshold: number = -30; // dB - Default, will be calibrated
  private readonly DEFAULT_THRESHOLD = -30; // Starting threshold
  private readonly SILENCE_DURATION = 5000; // ms of silence before transcribing
  private readonly SPEECH_CONFIRMATION_TIME = 600; // ms of sustained speech before recording starts
  private readonly MIN_RECORDING_TIME = 1000; // minimum ms to record
  private readonly MAX_RECORDING_TIME = 30000; // 30 seconds max before auto-chunking
  private readonly DEBUG_LOG_INTERVAL = 500; // Log audio level every 500ms for better feedback
  private recordingStartTime: number | null = null;
  
  // Calibration state
  private isCalibrating = false;
  private calibrationSamples: number[] = [];
  private readonly CALIBRATION_DURATION = 3000; // 3 seconds of calibration
  private calibrationMargin: number = 10; // dB above noise floor to set threshold (configurable)
  private lastNoiseFloor: number = -Infinity; // Store last measured noise floor
  
  // Current audio level for real-time display
  private currentAudioLevel: number = -Infinity;

  constructor(
    private onAudioReady: (
      audioBlob: Blob, 
      transcriptsSinceLastAnalysis: string[],
      timeSinceLastAnalysis: number,
      timeSinceLastSpeech: number
    ) => void,
    private onStatusChange: (status: 'idle' | 'listening' | 'processing') => void,
    private onAudioLevelChange?: (level: number, threshold: number) => void
  ) {
    // Try to load saved threshold and margin from localStorage
    const savedThreshold = localStorage.getItem('grimlog-audio-threshold');
    if (savedThreshold) {
      this.silenceThreshold = parseFloat(savedThreshold);
      console.log(`📊 Loaded saved threshold: ${this.silenceThreshold.toFixed(1)}dB`);
    }
    
    const savedMargin = localStorage.getItem('grimlog-audio-margin');
    if (savedMargin) {
      this.calibrationMargin = parseFloat(savedMargin);
      console.log(`📊 Loaded saved margin: ${this.calibrationMargin.toFixed(1)}dB`);
    }
    
    const savedNoiseFloor = localStorage.getItem('grimlog-noise-floor');
    if (savedNoiseFloor) {
      this.lastNoiseFloor = parseFloat(savedNoiseFloor);
    }
  }

  async initialize(): Promise<void> {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      // Set up audio context for VAD
      this.audioContext = new AudioContext();
      const source = this.audioContext.createMediaStreamSource(stream);
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 2048;
      source.connect(this.analyser);

      // Set up media recorder
      this.mediaRecorder = new MediaRecorder(stream);
      
      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.audioChunks.push(event.data);
        }
      };

      this.mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(this.audioChunks, { type: 'audio/webm' });
        const blobSize = audioBlob.size;
        this.audioChunks = [];
        
        console.log(`📦 Audio chunk captured: ${(blobSize / 1024).toFixed(2)}KB`);
        
        // Basic checks
        if (blobSize === 0 || !this.recordingStartTime || 
            Date.now() - this.recordingStartTime <= this.MIN_RECORDING_TIME) {
          console.log(`❌ Audio rejected: ${blobSize === 0 ? 'empty' : 'too short'}`);
          this.recordingStartTime = null;
          // Ready for next recording
          this.onStatusChange('listening');
          return;
        }
        
        // Validate audio content before sending (run async but don't block VAD)
        console.log('🔍 Validating audio blob...');
        
        try {
          const validation = await validateAudioBlob(audioBlob);
          
          if (!validation.isValid) {
            console.log('❌ Audio validation failed:', validation.reason);
            this.recordingStartTime = null;
            // Ready for next recording
            this.onStatusChange('listening');
            return;
          }
          
          // Update speech timing (user just spoke)
          const now = Date.now();
          this.lastSpeechTime = now;
          
          // Calculate timing for analysis triggers
          const timeSinceLastAnalysis = now - this.lastAnalysisTime;
          const timeSinceLastSpeechMs = now - this.lastSpeechTime;
          
          console.log(`✅ Audio validated - Passing to decision layer (${this.transcriptsSinceLastAnalysis.length} transcripts accumulated)`);
          
          this.onStatusChange('processing');
          this.onAudioReady(
            audioBlob,
            this.transcriptsSinceLastAnalysis,
            timeSinceLastAnalysis,
            timeSinceLastSpeechMs
          );
          this.recordingStartTime = null;
        } catch (error) {
          console.error('❌ Audio validation error:', error);
          // On validation error, send anyway (fail open)
          console.log('⚠️ Validation error - sending audio anyway');
          this.onStatusChange('processing');
          this.onAudioReady(audioBlob, this.transcriptsSinceLastAnalysis, Date.now() - this.lastAnalysisTime, Date.now() - this.lastSpeechTime); // Analyze on error to be safe
          this.recordingStartTime = null;
        }
      };

      this.startListening();
    } catch (error) {
      console.error('Failed to initialize audio:', error);
      throw error;
    }
  }

  private startListening(): void {
    if (!this.mediaRecorder || !this.analyser) return;
    
    this.isRecording = false;
    this.isActive = true;
    this.onStatusChange('listening');
    console.log('✅ VAD loop started');
    this.checkAudioLevel();
  }

  private checkAudioLevel(): void {
    // Stop VAD loop if no longer active
    if (!this.isActive || !this.analyser) {
      return;
    }

    // Use time-domain data for better VAD (actual waveform amplitude)
    const dataArray = new Uint8Array(this.analyser.fftSize);
    this.analyser.getByteTimeDomainData(dataArray);

    // Calculate RMS (Root Mean Square) for more accurate volume measurement
    let sum = 0;
    for (let i = 0; i < dataArray.length; i++) {
      const normalized = (dataArray[i] - 128) / 128; // Normalize to -1 to 1
      sum += normalized * normalized;
    }
    const rms = Math.sqrt(sum / dataArray.length);
    const dB = 20 * Math.log10(rms);
    
    // Update current level for UI
    this.currentAudioLevel = dB;
    
    // Notify UI of level change
    if (this.onAudioLevelChange) {
      this.onAudioLevelChange(dB, this.silenceThreshold);
    }

    // Handle calibration mode
    if (this.isCalibrating) {
      this.calibrationSamples.push(dB);
      return; // Don't process VAD during calibration
    }

    // Periodic debug logging to monitor audio levels
    const now = Date.now();
    if (now - this.lastDebugLog > this.DEBUG_LOG_INTERVAL) {
      console.log(`📊 Audio level: ${dB.toFixed(1)}dB (threshold: ${this.silenceThreshold.toFixed(1)}dB) - ${this.isRecording ? 'RECORDING' : 'IDLE'}`);
      this.lastDebugLog = now;
    }

    if (dB > this.silenceThreshold) {
      // Sound detected
      if (!this.isRecording && this.mediaRecorder?.state === 'inactive') {
        // Start tracking speech
        if (this.speechStart === null) {
          this.speechStart = Date.now();
          console.log(`👂 Potential speech detected (${dB.toFixed(1)}dB) - Confirming...`);
        } else if (Date.now() - this.speechStart > this.SPEECH_CONFIRMATION_TIME) {
          // Speech sustained for confirmation period - start recording
          console.log(`🎤 Speech confirmed (${dB.toFixed(1)}dB, sustained ${Date.now() - this.speechStart}ms) - Starting recording`);
          try {
            this.mediaRecorder?.start();
            this.recordingStartTime = Date.now();
            this.isRecording = true;
            this.speechStart = null; // Reset
          } catch (error) {
            console.error('❌ Failed to start recording:', error);
            this.isRecording = false;
            this.speechStart = null;
          }
        }
        // else: still confirming, waiting for SPEECH_CONFIRMATION_TIME
      } else if (this.isRecording) {
        // Already recording, reset silence timer
        this.silenceStart = null;
        
        // Check max recording time (safety limit)
        if (this.recordingStartTime && Date.now() - this.recordingStartTime > this.MAX_RECORDING_TIME) {
          const recordingDuration = Date.now() - this.recordingStartTime;
          console.log(`⏱️ Max recording time reached (${recordingDuration}ms) - Auto-chunking`);
          if (this.mediaRecorder?.state === 'recording') {
            this.mediaRecorder.stop();
          }
          this.isRecording = false;
          this.silenceStart = null;
        }
      }
    } else {
      // Silence detected
      
      // Reset speech confirmation if sound drops before confirmation completes
      if (!this.isRecording && this.speechStart !== null) {
        console.log(`❌ Speech not confirmed (dropped to ${dB.toFixed(1)}dB after ${Date.now() - this.speechStart}ms) - Ignoring`);
        this.speechStart = null;
      }
      
      // Handle silence during recording
      if (this.isRecording) {
        if (this.silenceStart === null) {
          this.silenceStart = Date.now();
          console.log(`🔇 Silence detected (${dB.toFixed(1)}dB) - Waiting ${this.SILENCE_DURATION}ms before chunking`);
        } else if (Date.now() - this.silenceStart > this.SILENCE_DURATION) {
          // Silence duration exceeded, stop recording
          const recordingDuration = Date.now() - (this.recordingStartTime || 0);
          console.log(`⏹️ Silence exceeded ${this.SILENCE_DURATION}ms - Stopping recording (${recordingDuration}ms total)`);
          if (this.mediaRecorder?.state === 'recording') {
            this.mediaRecorder.stop();
          }
          this.isRecording = false;
          this.silenceStart = null;
        }
      }
    }

    // Continue checking only if still active
    if (this.isActive) {
      requestAnimationFrame(() => this.checkAudioLevel());
    }
  }

  stop(): void {
    console.log('🛑 Stopping VAD loop and audio capture');
    
    // Stop VAD loop first
    this.isActive = false;
    
    // Stop recording if in progress
    if (this.mediaRecorder?.state === 'recording') {
      this.mediaRecorder.stop();
    }
    
    // Clean up resources
    this.mediaRecorder?.stream.getTracks().forEach(track => track.stop());
    this.audioContext?.close();
    this.isRecording = false;
    this.speechStart = null; // Reset speech confirmation
    this.silenceStart = null; // Reset silence detection
    this.onStatusChange('idle');
  }

  isActiveRecording(): boolean {
    return this.isRecording;
  }

  /**
   * Force next chunk to trigger full analysis
   * Used for priority keywords or manual triggers
   */
  forceNextAnalysis(): void {
    console.log('🔴 Next chunk will trigger FULL ANALYSIS (forced)');
    this.lastAnalysisTime = 0; // Reset timer to force analysis
  }

  /**
   * Update accumulated transcripts after transcribe-only
   */
  addTranscript(transcription: string): void {
    this.transcriptsSinceLastAnalysis.push(transcription);
    console.log(`📝 Accumulated transcript #${this.transcriptsSinceLastAnalysis.length}: "${transcription.substring(0, 50)}..."`);
  }

  /**
   * Reset accumulated transcripts after analysis
   */
  resetAccumulatedTranscripts(): void {
    console.log(`🔄 Resetting accumulated transcripts (had ${this.transcriptsSinceLastAnalysis.length})`);
    this.transcriptsSinceLastAnalysis = [];
    this.lastAnalysisTime = Date.now();
  }

  /**
   * Start automatic calibration process
   * Measures noise floor for 3 seconds and sets threshold accordingly
   */
  async startCalibration(): Promise<{ success: boolean; threshold: number; noiseFloor: number }> {
    if (!this.analyser || !this.isActive) {
      return { success: false, threshold: this.silenceThreshold, noiseFloor: -Infinity };
    }

    console.log('🎯 Starting audio calibration (3 seconds)...');
    console.log('   Please remain quiet to measure noise floor');
    
    this.isCalibrating = true;
    this.calibrationSamples = [];

    // Wait for calibration duration
    await new Promise(resolve => setTimeout(resolve, this.CALIBRATION_DURATION));

    this.isCalibrating = false;

    if (this.calibrationSamples.length === 0) {
      console.log('❌ Calibration failed: No samples collected');
      return { success: false, threshold: this.silenceThreshold, noiseFloor: -Infinity };
    }

    // Calculate noise floor (average of samples)
    const noiseFloor = this.calibrationSamples.reduce((a, b) => a + b, 0) / this.calibrationSamples.length;
    this.lastNoiseFloor = noiseFloor;
    
    // Set threshold above noise floor using current margin
    const newThreshold = noiseFloor + this.calibrationMargin;
    
    console.log(`✅ Calibration complete:`);
    console.log(`   Noise floor: ${noiseFloor.toFixed(1)}dB`);
    console.log(`   New threshold: ${newThreshold.toFixed(1)}dB (${this.calibrationMargin}dB margin)`);
    console.log(`   Samples collected: ${this.calibrationSamples.length}`);

    this.silenceThreshold = newThreshold;
    
    // Save to localStorage
    localStorage.setItem('grimlog-audio-threshold', newThreshold.toString());
    localStorage.setItem('grimlog-noise-floor', noiseFloor.toString());

    return { success: true, threshold: newThreshold, noiseFloor };
  }

  /**
   * Get current audio level for display
   */
  getCurrentLevel(): number {
    return this.currentAudioLevel;
  }

  /**
   * Get current threshold
   */
  getThreshold(): number {
    return this.silenceThreshold;
  }

  /**
   * Manually set threshold (for advanced users)
   */
  setThreshold(threshold: number): void {
    this.silenceThreshold = threshold;
    localStorage.setItem('grimlog-audio-threshold', threshold.toString());
    console.log(`🔧 Threshold manually set to ${threshold.toFixed(1)}dB`);
  }

  /**
   * Reset to default threshold
   */
  resetThreshold(): void {
    this.silenceThreshold = this.DEFAULT_THRESHOLD;
    localStorage.removeItem('grimlog-audio-threshold');
    console.log(`🔄 Threshold reset to default: ${this.DEFAULT_THRESHOLD}dB`);
  }

  /**
   * Adjust the calibration margin and recalculate threshold
   * @param margin - dB above noise floor
   */
  setCalibrationMargin(margin: number): void {
    this.calibrationMargin = margin;
    localStorage.setItem('grimlog-audio-margin', margin.toString());
    
    // If we have a noise floor, recalculate threshold
    if (this.lastNoiseFloor > -Infinity) {
      const newThreshold = this.lastNoiseFloor + margin;
      this.silenceThreshold = newThreshold;
      localStorage.setItem('grimlog-audio-threshold', newThreshold.toString());
      console.log(`🔧 Margin adjusted to ${margin.toFixed(1)}dB, threshold now ${newThreshold.toFixed(1)}dB`);
    }
  }

  /**
   * Get current calibration margin
   */
  getCalibrationMargin(): number {
    return this.calibrationMargin;
  }

  /**
   * Get last measured noise floor
   */
  getNoiseFloor(): number {
    return this.lastNoiseFloor;
  }
}

