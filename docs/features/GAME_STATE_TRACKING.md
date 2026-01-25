# 🎮 Game State Dashboard - User Guide

## 🎉 What's New

Your Grimlog app now features a **comprehensive game state dashboard** that displays all critical game information in real-time!

### New Features Added:
✅ Two-panel dashboard (Player vs Opponent)
✅ Live CP (Command Points) tracking with manual adjustment
✅ Victory Points display
✅ Objective control visualization (5 objectives)
✅ Secondary objectives display
✅ Auto-updates when AI tools execute
✅ Manual CP +/- buttons for each player

---

## 📊 Dashboard Layout

```
┌──────────────────────────────────────────────────────────┐
│             ROUND 1 - SHOOTING PHASE                     │
├────────────────────────┬─────────────────────────────────┤
│     PLAYER (You)       │     OPPONENT                    │
├────────────────────────┼─────────────────────────────────┤
│ ⚡ CP: 5        [±]    │ ⚡ CP: 3         [±]            │
│ 🎯 VP: 15              │ 🎯 VP: 20                        │
│ 📍 OBJ: 🟠🟠🟠⚫⚫ (3) │ 📍 OBJ: 🔴🔴⚫⚫⚫ (2)          │
│                        │                                 │
│ Secondaries:           │ Secondaries:                    │
│ • Assassination        │ • No Prisoners                  │
│ • Deploy Scramblers    │ • Bring It Down                 │
│ • Engage All Fronts    │ • Teleport Homer                │
└────────────────────────┴─────────────────────────────────┘
```

---

## 🎤 Voice Commands for Game State

### 📍 Setting Secondary Objectives

**When:** During Command Phase at game start

**Say:**
- "My secondaries are Assassination, Deploy Scramblers, and Engage on All Fronts"
- "I'm taking Assassination, No Prisoners, and Bring It Down"
- "Opponent chose Assassination, Teleport Homer, and Grind Them Down"

**Result:** Secondaries appear in dashboard under each player

---

### 🔄 Redrawing a Secondary (Costs 1 CP)

**Say:**
- "I'm discarding Assassination and drawing Grind Them Down"
- "Redrawing my secondary from Deploy Scramblers to Teleport Homer for 1 CP"

**Result:** 
- Secondary updated in dashboard
- 1 CP deducted automatically
- Timeline event created

---

### 📍 Capturing Objectives

**Say:**
- "I captured objective 3"
- "I control objective 1 with my Intercessors"
- "Opponent took objective 5"

**Result:** Objective circles update in dashboard

---

### 🎯 Scoring Victory Points

**Say:**
- "I score 10 VP from primary objective"
- "I score 5 victory points from Assassination"
- "Opponent scores 8 VP from their secondary"

**Result:** VP totals update in dashboard

---

### ⚡ Command Points

**Via Voice:**
- "I gain 1 command point" (at start of turn)
- "I spend 2 CP on this stratagem"

**Via UI:**
- Click the **±** button next to CP
- Click **+1 CP** or **-1 CP**

**Note:** Stratagems automatically deduct CP!

---

## ⚙️ Auto CP Gain Rules

In Warhammer 40k 10th Edition:
- Players gain **1 CP per turn**
- Each battle round has **2 turns** (1 per player)
- Therefore: **2 CP total gained per round**

**Implementation:** Currently manual via voice/UI. Future: Auto-gain on turn changes.

---

## 🎨 Visual Design

### Color Coding:
- **Orange** = Player (you)
- **Red** = Opponent
- **Green** = Active values (CP/VP numbers)
- **Gray** = Empty/uncontrolled objectives

### Objective Circles:
- **Filled Orange Circle** 🟠 = Player controls
- **Filled Red Circle** 🔴 = Opponent controls
- **Empty Gray Circle** ⚫ = Uncontrolled
- Shows X/5 objectives controlled

---

## 🧪 Testing the Dashboard

### 1. Start a New Game
```
1. Click "▶ START" 
2. Dashboard appears (all values at 0)
```

### 2. Set Starting CP
**Say:** "I start with 5 command points"
**Result:** Player CP shows 5

**Say:** "Opponent starts with 3 CP"
**Result:** Opponent CP shows 3

### 3. Set Secondaries
**Say:** "My secondaries are Assassination, Deploy Scramblers, and Engage on All Fronts"
**Result:** All 3 appear under Player secondaries

### 4. Capture Objectives
**Say:** "I captured objectives 1, 2, and 3"
**AI:** Calls tool 3 times
**Result:** Player shows 3/5 objectives (3 orange circles)

### 5. Use Stratagem
**Say:** "Using Transhuman Physiology for 1 CP on my Terminators"
**Result:** 
- CP decreases by 1 (5 → 4)
- Toast shows confirmation
- Dashboard updates immediately

### 6. Score Points
**Say:** "I score 10 VP from primary objective"
**Result:** Player VP increases to 10

### 7. Manual CP Adjustment
```
1. Click ± button next to Player CP
2. Click "+1 CP" 
3. CP increases by 1
4. Timeline event logged
```

---

## 🛠️ Manual Controls

### Adjusting CP
1. **Click the ± button** next to any player's CP
2. **Choose:**
   - **-1 CP** = Subtract 1 command point
   - **+1 CP** = Add 1 command point
3. **Timeline logged** with reason "manually adjusted"
4. **Toast notification** confirms change

**Use cases:**
- Setting starting CP
- Correcting AI mistakes
- Gaining CP at start of turn

---

## 📋 Database Storage

All game state is persisted in the database:

### GameSession Table:
- `playerCommandPoints` / `opponentCommandPoints`
- `playerVictoryPoints` / `opponentVictoryPoints`
- `playerSecondaries` / `opponentSecondaries` (JSON arrays)
- `battleRound`
- `currentPhase`

### ObjectiveMarker Table:
- `objectiveNumber` (1-5)
- `controlledBy` ("player" / "opponent" / "contested" / "none")
- `controllingUnit` (optional unit name)

---

## 🎯 Common Workflows

### Game Start Setup
```
1. START new session
2. Say: "I start with 5 command points"
3. Say: "Opponent starts with 5 command points"
4. Say: "My secondaries are X, Y, and Z"
5. Say: "Opponent's secondaries are A, B, and C"
6. Ready to play!
```

### Turn Sequence
```
1. Command Phase starts
2. Say: "I gain 1 command point" 
3. Set secondaries (if first turn)
4. Continue with phases...
```

### End of Round
```
1. Click "ROUND" button
2. Both players gain 1 CP each automatically (future feature)
3. Resets to Command Phase
```

---

## 🔧 Troubleshooting

### Issue: Dashboard not showing
**Fix:** Dashboard only appears when a session is active. Click "START" first.

### Issue: CP not updating after stratagem
**Fix:** 
1. Check console for tool execution logs
2. Verify stratagem tool was called
3. Refresh page to sync with database

### Issue: Objectives not counting
**Fix:**
1. Make sure you say "captured objective 3" (specific number)
2. Check ObjectiveMarker table in Prisma Studio
3. Run `refreshGameState()` to resync

### Issue: Secondaries not showing
**Fix:**
1. Secondaries are stored as JSON - check database
2. Say all secondaries in one sentence
3. Format: "My secondaries are X, Y, and Z"

---

## 🚀 Future Enhancements

Coming soon:
- [ ] Auto CP gain at start of each turn (1 CP)
- [ ] Objective marker labels (show which objectives: 1,3,5)
- [ ] Secondary objective progress tracking (5/15 VP)
- [ ] Mission/deployment type selection
- [ ] Suggested secondary objectives based on army
- [ ] CP spend breakdown (how CP was used)

---

## 📝 Technical Notes

### Component Location:
- `components/GameStateDisplay.tsx` - Main dashboard UI
- `lib/aiTools.ts` - Tool definitions for secondaries
- `lib/toolHandlers.ts` - Secondary objective handlers
- `app/page.tsx` - Integration and state management

### New AI Tools:
1. `set_secondary_objectives` - Sets player's secondaries
2. `redraw_secondary_objective` - Redraws one for 1 CP

### Database Schema Changes:
```prisma
model GameSession {
  // ... existing fields
  playerSecondaries    String?  // JSON array
  opponentSecondaries  String?  // JSON array
}
```

---

## 🎊 You're Ready!

The game state dashboard is fully integrated and working. Start a new session and try the voice commands above to see it in action!

**Quick Test:**
1. START session
2. Say: "I start with 5 command points"
3. Say: "My secondaries are Assassination, Deploy Scramblers, Engage on All Fronts"
4. Say: "I captured objective 3"
5. Say: "I score 10 VP from primary"
6. Watch dashboard update in real-time! 🎉

For questions, check the console logs or database in Prisma Studio (`npx prisma studio`).

