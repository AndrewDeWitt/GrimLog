# Rules System Guide

**Last Updated:** 2024-11-12  
**Status:** Complete

## Overview

This guide explains how to use Grimlog's rules-based gameplay enhancement system, which provides intelligent CP validation, automatic secondary scoring, mission tracking, and proactive gameplay reminders.

## Table of Contents

- [Quick Start](#quick-start)
- [Mission Selection](#mission-selection)
- [Secondary Scoring](#secondary-scoring)
- [CP Validation](#cp-validation)
- [Phase Reminders](#phase-reminders)
- [Troubleshooting](#troubleshooting)

---

## Quick Start

### For New Games

1. **Create Session** - Start a new game as usual
2. **Select Mission** (optional) - Choose from 7 tournament missions
3. **Set Secondaries** - Choose your secondary objectives
4. **Play** - Use voice commands as normal

The AI now automatically:
- Validates CP gain/spend (max 2 CP/turn)
- Calculates secondary VP
- Reminds about scoring opportunities
- Detects damaged state on units

---

## Mission Selection

### How to Select a Mission

When creating a new session or during setup:
1. Look for "Select Mission" option
2. Browse available missions
3. Click to see details (deployment type, scoring rules)
4. Confirm selection

### Available Missions (7)

- Take and Hold
- Supply Drop
- Linchpin
- Scorched Earth
- Hidden Supplies
- Purge the Foe
- Terraform

### What the AI Knows

Once selected, the AI understands:
- Mission name and deployment type
- When to score (scoring phase/timing)
- Scoring reminders at appropriate phases

### Voice Commands

**Check Scoring:**
> "How much primary can I score?"

**AI calculates based on objectives:**
> "Primary Scoring Available: 3 objectives controlled → 15 VP"

---

## Secondary Scoring

### Automatic Calculation (6 Secondaries)

The AI automatically calculates VP for these secondaries:

#### 1. Assassination

**Voice:** "Destroyed captain for assassination"  
**AI:** Looks up wounds, calculates VP (3 VP for <4W, 4 VP for 4W+)  
**Result:** "Assassination: Captain (5W) = 4 VP. Total: 4/20 VP"

#### 2. Bring It Down

**Voice:** "Killed land raider for bring it down"  
**AI:** Calculates cumulative VP (2 base + 2 for 15W+ + 2 for 20W+)  
**Result:** "Bring It Down: Land Raider (18W) = 4 VP. Total: 4/20 VP"

#### 3. No Prisoners

**Voice:** "Destroyed intercessors, no prisoners"  
**AI:** Scores 2 VP per unit, enforces 5 VP/turn cap  
**Result:** "No Prisoners: Intercessors = 2 VP. Total: 2/20 VP"

#### 4. Marked for Death

**Voice:** "Alpha target down"  
**AI:** Scores 5 VP for Alpha, 2 VP for Gamma  
**Result:** "Marked for Death: Alpha target = 5 VP"

#### 5. Cull the Horde

**Voice:** "Destroyed 20-strong boyz unit"  
**AI:** Validates INFANTRY with 13+ models  
**Result:** Scores appropriate VP

#### 6. Overwhelming Force

**Voice:** "Killed unit on objective 3"  
**AI:** Scores 3 VP per unit, max 5 VP/turn  
**Result:** "Overwhelming Force: Unit = 3 VP"

### Manual Scoring (Other Secondaries)

For secondaries without specialized tools:

**Voice:** "Scored 4 VP for behind enemy lines"  
**AI:** Uses generic `score_secondary_vp` tool  
**Result:** VP tracked normally

---

## CP Validation

### Automatic Validation

The AI enforces official CP rules:
- Max 2 CP per turn (1 automatic + 1 from discard)
- Absolute max 3 CP/turn (with rare abilities)

### Examples

**Normal CP Gain:**
> Voice: "Gain 1 CP"  
> AI: "attacker gained 1 CP (automatic). Now at 6 CP."

**Overspending Detection:**
> Voice: "Spend 5 CP" (when you only have 3 CP)  
> AI: Error - "Insufficient CP: Have 3 CP, trying to spend 5 CP"

**Over-Limit Warning:**
> Voice: "Gain 1 CP" (when already gained 2 CP this turn)  
> AI: Warning - "Gaining 3 CP this turn exceeds standard max of 2. Verify special ability."

### CP Transaction History

All CP changes are logged with:
- Round and phase
- Reason (automatic, secondary_discard, stratagem, ability)
- Before/after CP amounts

---

## Phase Reminders

### Automatic Reminders

When changing phases, the AI provides helpful reminders:

#### Command Phase

> "Moving to Command phase"

**AI reminds:**
- "+1 CP automatically (now 7 CP)"
- "2 units need battle-shock tests"
- "Primary scores at end of phase (holding 3 objectives)"
- "Can discard tactical secondary for +1 CP"

#### Movement Phase

> "Movement phase"

**AI reminds:**
- "Declare Advances (can't charge, -1 to shoot except Assault weapons)"

#### Other Phases

- Shooting: Overwatch warnings
- Charge: Charge distance reminders
- Fight: Activation and consolidation rules

---

## Troubleshooting

### Mission Not Appearing in AI Context

**Problem:** AI doesn't mention mission  
**Solution:** Select a mission for the session via Mission Selection modal

### Secondary Scoring Not Working

**Problem:** "Secondary not active" error  
**Solution:** Set secondaries for the session first

### CP Validation Too Strict

**Problem:** Getting warnings for valid CP gains  
**Solution:** This is expected - warnings allow action but flag unusual patterns

### Damaged State Not Detecting

**Problem:** Unit below half wounds but no "Damaged" notification  
**Solution:** Unit may not have "Damaged" ability on datasheet (only some units have this)

---

## Related Documentation

- [Mission System](../features/MISSION_SYSTEM.md) - Technical details of mission system
- [Secondary Auto-Calculation](../features/SECONDARY_OBJECTIVES_AUTO_CALCULATION.md) - How secondary scoring works
- [Rules Extensibility](./RULES_EXTENSIBILITY_GUIDE.md) - Adding new rules
- [Strategic Assistant](./STRATEGIC_ASSISTANT_USER_GUIDE.md) - Overall strategic guidance system


