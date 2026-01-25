# Validation System - End-to-End Testing Guide

## 🚀 Setup Instructions

### 1. Database Migration

First, apply the new ValidationEvent model to your database:

```bash
# Generate migration
npx prisma migrate dev --name add_validation_events

# Or if you want to just push without creating a migration file
npx prisma db push
```

This will add the `ValidationEvent` table to track all validation warnings and overrides.

### 2. Start the Development Server

```bash
npm run dev
```

Open http://localhost:3000

---

## 🧪 Test Scenarios

### ✅ Test 1: Insufficient CP Error (Critical Path)

**Goal:** Verify ERROR-level validation appears when trying to spend CP you don't have.

**Steps:**
1. Click **START** button → Wait for "Audio capture started"
2. In Game State Dashboard, set Player CP to **0** (use - button)
3. Say clearly: *"Using Transhuman Physiology on my Terminators"*
4. Wait 2-3 seconds for processing

**Expected Results:**
- ❌ Red **ERROR** ValidationToast appears in bottom-right
- Toast shows:
  ```
  ❌ ERROR
  LOG STRATAGEM USE
  
  Insufficient CP: player has 0 CP but stratagem costs 2 CP
  Rule: insufficient_cp
  💡 Verify CP cost or current CP total
  
  Action executed: Transhuman Physiology used (-2 CP, 0 CP remaining)
  
  [OVERRIDE & ACCEPT] [DISMISS]
  ```
- Timeline shows stratagem use event with **❌** error badge
- CP remains at 0 (clamped, doesn't go negative)

**Actions to Test:**
- ✅ Click **OVERRIDE & ACCEPT** → Toast disappears, "Validation override" event added to timeline
- ✅ Click **DISMISS** → Toast disappears, no override logged
- ✅ Click **X** (close button) → Same as DISMISS

**Database Verification:**
```bash
# Check validation events were logged
curl http://localhost:3000/api/sessions/{SESSION_ID}/validations?stats=true
```

Should show:
```json
{
  "events": [...],
  "stats": {
    "total": 1,
    "bySeverity": { "error": 1, ... },
    "overridden": 1,
    "byRule": { "insufficient_cp": 1 }
  }
}
```

---

### ⚠️ Test 2: Duplicate Stratagem Warning

**Goal:** Verify WARNING when using same stratagem twice in one phase.

**Steps:**
1. Ensure Player CP ≥ 2
2. Say: *"Using Transhuman Physiology"*
3. Wait for success (should work normally)
4. **Immediately** say again: *"Using Transhuman Physiology"*

**Expected Results:**
- ⚠️ Amber **WARNING** ValidationToast appears
- Shows: "Transhuman Physiology may have already been used by player this phase"
- Rule: `duplicate_stratagem_this_phase`
- Timeline shows both stratagem events, second has **⚠️** warning badge
- CP deducted twice (if you had 2+ CP)

**Edge Cases to Test:**
- ✅ Using different stratagem in same phase → No warning
- ✅ Using same stratagem in different phase → INFO warning (not ERROR)
- ✅ Advancing to next phase, then using again → No warning

---

### 🚨 Test 3: Invalid Phase Transition (Critical)

**Goal:** Verify CRITICAL error when going backwards in phases.

**Steps:**
1. Ensure you're in **Shooting Phase** (say "moving to shooting phase" if needed)
2. Say: *"Moving to Movement Phase"* (backwards transition)

**Expected Results:**
- 🚨 Dark red **CRITICAL ERROR** ValidationToast appears
- Shows: "Invalid phase transition: Cannot go backwards from Shooting to Movement"
- Rule: `phase_sequence_violation`
- Suggestion: "Valid next phase: Charge"
- Timeline shows phase change with **🚨** critical badge
- Phase still changes (action executed despite error)

**Valid Transitions to Test:**
- ✅ Command → Movement → Shooting → Charge → Fight (all work)
- ✅ Command → Shooting (skip Movement) → INFO message (phase skip)
- ❌ Shooting → Command (backwards) → CRITICAL
- ❌ Fight → Movement (backwards) → CRITICAL

---

### ⚠️ Test 4: High CP Gain Warning

**Goal:** Verify warning when gaining unusual amounts of CP.

**Steps:**
1. Say: *"I gained 3 CP"*

**Expected Results:**
- ⚠️ **WARNING** ValidationToast appears
- Shows: "Gaining 3 CP is unusual (standard is +1 per turn, max +2 with secondary discard)"
- Rule: `high_cp_gain`
- Timeline shows CP gain with **⚠️** badge
- CP actually increases by 3

**Test Variations:**
- ✅ Say: "I gained 1 CP" → No warning (normal)
- ✅ Say: "I gained 2 CP" → No warning (normal with secondary)
- ⚠️ Say: "I gained 3 CP" → WARNING (unusual but possible)
- 🚨 Say: "I gained 5 CP" → CRITICAL (impossible)

---

### 🚨 Test 5: Round Regression

**Goal:** Verify critical error when trying to go backwards in rounds.

**Steps:**
1. Advance to Round 2 or 3 (click **ROUND** button)
2. Say: *"Moving to Round 1"*

**Expected Results:**
- 🚨 **CRITICAL ERROR** ValidationToast appears
- Shows: "Cannot go backwards from Round 3 to Round 1"
- Rule: `round_regression`
- Timeline shows round change with **🚨** badge
- Round changes anyway (action executed)

---

### 📚 Test 6: Multiple Warnings Stack

**Goal:** Verify multiple ValidationToasts stack vertically.

**Steps:**
1. Set CP to 0
2. Say quickly: *"Using Transhuman, Moving to Movement, I gained 5 CP"*
3. Or say each separately with 2-3 seconds between

**Expected Results:**
- Multiple ValidationToasts appear stacked vertically
- Each has independent close/override buttons
- Can dismiss each individually
- Different severity colors visible (red, amber, etc.)
- Bottom-right corner placement
- No overlap

**Test Actions:**
- ✅ Override one warning → Only that toast disappears
- ✅ Dismiss another → That toast disappears
- ✅ Wait 10s with INFO toast → Auto-dismisses
- ✅ ERROR/WARNING toasts → Do NOT auto-dismiss

---

### 🎨 Test 7: Timeline Badges

**Goal:** Verify validation badges appear in timeline.

**Steps:**
1. Trigger various validation warnings (insufficient CP, phase errors, etc.)
2. Scroll through timeline

**Expected Results:**
- Events with validation warnings show colored badges:
  - ℹ️ **INFO** (blue) - Phase skip, duplicate in turn
  - ⚠️ **WARNING** (amber) - Unusual CP gain, duplicate in phase
  - ❌ **ERROR** (red) - Insufficient CP, invalid transition
  - 🚨 **CRITICAL** (dark red) - Round regression, excessive CP
- Overridden events show faded badge with "OVERRIDE" text
- Badges appear next to event type label
- Hover shows tooltip with severity level

**Badge Examples:**
```
STRATAGEM  ❌  12:34:56 PM
player used Transhuman Physiology (2 CP)

CUSTOM  ⚠️ OVERRIDE  12:35:10 PM
Validation override: Insufficient CP warning
```

---

### 📊 Test 8: Validation Analytics

**Goal:** Verify validation events are logged to database.

**Steps:**
1. Complete Tests 1-6 (generate various validations)
2. Open DevTools Console
3. Fetch validation stats:

```javascript
const sessionId = localStorage.getItem('taclog-current-session');
const response = await fetch(`/api/sessions/${sessionId}/validations?stats=true`);
const data = await response.json();
console.log(data);
```

**Expected Results:**
```json
{
  "events": [
    {
      "id": "...",
      "toolName": "log_stratagem_use",
      "severity": "error",
      "message": "Insufficient CP: ...",
      "rule": "insufficient_cp",
      "wasOverridden": true,
      "overriddenAt": "2025-01-01T12:00:00Z",
      "battleRound": 1,
      "phase": "Shooting",
      ...
    }
  ],
  "stats": {
    "total": 8,
    "bySeverity": {
      "info": 1,
      "warning": 3,
      "error": 3,
      "critical": 1
    },
    "overridden": 4,
    "byRule": {
      "insufficient_cp": 2,
      "duplicate_stratagem_this_phase": 1,
      "phase_sequence_violation": 1,
      "high_cp_gain": 1
    }
  }
}
```

---

## 🐛 Common Issues & Fixes

### Issue 1: "Session not found" error
**Fix:** 
```bash
# Clear old session and start fresh
localStorage.removeItem('taclog-current-session');
# Refresh page, click START
```

### Issue 2: ValidationToast doesn't appear
**Checks:**
- [ ] Is database migrated? Run `npx prisma db push`
- [ ] Check console for errors
- [ ] Verify tool result has `validation` field
- [ ] Check network tab → `/api/analyze` response

### Issue 3: Timeline badges missing
**Checks:**
- [ ] Refresh page to reload timeline
- [ ] Check event metadata has `severity` field
- [ ] Verify Timeline.tsx imports `ValidationSeverity` type

### Issue 4: Override button doesn't work
**Checks:**
- [ ] Check console for errors
- [ ] Verify session ID is set
- [ ] Check network tab → POST to `/api/sessions/{id}/events`

---

## ✅ Final Checklist

### UI Tests
- [ ] ValidationToast appears for errors
- [ ] ValidationToast appears for warnings
- [ ] ValidationToast appears for critical errors
- [ ] INFO toasts auto-dismiss after 10s
- [ ] ERROR/WARNING toasts require manual dismiss
- [ ] Multiple toasts stack without overlapping
- [ ] Override button logs to database
- [ ] Dismiss button closes toast
- [ ] Close (X) button works

### Timeline Tests
- [ ] Validation badges appear on events
- [ ] Badge colors match severity (blue/amber/red)
- [ ] Overridden events show "OVERRIDE" label
- [ ] Badge tooltips work on hover
- [ ] Timeline scrolls to latest event

### Database Tests
- [ ] ValidationEvent records created
- [ ] Override events logged correctly
- [ ] Stats endpoint works
- [ ] Phase/round context captured
- [ ] Tool args/result stored as JSON

### Integration Tests
- [ ] Validation doesn't block tool execution
- [ ] Game state updates correctly
- [ ] CP clamped at 0 (no negative)
- [ ] Timeline events created
- [ ] Langfuse traces include validation data

---

## 📈 Success Criteria

✅ **All test scenarios pass**  
✅ **No console errors during tests**  
✅ **Validation events logged to database**  
✅ **UI responsive and intuitive**  
✅ **Override system works correctly**  
✅ **Timeline badges visible**  

---

## 🎉 Post-Testing

Once all tests pass:

1. **Document any bugs found** in GitHub issues
2. **Update validation rules** if AI behavior is incorrect
3. **Adjust thresholds** (e.g., CP gain limits) if needed
4. **Add more test cases** for edge cases discovered
5. **Consider adding unit tests** for validation functions

---

## 💡 Tips for Effective Testing

1. **Use Clear Speech**: Better transcription = better results
2. **Wait for Processing**: Give AI 2-3 seconds to respond
3. **Check Console Logs**: Look for tool execution details
4. **Test Edge Cases**: Try boundary values (0 CP, max rounds, etc.)
5. **Test Overrides**: Make sure override tracking works
6. **Verify Database**: Check validation events are persisted
7. **Test on Mobile**: Ensure toasts are responsive

---

**Ready?** Start with Test 1 (Insufficient CP) and work through all scenarios! 🚀




