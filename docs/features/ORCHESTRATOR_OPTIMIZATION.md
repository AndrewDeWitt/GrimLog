# Voice Analysis Orchestrator Optimization

**Last Updated:** 2025-11-02  
**Status:** Complete (Enhanced v4.1.0)

## Overview

The orchestrator pattern optimization addresses performance and race condition issues in the voice analysis pipeline by implementing intelligent request routing, deduplication, and tiered context loading.

## Problem Statement

The previous implementation had three major issues:

1. **Race Conditions**: Multiple analyze calls would stack up, processing the same transcription text multiple times before the first request could mark transcripts as analyzed.

2. **Over-fetching**: Every analysis would load the full context (session + units + datasheets + 20 transcripts + rules) even for simple operations like phase changes.

3. **High Latency**: Loading and formatting 49+ datasheets with weapon profiles took significant time even when that information wasn't needed.

## Solution Architecture

### 1. Request Deduplication (`lib/requestDeduplication.ts`)

Prevents concurrent processing of the same transcripts:

```typescript
// Before analysis
const requestToken = startAnalysisRequest(transcriptIds);
if (!requestToken) {
  return; // Already being processed
}

// After analysis
completeAnalysisRequest(requestToken);
```

**Features:**
- In-memory tracking of active requests
- Per-transcript processing locks
- Automatic timeout cleanup (30s)
- Request lifecycle management

### 2. Intent Classification (`lib/intentOrchestrator.ts`)

Classifies player intent to determine required context level:

**Intent Categories (v4.1.0 - Tool-Specific):**

1. **SIMPLE_STATE** → Minimal Context (~500 tokens)
   - Phase changes, round advancement
   - Simple queries (CP, VP, phase)
   - Tools: `change_phase`, `update_command_points`, `query_game_state`

2. **UNIT_HEALTH** → Units Only Context (~2500 tokens)
   - Health/wound tracking
   - Models lost tracking
   - Tools: `update_unit_health`, `mark_unit_destroyed`

3. **COMBAT_LOGGING** → Unit Names Context (~800 tokens)
   - Combat results recording
   - Attack outcomes
   - Tools: `log_combat_result`

4. **OBJECTIVE_CONTROL** → Objectives Context (~600 tokens)
   - Objective marker control
   - Territory tracking
   - Tools: `update_objective_control`

5. **SECONDARY_SCORING** → Secondaries Context (~700 tokens)
   - Secondary objectives scoring
   - VP calculations
   - Tools: `score_assassination`, `score_bring_it_down`, `score_secondary_vp`

6. **STRATEGIC** → Full Context (~8000+ tokens)
   - Stratagems, rules questions
   - Strategic analysis
   - Complex multi-step operations

**Implementation:**
- GPT-5-nano classification with structured outputs
- Tool-to-intent explicit mappings
- Token cost awareness in classification
- Confidence scoring with fallback to full context

### 3. Tiered Context Builder (`lib/contextBuilder.ts`)

Builds appropriate context level based on intent:

**Minimal Context:**
- ✅ Session state (phase, round, CP, VP)
- ❌ Units, datasheets, conversation history, rules

**Units Only Context (NEW v4.1.0):**
- ✅ Session state
- ✅ Full unit list with health/wounds/models
- ✅ Recent conversation (last 3 transcripts)
- ❌ Datasheets, full history, rules reference
- Use: Health tracking requiring current wound states

**Unit Names Context (NEW v4.1.0):**
- ✅ Session state
- ✅ Unit names only (no health details)
- ✅ Recent conversation (last 3 transcripts)
- ❌ Full unit details, datasheets, rules
- Use: Combat logging, simple unit references

**Objectives Context (NEW v4.1.0):**
- ✅ Session state
- ✅ Objective markers status
- ✅ Unit names only
- ✅ Recent conversation (last 3 transcripts)
- ❌ Unit health, datasheets, rules
- Use: Objective control tracking

**Secondaries Context (NEW v4.1.0):**
- ✅ Session state
- ✅ Active secondary objectives
- ✅ Unit names only
- ✅ Recent conversation (last 3 transcripts)
- ❌ Unit health, datasheets, rules
- Use: Secondary objectives scoring

**Full Context:**
- ✅ Everything: Session + units + datasheets + full history (20 transcripts) + rules
- No restrictions

### 4. Updated Analysis Flow

```
1. Receive transcription → Save to DB
2. ✨ Check deduplication → Return early if already processing
3. Smart triggers (existing) → Return if no analysis needed
4. Gatekeeper (existing) → Return if not game-related
5. ✨ Intent Classification → Determine context tier
6. ✨ Build appropriate context tier
7. Execute GPT analysis with tools
8. ✨ Cleanup deduplication tracker
```

## Performance Improvements

### Expected Gains (v4.1.0 Enhanced)

| Operation Type | Context Tier | Speed Improvement | Token Savings |
|---------------|--------------|-------------------|---------------|
| Phase change | Minimal | ~70% faster | ~95% fewer tokens |
| Health update | Units Only | ~50% faster | ~83% fewer tokens |
| Combat logging | Unit Names | ~65% faster | ~95% fewer tokens |
| Objective control | Objectives | ~70% faster | ~96% fewer tokens |
| Secondary scoring | Secondaries | ~70% faster | ~95% fewer tokens |
| Stratagem use | Full | Same | Same |
| Strategic question | Full | Same | Same |

### Cost Reduction (v4.1.0)

- **Minimal context**: ~500 tokens vs ~15,000 tokens (97% reduction)
- **Units only context**: ~2,500 tokens vs ~15,000 tokens (83% reduction)
- **Unit names context**: ~800 tokens vs ~15,000 tokens (95% reduction)
- **Objectives context**: ~600 tokens vs ~15,000 tokens (96% reduction)
- **Secondaries context**: ~700 tokens vs ~15,000 tokens (95% reduction)
- **Full context**: ~15,000 tokens (no change - when needed)
- Intent classification: ~200 tokens (negligible overhead)

### Real-World Examples (v4.1.0)

| Speech Input | Old System | New System | Savings |
|-------------|-----------|------------|---------|
| "Killed 3 marines" | UNIT_OPERATION → 2500 tokens | COMBAT_LOGGING → 800 tokens | **-68%** |
| "I control objective 3" | UNIT_OPERATION → 2500 tokens | OBJECTIVE_CONTROL → 600 tokens | **-76%** |
| "Scored assassination" | UNIT_OPERATION → 2500 tokens | SECONDARY_SCORING → 700 tokens | **-72%** |
| "My terminators took 5 wounds" | UNIT_OPERATION → 2500 tokens | UNIT_HEALTH → 2500 tokens | 0% (needs health) |

## Testing Guide

### Test Scenarios (v4.1.0)

#### 1. Simple Phase Change (Should use Minimal)
```
User: "Moving to shooting phase"
Expected:
- 🎯 Intent: SIMPLE_STATE
- 📦 Building MINIMAL context (~500 tokens)
- ✅ Phase changed successfully
```

#### 2. Unit Health Update (Should use Units Only)
```
User: "My Terminators took 6 wounds"
Expected:
- 🤖 Using AI classification
- 🎯 Intent: UNIT_HEALTH → units_only
- 📦 Building UNITS_ONLY context (~2500 tokens)
- ✅ Health updated successfully
```

#### 3. Combat Logging (Should use Unit Names)
```
User: "Killed 3 marines"
Expected:
- 🤖 Using AI classification
- 🎯 Intent: COMBAT_LOGGING → unit_names
- 📦 Building UNIT_NAMES context (~800 tokens)
- ✅ Combat result logged successfully
```

#### 4. Objective Control (Should use Objectives)
```
User: "I control objective 3"
Expected:
- 🤖 Using AI classification
- 🎯 Intent: OBJECTIVE_CONTROL → objectives
- 📦 Building OBJECTIVES context (~600 tokens)
- ✅ Objective control updated successfully
```

#### 5. Secondary Scoring (Should use Secondaries)
```
User: "Scored assassination on his captain"
Expected:
- 🤖 Using AI classification
- 🎯 Intent: SECONDARY_SCORING → secondaries
- 📦 Building SECONDARIES context (~700 tokens)
- ✅ Secondary VP scored successfully
```

#### 6. Stratagem Use (Should use Full)
```
User: "Using Transhuman Physiology on my Terminators"
Expected:
- 🤖 Using AI classification
- 🎯 Intent: STRATEGIC → full
- 📦 Building FULL context (~8000+ tokens)
- ✅ Stratagem logged successfully
```

#### 7. Race Condition Prevention
```
Concurrent requests with same transcripts:
Expected:
- Request 1: ✅ Analysis request started
- Request 2: 🔒 Request blocked - already being processed
- Request 1 completes: ✅ Analysis request completed
```

### Manual Testing

1. **Test context tiers (v4.1.0):**
   ```bash
   # Watch console logs for:
   "📦 Building MINIMAL context"
   "📦 Building UNITS_ONLY context"
   "📦 Building UNIT_NAMES context"
   "📦 Building OBJECTIVES context"
   "📦 Building SECONDARIES context"
   "📦 Building FULL context"
   ```

2. **Test deduplication:**
   ```bash
   # Rapidly trigger multiple analyze calls with same text
   # Check logs for "🔒 Request blocked"
   ```

3. **Test fallback safety:**
   ```bash
   # Use ambiguous or unclear commands
   # Should default to full context for safety
   ```

## Monitoring

### Key Metrics to Track (v4.1.0)

1. **Context Tier Distribution**
   - How often each tier is used
   - Expected distribution:
     - ~25% minimal (phase/CP/VP changes)
     - ~30% units_only (health tracking)
     - ~15% unit_names (combat logging)
     - ~10% objectives (objective control)
     - ~10% secondaries (secondary scoring)
     - ~10% full (strategic/rules)

2. **Response Times**
   - Measure analysis duration by context tier
   - Target times:
     - <500ms minimal
     - <1s units_only
     - <800ms unit_names, objectives, secondaries
     - <3s full

3. **Deduplication Rate**
   - How many requests are blocked
   - Target: <5% blocked (indicates race condition prevention)

4. **Intent Classification Accuracy**
   - Manual review of intent classifications
   - Target: >90% accuracy

### Langfuse Traces (v4.1.0)

All analysis traces now include:
- `contextTier`: "minimal" | "units_only" | "unit_names" | "objectives" | "secondaries" | "full"
- `intentClassification`: SIMPLE_STATE | UNIT_HEALTH | COMBAT_LOGGING | OBJECTIVE_CONTROL | SECONDARY_SCORING | STRATEGIC
- `intentConfidence`: Classification confidence score
- Tags examples:
  - `context-minimal`, `intent-SIMPLE_STATE`
  - `context-units_only`, `intent-UNIT_HEALTH`
  - `context-unit_names`, `intent-COMBAT_LOGGING`
  - `context-objectives`, `intent-OBJECTIVE_CONTROL`
  - `context-secondaries`, `intent-SECONDARY_SCORING`
  - `context-full`, `intent-STRATEGIC`

## Code Organization

### New Files
- `lib/requestDeduplication.ts` - Request tracking and deduplication
- `lib/intentOrchestrator.ts` - Intent classification logic
- `lib/contextBuilder.ts` - Tiered context building

### Modified Files
- `app/api/analyze/route.ts` - Main analyze endpoint with new flow

### No Breaking Changes
- All existing tools continue to work
- Tool definitions unchanged
- Tool handlers unchanged
- Graceful fallback to full context if uncertain

## Rollback Plan

If issues arise, revert these commits:
1. `lib/requestDeduplication.ts` removal
2. `lib/intentOrchestrator.ts` removal
3. `lib/contextBuilder.ts` removal
4. `app/api/analyze/route.ts` to previous version

The system will function identically to before (always using full context).

## Future Enhancements

1. **Metrics Dashboard**: Visualize context tier usage and performance
2. **Dynamic Tier Adjustment**: Learn from corrections to improve classification
3. **Request Queue**: Instead of blocking duplicates, queue them
4. **Caching**: Cache context between rapid sequential requests
5. **Parallel Classification**: Run intent classification during gatekeeper check

## Related Documentation

- [Architecture](../ARCHITECTURE.md)
- [API Documentation](../api/analyze.md)
- [Performance Optimization Summary](../../PERFORMANCE_OPTIMIZATION_SUMMARY.md)


