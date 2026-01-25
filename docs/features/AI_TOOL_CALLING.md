# AI Tool Calling Implementation - Setup Guide

## 🎉 What's New

Your AI agent now uses **OpenAI Function Calling** to execute structured actions! Instead of just returning JSON, the AI can now:

- ✅ Call multiple tools in one response
- ✅ Automatically update game state (phase, CP, VP, objectives)
- ✅ Track stratagem usage with CP deduction
- ✅ Log unit actions and combat results
- ✅ Query game state to answer questions
- ✅ Execute actions immediately with database persistence

## 🗄️ Database Changes

### New Models Added:
1. **ObjectiveMarker** - Track objectives 1-6 and who controls them
2. **UnitInstance** - Track active units with wounds, models, and effects
3. **StratagemLog** - Detailed stratagem usage log
4. **CombatLog** - Combat outcomes and casualties

### GameSession Fields Added:
- `currentPlayerTurn` - Whose turn it is ("player" or "opponent")
- `playerCommandPoints` - Player's CP (starts at 0, you set initial value)
- `opponentCommandPoints` - Opponent's CP
- `playerVictoryPoints` - Player's VP
- `opponentVictoryPoints` - Opponent's VP

## 🚀 Migration Steps

### 1. Run Prisma Migration

```bash
npx prisma migrate dev --name add_ai_tool_calling
```

This will:
- Create the new database tables
- Add new fields to GameSession
- Generate updated Prisma Client

### 2. Regenerate Prisma Client (if needed)

```bash
npx prisma generate
```

### 3. Optional: Seed Starting CP for Existing Sessions

If you have existing sessions, you may want to set their starting CP:

```bash
# Create a quick seed script or run in Prisma Studio
npx prisma studio
```

Navigate to GameSession and set:
- `playerCommandPoints` = 0 (or your starting CP)
- `opponentCommandPoints` = 0
- `currentPlayerTurn` = "player"

## 🎮 Available AI Tools

The AI can now call these functions automatically based on voice input:

### 1. **change_phase**
Triggered by: "Moving to shooting phase", "Starting command phase"
- Updates current phase
- Tracks whose turn it is
- Creates timeline event

### 2. **advance_battle_round**
Triggered by: "Starting round 2", "Next round"
- Increments battle round
- Resets to Command phase
- Creates timeline event

### 3. **log_stratagem_use**
Triggered by: "Using Transhuman for 1 CP on my Terminators"
- Logs stratagem name
- **Automatically deducts CP**
- Creates timeline event
- Logs to StratagemLog table

### 4. **update_command_points**
Triggered by: "I gain 1 CP", "Opponent gains 1 command point"
- Adjusts CP up or down
- Creates timeline event with reason

### 5. **update_victory_points**
Triggered by: "I score 5 VP from primary", "Opponent scores 10 points"
- Adds VP to player or opponent
- Tracks source (primary, secondary, etc.)
- Creates timeline event

### 6. **update_objective_control**
Triggered by: "I captured objective 3", "Opponent holds objective 1"
- Updates ObjectiveMarker table
- Tracks controlling unit (optional)
- Creates timeline event

### 7. **log_unit_action**
Triggered by: "My Terminators deep strike", "I advance with my Dreadnought"
- Logs unit movements
- Tracks charge success/failure
- Creates timeline event

### 8. **log_combat_result**
Triggered by: "My bolters killed 5 Orks", "Opponent destroyed my tank"
- Logs wounds and casualties
- Tracks unit destruction
- Creates CombatLog entry
- Creates timeline event

### 9. **query_game_state**
Triggered by: "How many CP do I have?", "What's the score?"
- Returns current game state
- No database changes
- Shows info in toast notification

## 🔧 Testing the System

### Test Voice Commands:

1. **Phase Change:**
   - Say: "Moving to my shooting phase"
   - Expected: Phase changes, toast shows "Changed to Shooting phase (player's turn)"

2. **Stratagem Use:**
   - Say: "Using Transhuman Physiology for 1 CP on my Intercessors"
   - Expected: Toast shows "Transhuman Physiology used (-1 CP, X CP remaining)"

3. **Multiple Actions:**
   - Say: "I'm in shooting phase and using Transhuman for 1 CP"
   - Expected: TWO toasts - one for phase change, one for stratagem

4. **Objective Control:**
   - Say: "I captured objective 3 with my Tactical Squad"
   - Expected: Toast shows "Objective 3 controlled by player (Tactical Squad)"

5. **Victory Points:**
   - Say: "I score 5 victory points from primary objective"
   - Expected: Toast shows "player scored 5 VP from primary objective (X total)"

6. **Query State:**
   - Say: "How many command points do I have?"
   - Expected: Toast shows "player has X CP"

## 📊 Monitoring Tool Calls

### Check Console Logs:
```
Executing 2 tool calls...
Executing tool: change_phase { new_phase: 'Shooting', player_turn: 'player' }
Tool change_phase result: { success: true, message: '...' }
```

### Check Database:
```bash
npx prisma studio
```

View:
- **StratagemLog** - All stratagem uses
- **ObjectiveMarker** - Current objective status
- **CombatLog** - Combat history
- **TimelineEvent** - All events with metadata

### Check Timeline:
The Timeline component shows all events in chronological order with full descriptions.

## 🐛 Troubleshooting

### Issue: Tools not executing
**Check:**
1. Console shows "Executing X tool calls..." - if not, AI didn't call any tools
2. OpenAI API key is valid
3. Database connection is working
4. Session ID exists

### Issue: CP not deducting
**Check:**
1. Starting CP is set (not 0 if you've gained CP)
2. StratagemLog table has the entry
3. GameSession.playerCommandPoints is updating

### Issue: Timeline not updating
**Check:**
1. Timeline events are being created (check TimelineEvent table)
2. Frontend is calling `refreshGameState()` after tool execution
3. No errors in browser console

### Issue: AI calling wrong tool
**Fix:**
- AI is trained on natural language patterns
- Try being more explicit: "I am using the stratagem Transhuman Physiology which costs 1 command point"
- Check system prompt in `lib/aiTools.ts` for examples

## 🎯 Best Practices

### Voice Commands:
1. **Be explicit about ownership:**
   - Good: "**I** captured objective 3"
   - Good: "**My opponent** used a stratagem"
   
2. **Include key details:**
   - Good: "Using Transhuman **for 1 CP** on my Terminators"
   - Bad: "Using Transhuman" (AI might guess CP cost)

3. **Combine actions naturally:**
   - Good: "Moving to shooting and using Fire Overwatch for 1 CP"
   - AI will call both `change_phase` AND `log_stratagem_use`

### Setting Initial CP:
At the start of a game, say:
- "I start with 5 command points"
- "Opponent has 3 command points"

Or manually set in database/UI.

## 📈 Future Enhancements

Ready to add:
- **Dice roll logging** (already defined, just needs UI)
- **Unit status tracking** (wounds remaining, battle shocked)
- **Tactical suggestions** (AI analyzes and suggests options)
- **Validation/correction** ("Undo that", "Actually I meant...")

## 🎊 Next Steps

1. Run the migration: `npx prisma migrate dev --name add_ai_tool_calling`
2. Start your dev server: `npm run dev`
3. Start a new game session
4. Try the test commands above
5. Check the console and database to see tool execution

## 📝 Notes

- **Model:** Currently using `gpt-5-nano` (called "gpt-5-nano" in code)
- **Cost:** ~$0.15 per 1M input tokens, $0.60 per 1M output tokens
- **Auto-execution:** Tools execute immediately (Option A - no confirmation)
- **Toast feedback:** Each successful tool call shows a notification (Option B)
- **Multiple tools:** AI can call multiple tools in one response (Option A)

Enjoy your new AI-powered game tracker! 🎲⚙️

