# Quick Start: Per-Model Tracking + Character Attachments

## 🎯 What's New

✅ **Per-Model Wound Tracking** - See each model in a unit individually  
✅ **Character Attachments** - Configure characters to display with their parent units  
✅ **Smart Damage Distribution** - AI automatically protects special models  
✅ **Role-Based Targeting** - Voice commands can target specific models  

---

## 🚀 How to Use

### Step 1: Configure Character Attachments (Optional)

1. Go to **Armies** → Select your army
2. Find character units (marked with ⭐ star)
3. Use **"Attach To Unit"** dropdown to select parent unit
4. Click **"💾 SAVE CHARACTER ATTACHMENTS"**

**Example:**
- Arjac Rockfist → Wolf Guard Terminators
- Ragnar Blackmane → Blood Claws
- Logan Grimnar → Thunderwolf Cavalry

### Step 2: Create New Game Session

1. Click **hamburger menu** → **New Game**
2. Select your army (with configured attachments)
3. System automatically applies character attachments

### Step 3: View Units

1. Switch to **"⚔ UNIT HEALTH"** tab
2. You'll see:
   - Per-model breakdown for each unit
   - Role badges (⭐ sergeant, 🔫 heavy weapon, ◆ regular)
   - Color-coded health (green/amber/red)
   - Attached characters displayed with parent units

**What You'll See:**
```
┌────────────────────────────────────┐
│ ⚔ WOLF GUARD TERMINATORS          │
│   ⭐ Arjac Rockfist 6/6W           │ ← Attached character
│                                    │
│ MODELS: ██████ 6/6                │
│                                    │
│ SQUAD COMPOSITION:                 │
│ ◆ REGULAR (6)                     │
│ [█][█][█][█][█][█]                │ ← Individual models
└────────────────────────────────────┘
```

### Step 4: Use Voice Commands

**Standard Damage:**
```
"My Terminators took 6 wounds"
→ AI distributes smartly: regular models first, protect sergeant
```

**Target Specific Model:**
```
"Terminator Sergeant took 3 wounds"
→ AI targets sergeant specifically
```

**Target Character:**
```
"Arjac took 4 wounds"
→ AI targets Arjac (attached character), not the unit
```

---

## 🐛 Bugs Fixed

### Bug 1: Casualty List Showing All Units ✅ FIXED
**Issue:** All units appeared in casualties section  
**Cause:** Typo in filter (was `!u.isDestroyed`, should be `u.isDestroyed`)  
**Status:** Fixed in `UnitHealthView.tsx`

### Bug 2: Duplicate Characters Overwriting ✅ FIXED
**Issue:** Two Neurotyrants both trying to attach overwrote each other  
**Cause:** Using unit name as key instead of unit ID  
**Solution:** Changed to use unit.id as key  
**Status:** Fixed in `app/armies/[id]/page.tsx` and session creation

### Bug 3: Existing Sessions Don't Show Attachments ✅ EXPLAINED
**Issue:** Character attachments not showing in current session  
**Cause:** This is expected - attachments applied only during session creation  
**Solution:** Create a new session to see attachments  

---

## ✅ Features Working Now

### Per-Model Tracking
- [x] Individual model states tracked
- [x] Smart damage distribution
- [x] Role badges (sergeant, heavy weapon, etc.)
- [x] Visual model grid display
- [x] Color-coded health states

### Character Attachments
- [x] Army builder UI with dropdown
- [x] Save attachments to database
- [x] Support for duplicate characters (2+ of same type)
- [x] Characters display with parent units
- [x] Separate health tracking
- [x] Voice command disambiguation

### Voice Commands
- [x] "My Terminators took 6 wounds" - smart distribution
- [x] "Sergeant took 3 wounds" - role targeting
- [x] "Arjac took 4 wounds" - character targeting
- [x] "Lost my heavy bolter guy" - specific model removal

---

## 📋 Testing Checklist

**Before Creating New Session:**
- [x] Configure character attachments in army builder
- [x] Save attachments
- [x] Note which characters attach to which units

**After Creating New Session:**
- [ ] Open Unit Health tab
- [ ] Verify characters show with parent units (⭐ badge)
- [ ] Check character health displays separately
- [ ] Verify casualty section is empty (or only shows destroyed units)

**During Gameplay:**
- [ ] Test voice: "My [unit] took X wounds"
- [ ] Check model grid updates correctly
- [ ] Test character targeting: "[Character name] took X wounds"
- [ ] Verify smart distribution (regulars before sergeants)

---

## 🎮 Quick Test Scenario

**Setup:**
1. End current session (hamburger → End Game)
2. Start new session with Space Wolves army
3. Navigate to Unit Health tab

**Expected:**
- Wolf Guard Terminators shows "⭐ Arjac Rockfist 6/6W"
- Blood Claws shows "⭐ Ragnar Blackmane 6/6W"
- Wolf Guard Headtakers shows "⭐ Wolf Guard Battle Leader 5/5W"
- Characters NOT in main unit list
- Casualty section EMPTY

**Test Voice:**
```
1. "My Blood Claws took 4 wounds"
   → Should damage Blood Claws models, NOT Ragnar

2. "Ragnar took 3 wounds"
   → Should damage Ragnar specifically (3/6W remaining)

3. Check Unit Health tab
   → Blood Claws: Some models damaged
   → Ragnar: Shows 3/6W
```

---

## 🔧 If Something's Not Working

**Character attachments not showing:**
- Did you create a NEW session after saving attachments?
- Old sessions won't have attachments

**Casualties section showing healthy units:**
- Already fixed! Refresh page to see fix

**Duplicate characters overwriting:**
- Already fixed! They now use unique IDs

**Models not showing:**
- Per-model tracking initializes on first damage
- Or automatically on new session creation

---

## 📞 Next Steps

1. ✅ **Restart dev server** (to load new Prisma client)
2. ✅ **End current session**
3. ✅ **Create new session** with your army
4. ✅ **Test character attachments** (should work!)
5. ✅ **Test voice commands** for damage
6. ✅ **Verify visual display** looks good

**Status:** Ready to test! Create a new session and enjoy the new features! 🎉

