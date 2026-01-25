# Tactical Advisor User Guide

**Last Updated:** 2025-01-18  
**Status:** Complete

## Overview

The Tactical Advisor is an AI-powered assistant that analyzes your current game state and provides personalized tactical suggestions. It considers unit positions, health, abilities, stratagems, CP availability, and objective control to give you actionable advice for both your turn and your opponent's turn.

## Opening the Tactical Advisor

### Method 1: Keyboard Shortcut
Press **`Shift+S`** while in an active game session.

### Method 2: Menu Button
1. Click the hamburger menu (☰) in the top navigation
2. Click **"🧠 TACTICAL ADVISOR"** in the Battle Controls section

### Method 3: Voice Command
Say **"open tactical advisor"** or **"show tactical suggestions"** (if voice commands are enabled).

## Understanding the Interface

### Header
- Shows current **phase** (Command, Movement, Shooting, etc.)
- Shows current **turn** (Your Turn / Opponent's Turn)
- Shows current **perspective** (Advising: Your Army / Opponent)

### Controls

#### Player Perspective Toggle
- **Your Army** - See opportunities and suggestions for your units
- **Opponent** - See threats and what your opponent might do

#### Detail Level Toggle
- **Quick Tips** - 3-5 concise, actionable suggestions (faster)
- **Detailed** - 5-10 in-depth suggestions with reasoning (slower but more comprehensive)

#### Refresh Button
Click **"↻ REFRESH"** to regenerate suggestions with current game state.

### Context Summary
Quick stats showing:
- **CP**: Your current Command Points
- **VP**: Victory Point differential (+ means you're ahead)
- **Units**: Number of active units analyzed
- **Objectives**: Objectives currently held

### Suggestion Cards

Each suggestion card displays:

1. **Priority Badge** - Color-coded priority level:
   - 🔥 **HIGH** (Orange) - Critical actions you should take
   - ⚡ **MEDIUM** (Amber) - Important but not urgent
   - 💡 **LOW** (Steel) - Optional considerations

2. **Category Badge** - Type of suggestion:
   - ⚔️ **Ability** - Activate a unit ability
   - 📜 **Stratagem** - Use a stratagem
   - 🎯 **Movement** - Positioning or movement advice
   - 🏁 **Objective** - Objective control suggestions
   - 💎 **Resources** - CP management or resource optimization
   - ⚠️ **Threat** - Enemy threats to address

3. **Title** - Short action title (e.g., "Activate Encircling Jaws Hunting Pack")

4. **Description** - Detailed explanation of the action

5. **CP Cost** - Command Point cost if applicable (shown as badge)

6. **Reasoning** - (Detailed mode only) Why this suggestion is valuable

## Reading Suggestions

### Quick Tips Mode
- **3-5 concise suggestions**
- Each tip is a single sentence
- Focuses on highest-priority actions
- Fast generation (~6-8 seconds)

**Example:**
> 🔥 HIGH - Ability  
> **Activate Encircling Jaws Hunting Pack**  
> Select 'Encircling Jaws' for your Master of Wolves ability to grant re-rolls on Advance and Charge rolls.

### Detailed Analysis Mode
- **5-10 comprehensive suggestions**
- Includes reasoning for each suggestion
- Shows related units and rules
- More thorough analysis (~8-10 seconds)

**Example:**
> 🔥 HIGH - Ability  
> **Activate Encircling Jaws Hunting Pack**  
> Select 'Encircling Jaws' as your active Hunting Pack for the Master of Wolves detachment ability. Re-rolling Advance and Charge rolls is critical in Battle Round 2 to ensure your Thunderwolf Cavalry and Terminators reach combat.  
> **Reasoning:** This ability is crucial for ensuring your key melee units can get into position and make successful charges, maximizing their impact in the early game.  
> **Related Units:** Thunderwolf Cavalry, Wolf Guard Terminators  
> **Rules Referenced:** Master of Wolves, Encircling Jaws

## Using Different Perspectives

### Your Army Perspective
- Focuses on **opportunities** for your units
- Suggests abilities to activate, stratagems to use
- Recommends positioning and objective control
- Highlights resource management (CP generation)

### Opponent Perspective
- Focuses on **threats** from enemy units
- Identifies dangerous enemy abilities or stratagems
- Suggests defensive actions or target prioritization
- Helps you anticipate opponent's moves

**Tip:** Switch perspectives frequently to see both sides of the tactical situation!

## When to Use

### Best Times to Check
- **Start of your turn** - Get suggestions for the entire turn
- **Before key phases** - Movement, Shooting, Charge, Fight
- **When CP is low** - Find cost-effective actions
- **When objectives are contested** - Get positioning advice
- **After opponent's turn** - Assess threats and plan responses

### Quick Tips vs Detailed
- **Use Quick Tips** when you need fast guidance during active play
- **Use Detailed** when you have time to plan (between turns, during opponent's turn)

## Mobile/Tablet Usage

- **Full-screen modal** - Optimized for tablet viewing
- **Touch-friendly** - Large buttons and cards
- **Scrollable** - All suggestions visible with scrolling
- **Responsive** - Adapts to screen size

## Troubleshooting

### "Failed to generate tactical advice"
- **Check internet connection** - AI requires online access
- **Wait and retry** - LLM may be temporarily unavailable
- **Check session** - Ensure you have an active game session

### Suggestions seem generic
- **Check game state** - Ensure units and objectives are properly tracked
- **Refresh** - Click refresh to regenerate with current state
- **Switch perspective** - Try opponent view for different insights

### Modal won't open
- **Check keyboard shortcut** - Ensure `Shift+S` is pressed (not just `S`)
- **Check session** - Must have active game session
- **Try menu button** - Use hamburger menu as alternative

### Slow generation
- **Normal for Detailed mode** - Takes 8-10 seconds
- **Quick Tips faster** - Switch to Quick Tips for faster results
- **Check network** - Slow connection may delay LLM response

## Tips for Best Results

1. **Keep game state updated** - Accurate unit health and CP tracking improves suggestions
2. **Use both perspectives** - Check both Your Army and Opponent views
3. **Refresh after major changes** - Update suggestions after significant game events
4. **Combine with manual analysis** - AI suggestions complement your own tactical thinking
5. **Consider context** - Suggestions are based on current state; game may change quickly

## Related Documentation

- [Tactical Advisor Feature](features/TACTICAL_ADVISOR.md) - Complete technical documentation
- [Tactical Advisor API](api/TACTICAL_ADVISOR_API.md) - API reference for developers
- [Strategic Assistant](features/STRATEGIC_ASSISTANT.md) - Previous system (deprecated)

## Keyboard Shortcuts

- **`Shift+S`** - Open/close Tactical Advisor modal

---

**Remember:** The Tactical Advisor provides guidance based on current game state. Always verify suggestions against official rules and your own tactical judgment!

