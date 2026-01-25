# Game State Correction & Revert System

**Version:** 1.0  
**Last Updated:** November 15, 2025  
**Status:** ✅ Production Ready

## Overview

The Revert System allows players to correct mistakes in game tracking by undoing events via voice commands or manual UI controls. The system maintains a full audit trail using soft deletes and provides warnings about cascade effects when reverting events with subsequent changes.

## Features

✅ **Voice-Activated Reverts** - Use natural language to undo mistakes  
✅ **Manual UI Controls** - Click to revert any event in the timeline  
✅ **Full Audit Trail** - All reverts tracked with reasons and timestamps  
✅ **Cascade Detection** - Warns about subsequent events that may be affected  
✅ **Soft Deletes** - Events marked as reverted, never permanently deleted  
✅ **State Restoration** - Automatically reverses CP, VP, and other changes  
✅ **Expandable Details** - Revert events show all affected events

## Architecture

### Database Schema

**TimelineEvent Model (Enhanced)**
```typescript
{
  // Existing fields...
  
  // Revert tracking
  isReverted: boolean;
  revertedAt?: DateTime;
  revertedBy?: string;       // "user", "ai", or user ID
  revertReason?: string;
  revertedEventId?: string;  // ID of revert action event
  
  // Cascade tracking
  cascadedFrom?: string;     // ID of event that triggered cascade
}
```

**RevertAction Model (New)**
```typescript
{
  id: string;
  gameSessionId: string;
  timestamp: DateTime;
  
  // What was reverted
  targetEventId: string;
  targetEventType: string;
  targetDescription: string;
  
  // How it was reverted
  revertType: 'single' | 'cascade';
  triggerMethod: 'voice' | 'manual' | 'ai-correction';
  reason?: string;
  
  // Audit trail
  affectedEventIds: string[];  // JSON array
  stateBefore?: any;           // Game state snapshot
  stateAfter?: any;
}
```

### System Components

1. **AI Tool** - `revert_event` - Handles voice-based reverts
2. **API Endpoint** - `/api/sessions/[id]/events/[eventId]` - Handles manual reverts
3. **UI Components**:
   - `RevertConfirmDialog` - Confirmation with cascade warning
   - `Timeline` - Enhanced with revert buttons and expandable details
4. **Helper Functions**:
   - `findEventsToRevert()` - Searches for events to revert
   - `reverseEventStateChanges()` - Restores game state
   - `captureGameState()` - Creates audit trail snapshots

## Usage

### Voice Commands

The AI understands natural correction phrases:

**Simple Undo**
```
"Grimlog, undo the last stratagem"
"Take back that phase change"
"Revert the last VP score"
```

**Correction with Reason**
```
"Actually that was 4 VP not 3"
"Correction: I had 5 CP not 6"
"Mistake, that stratagem cost 2 CP not 1"
```

**Search by Description**
```
"Undo the Transhuman stratagem"
"Revert Objective 3 control change"
"Take back Intercessor combat"
```

### Manual Revert (UI)

1. **Find the Event** - Locate the event in the timeline
2. **Click Undo Button** - Click the "⎌ UNDO" button on the event
3. **Review Warning** - Check if subsequent events will be affected
4. **Choose Revert Mode**:
   - **Revert This Only** - Only reverts the selected event
   - **Revert All** - Reverts this event and all subsequent events (cascade)
5. **Confirm** - Click confirm to execute the revert

### Cascade Behavior

When you revert an event that has subsequent events, you'll see a warning:

```
⚠ WARNING: 5 events occurred after this
```

**Options:**
- **Revert This Only** - Fast but may create inconsistent state
- **Revert All (Cascade)** - Maintains consistency by reverting everything after

**Example Scenario:**
```
Event 1: Phase changed to Shooting
Event 2: Stratagem used (2 CP spent)
Event 3: VP scored
Event 4: Phase changed to Charge
```

If you revert Event 2 (stratagem):
- **Single Revert**: Restores 2 CP, but VP and phase changes remain
- **Cascade Revert**: Restores 2 CP AND removes Events 3 and 4

## State Restoration

The system automatically reverses state changes:

### Phase Change Reverts ✅
- ✅ Restores previous phase
- ✅ Restores previous turn
- ✅ Reverts round advancement if applicable
- ✅ Works for manual and voice-triggered phase changes

### Stratagem Reverts ✅
- ✅ Restores CP spent
- ✅ Removes from stratagem log
- ✅ Creates revert event in timeline

### VP Reverts ✅
- ✅ Subtracts VP from player total
- ✅ Ensures VP never goes negative
- ✅ Updates secondary progress if applicable
- ✅ Reverses secondary-specific VP tracking

### CP Reverts ✅
- ✅ Reverses CP gain or loss
- ✅ Restores both manual and automatic changes
- ✅ Updates CP transaction history
- ✅ Maintains CP validation rules

### Objective Control Reverts ✅
- ✅ Restores previous control state
- ✅ Updates objective markers automatically
- ✅ Tracks who previously controlled objectives

### Unit Damage Reverts ✅
- ✅ Restores lost models
- ✅ Un-destroys destroyed units
- ✅ Reverses wound allocation
- ✅ Works with per-model wound tracking

### Unit Status Reverts ✅
- ✅ Removes added status effects
- ✅ Restores removed status effects
- ✅ Reverses battleshock status
- ✅ Handles all buff/debuff changes

### Secondary Objectives ✅
- ✅ Clears secondary selections on revert
- ✅ Reverses secondary VP scoring
- ✅ Updates progress tracking

## Timeline Visual Indicators

### Reverted Events
- Strikethrough text
- Grayed out appearance
- "⎌ REVERTED" badge
- Cannot be reverted again
- **Hidden from timeline** (but preserved in database)

### Revert Action Events
- **Distinct amber color** with dashed border
- **"⎌ REVERT" badge** instead of event type
- Shows reason for revert
- Expandable to show affected events
- Clickable to see details

### Grouped Revert Actions (NEW!)
When multiple reverts happen in succession, they're automatically grouped together:

```
┌────────────────────────────────────────┐
│ ⎌  3 Consecutive Reverts  [Expand All] │
├────────────────────────────────────────┤
│ ⎌ REVERTED: Event 1                    │
│ ⎌ REVERTED: Event 2                    │
│ ⎌ REVERTED: Event 3                    │
└────────────────────────────────────────┘
```

Benefits:
- ✅ Reduces visual clutter
- ✅ "Expand All" button to see details
- ✅ Clear indication of batch corrections
- ✅ Each revert still expandable individually

**Example:**
```
⎌ REVERTED: Transhuman Physiology used for 2 CP - Reason: Wrong cost
  ▶ Show 1 affected event
```

When expanded:
```
  Events Reverted:
  ┌─────────────────────────────────────┐
  │ ◆ STRATAGEM         10:23:15 AM     │
  │ Transhuman Physiology used for 2 CP │
  └─────────────────────────────────────┘
```

## API Reference

### Revert Event (Voice)

**Tool:** `revert_event`

**Parameters:**
```typescript
{
  target_event_type: "phase" | "stratagem" | "objective" | "vp" | "cp" | "any";
  search_description?: string;
  revert_reason: string;
  correction_data?: {
    correct_value?: string;
    reapply_corrected?: boolean;
  };
  how_far_back?: "last" | "last_2" | "last_3";
}
```

**Example:**
```json
{
  "target_event_type": "stratagem",
  "search_description": "Transhuman",
  "revert_reason": "Wrong CP cost"
}
```

### Revert Event (Manual)

**Endpoint:** `PATCH /api/sessions/[id]/events/[eventId]`

**Body:**
```typescript
{
  revertReason: string;
  cascadeMode: 'single' | 'cascade';
}
```

**Response:**
```typescript
{
  success: boolean;
  revertedCount: number;
  revertActionId: string;
}
```

## Best Practices

### When to Revert

✅ **Good Use Cases:**
- Incorrect VP scores
- Wrong CP amounts
- Mistaken stratagem costs
- Accidental phase changes
- Wrong objective control markers

❌ **Avoid Reverting:**
- Very old events (10+ events ago)
- Events from previous rounds (unless necessary)
- Events where state has significantly changed

### Cascade Decisions

**Use Single Revert When:**
- Correcting simple values (VP amounts, CP costs)
- Recent events (1-2 events ago)
- Subsequent events are unaffected

**Use Cascade Revert When:**
- Major errors (wrong phase, turn)
- Events built on incorrect state
- Need to maintain consistency
- Replaying sequence of actions

### Audit Trail

All reverts are permanently logged:
- ✅ What was reverted
- ✅ When it was reverted  
- ✅ Who reverted it (user or AI)
- ✅ Why it was reverted
- ✅ What state looked like before/after

Query revert history:
```typescript
const reverts = await prisma.revertAction.findMany({
  where: { gameSessionId: sessionId },
  orderBy: { timestamp: 'desc' }
});
```

## Examples

### Example 1: Simple VP Correction

**Voice:** "Actually that was 4 VP not 3"

**Result:**
1. AI finds last VP event
2. Reverts VP change (removes 3 VP)
3. Can immediately re-score with correct value

### Example 2: Stratagem Mistake

**Voice:** "Undo the last stratagem, wrong cost"

**Result:**
1. Finds last stratagem event
2. Restores CP spent
3. Removes from stratagem log
4. Timeline shows revert event

### Example 3: Phase Change Error

**Manual Steps:**
1. Find phase change event in timeline
2. Click "⎌ UNDO" button
3. See warning: "5 events after this"
4. Choose "REVERT ALL (6)"
5. Confirm cascade revert
6. All 6 events reverted
7. Game state restored to before error

## Troubleshooting

### "Event not found"
- Event may already be reverted
- Check event type matches
- Try broader search (use "any" type)

### "Event already reverted"
- Events can only be reverted once
- Check timeline for existing revert marker
- Cascade revert may have already handled it

### State not fully restored
- Some events require manual adjustment
- Check console for restoration logs
- Phase/objective changes may need manual fix
- Review expanded revert details

### Cascade warning not showing
- Only shows if subsequent non-reverted events exist
- Previous cascades remove from count
- Check timeline order

## Performance

- ✅ Fast lookups via indexed queries
- ✅ Optimized for recent events
- ✅ Parallel state restoration
- ✅ Cache invalidation after revert
- ✅ Real-time UI updates

## Security

- ✅ Authentication required for manual reverts
- ✅ User ID tracked in audit trail
- ✅ Session-scoped operations
- ✅ No deletion of original events
- ✅ Full accountability trail

## Future Enhancements

- [ ] Bulk revert operations
- [ ] Undo cascade revert
- [ ] Revert preview mode
- [ ] Advanced search filters
- [ ] Revert analytics dashboard
- [ ] Export revert history

---

**For technical implementation details, see:**
- [Architecture Docs](../ARCHITECTURE.md)
- [API Documentation](../api/)
- [Code Standards](.cursor/rules/code-standards.mdc)

**The Machine God approves of corrections made in His name.** ⚙️

