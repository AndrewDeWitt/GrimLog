# Validation System - Testing Guide

## ✅ What's Been Implemented

The validation system is now **fully integrated into the UI**! Here's what works:

### Backend (Completed)
- ✅ AI receives full game state context (CP, VP, phase, round, recent stratagems)
- ✅ Warhammer rules cheat sheet injected into AI prompt
- ✅ Validation checks in all critical tool handlers
- ✅ Validation results attached to tool execution responses

### Frontend (Completed)
- ✅ ValidationToast component with beautiful severity-based styling
- ✅ State management for multiple validation warnings
- ✅ Automatic detection of validation warnings from tool results
- ✅ Stacked toast display (multiple warnings shown simultaneously)
- ✅ Override button with database logging
- ✅ Dismiss button to close warnings
- ✅ Auto-dismiss for info-level warnings (10s)

---

## 🧪 How to Test

### Test Scenario 1: Insufficient CP Error ❌

**Setup:**
1. Start a new game session (click START)
2. Wait for "Audio capture started" toast
3. Manually adjust player CP to 0 (use the +/- buttons in Game State Dashboard)

**Test:**
1. Say: *"Using Transhuman Physiology on my Terminators"*
2. Wait for processing

**Expected Result:**
- ❌ **ERROR** ValidationToast appears
- Shows: "Insufficient CP: player has 0 CP but stratagem costs 2 CP"
- Rule: `insufficient_cp`
- Suggestion: "Verify CP cost or current CP total"
- Action executed: "Transhuman Physiology used (-2 CP, 0 CP remaining)"
- Two buttons: **[OVERRIDE & ACCEPT]** **[DISMISS]**

**Actions to Try:**
- Click **OVERRIDE & ACCEPT** → Toast disappears, event logged to database
- Click **DISMISS** → Toast disappears without additional logging
- Wait (it won't auto-dismiss for errors)

---

### Test Scenario 2: Duplicate Stratagem Warning ⚠️

**Setup:**
1. Have at least 2 CP available
2. Use a stratagem once

**Test:**
1. Say: *"Using Transhuman Physiology"* (first time - should work normally)
2. Wait for success toast
3. Say: *"Using Transhuman Physiology again"* (second time in same phase)

**Expected Result:**
- ⚠️ **WARNING** ValidationToast appears
- Shows: "Transhuman Physiology may have already been used by player this phase"
- Rule: `duplicate_stratagem_this_phase`
- Suggestion: "Check if stratagem has 'once per phase' restriction"
- Buttons: **[OVERRIDE & ACCEPT]** **[DISMISS]**

---

### Test Scenario 3: Invalid Phase Transition ❌

**Setup:**
1. Currently in Shooting phase

**Test:**
1. Say: *"Moving to Movement phase"* (backwards transition)

**Expected Result:**
- ❌ **ERROR** ValidationToast appears
- Shows: "Invalid phase transition: Cannot go backwards from Shooting to Movement"
- Rule: `phase_sequence_violation`
- Suggestion: "Valid next phase: Charge"
- Buttons: **[OVERRIDE & ACCEPT]** **[DISMISS]**

---

### Test Scenario 4: High CP Gain Warning ⚠️

**Test:**
1. Say: *"I gained 3 CP"* (unusual but possible with certain abilities)

**Expected Result:**
- ⚠️ **WARNING** ValidationToast appears
- Shows: "Gaining 3 CP is unusual (standard is +1 per turn, max +2 with secondary discard)"
- Rule: `high_cp_gain`
- Suggestion: "Check for special abilities or rules"
- Buttons: **[OVERRIDE & ACCEPT]** **[DISMISS]**

---

### Test Scenario 5: Critical Round Error 🚨

**Setup:**
1. Currently in Round 3

**Test:**
1. Say: *"Moving to Round 1"* (backwards in rounds)

**Expected Result:**
- 🚨 **CRITICAL ERROR** ValidationToast appears
- Shows: "Cannot go backwards from Round 3 to Round 1"
- Rule: `round_regression`
- Suggestion: "Use manual correction if needed"
- Buttons: **[OVERRIDE & ACCEPT]** **[DISMISS]**

---

### Test Scenario 6: Multiple Warnings Stacking

**Test:**
1. Trigger multiple validation warnings quickly:
   - Say: *"Using Transhuman"* (with 0 CP)
   - Say: *"Moving to Movement phase"* (while in Shooting)
   - Say: *"I gained 5 CP"*

**Expected Result:**
- Multiple ValidationToast components stack vertically
- Each has its own close/override buttons
- Can be dismissed independently
- Bottom-right corner of screen

---

## 🎨 Validation Severity Visual Guide

### ✓ Valid (Green)
- No toast shown
- Action executed normally

### ℹ Info (Blue)
- Blue border and text
- Auto-dismisses after 10 seconds
- Example: Phase skip, duplicate stratagem in turn

### ⚠️ Warning (Amber/Orange)
- Amber border and text
- Requires manual dismiss or override
- Example: Unusual CP gain, potential duplicate stratagem

### ❌ Error (Red)
- Red border and text
- Requires manual dismiss or override
- Example: Insufficient CP, invalid phase transition

### 🚨 Critical (Dark Red)
- Dark red border and bright red text
- Requires manual dismiss or override
- Example: Round regression, excessive CP gain (>3)

---

## 🔍 Debugging Tips

### Check Console Logs:
1. Open browser DevTools (F12)
2. Go to Console tab
3. Look for:
   ```
   Tool calls executed: [...]
   User overrode validation warning: {...}
   ```

### Check Database Events:
1. Override events are logged to the timeline
2. Check: `/api/sessions/{sessionId}/events`
3. Look for `eventType: 'custom'` with `wasOverridden: true` in metadata

### Check Game State:
1. The AI receives game state in the prompt
2. Check network tab → `/api/analyze` request
3. Look at the FormData being sent

---

## 📊 What to Observe

### When Validation Works:
- ✅ ValidationToast appears with detailed information
- ✅ Action still executes (shown in "Action executed:" line)
- ✅ Game state updates correctly
- ✅ Timeline shows the event
- ✅ Override logs to database

### When Validation Doesn't Trigger:
- Action executes normally
- Green success toast appears (old behavior)
- No validation warnings
- This is correct for valid actions!

---

## 🐛 Known Limitations

1. **Stratagem Restrictions**: We validate duplicates by name, but don't have a database of which stratagems have "once per phase/turn/battle" restrictions
2. **CP Gain Tracking**: We don't track CP gains per round yet (requires database schema update)
3. **Unit Tracking**: We don't validate unit-specific actions (e.g., unit already destroyed)
4. **Phase Context**: Stratagem phase restrictions aren't validated (e.g., can't use a Command phase stratagem in Shooting)

These will be addressed in future phases.

---

## 🚀 Next Steps (Optional)

Want to enhance the system further?

1. **Add Timeline Badges** - Show validation icons next to timeline events
2. **Validation History** - Track all overrides for post-game analysis
3. **Stratagem Database** - Add metadata about stratagem restrictions
4. **RAG System** - Add rule citation system with pgvector

---

## 💡 Tips for Best Results

1. **Speak Clearly**: Better transcription = better validation
2. **Be Specific**: "Using Transhuman on Terminators" works better than just "Transhuman"
3. **Check Game State**: Make sure CP/VP values are accurate before testing
4. **Test Edge Cases**: Try intentionally wrong actions to see validation in action
5. **Override Wisely**: Use override when you know the AI is wrong (e.g., special rules, house rules)

---

## 📝 Test Checklist

- [ ] Test insufficient CP error
- [ ] Test duplicate stratagem warning
- [ ] Test invalid phase transition
- [ ] Test high CP gain warning
- [ ] Test round regression error
- [ ] Test multiple warnings stacking
- [ ] Test override button functionality
- [ ] Test dismiss button functionality
- [ ] Test auto-dismiss for info messages
- [ ] Verify override events logged to database
- [ ] Check console logs for debugging info
- [ ] Test on mobile (responsive design)

---

**Ready to test?** Start a game, make some intentionally wrong actions, and watch the validation system catch them! 🎮




