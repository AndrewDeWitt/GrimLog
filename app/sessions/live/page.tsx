'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Timeline from '@/components/Timeline';
import GrimlogFrame from '@/components/MechanicusFrame';
import ConfirmDialog from '@/components/ConfirmDialog';
import Toast from '@/components/Toast';
import ValidationToast from '@/components/ValidationToast';
import GameStateDisplay from '@/components/GameStateDisplay';
import UnitHealthSheet from '@/components/UnitHealthSheet';
import SettingsModal from '@/components/SettingsModal';
import HamburgerMenu from '@/components/HamburgerMenu';
import CompactAudioStatus from '@/components/CompactAudioStatus';
import HeaderSpeechStatus from '@/components/HeaderSpeechStatus';
import AuthModal from '@/components/AuthModal';
import TacticalAdvisorModal from '@/components/TacticalAdvisorModal';
import SecondaryModal from '@/components/SecondaryModal';
import type { MissionMode } from '@/lib/types';
import StratagemLoggerModal from '@/components/StratagemLoggerModal';
import DamageCalculatorModal from '@/components/tools/DamageCalculatorModal';
import DamageResultsModal, { DamageCalculationResult } from '@/components/DamageResultsModal';
import { SpeechRecognitionManager } from '@/lib/speechRecognition';
import { GamePhase, TimelineEventData, AudioAnalysisResult, ValidationResult } from '@/lib/types';
import { checkAnalysisTriggers } from '@/lib/analysisTriggers';
import { useAuth } from '@/lib/auth/AuthContext';
import { useSession, fetchSessionEvents, SessionData } from '@/lib/hooks/useSession';
import { debounce, invalidateCache, invalidateCachePattern } from '@/lib/requestCache';

export default function LiveSessionPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [adminCheckDone, setAdminCheckDone] = useState(false);
  const [currentPhase, setCurrentPhase] = useState<GamePhase>('Command');
  const [currentTurn, setCurrentPlayerTurn] = useState<'attacker' | 'defender'>('attacker');
  const [firstTurn, setFirstTurn] = useState<'attacker' | 'defender'>('attacker');
  const [battleRound, setBattleRound] = useState(1);
  const [timelineEvents, setTimelineEvents] = useState<TimelineEventData[]>([]);
  const [audioStatus, setAudioStatus] = useState<'idle' | 'listening' | 'processing'>('idle');
  const [speechManager, setSpeechManager] = useState<SpeechRecognitionManager | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [isUnitsModalOpen, setIsUnitsModalOpen] = useState(false);
  const [unitsRefreshKey, setUnitsRefreshKey] = useState(0); // Increment to force UnitHealthSheet refetch
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isTacticalAdvisorOpen, setIsTacticalAdvisorOpen] = useState(false);
  const [isSecondariesModalOpen, setIsSecondariesModalOpen] = useState(false);
  const [secondariesInitialTab, setSecondariesInitialTab] = useState<'attacker' | 'defender'>('attacker');
  const [isStratagemLoggerOpen, setIsStratagemLoggerOpen] = useState(false);
  const [isDamageCalculatorOpen, setIsDamageCalculatorOpen] = useState(false);
  const [isDamageResultsOpen, setIsDamageResultsOpen] = useState(false);
  const [damageResults, setDamageResults] = useState<DamageCalculationResult[]>([]);
  
  // Live captions state
  const [interimTranscript, setInterimTranscript] = useState<string>('');
  const [finalTranscript, setFinalTranscript] = useState<string>('');
  const [speechHistory, setSpeechHistory] = useState<string[]>([]);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  
  // Dialog and notification states
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    variant?: 'danger' | 'warning' | 'info';
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
  });
  
  const [toast, setToast] = useState<{
    isVisible: boolean;
    message: string;
    type: 'success' | 'error' | 'info' | 'warning';
  }>({
    isVisible: false,
    message: '',
    type: 'info',
  });
  
  // Validation warnings state
  const [validationWarnings, setValidationWarnings] = useState<Array<{
    id: string;
    validation: ValidationResult;
    toolName: string;
    toolMessage: string;
  }>>([]);
  
  const [isLoading, setIsLoading] = useState(false);
  
  // Game state tracking
  const [playerCP, setPlayerCP] = useState(0);
  const [opponentCP, setOpponentCP] = useState(0);
  const [playerVP, setPlayerVP] = useState(0);
  const [opponentVP, setOpponentVP] = useState(0);
  const [attackerSecondaries, setPlayerSecondaries] = useState<string[]>([]);
  const [defenderSecondaries, setOpponentSecondaries] = useState<string[]>([]);
  const [attackerSecondaryProgress, setPlayerSecondaryProgress] = useState<any>({});
  const [defenderSecondaryProgress, setOpponentSecondaryProgress] = useState<any>({});
  const [playerDiscarded, setPlayerDiscarded] = useState<string[]>([]);
  const [opponentDiscarded, setOpponentDiscarded] = useState<string[]>([]);
  const [playerExtraCP, setPlayerExtraCP] = useState(false);
  const [opponentExtraCP, setOpponentExtraCP] = useState(false);
  const [allSecondaries, setAllSecondaries] = useState<any[]>([]);
  const [missionMode, setMissionMode] = useState<MissionMode>('tactical');
  const [playerObjectivesHeld, setPlayerObjectivesHeld] = useState(0);
  const [opponentObjectivesHeld, setOpponentObjectivesHeld] = useState(0);
  const [deploymentType, setDeploymentType] = useState<string>('crucible-of-battle');
  const [objectiveMarkers, setObjectiveMarkers] = useState<Array<{
    objectiveNumber: number;
    controlledBy: 'attacker' | 'defender' | 'contested' | 'none';
    controllingUnit?: string;
  }>>([]);
  
  // Army identification
  const [attackerArmyName, setAttackerArmyName] = useState<string>('');
  const [attackerFaction, setAttackerFaction] = useState<string>('');
  const [defenderArmyName, setDefenderArmyName] = useState<string>('');
  const [defenderFactionName, setDefenderFactionName] = useState<string>('');
  
  // Toast helper
  const showToast = (message: string, type: 'success' | 'error' | 'info' | 'warning' = 'info') => {
    setToast({ isVisible: true, message, type });
  };

  // Validation warning handlers
  const dismissValidationWarning = (warningId: string) => {
    setValidationWarnings(prev => prev.filter(w => w.id !== warningId));
  };

  const handleValidationOverride = async (warningId: string) => {
    const warning = validationWarnings.find(w => w.id === warningId);
    if (!warning) return;

    console.log('User overrode validation warning:', {
      warningId,
      toolName: warning.toolName,
      severity: warning.validation.severity,
      rule: warning.validation.rule,
    });

    // Log override event to database (optional - for Phase 4)
    if (currentSessionId) {
      try {
        await fetch(`/api/sessions/${currentSessionId}/events`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            eventType: 'custom',
            phase: currentPhase,
            description: `Validation override: ${warning.validation.message}`,
            metadata: JSON.stringify({
              warningId,
              toolName: warning.toolName,
              severity: warning.validation.severity,
              rule: warning.validation.rule,
              wasOverridden: true,
            }),
            timestamp: new Date().toISOString()
          })
        });
      } catch (error) {
        console.error('Failed to log override event:', error);
        // Don't block on logging failure
      }
    }

    // Show confirmation toast
    showToast(`Override accepted: ${warning.toolName}`, 'info');

    // Remove warning from UI
    dismissValidationWarning(warningId);
  };

  // Add global error handler for unhandled promise rejections
  useEffect(() => {
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      console.error('Unhandled promise rejection:', event.reason);
      event.preventDefault(); // Prevent default browser behavior (page reload)
      showToast('An unexpected error occurred', 'error');
    };

    window.addEventListener('unhandledrejection', handleUnhandledRejection);
    
    return () => {
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    };
  }, []);

  // Keyboard shortcut for Tactical Advisor (Shift+S)
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.shiftKey && e.key === 'S' && currentSessionId && !isTacticalAdvisorOpen) {
        e.preventDefault();
        setIsTacticalAdvisorOpen(true);
      }
    };
    
    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [currentSessionId, isTacticalAdvisorOpen]);

  // Use custom session hook with caching
  const savedSessionId = typeof window !== 'undefined' 
    ? localStorage.getItem('grimlog-current-session') 
    : null;
  
  const { session: sessionData, loading: sessionLoading } = useSession(
    user && !authLoading ? savedSessionId : null,
    { ttl: 30000, autoFetch: true }
  );

  // Check admin status and redirect non-admin users to brief
  useEffect(() => {
    const checkAdminStatus = async () => {
      if (!user) {
        setIsAdmin(null);
        setAdminCheckDone(true);
        return;
      }
      
      try {
        const response = await fetch('/api/users/credits');
        if (response.ok) {
          const data = await response.json();
          setIsAdmin(data.isAdmin);
          
          // Redirect non-admin users to brief
          if (!data.isAdmin) {
            router.push('/brief');
            return;
          }
        }
      } catch (error) {
        console.error('Failed to check admin status:', error);
      }
      setAdminCheckDone(true);
    };
    
    if (!authLoading) {
      checkAdminStatus();
    }
  }, [authLoading, user, router]);
  
  // Show auth modal when user is not authenticated
  useEffect(() => {
    if (!authLoading && !user) {
      setShowAuthModal(true);
    }
  }, [authLoading, user]);

  // Fetch all secondaries once on mount
  useEffect(() => {
    const fetchAllSecondaries = async () => {
      try {
        const response = await fetch('/api/secondaries');
        if (response.ok) {
          const data = await response.json();
          setAllSecondaries(data.secondaries || []);
        }
      } catch (error) {
        console.error('Error fetching secondaries:', error);
      }
    };
    
    if (user && !authLoading) {
      fetchAllSecondaries();
    }
  }, [user, authLoading]);

  // Restore game state from session data when it loads
  useEffect(() => {
    if (!sessionData) return;

    console.log('Restoring session:', sessionData.id);
    setCurrentSessionId(sessionData.id);
    
    // Restore game state
    setCurrentPhase(sessionData.currentPhase as GamePhase);
    setCurrentPlayerTurn(sessionData.currentTurn as 'attacker' | 'defender');
    setFirstTurn(sessionData.firstTurn as 'attacker' | 'defender' || 'attacker');
    setBattleRound(sessionData.battleRound);
    setDeploymentType(sessionData.deploymentType || 'crucible-of-battle');
    setMissionMode('tactical' as MissionMode); // Default to tactical mission mode
    setPlayerCP(sessionData.attackerCommandPoints || 0);
    setOpponentCP(sessionData.defenderCommandPoints || 0);
    setPlayerVP(sessionData.attackerVictoryPoints || 0);
    setOpponentVP(sessionData.defenderVictoryPoints || 0);
    
    // Parse and restore secondaries
    if (sessionData.attackerSecondaries) {
      try {
        setPlayerSecondaries(JSON.parse(sessionData.attackerSecondaries));
      } catch (e) {
        setPlayerSecondaries([]);
      }
    } else {
      setPlayerSecondaries([]);
    }
    
    if (sessionData.defenderSecondaries) {
      try {
        setOpponentSecondaries(JSON.parse(sessionData.defenderSecondaries));
      } catch (e) {
        setOpponentSecondaries([]);
      }
    } else {
      setOpponentSecondaries([]);
    }
    
    // Parse and restore secondary progress
    if (sessionData.attackerSecondaryProgress) {
      try {
        setPlayerSecondaryProgress(JSON.parse(sessionData.attackerSecondaryProgress));
      } catch (e) {
        setPlayerSecondaryProgress({});
      }
    } else {
      setPlayerSecondaryProgress({});
    }
    
    if (sessionData.defenderSecondaryProgress) {
      try {
        setOpponentSecondaryProgress(JSON.parse(sessionData.defenderSecondaryProgress));
      } catch (e) {
        setOpponentSecondaryProgress({});
      }
    } else {
      setOpponentSecondaryProgress({});
    }
    
    // Parse and restore discarded secondaries
    if (sessionData.attackerDiscardedSecondaries) {
      try {
        setPlayerDiscarded(JSON.parse(sessionData.attackerDiscardedSecondaries));
      } catch (e) {
        setPlayerDiscarded([]);
      }
    } else {
      setPlayerDiscarded([]);
    }
    
    if (sessionData.defenderDiscardedSecondaries) {
      try {
        setOpponentDiscarded(JSON.parse(sessionData.defenderDiscardedSecondaries));
      } catch (e) {
        setOpponentDiscarded([]);
      }
    } else {
      setOpponentDiscarded([]);
    }
    
    // Restore extra CP flags
    setPlayerExtraCP(sessionData.attackerExtraCPGainedThisTurn || false);
    setOpponentExtraCP(sessionData.defenderExtraCPGainedThisTurn || false);
    
    // Restore objectives
    if (sessionData.objectiveMarkers) {
      const playerObjs = sessionData.objectiveMarkers.filter((obj: any) => obj.controlledBy === 'attacker').length;
      const opponentObjs = sessionData.objectiveMarkers.filter((obj: any) => obj.controlledBy === 'defender').length;
      setPlayerObjectivesHeld(playerObjs);
      setOpponentObjectivesHeld(opponentObjs);
      setObjectiveMarkers(sessionData.objectiveMarkers);
    }
    
    // Restore army identification
    if (sessionData.attackerArmy) {
      setAttackerArmyName(sessionData.attackerArmy.name || '');
      setAttackerFaction(sessionData.attackerArmy.player?.faction || '');
    }
    setDefenderArmyName(sessionData.defenderName || '');
    setDefenderFactionName(sessionData.defenderFaction || '');
    
    showToast('Session restored successfully', 'success');
  }, [sessionData]);

  // Helper function to refresh timeline events
  const refreshTimeline = useCallback(async () => {
    if (!currentSessionId) return;
    
    try {
      const events = await fetchSessionEvents(currentSessionId, { skipCache: true });
      setTimelineEvents(events.map((e: any) => ({
        id: e.id,
        timestamp: new Date(e.timestamp),
        eventType: e.eventType,
        phase: e.phase,
        description: e.description,
        metadata: e.metadata ? JSON.parse(e.metadata) : undefined,
        // Revert tracking fields
        isReverted: e.isReverted || false,
        revertedAt: e.revertedAt,
        revertedBy: e.revertedBy,
        revertReason: e.revertReason,
        revertedEventId: e.revertedEventId,
        cascadedFrom: e.cascadedFrom
      })));
      console.log(`Refreshed ${events.length} timeline events`);
    } catch (error) {
      console.error('Failed to refresh timeline events:', error);
    }
  }, [currentSessionId]);

  // Load timeline events when session is restored
  useEffect(() => {
    const loadTimelineEvents = async () => {
      if (!currentSessionId) return;
      
      try {
        const events = await fetchSessionEvents(currentSessionId);
        setTimelineEvents(events.map((e: any) => ({
          id: e.id,
          timestamp: new Date(e.timestamp),
          eventType: e.eventType,
          phase: e.phase,
          description: e.description,
          metadata: e.metadata ? JSON.parse(e.metadata) : undefined,
          // Revert tracking fields
          isReverted: e.isReverted || false,
          revertedAt: e.revertedAt,
          revertedBy: e.revertedBy,
          revertReason: e.revertReason,
          revertedEventId: e.revertedEventId,
          cascadedFrom: e.cascadedFrom
        })));
        console.log(`Loaded ${events.length} timeline events from cache/database`);
      } catch (error) {
        console.error('Failed to load timeline events:', error);
      }
    };

    loadTimelineEvents();
  }, [currentSessionId]);

  // Save timeline to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem('wh40k-timeline', JSON.stringify({
      events: timelineEvents,
      currentPhase,
      battleRound,
    }));
  }, [timelineEvents, currentPhase, battleRound]);

  // Actual function that sends accumulated transcripts to /api/analyze
  const sendAccumulatedTranscripts = useCallback(async (sessionId: string, transcripts: string[]) => {
    // Join accumulated transcripts into a single context
    const fullTranscription = transcripts.join(' ').trim();
    if (!fullTranscription) return;

    console.log(`📤 Sending accumulated transcripts (${transcripts.length} segments): "${fullTranscription.substring(0, 100)}..."`);

    try {
      setAudioStatus('processing');
      
      // Create new AbortController for this request
      const abortController = new AbortController();
      analyzeAbortControllerRef.current = abortController;

      // Send text to /api/analyze
      const formData = new FormData();
      formData.append('transcription', fullTranscription);
      formData.append('sessionId', sessionId);
      formData.append('armyContext', ''); // TODO: Add army context from database

      const response = await fetch('/api/analyze', {
        method: 'POST',
        body: formData,
        signal: abortController.signal,
      });

      // Clear abort controller after successful response
      analyzeAbortControllerRef.current = null;

      if (!response.ok) {
        // Handle session not found error (old/invalid session ID)
        if (response.status === 404) {
          const errorData = await response.json();
          console.error('Session error:', errorData.error);
          
          // Clear invalid session
          setCurrentSessionId(null);
          localStorage.removeItem('grimlog-current-session');
          
          // Stop speech recognition
          speechManager?.stop();
          setSpeechManager(null);
          setIsInitialized(false);
          setAudioStatus('idle');
          
          showToast('Session expired. Please click START to begin a new game.', 'error');
          return;
        }
        throw new Error('Analysis failed');
      }

      const result = await response.json();
      
      // Check if analysis was performed (vs transcribe-only)
      if (!result.analyzed) {
        // Server decided not to analyze - just transcribed
        console.log(`📝 Server transcribed only: ${result.reason || 'No analysis needed'}`);
        
        setAudioStatus('listening');
        return;
      }
      
      // Server performed full analysis
      console.log(`🤖 Server performed FULL ANALYSIS`);
      
      // Reset accumulated transcripts since analysis was done
      speechManager?.resetAccumulatedTranscripts();

      // Handle tool execution results from full analysis
      if (result.toolCalls && result.toolCalls.length > 0) {
        console.log('Tool calls executed:', result.toolCalls);
        
        // Process validation warnings and show appropriate notifications
        const newValidationWarnings: any[] = [];
        const newDamageResults: DamageCalculationResult[] = [];
        
        for (const toolCall of result.toolCalls) {
          // Special handling for damage estimate results - show in modal instead of toast
          if (toolCall.toolName === 'estimate_damage' && toolCall.success && toolCall.data) {
            const damageResult: DamageCalculationResult = {
              id: crypto.randomUUID(),
              timestamp: new Date(),
              attacker: toolCall.data.attacker,
              defender: toolCall.data.defender,
              weapon: toolCall.data.weapon,
              phase: toolCall.data.phase || 'Shooting',
              modifiers: toolCall.data.modifiers || [],
              stats: toolCall.data.stats,
              allWeapons: toolCall.data.allWeapons,
              extraAttacks: toolCall.data.extraAttacks,
            };
            newDamageResults.push(damageResult);
            
            // Also save as timeline event for later review
            const damageEvent: TimelineEventData = {
              id: damageResult.id,
              timestamp: new Date(),
              eventType: 'custom',
              phase: currentPhase,
              description: `Damage calc: ${damageResult.attacker} → ${damageResult.defender} (${damageResult.stats.expected_damage.toFixed(1)} dmg, ${damageResult.stats.models_killed.toFixed(1)} kills)`,
              metadata: {
                type: 'damage_calculation',
                ...toolCall.data
              },
            };
            saveEventToDatabase(damageEvent);
            
            continue; // Skip normal toast handling
          }
          
          // Check if this tool call has a validation warning
          if (toolCall.validation) {
            // Add to validation warnings list
            newValidationWarnings.push({
              id: crypto.randomUUID(),
              validation: toolCall.validation,
              toolName: toolCall.toolName,
              toolMessage: toolCall.message
            });
          } else {
            // No validation issues - show normal toast
            if (toolCall.success) {
              showToast(toolCall.message, 'success');
            } else {
              showToast(`Failed: ${toolCall.message}`, 'error');
            }
          }
        }
        
        // Add damage results and open modal if any
        if (newDamageResults.length > 0) {
          setDamageResults(prev => [...newDamageResults, ...prev]); // Newest first
          setIsDamageResultsOpen(true);
        }
        
        // Add validation warnings to state
        if (newValidationWarnings.length > 0) {
          setValidationWarnings(prev => [...prev, ...newValidationWarnings]);
        }
        
        // Refresh game state from database to sync with tool changes
        // Use try-catch to prevent refresh errors from breaking the flow
        try {
          await refreshGameState();
        } catch (refreshError) {
          console.error('Failed to refresh game state:', refreshError);
          // Don't show error toast - not critical if refresh fails
        }
      }
      
      // Legacy support for old response format (will be removed)
      if (result.type === 'phase' && result.phase) {
        setCurrentPhase(result.phase);
      } else if (result.type === 'event' && result.event) {
        const newEvent: TimelineEventData = {
          id: crypto.randomUUID(),
          timestamp: new Date(),
          eventType: result.event.type,
          phase: currentPhase,
          description: result.event.description,
          metadata: result.event.metadata,
        };
        setTimelineEvents(prev => [...prev, newEvent]);
        await saveEventToDatabase(newEvent);
      }

      setAudioStatus('listening');
    } catch (error) {
      // Handle abort errors gracefully - these are expected when new speech arrives
      if (error instanceof Error && error.name === 'AbortError') {
        console.log('🔄 Previous analyze request aborted (new speech received)');
        return; // Don't show error, this is expected
      }
      
      console.error('Error processing transcription:', error);
      showToast('Failed to process transcription', 'error');
      setAudioStatus('listening');
    }
    // Note: refreshGameState is intentionally excluded from deps - it's called asynchronously
    // after debounce when it will be defined. Including it causes circular reference issues.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [speechManager, currentPhase]);

  // Handler for when Speech API gives us final transcription
  // Uses debounce buffer to accumulate speech before sending to AI
  const handleFinalTranscript = useCallback((transcription: string) => {
    if (!currentSessionId) {
      console.error('No active session - cannot process transcription');
      showToast('No active session', 'error');
      return;
    }

    // Update UI immediately with the transcript
    setFinalTranscript(transcription);
    setSpeechHistory(prev => [transcription, ...prev].slice(0, 20));
    
    // Check for Strategic Assistant voice triggers (immediate, no debounce)
    const lowerTranscript = transcription.toLowerCase();
    const strategicKeywords = [
      'what can i do',
      'what should i watch',
      'show strategic',
      'open strategic',
      'strategic assistant',
      'what stratagems',
      'what abilities'
    ];
    
    const hasStrategicKeyword = strategicKeywords.some(kw => lowerTranscript.includes(kw));
    
    if (hasStrategicKeyword) {
      // Clear pending buffer - user wants assistant instead
      pendingTranscriptsRef.current = [];
      bufferStartTimeRef.current = null;
      if (analyzeDebounceTimeoutRef.current) {
        clearTimeout(analyzeDebounceTimeoutRef.current);
        analyzeDebounceTimeoutRef.current = null;
      }
      if (analyzeCeilingTimeoutRef.current) {
        clearTimeout(analyzeCeilingTimeoutRef.current);
        analyzeCeilingTimeoutRef.current = null;
      }
      
      setIsTacticalAdvisorOpen(true);
      showToast('Opening Tactical Advisor', 'info');
      return;
    }

    // Abort any in-flight analyze request - new speech has more complete context
    if (analyzeAbortControllerRef.current) {
      console.log('🛑 Aborting previous analyze request (more speech incoming)');
      analyzeAbortControllerRef.current.abort();
      analyzeAbortControllerRef.current = null;
    }

    // Add to pending transcripts buffer
    pendingTranscriptsRef.current.push(transcription);
    
    // Track when we started buffering (for ceiling timeout)
    if (bufferStartTimeRef.current === null) {
      bufferStartTimeRef.current = Date.now();
      
      // Set ceiling timeout - force analysis after max buffer time
      if (analyzeCeilingTimeoutRef.current) {
        clearTimeout(analyzeCeilingTimeoutRef.current);
      }
      const sessionIdForCeiling = currentSessionId;
      analyzeCeilingTimeoutRef.current = setTimeout(() => {
        console.log(`⏱️ Ceiling reached (${ANALYZE_CEILING_MS}ms) - forcing analysis`);
        triggerAnalysis(sessionIdForCeiling);
      }, ANALYZE_CEILING_MS);
    }
    
    // Check for game keywords to determine debounce time (keyword boosting)
    const allPendingText = pendingTranscriptsRef.current.join(' ').toLowerCase();
    const hasGameKeyword = GAME_KEYWORDS.some(kw => allPendingText.includes(kw));
    const debounceTime = hasGameKeyword ? ANALYZE_DEBOUNCE_FAST_MS : ANALYZE_DEBOUNCE_MS;
    
    console.log(`📝 Buffered transcript (${pendingTranscriptsRef.current.length} pending, ${hasGameKeyword ? 'FAST' : 'normal'} debounce): "${transcription}"`);

    // Clear existing debounce timeout
    if (analyzeDebounceTimeoutRef.current) {
      clearTimeout(analyzeDebounceTimeoutRef.current);
    }

    // Set status to show we're collecting speech
    setAudioStatus('listening');

    // Start debounce timer - send after silence period
    const sessionIdSnapshot = currentSessionId;
    analyzeDebounceTimeoutRef.current = setTimeout(() => {
      triggerAnalysis(sessionIdSnapshot);
    }, debounceTime);
  }, [currentSessionId, sendAccumulatedTranscripts]);
  
  // Helper function to trigger analysis with all checks
  const triggerAnalysis = useCallback((sessionId: string) => {
    // Clear all timeouts
    if (analyzeDebounceTimeoutRef.current) {
      clearTimeout(analyzeDebounceTimeoutRef.current);
      analyzeDebounceTimeoutRef.current = null;
    }
    if (analyzeCeilingTimeoutRef.current) {
      clearTimeout(analyzeCeilingTimeoutRef.current);
      analyzeCeilingTimeoutRef.current = null;
    }
    
    // Capture and clear the pending transcripts
    const transcriptsToSend = [...pendingTranscriptsRef.current];
    pendingTranscriptsRef.current = [];
    bufferStartTimeRef.current = null;
    
    if (transcriptsToSend.length === 0) {
      return;
    }
    
    // Join all transcripts and check minimum word count
    const fullText = transcriptsToSend.join(' ').trim();
    const wordCount = fullText.split(/\s+/).filter(w => w.length > 0).length;
    
    if (wordCount < ANALYZE_MIN_WORDS) {
      console.log(`📝 Skipping analysis - only ${wordCount} word(s), need at least ${ANALYZE_MIN_WORDS}`);
      return;
    }
    
    console.log(`⏱️ Debounce complete - sending ${transcriptsToSend.length} transcript(s), ${wordCount} words`);
    sendAccumulatedTranscripts(sessionId, transcriptsToSend);
  }, [sendAccumulatedTranscripts]);

  const startListening = async () => {
    // Require session before starting
    if (!currentSessionId) {
      showToast('Please create a battle session first', 'warning');
      return;
    }

    // Check browser support
    if (!SpeechRecognitionManager.isSupported()) {
      showToast('Speech recognition not supported. Please use Chrome or Edge browser.', 'error');
      return;
    }

    setIsLoading(true);
    try {
      const manager = new SpeechRecognitionManager({
        onInterimTranscript: (text: string) => {
          setInterimTranscript(text); // Live captions
        },
        onFinalTranscript: handleFinalTranscript, // Process when complete
        onStatusChange: setAudioStatus,
        onError: (error: string) => {
          console.error('Speech recognition error:', error);
          showToast(error, 'error');
        },
        language: 'en-US',
        continuous: true
      });
      
      await manager.initialize();
      setSpeechManager(manager);
      setIsInitialized(true);
      
      showToast('Speech recognition started', 'success');
    } catch (error) {
      console.error('Failed to start speech recognition:', error);
      showToast('Failed to start speech recognition. Please allow microphone permission.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const stopListening = () => {
    speechManager?.stop();
    setSpeechManager(null);
    setIsInitialized(false);
    setAudioStatus('idle');
    setInterimTranscript('');
    setFinalTranscript('');
    
    // Clean up any pending debounce/ceiling timeouts
    if (analyzeDebounceTimeoutRef.current) {
      clearTimeout(analyzeDebounceTimeoutRef.current);
      analyzeDebounceTimeoutRef.current = null;
    }
    if (analyzeCeilingTimeoutRef.current) {
      clearTimeout(analyzeCeilingTimeoutRef.current);
      analyzeCeilingTimeoutRef.current = null;
    }
    pendingTranscriptsRef.current = [];
    bufferStartTimeRef.current = null;
    
    showToast('Speech recognition stopped', 'info');
    // Note: We don't end the session here - user can resume
  };

  const endGame = () => {
    if (!currentSessionId) return;

    setConfirmDialog({
      isOpen: true,
      title: 'END GAME SESSION',
      message: 'End this game session? You can view it later in past games.',
      variant: 'warning',
      onConfirm: async () => {
        setIsLoading(true);
        try {
          // Stop speech recognition if active
          if (speechManager) {
            speechManager.stop();
            setSpeechManager(null);
            setIsInitialized(false);
            setAudioStatus('idle');
            setInterimTranscript('');
            setFinalTranscript('');
          }

          // Mark session as ended
          await fetch(`/api/sessions/${currentSessionId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              endTime: new Date().toISOString(),
              isActive: false
            })
          });

          // Invalidate sessions cache so the list reflects the ended session
          invalidateCache('/api/sessions');

          // Clear current session
          setCurrentSessionId(null);
          localStorage.removeItem('grimlog-current-session');
          
          // Reset UI state
          setTimelineEvents([]);
          setCurrentPhase('Command');
          setBattleRound(1);
          setInterimTranscript('');
          setFinalTranscript('');

          showToast('Game session ended', 'success');
          console.log('Game session ended');
        } catch (error) {
          console.error('Error ending session:', error);
          showToast('Failed to end session', 'error');
        } finally {
          setIsLoading(false);
        }
      }
    });
  };

  const clearTimeline = () => {
    setConfirmDialog({
      isOpen: true,
      title: 'CLEAR TIMELINE',
      message: 'Clear timeline for this session? This only clears the display. Database events will remain for replay.',
      variant: 'info',
      onConfirm: () => {
        setTimelineEvents([]);
        showToast('Timeline cleared', 'info');
      }
    });
  };

  const saveEventToDatabase = async (event: TimelineEventData) => {
    if (!currentSessionId) return;

    try {
      const response = await fetch(`/api/sessions/${currentSessionId}/events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventType: event.eventType,
          phase: event.phase,
          description: event.description,
          metadata: event.metadata ? JSON.stringify(event.metadata) : null,
          timestamp: event.timestamp.toISOString()
        })
      });
      
      if (!response.ok) {
        throw new Error('Failed to save event');
      }
    } catch (error) {
      console.error('Failed to save event to database:', error);
      showToast('Warning: Failed to save event to database', 'warning');
      // Don't block UI on DB errors
    }
  };

  // Handle clicking on a damage_calc timeline event to view its details
  const handleDamageCalcClick = useCallback((event: TimelineEventData) => {
    // Check for custom event with damage_calculation type in metadata
    if (event.eventType !== 'custom' || !event.metadata || event.metadata.type !== 'damage_calculation') return;
    
    const meta = event.metadata;
    
    // Convert timeline event metadata back to DamageCalculationResult format
    const damageResult: DamageCalculationResult = {
      id: event.id,
      timestamp: new Date(event.timestamp),
      attacker: meta.attacker || 'Unknown',
      defender: meta.defender || 'Unknown',
      weapon: meta.weapon || 'Unknown',
      phase: meta.phase || event.phase || 'Fight',
      modifiers: meta.modifiers || [],
      stats: meta.stats || {
        expected_hits: 0,
        expected_wounds: 0,
        expected_unsaved: 0,
        expected_damage: 0,
        models_killed: 0,
        mortal_wounds: 0,
        hit_rate: 0,
        wound_rate: 0,
        save_rate: 0,
        crit_hit_chance: 0,
        crit_wound_chance: 0,
      },
      allWeapons: meta.allWeapons,
      extraAttacks: meta.extraAttacks,
    };
    
    // Set this as the only result in the modal (replace existing)
    setDamageResults([damageResult]);
    setIsDamageResultsOpen(true);
  }, []);

  // Debounced refresh to prevent rapid successive calls
  const refreshGameState = useCallback(async () => {
    if (!currentSessionId) return;

    try {
      // Force skip cache to get fresh data
      const response = await fetch(`/api/sessions/${currentSessionId}`, {
        cache: 'no-store'
      });
      if (!response.ok) {
        throw new Error('Failed to fetch session');
      }

      const session: SessionData = await response.json();
      
      // Update UI with latest state from database
      setCurrentPhase(session.currentPhase as GamePhase);
      setCurrentPlayerTurn(session.currentTurn as 'attacker' | 'defender');
      setBattleRound(session.battleRound);
      setDeploymentType(session.deploymentType || 'crucible-of-battle');
      setMissionMode('tactical' as MissionMode); // Default to tactical mission mode
      setPlayerCP(session.attackerCommandPoints || 0);
      setOpponentCP(session.defenderCommandPoints || 0);
      setPlayerVP(session.attackerVictoryPoints || 0);
      setOpponentVP(session.defenderVictoryPoints || 0);
      
      // Parse secondaries from JSON
      if (session.attackerSecondaries) {
        try {
          setPlayerSecondaries(JSON.parse(session.attackerSecondaries));
        } catch (e) {
          setPlayerSecondaries([]);
        }
      } else {
        setPlayerSecondaries([]);
      }
      
      if (session.defenderSecondaries) {
        try {
          setOpponentSecondaries(JSON.parse(session.defenderSecondaries));
        } catch (e) {
          setOpponentSecondaries([]);
        }
      } else {
        setOpponentSecondaries([]);
      }
      
      // Parse secondary progress from JSON
      if (session.attackerSecondaryProgress) {
        try {
          setPlayerSecondaryProgress(JSON.parse(session.attackerSecondaryProgress));
        } catch (e) {
          setPlayerSecondaryProgress({});
        }
      } else {
        setPlayerSecondaryProgress({});
      }
      
      if (session.defenderSecondaryProgress) {
        try {
          setOpponentSecondaryProgress(JSON.parse(session.defenderSecondaryProgress));
        } catch (e) {
          setOpponentSecondaryProgress({});
        }
      } else {
        setOpponentSecondaryProgress({});
      }
      
      // Parse discarded secondaries from JSON
      if (session.attackerDiscardedSecondaries) {
        try {
          setPlayerDiscarded(JSON.parse(session.attackerDiscardedSecondaries));
        } catch (e) {
          setPlayerDiscarded([]);
        }
      } else {
        setPlayerDiscarded([]);
      }
      
      if (session.defenderDiscardedSecondaries) {
        try {
          setOpponentDiscarded(JSON.parse(session.defenderDiscardedSecondaries));
        } catch (e) {
          setOpponentDiscarded([]);
        }
      } else {
        setOpponentDiscarded([]);
      }
      
      // Update extra CP flags
      setPlayerExtraCP(session.attackerExtraCPGainedThisTurn || false);
      setOpponentExtraCP(session.defenderExtraCPGainedThisTurn || false);
      
      console.log('Game state refreshed:', {
        phase: session.currentPhase,
        round: session.battleRound,
        playerCP: session.attackerCommandPoints,
        opponentCP: session.defenderCommandPoints,
        playerVP: session.attackerVictoryPoints,
        opponentVP: session.defenderVictoryPoints
      });

      // Count objectives from objectiveMarkers
      if (session.objectiveMarkers) {
        const playerObjs = session.objectiveMarkers.filter((obj: any) => obj.controlledBy === 'attacker').length;
        const opponentObjs = session.objectiveMarkers.filter((obj: any) => obj.controlledBy === 'defender').length;
        console.log('📊 Objective counts from refresh:', {
          playerObjs,
          opponentObjs,
          totalMarkers: session.objectiveMarkers.length,
          markers: session.objectiveMarkers
        });
        setPlayerObjectivesHeld(playerObjs);
        setOpponentObjectivesHeld(opponentObjs);
        setObjectiveMarkers(session.objectiveMarkers);
      } else {
        console.warn('⚠️ No objectiveMarkers in session data');
      }

      // Fetch and update timeline events (skip cache for fresh data)
      const events = await fetchSessionEvents(currentSessionId, { skipCache: true });
      setTimelineEvents(events.map((e: any) => ({
        id: e.id,
        timestamp: new Date(e.timestamp),
        eventType: e.eventType,
        phase: e.phase,
        description: e.description,
        metadata: e.metadata ? JSON.parse(e.metadata) : undefined,
        // Revert tracking fields
        isReverted: e.isReverted || false,
        revertedAt: e.revertedAt,
        revertedBy: e.revertedBy,
        revertReason: e.revertReason,
        revertedEventId: e.revertedEventId,
        cascadedFrom: e.cascadedFrom
      })));
      
      // IMPORTANT: Also invalidate units cache so UnitHealthSheet gets fresh data
      // This ensures unit health changes from tool calls are reflected in the UI
      invalidateCachePattern(`/api/sessions/${currentSessionId}/units`);
      
      // Increment refresh key to force UnitHealthSheet to refetch (even if modal is open)
      setUnitsRefreshKey(prev => prev + 1);
      
    } catch (error) {
      console.error('Failed to refresh game state:', error);
      // Don't show error toast - this is a background operation
    }
  }, [currentSessionId, invalidateCachePattern]);

  // Speech analysis debounce and abort refs
  // These ensure we capture complete speech context before sending to AI
  const analyzeAbortControllerRef = useRef<AbortController | null>(null);
  const pendingTranscriptsRef = useRef<string[]>([]);
  const analyzeDebounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const analyzeCeilingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const bufferStartTimeRef = useRef<number | null>(null);
  
  // Debounce configuration - tuned to reduce wasted API calls
  const ANALYZE_DEBOUNCE_MS = 4000; // Base: 4 seconds of silence before analyzing
  const ANALYZE_DEBOUNCE_FAST_MS = 2000; // With game keywords: 2 seconds
  const ANALYZE_MIN_WORDS = 3; // Minimum words required to trigger analysis
  const ANALYZE_CEILING_MS = 15000; // Force analysis after 15 seconds max buffering
  
  // Game-related keywords that trigger faster analysis (keyword boosting)
  const GAME_KEYWORDS = [
    'wound', 'damage', 'killed', 'destroyed', 'dead', 'died', 'lost',
    'phase', 'shooting', 'movement', 'charge', 'fight', 'command',
    'objective', 'control', 'captured', 'hold', 'contest',
    'cp', 'vp', 'command point', 'victory point', 'point',
    'round', 'turn', 'battle round',
    'stratagem', 'ability', 'strat',
    'model', 'unit', 'squad',
    'mortal', 'save', 'failed', 'passed',
    'advance', 'fall back', 'retreat', 'deploy'
  ];

  // Debounced CP update refs
  const cpUpdateTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pendingCPUpdateRef = useRef<{ player: 'attacker' | 'defender'; value: number; previousValue: number } | null>(null);

  const handleAdjustCP = useCallback(async (player: 'attacker' | 'defender', amount: number, absolute: boolean = false) => {
    if (!currentSessionId) return;
    
    const currentCP = player === 'attacker' ? playerCP : opponentCP;
    const newCP = absolute ? Math.max(0, amount) : Math.max(0, currentCP + amount);
    const previousCP = currentCP;
    
    // Optimistic update - instant UI feedback
    if (player === 'attacker') {
      setPlayerCP(newCP);
    } else {
      setOpponentCP(newCP);
    }
    
    // Store pending update info for potential rollback
    pendingCPUpdateRef.current = { player, value: newCP, previousValue: previousCP };
    
    // Clear existing timeout
    if (cpUpdateTimeoutRef.current) {
      clearTimeout(cpUpdateTimeoutRef.current);
    }
    
    // Debounced API call (100ms)
    cpUpdateTimeoutRef.current = setTimeout(async () => {
      try {
        const cpField = player === 'attacker' ? 'attackerCommandPoints' : 'defenderCommandPoints';
        
        // Update database
        await fetch(`/api/sessions/${currentSessionId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            [cpField]: newCP
          })
        });
        
        // Create timeline event
        const change = newCP - previousCP;
        await fetch(`/api/sessions/${currentSessionId}/events`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            eventType: 'custom',
            phase: currentPhase,
            description: absolute 
              ? `${player} CP set to ${newCP} manually`
              : `${player} ${change >= 0 ? 'gained' : 'lost'} ${Math.abs(change)} CP manually (${newCP} total)`,
            metadata: JSON.stringify({ player, change, newCP, absolute }),
            timestamp: new Date().toISOString()
          })
        });
        
        // Invalidate ALL session-related caches (pattern-based)
        invalidateCachePattern(`/api/sessions/${currentSessionId}`);
        
        // Refresh timeline to show new event
        await refreshTimeline();
        
        showToast(absolute ? `${player} CP set to ${newCP}` : `${player} ${change >= 0 ? '+' : ''}${change} CP (${newCP} total)`, 'success');
        pendingCPUpdateRef.current = null;
      } catch (error) {
        console.error('Failed to adjust CP:', error);
        showToast('Failed to adjust CP - reverting', 'error');
        
        // Rollback on error
        if (pendingCPUpdateRef.current) {
          if (player === 'attacker') {
            setPlayerCP(previousCP);
          } else {
            setOpponentCP(previousCP);
          }
          pendingCPUpdateRef.current = null;
        }
      }
    }, 100);
  }, [currentSessionId, currentPhase, playerCP, opponentCP, refreshTimeline]);

  // Debounced VP update refs
  const vpUpdateTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pendingVPUpdateRef = useRef<{ player: 'attacker' | 'defender'; value: number; previousValue: number } | null>(null);

  const handleAdjustVP = useCallback(async (player: 'attacker' | 'defender', amount: number, absolute: boolean = false) => {
    if (!currentSessionId) return;
    
    const currentVP = player === 'attacker' ? playerVP : opponentVP;
    const newVP = absolute ? Math.max(0, amount) : Math.max(0, currentVP + amount);
    const previousVP = currentVP;
    
    // Optimistic update - instant UI feedback
    if (player === 'attacker') {
      setPlayerVP(newVP);
    } else {
      setOpponentVP(newVP);
    }
    
    // Store pending update info for potential rollback
    pendingVPUpdateRef.current = { player, value: newVP, previousValue: previousVP };
    
    // Clear existing timeout
    if (vpUpdateTimeoutRef.current) {
      clearTimeout(vpUpdateTimeoutRef.current);
    }
    
    // Debounced API call (100ms)
    vpUpdateTimeoutRef.current = setTimeout(async () => {
      try {
        const vpField = player === 'attacker' ? 'attackerVictoryPoints' : 'defenderVictoryPoints';
        
        // Update database
        await fetch(`/api/sessions/${currentSessionId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            [vpField]: newVP
          })
        });
        
        // Create timeline event
        const change = newVP - previousVP;
        await fetch(`/api/sessions/${currentSessionId}/events`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            eventType: 'custom',
            phase: currentPhase,
            description: absolute 
              ? `${player} VP set to ${newVP} manually`
              : `${player} ${change >= 0 ? 'scored' : 'lost'} ${Math.abs(change)} VP manually (${newVP} total)`,
            metadata: JSON.stringify({ player, change, newVP, absolute }),
            timestamp: new Date().toISOString()
          })
        });
        
        // Invalidate ALL session-related caches (pattern-based)
        invalidateCachePattern(`/api/sessions/${currentSessionId}`);
        
        // Refresh timeline to show new event
        await refreshTimeline();
        
        showToast(absolute ? `${player} VP set to ${newVP}` : `${player} ${change >= 0 ? '+' : ''}${change} VP (${newVP} total)`, 'success');
        pendingVPUpdateRef.current = null;
      } catch (error) {
        console.error('Failed to adjust VP:', error);
        showToast('Failed to adjust VP - reverting', 'error');
        
        // Rollback on error
        if (pendingVPUpdateRef.current) {
          if (player === 'attacker') {
            setPlayerVP(previousVP);
          } else {
            setOpponentVP(previousVP);
          }
          pendingVPUpdateRef.current = null;
        }
      }
    }, 100);
  }, [currentSessionId, currentPhase, playerVP, opponentVP, refreshTimeline]);

  const handleScoreSecondary = useCallback(async (
    player: 'attacker' | 'defender',
    secondaryName: string,
    vpAmount: number,
    details: string,
    option: string
  ) => {
    if (!currentSessionId) return;
    
    try {
      const response = await fetch(`/api/sessions/${currentSessionId}/score-secondary`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          player,
          secondaryName,
          vpAmount,
          details,
          option
        })
      });

      const result = await response.json();
      
      if (result.success) {
        // Invalidate cache and refresh to get updated state
        invalidateCachePattern(`/api/sessions/${currentSessionId}`);
        await refreshGameState();
        showToast(result.message, 'success');
      } else {
        // Refresh to get correct state if validation failed
        invalidateCachePattern(`/api/sessions/${currentSessionId}`);
        await refreshGameState();
        // Show validation error (e.g., already scored this turn)
        showToast(result.message || 'Cannot score VP', 'warning');
      }
    } catch (error) {
      console.error('Error scoring secondary:', error);
      // Refresh to get correct state on error
      invalidateCachePattern(`/api/sessions/${currentSessionId}`);
      await refreshGameState();
      showToast('Failed to score VP', 'error');
    }
  }, [currentSessionId, refreshGameState, invalidateCachePattern]);

  // Optimistic phase change (called immediately)
  const handlePhaseChange = useCallback((phase: GamePhase, playerTurn: 'attacker' | 'defender') => {
    setCurrentPhase(phase);
    setCurrentPlayerTurn(playerTurn);
  }, []);

  // Called after API succeeds (invalidate caches and refresh timeline)
  const handlePhaseChangeComplete = useCallback(async () => {
    if (currentSessionId) {
      invalidateCachePattern(`/api/sessions/${currentSessionId}`);
      await refreshTimeline();
    }
  }, [currentSessionId, refreshTimeline]);

  const advanceRound = useCallback(async () => {
    if (!currentSessionId) return;
    
    setIsLoading(true);
    try {
      const newRound = battleRound + 1;
      setBattleRound(newRound);
      setCurrentPhase('Command');
      
      const newEvent: TimelineEventData = {
        id: crypto.randomUUID(),
        timestamp: new Date(),
        eventType: 'phase',
        phase: 'Command',
        description: `Battle Round ${newRound} started`,
      };
      setTimelineEvents(prev => [...prev, newEvent]);
      
      // Save to database
      await saveEventToDatabase(newEvent);

      // Update session in database
      await fetch(`/api/sessions/${currentSessionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          battleRound: newRound,
          currentPhase: 'Command'
        })
      });
      
      // Invalidate ALL session caches and refresh timeline
      invalidateCachePattern(`/api/sessions/${currentSessionId}`);
      await refreshTimeline();
      
      showToast(`Advanced to Round ${newRound}`, 'success');
    } catch (error) {
      console.error('Failed to update session:', error);
      showToast('Failed to advance round', 'error');
    } finally {
      setIsLoading(false);
    }
  }, [currentSessionId, battleRound, refreshTimeline]);

  // Show loading while checking admin status
  if (!adminCheckDone || (user && isAdmin === null)) {
    return (
      <>
        <GrimlogFrame />
        <div className="min-h-screen flex items-center justify-center bg-grimlog-slate">
          <div className="text-center">
            <div className="animate-spin text-4xl mb-4">⚙</div>
            <p className="text-grimlog-green font-mono">Verifying access...</p>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      {/* Auth Modal */}
      <AuthModal isOpen={showAuthModal} onClose={() => setShowAuthModal(false)} />

      <GrimlogFrame />
      
      <div className="min-h-screen flex flex-col md:h-screen md:overflow-hidden bg-grimlog-slate">
        {/* Compact Header - Keep dark for brand contrast */}
        <header className="py-1 px-3 border-b-2 border-grimlog-steel bg-grimlog-black flex-shrink-0" role="banner">
          <div className="flex items-center justify-between gap-3">
            {/* Logo & Status */}
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <div className="flex-shrink-0">
                <h1 className="text-lg md:text-xl font-bold text-grimlog-orange glow-orange tracking-wider uppercase">
                  GRIMLOG
                </h1>
              </div>
              
              {/* Compact Audio Status + Header Speech Status */}
              <div className="flex items-center gap-3 min-w-0">
                <HeaderSpeechStatus
                  status={audioStatus}
                  interimText={interimTranscript}
                  lastFinalText={finalTranscript}
                  history={speechHistory}
                />
              </div>
            </div>
            
            {/* Right Side: AI Badge + Menu */}
            <nav className="flex items-center gap-2" aria-label="Main navigation">
              {/* AI Badge removed as requested */}
              
              <HamburgerMenu
                isOpen={isMenuOpen}
                onClose={() => setIsMenuOpen(false)}
                onToggle={() => setIsMenuOpen(!isMenuOpen)}
                currentSessionId={currentSessionId}
                isInitialized={isInitialized}
                isLoading={isLoading}
                onStart={startListening}
                onStop={stopListening}
                onAdvanceRound={advanceRound}
                onClearTimeline={clearTimeline}
                onEndGame={endGame}
                onOpenTacticalAdvisor={() => setIsTacticalAdvisorOpen(true)}
                onOpenStratagemLogger={() => setIsStratagemLoggerOpen(true)}
                onOpenDamageCalculator={() => setIsDamageCalculatorOpen(true)}
                onOpenDamageResults={() => setIsDamageResultsOpen(true)}
                timelineEventsCount={timelineEvents.length}
                damageResultsCount={damageResults.length}
              />
            </nav>
          </div>
        </header>

        {/* View Tabs - Show only when session is active */}
        {/* Game State Dashboard - Always visible in unified layout */}
        {currentSessionId && (
          <section 
            className="border-b-2 border-grimlog-steel bg-grimlog-slate flex-shrink-0 md:sticky md:top-0 z-10"
          >
            <GameStateDisplay
              playerCP={playerCP}
              playerVP={playerVP}
              attackerSecondaries={attackerSecondaries}
              playerObjectives={playerObjectivesHeld}
              attackerSecondaryProgress={attackerSecondaryProgress}
              opponentCP={opponentCP}
              opponentVP={opponentVP}
              defenderSecondaries={defenderSecondaries}
              opponentObjectives={opponentObjectivesHeld}
              defenderSecondaryProgress={defenderSecondaryProgress}
              attackerArmyName={attackerArmyName}
              attackerFaction={attackerFaction}
              defenderArmyName={defenderArmyName}
              defenderFaction={defenderFactionName}
              battleRound={battleRound}
              currentPhase={currentPhase}
              currentTurn={currentTurn}
              firstTurn={firstTurn}
              sessionId={currentSessionId}
              deploymentType={deploymentType}
              totalObjectives={5}
              objectiveMarkers={objectiveMarkers}
              allSecondaries={allSecondaries}
              missionMode={missionMode}
              onAdjustCP={handleAdjustCP}
              onAdjustVP={handleAdjustVP}
              onPhaseChange={handlePhaseChange}
              onPhaseChangeComplete={handlePhaseChangeComplete}
              onOpenSecondaries={(player) => {
                setSecondariesInitialTab(player);
                setIsSecondariesModalOpen(true);
              }}
              onScoreSecondary={handleScoreSecondary}
              onRemoveSecondary={async (player, secondaryName) => {
                try {
                  const response = await fetch(`/api/sessions/${currentSessionId}/discard-secondary`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ player, secondaryName })
                  });
                  if (!response.ok) throw new Error('Failed to discard secondary');
                  refreshGameState();
                } catch (error) {
                  showToast('Failed to discard secondary', 'error');
                  throw error;
                }
              }}
              onAddSecondary={async (player, secondaryName) => {
                const currentSecondaries = player === 'attacker' ? attackerSecondaries : defenderSecondaries;
                const updatedSecondaries = [...currentSecondaries, secondaryName];
                try {
                  const response = await fetch(`/api/sessions/${currentSessionId}/manual-action`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      toolName: 'set_secondary_objectives',
                      args: { player, secondaries: updatedSecondaries }
                    })
                  });
                  if (!response.ok) throw new Error('Failed to add secondary');
                  refreshGameState();
                } catch (error) {
                  showToast('Failed to add secondary', 'error');
                  throw error;
                }
              }}
              onRefresh={refreshGameState}
              onShowToast={showToast}
            />
          </section>
        )}

        {/* Main Content Area - Always show Timeline in unified layout */}
        <main 
          id="main-content"
          className="flex-1 bg-grimlog-slate-light md:overflow-hidden"
          role="main"
            >
              <Timeline 
                events={timelineEvents} 
                sessionId={currentSessionId || undefined} 
                onRefresh={refreshGameState}
                onDamageCalcClick={handleDamageCalcClick}
                attackerFaction={attackerFaction}
                defenderFaction={defenderFactionName}
              />
        </main>

        {/* Floating Units Button - Bottom right */}
        {currentSessionId && !isUnitsModalOpen && (
          <button
            onClick={() => setIsUnitsModalOpen(true)}
            className="fixed bottom-6 right-6 z-40 w-14 h-14 bg-grimlog-orange hover:bg-grimlog-amber text-grimlog-black rounded-full shadow-[0_4px_14px_rgba(234,88,12,0.4)] hover:shadow-[0_6px_20px_rgba(234,88,12,0.6)] transition-all duration-300 hover:scale-110 active:scale-95 flex items-center justify-center text-2xl border-2 border-grimlog-steel animate-fab-in"
            aria-label="Open unit health view"
            title="Unit Health (⚔)"
          >
            ⚔
          </button>
        )}
      </div>

      {/* Dialogs and Notifications */}
      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        onClose={() => setConfirmDialog(prev => ({ ...prev, isOpen: false }))}
        onConfirm={confirmDialog.onConfirm}
        title={confirmDialog.title}
        message={confirmDialog.message}
        variant={confirmDialog.variant}
      />

      <Toast
        isVisible={toast.isVisible}
        message={toast.message}
        type={toast.type}
        onClose={() => setToast(prev => ({ ...prev, isVisible: false }))}
      />

      {/* Validation Warnings - Stack Multiple Toasts */}
      <div className="fixed bottom-20 right-4 z-50 flex flex-col-reverse gap-3 max-w-lg pointer-events-none">
        {validationWarnings.map((warning) => (
          <div key={warning.id} className="pointer-events-auto">
            <ValidationToast
              validation={warning.validation}
              toolName={warning.toolName}
              toolMessage={warning.toolMessage}
              isVisible={true}
              onClose={() => dismissValidationWarning(warning.id)}
              onOverride={() => handleValidationOverride(warning.id)}
              duration={warning.validation.severity === 'info' ? 10000 : undefined}
            />
          </div>
        ))}
      </div>

      {/* Tactical Advisor Modal */}
      {currentSessionId && (
        <TacticalAdvisorModal
          isOpen={isTacticalAdvisorOpen}
          onClose={() => setIsTacticalAdvisorOpen(false)}
          sessionId={currentSessionId}
          currentPhase={currentPhase}
          currentTurn={currentTurn}
        />
      )}

      {/* Secondary Objectives Modal */}
      {currentSessionId && (
        <SecondaryModal
          isOpen={isSecondariesModalOpen}
          onClose={() => {
            setIsSecondariesModalOpen(false);
            setSecondariesInitialTab('attacker'); // Reset to default
          }}
          sessionId={currentSessionId}
          attackerSecondaries={attackerSecondaries}
          defenderSecondaries={defenderSecondaries}
          attackerProgress={attackerSecondaryProgress}
          defenderProgress={defenderSecondaryProgress}
          allSecondaries={allSecondaries}
          missionMode={missionMode}
          currentRound={battleRound}
          currentTurn={currentTurn}
          onScore={(player, secondaryName, vp, details) => 
            handleScoreSecondary(player, secondaryName, vp, details, details)
          }
          onAddSecondary={async (player, secondaryName) => {
            // Add secondary via API
            const currentSecondaries = player === 'attacker' ? attackerSecondaries : defenderSecondaries;
            const updatedSecondaries = [...currentSecondaries, secondaryName];
            try {
              const response = await fetch(`/api/sessions/${currentSessionId}/manual-action`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  toolName: 'set_secondary_objectives',
                  args: { player, secondaries: updatedSecondaries }
                })
              });
              if (!response.ok) throw new Error('Failed to add secondary');
              refreshGameState();
            } catch (error) {
              showToast('Failed to add secondary', 'error');
              throw error;
            }
          }}
          onRemoveSecondary={async (player, secondaryName) => {
            // Remove (discard) secondary via API
            try {
              const response = await fetch(`/api/sessions/${currentSessionId}/discard-secondary`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ player, secondaryName })
              });
              if (!response.ok) throw new Error('Failed to discard secondary');
              refreshGameState();
            } catch (error) {
              showToast('Failed to discard secondary', 'error');
              throw error;
            }
          }}
          onShowToast={showToast}
          initialTab={secondariesInitialTab}
        />
      )}

      {/* Stratagem Logger Modal */}
      {currentSessionId && (
        <StratagemLoggerModal
          isOpen={isStratagemLoggerOpen}
          onClose={() => setIsStratagemLoggerOpen(false)}
          sessionId={currentSessionId}
          playerCP={playerCP}
          opponentCP={opponentCP}
          onUpdate={refreshGameState}
          onShowToast={showToast}
        />
      )}

      {/* Damage Calculator Modal */}
      <DamageCalculatorModal
        isOpen={isDamageCalculatorOpen}
        onClose={() => setIsDamageCalculatorOpen(false)}
        sessionId={currentSessionId}
      />

      {/* Damage Results Modal (Voice-triggered results) */}
      <DamageResultsModal
        isOpen={isDamageResultsOpen}
        onClose={() => setIsDamageResultsOpen(false)}
        results={damageResults}
        onDismissResult={(id) => setDamageResults(prev => prev.filter(r => r.id !== id))}
        onClearAll={() => {
          setDamageResults([]);
          setIsDamageResultsOpen(false);
        }}
      />

      {/* Unit Health Bottom Sheet */}
      {currentSessionId && (
        <UnitHealthSheet
          key={`units-${unitsRefreshKey}`}
          sessionId={currentSessionId}
          isOpen={isUnitsModalOpen}
          onClose={() => setIsUnitsModalOpen(false)}
        />
      )}

      {/* Header captions handled by HeaderSpeechStatus */}
    </>
  );
}
