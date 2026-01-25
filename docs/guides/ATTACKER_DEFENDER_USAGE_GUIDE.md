# Attacker vs Defender Usage Guide

**Last Updated:** 2025-11-02  
**Status:** Complete  
**Version:** 4.0.0

## Overview

This guide explains how to use Grimlog's Attacker vs Defender terminology system in your daily gameplay.

## Table of Contents

- [Quick Reference](#quick-reference)
- [Session Setup](#session-setup)
- [During Gameplay](#during-gameplay)
- [Voice Commands](#voice-commands)
- [UI Navigation](#ui-navigation)
- [Common Questions](#common-questions)
- [Related Documentation](#related-documentation)

## Quick Reference

### Terminology at a Glance

| Term | Meaning | Set When | Changes During Game? |
|------|---------|----------|---------------------|
| **Attacker** | First designated side | Session creation | ❌ No - stays consistent |
| **Defender** | Second designated side | Session creation | ❌ No - stays consistent |
| **Current Turn** | Who's turn it is now | Each phase/turn change | ✅ Yes - alternates |

### Key Principle

**Attacker and Defender are ROLES, not positions or perspectives.**

Think of it like:
- Attacker = Team A (stays Team A all game)
- Defender = Team B (stays Team B all game)
- Current Turn = Who's playing right now (alternates)

## Session Setup

### 1. Creating a New Game

When creating a session, you'll choose:

1. **Attacker Army** - This is the first army (typically yours if you're hosting)
2. **Defender Army** - This is the second army (typically your opponent's)
3. **First Turn** - Who goes first each round (usually Attacker, but could be Defender based on mission rules)

```
┌─────────────────────────────┐
│   New Game Session Setup    │
├─────────────────────────────┤
│                             │
│ Attacker Army: [Select ▼]  │
│   → Space Marines (2000pts) │
│                             │
│ Defender Army: [Select ▼]  │
│   → Tyranids (2000pts)      │
│                             │
│ First Turn:                 │
│   ● Attacker  ○ Defender    │
│                             │
│         [START GAME]        │
└─────────────────────────────┘
```

### 2. What Gets Assigned

Once you start:
- All Attacker units get **red theme** (borders, text, accents)
- All Defender units get **green theme** (borders, text, accents)
- Command/Victory Points tracked separately
- These designations **never change** during the game

## During Gameplay

### Turn Sequence

```
Round 1:
  ├─ Attacker's Turn
  │   ├─ Command Phase
  │   ├─ Movement Phase
  │   ├─ Shooting Phase
  │   ├─ Charge Phase
  │   └─ Fight Phase
  │
  └─ Defender's Turn
      ├─ Command Phase
      ├─ Movement Phase
      ├─ Shooting Phase
      ├─ Charge Phase
      └─ Fight Phase

Round 2: [Repeats...]
```

### Understanding the Display

**Phase Indicator:**
```
┌──────────────────────────────┐
│ ROUND 2 - MOVEMENT PHASE     │
│ Attacker's Turn              │  ← Who's playing now
└──────────────────────────────┘
```

**Resource Tracking:**
```
Attacker CP: 3    Attacker VP: 25
Defender CP: 2    Defender VP: 18
```

**Unit Ownership:**
```
🔴 Attacker's Terminators (5 models, 15W) - Red theme
🟢 Defender's Hive Tyrant (1 model, 10W) - Green theme
```

## Voice Commands

### Correct Phrasing

**✅ Use Attacker/Defender:**
- "Attacker's Terminators took 6 wounds"
- "Defender scored 4 VP for Assassination"
- "Moving to Shooting phase, Attacker's turn"
- "Defender controls objective 3"

**❌ Avoid Your/Opponent:**
- ~~"My Terminators took 6 wounds"~~ → Ambiguous who "my" is
- ~~"Opponent scored 4 VP"~~ → Unclear which opponent
- ~~"Your turn"~~ → Doesn't work with neutral system

### Phase Changes

```
✅ "Moving to Movement phase, Attacker's turn"
✅ "Entering Shooting phase, Defender's turn"  
✅ "Defender ends turn" (automatically switches)
```

### Unit Actions

```
✅ "Attacker's Intercessors advance 6 inches"
✅ "Defender's Carnifex charges the Terminators"
✅ "Attacker's Captain used Rites of Battle"
```

### Damage and Combat

```
✅ "Attacker's Dreadnought killed Defender's Genestealers"
✅ "Defender's Terminators lost 3 models"
✅ "Attacker scored Bring It Down, killed Land Raider with 18 wounds"
```

## UI Navigation

### Resource Management

**Command Points:**
- Click +/- buttons next to "Attacker CP" or "Defender CP"
- Voice: "Attacker spends 2 CP" or "Defender gains 1 CP"

**Victory Points:**
- Click +/- buttons next to "Attacker VP" or "Defender VP"
- Voice: "Attacker scored 5 VP for primary"

### Secondary Objectives

**Tabs:**
- "ATTACKER SECONDARIES (2/2)" - Attacker's chosen objectives
- "DEFENDER SECONDARIES (2/2)" - Defender's chosen objectives

**Scoring:**
- Click checkboxes to manually score
- Voice: "Attacker scored Assassination for 4 VP"

### Unit Management

**Filter by Owner:**
- Units are automatically color-coded
- 🔴 Red = Attacker's units
- 🟢 Green = Defender's units

**Manual Health Updates:**
- Click unit card → Model Details
- Adjust wounds for specific side's units

## Common Questions

### Q: Can I change who is Attacker mid-game?

**A:** No. Attacker and Defender are set at session creation and remain consistent throughout the game. This is intentional to avoid confusion.

### Q: What if the Defender is attacking during their turn?

**A:** The terms "Attacker" and "Defender" are **roles/designations**, not descriptions of current actions. The Defender can absolutely attack during their turn - they're still called "Defender" because that's their designated role for this game.

Think of it like team colors: Team Blue vs Team Red. Team Blue can attack Team Red, and vice versa, but they keep their team color names.

### Q: Why not just use "Player 1" and "Player 2"?

**A:** "Attacker" and "Defender" are more thematic and align with Warhammer 40K terminology. They also make it clearer who has battlefield initiative/priority.

### Q: What happened to "Your army"?

**A:** We eliminated possessive language ("your", "their") because it doesn't work well with:
- Shared sessions where both players use the same interface
- Voice commands where "my" is ambiguous
- AI processing where perspective shifts

You'll still see "Your session" or "Your settings" for user-specific data, but never "Your army" in game context.

### Q: How do I know which is which?

**A:** Look for color coding:
- 🔴 **Red theme** = Attacker (borders, text, accents)
- 🟢 **Green theme** = Defender (borders, text, accents)

Also check the session info panel which shows the army assignments.

### Q: Can I swap roles between games?

**A:** Yes! When creating a new session, you can designate armies however you want. One game you might be Attacker, next game you might be Defender.

## Voice Command Examples

### Phase Management
```
✅ "Starting Command phase, Attacker's turn"
✅ "Moving to Shooting phase"  
✅ "Defender ends turn"
✅ "Starting Round 2"
```

### Resource Tracking
```
✅ "Attacker spends 2 CP on Transhuman"
✅ "Defender gains 1 CP"
✅ "Attacker scored 10 VP for primary objective"
```

### Unit Health
```
✅ "Attacker's Terminators took 8 wounds"
✅ "Defender's Termagants lost 6 models"
✅ "Attacker's Captain is destroyed"
✅ "Defender's Carnifex is battle-shocked"
```

### Objectives
```
✅ "Attacker controls objective 2"
✅ "Defender captured objective 5 with Genestealers"
✅ "Objective 3 is contested"
```

### Secondary Objectives
```
✅ "Attacker scored Assassination, killed Captain"
✅ "Defender scored 3 VP for No Prisoners"
✅ "Attacker completed Behind Enemy Lines for 4 VP"
```

### Combat Logging
```
✅ "Attacker's Dreadnought killed 5 Termagants"
✅ "Defender's Hive Tyrant killed the Captain"
```

## Best Practices

### DO:
- ✅ Always specify "Attacker" or "Defender" in voice commands
- ✅ Use the color coding to quickly identify unit ownership
- ✅ Check the phase indicator to see whose turn it is
- ✅ Be specific: "Attacker's Terminators" not just "Terminators"

### DON'T:
- ❌ Use "my" or "your" in voice commands
- ❌ Say "opponent" or "enemy"
- ❌ Assume the AI knows which side you mean without specifying
- ❌ Try to change Attacker/Defender mid-game

## Transitioning from v3.x

If you're used to the old system:

**Old Habit → New Approach:**
- ~~"My army"~~ → "Attacker's army" or "Defender's army"
- ~~"Opponent's units"~~ → "Defender's units" or "Attacker's units"
- ~~"Your turn"~~ → "Attacker's turn" or "Defender's turn"
- ~~"I scored 5 VP"~~ → "Attacker scored 5 VP"

**Tip**: After 2-3 games, the new terminology becomes natural!

## Related Documentation

- [Attacker vs Defender Terminology](../features/ATTACKER_DEFENDER_TERMINOLOGY.md) - Technical documentation
- [Migration Guide v3 → v4](../MIGRATION_V3_TO_V4.md) - Upgrading from v3.x
- [Session Setup Guide](SESSION_SETUP_GUIDE.md) - Creating games with new system
- [Voice Commands Guide](VOICE_COMMANDS_GUIDE.md) - Complete voice command reference
- [Game State Tracking](../features/GAME_STATE_TRACKING.md) - How game state works

