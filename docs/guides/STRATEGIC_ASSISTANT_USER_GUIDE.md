# Strategic Assistant - User Guide

**Last Updated:** 2025-10-23  
**Status:** Complete

## Overview

Step-by-step guide to using the Strategic Assistant feature for Warhammer 40K gameplay.

## Table of Contents

- [Getting Started](#getting-started)
- [Opening the Assistant](#opening-the-assistant)
- [Understanding the Interface](#understanding-the-interface)
- [Using Search and Filters](#using-search-and-filters)
- [Voice Commands](#voice-commands)
- [Best Practices](#best-practices)
- [Troubleshooting](#troubleshooting)

---

## Getting Started

### Requirements

1. Active game session
2. Player army loaded with units
3. Rules imported to database (see [PDF_RULES_IMPORT_GUIDE.md](PDF_RULES_IMPORT_GUIDE.md))

### Quick Start

1. Start a game session
2. Press `Shift+S` on your keyboard
3. See available stratagems for current phase

---

## Opening the Assistant

### Method 1: Keyboard Shortcut (Fastest)

Press `Shift+S` at any time during a game.

**Tip:** Works on desktop, tablet, and external keyboards.

### Method 2: Menu Button

1. Click the `☰` hamburger menu (top right)
2. Click "STRATEGIC (Shift+S)" button

**Note:** Button is disabled if no active session.

### Method 3: Voice Command

Say one of these phrases:
- "What can I do?"
- "What should I watch for?"
- "Open strategic assistant"
- "What stratagems are available?"

**Requirement:** Speech recognition must be started (click START button first).

---

## Understanding the Interface

### Header

Shows current game state:
- **Phase**: Current game phase (Command, Movement, Shooting, Charge, Fight)
- **Turn**: Your Turn or Opponent's Turn

### Search Bar

Type to filter rules by name, source, or effect text.

**Examples:**
- Search "overwatch" → Shows Fire Overwatch
- Search "wolf" → Shows Space Wolves stratagems
- Search "charge" → Shows charge-related rules

### Toggle Buttons

**"Stratagems Only" (Default)**
- Shows only stratagems and detachment rules
- Clean, focused view
- Hides passive unit abilities

**"Show All Abilities"**
- Shows all abilities including unit-specific
- Comprehensive view
- Use for reference or detailed planning

**Recommended:** Keep on "Stratagems Only" during gameplay for clarity.

### Subphase Tabs

Appear dynamically based on available rules:
- **All Timing** - Shows everything
- **Start of Phase** - Rules used at phase start
- **During Move** - Rules used during movement
- **End of Phase** - Rules used at phase end
- And more based on your rules

**Tip:** Use tabs to find rules for specific moments (e.g., "Just after enemy charges").

### Opportunities Column (Green)

**Your Turn:**
- Stratagems you can use
- Actions available to you

**Opponent's Turn:**
- Reactive abilities you can use
- Interrupts and counter-plays

### Threats Column (Red)

**Your Turn:**
- Opponent's reactive abilities
- What they can interrupt with

**Opponent's Turn:**
- Opponent's available actions
- What to expect

---

## Using Search and Filters

### Scenario 1: Find Specific Stratagem

1. Type stratagem name in search bar
2. Results filter instantly
3. Click card to see full text

### Scenario 2: Clean View for Quick Reference

1. Keep "Stratagems Only" selected
2. See only high-priority decisions
3. 5-15 items max (easy to scan)

### Scenario 3: Comprehensive Research

1. Toggle "Show All Abilities"
2. See all unit abilities, passives, etc.
3. Use search to find specific ability

### Scenario 4: Find Rules for Specific Timing

1. Click appropriate subphase tab
2. See only rules for that timing
3. Example: Click "Just after enemy charges" → See Fire Overwatch, Counter-Offensive

---

## Voice Commands

### Opening Modal Commands

Say any of these to open the Strategic Assistant:
- "What can I do?"
- "What should I watch for?"
- "Open strategic"
- "Strategic assistant"
- "What stratagems"
- "What abilities"

### AI Strategic Advice (Without Opening Modal)

Ask the AI directly for advice:

**Examples:**
```
You: "Grimlog, what can I do in my shooting phase?"
AI: Lists top stratagems with CP costs

You: "What should I watch for in opponent's charge?"
AI: Lists reactive abilities you can use

You: "Show me all Command phase stratagems"
AI: Lists all Command phase options
```

**Tip:** AI responses include top 5 rules. Say "open strategic assistant" to see complete list.

---

## Best Practices

### During Gameplay

1. **Open at phase start** - Quick glance at available options
2. **Check threats column** - Anticipate opponent interrupts
3. **Use voice when busy** - Hands-free while rolling dice
4. **Keep on "Stratagems Only"** - Reduces decision fatigue

### Setup and Planning

1. **Import your faction rules** before first game
2. **Test with army loaded** - Verify keyword filtering works
3. **Review subphase tabs** - Learn timing windows
4. **Try search function** - Find rules quickly mid-game

### Mobile/Tablet Usage

1. **Landscape mode recommended** for two-column view
2. **Search bar** easy to tap on touchscreens
3. **Large tap targets** on all buttons
4. **Scrollable tabs** - swipe to see all timings

---

## Troubleshooting

### Modal Won't Open

**Problem:** Pressing Shift+S does nothing

**Solutions:**
1. Ensure you have an active game session
2. Try menu button instead
3. Check browser console for errors
4. Refresh page and try again

### No Stratagems Showing

**Problem:** "No opportunities available" message

**Possible Causes:**
1. Rules not imported - Run import script
2. Army has no units with required keywords
3. Wrong phase selected

**Solutions:**
1. Verify rules in database (check with Supabase)
2. Check your army's unit keywords match stratagem requirements
3. Try "Show All Abilities" toggle

### Search Not Working

**Problem:** Search doesn't find rules you know exist

**Solutions:**
1. Check spelling
2. Try partial name (e.g., "over" instead of "overwatch")
3. Toggle "Show All Abilities" - might be filtered out
4. Clear search and browse manually

### Voice Trigger Not Working

**Problem:** Saying "what can I do?" doesn't open modal

**Solutions:**
1. Ensure speech recognition is started (green indicator)
2. Speak clearly and wait for transcription
3. Check console for transcription output
4. Use keyboard shortcut `Shift+S` as fallback

### Rules Seem Wrong

**Problem:** Rules appear in wrong phase or for wrong faction

**Solutions:**
1. Check which army is loaded in session
2. Verify correct faction in database
3. Re-import rules with correct `--faction` and `--detachment` flags
4. Check `triggerPhase` data in database

---

## Related Documentation

- **Feature Overview**: [STRATEGIC_ASSISTANT.md](../features/STRATEGIC_ASSISTANT.md) - What the feature is
- **API Reference**: [STRATEGIC_ASSISTANT_API.md](../api/STRATEGIC_ASSISTANT_API.md) - Technical API docs
- **Import Guide**: [PDF_RULES_IMPORT_GUIDE.md](PDF_RULES_IMPORT_GUIDE.md) - How to import rules from PDFs
- **Architecture**: [ARCHITECTURE.md](../ARCHITECTURE.md) - System design

