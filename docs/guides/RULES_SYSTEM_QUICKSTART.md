# Rules System Quick Start

**Last Updated:** 2024-11-12  
**Status:** Complete

## Overview

Get started with Grimlog's rules-based gameplay enhancement in 5 minutes. This guide covers setup and first-time usage.

## Table of Contents

- [Current Status](#current-status)
- [What's Working](#whats-working)
- [First Time Use](#first-time-use)
- [Testing the Features](#testing-the-features)
- [Next Steps](#next-steps)

---

## Current Status

✅ **Database:** Synced with 46 rules loaded  
✅ **Code:** All features implemented and tested  
✅ **Preserved:** All your existing datasheets, armies, and units

**Rules Loaded:**
- 7 primary missions
- 13 CP validation rules
- 26 phase transition rules

---

## What's Working

### 1. Mission Selection
- 7 tournament missions available
- Mission context in AI prompts
- Scoring reminders

### 2. CP Validation
- Max 2 CP/turn enforcement
- Transaction logging
- Validation warnings

### 3. Secondary Auto-Calculation
- 6 specialized scoring tools
- Fallback VP calculations (works without DB rules)
- Progress tracking

### 4. Proactive Features
- Phase transition reminders
- Damaged state detection  
- Battle-shock alerts

---

## First Time Use

### Start the App

```bash
npm run dev
```

Navigate to `http://localhost:3000`

### Create or Load a Session

Your existing sessions will work normally - new features enhance gameplay.

---

## Testing the Features

### Test 1: CP Validation

**Say:** "Attacker gets 500 CP"

**Expected:**
- ❌ Error validation toast appears
- Message: "Would exceed absolute max CP per turn"
- CP not added

**Result:** CP validation is working! ✅

### Test 2: Secondary Scoring

**Prerequisites:**
1. Set a secondary (e.g., "Assassination") for attacker

**Say:** "Destroyed captain for assassination"

**Expected:**
- ✅ AI looks up captain's wounds
- ✅ Calculates VP (typically 4 VP for 5W captain)
- ✅ Updates secondary progress
- Message: "Assassination: Captain (5W) = 4 VP. Total: 4/20 VP"

### Test 3: Phase Reminders

**Say:** "Moving to Command phase"

**Expected:**
- ✅ Phase changes
- ✅ Reminder about +1 CP automatic
- ✅ Battle-shock check reminder
- ✅ Mission scoring reminder (if applicable)

### Test 4: Mission Selection

**In UI:**
1. Create new session (or edit existing)
2. Look for mission selection option
3. Browse 7 available missions
4. Select one and confirm

**Expected:**
- ✅ Mission saves to session
- ✅ AI mentions mission in responses
- ✅ Mission context in prompts

---

## Next Steps

### Optional Enhancements

1. **Add Mission Scoring Formulas:**
   - Open Prisma Studio: `npx prisma studio`
   - Edit PrimaryMission table
   - Add scoring formulas manually

2. **Test More Features:**
   - Try all 6 secondary scoring tools
   - Test CP transaction history
   - Verify phase reminders

3. **Add More Rules:**
   - Parse additional PDFs when ready
   - See [Rules Extensibility Guide](./RULES_EXTENSIBILITY_GUIDE.md)

---

## Related Documentation

- [Rules System Guide](./RULES_SYSTEM_GUIDE.md) - Full feature guide
- [Mission System](../features/MISSION_SYSTEM.md) - Technical details
- [Secondary Auto-Calculation](../features/SECONDARY_OBJECTIVES_AUTO_CALCULATION.md) - How scoring works
- [Rules Extensibility](./RULES_EXTENSIBILITY_GUIDE.md) - Adding new rules


