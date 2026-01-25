# Tactical Advisor

**Last Updated:** 2025-12-20  
**Status:** Complete

## Overview

The Tactical Advisor is an AI-powered strategic assistant that analyzes the current game state and provides contextual tactical advice. It uses Gemini 3 Flash to evaluate unit positions, remaining wounds, abilities, stratagems, and objective control to generate actionable suggestions for both players.

Unlike the previous Strategic Assistant (which filtered static rules), the Tactical Advisor dynamically analyzes the live game state and provides personalized recommendations based on the current board situation.

## Table of Contents

- [Key Features](#key-features)
- [Architecture](#architecture)
- [User Interface](#user-interface)
- [API Integration](#api-integration)
- [LLM Configuration](#llm-configuration)
- [Prompt Engineering](#prompt-engineering)
- [Error Handling](#error-handling)
- [Keyboard Shortcuts](#keyboard-shortcuts)
- [Technical Notes](#technical-notes)
- [Future Enhancements](#future-enhancements)
- [Related Documentation](#related-documentation)

## Key Features

- **AI-Powered Analysis** - Uses Gemini 3 Flash to analyze game state and generate tactical suggestions
- **Dual Perspective** - Toggle between "Your Army" and "Opponent" perspectives to see opportunities and threats
- **Two Detail Levels** - Quick Tips (3-5 concise suggestions) or Detailed Analysis (5-10 in-depth recommendations)
- **Context-Aware** - Considers unit health, CP availability, objective control, recent stratagem usage, and phase
- **Priority-Based Suggestions** - High/Medium/Low priority badges with color-coded cards
- **Category Classification** - Suggestions categorized by type (Ability, Stratagem, Movement, Objective, Combat, Threat, Resources)
- **Primary Mission Awareness** - Includes selected primary mission + scoring timing in the analysis context
- **Objective Marker Awareness** - Includes objective marker control by objective number
- **Unit Icon Strip (Quick Tips)** - Quick Tips mode displays unit icons for referenced units (resolved via unit icon system)

## Architecture

### Core Components

- **`lib/tacticalAdvisor.ts`** - Core logic for building game context and generating prompts
- **`app/api/tactical-advisor/route.ts`** - API endpoint for tactical advice requests
- **`components/TacticalAdvisorModal.tsx`** - UI component with toggles and suggestion cards

### Data Flow

1. User opens Tactical Advisor modal (keyboard shortcut `Shift+S` or menu button)
2. Modal sends request to `/api/tactical-advisor` with:
   - `sessionId` - Current game session
   - `perspective` - 'attacker' or 'defender'
   - `detailLevel` - 'quick' or 'detailed'
3. API endpoint builds comprehensive game context:
   - Unit instances (health, models, wounds, status effects)
   - Objective markers and control
   - Recent stratagem usage
   - Army rules and detachment abilities
   - CP/VP state
4. Context is formatted into a structured prompt for Gemini 3 Flash
5. LLM generates JSON response with suggestions
6. Response is parsed and displayed in modal with priority badges

### Context Building

The advisor considers:

- **Unit State**: Current models, wounds per model, destroyed status, battle-shocked status
- **Unit Abilities**: Phase-relevant abilities that can be activated
- **Stratagems**: Available stratagems with CP costs, filtered by phase
- **Objectives**: Current objective control and positioning
- **Resources**: CP availability, VP differential
- **Recent Actions**: Last 5 stratagem uses for pattern detection
- **Army Rules**: Faction abilities, detachment rules, enhancements

## User Interface

### Modal Layout

- **Header**: Shows current phase, turn, and perspective
- **Controls**: 
  - Player Perspective toggle (Your Army / Opponent)
  - Detail Level toggle (Quick Tips / Detailed)
  - Refresh button
- **Context Summary**: CP, VP, active units, objectives held, and (when selected) the current primary mission + scoring timing
- **Suggestions**: Priority-coded cards with:
  - Priority badge (High/Medium/Low)
  - Category badge (Ability, Stratagem, etc.)
  - Title and description
  - CP cost (if applicable)
  - Reasoning (in detailed mode)
  - Unit icon strip in **Quick Tips** mode (resolved via `GET/POST /api/icons/resolve` with fallback to role-based icons)

### Visual Design

- **Dark Modal Background** - Maintains grimdark aesthetic
- **Event Log-style Suggestion Rows** - Light slate content area with white “event row” entries (`bg-white`) for fast scanning
- **Priority Colors**:
  - High: Orange left border and priority chip
  - Medium: Amber left border and priority chip
  - Low: Steel/gray left border and priority chip
- **Category Icons**: Visual indicators (🔥 Ability, ⚡ Stratagem, 🎯 Movement, etc.)

## API Integration

See [Tactical Advisor API Documentation](../api/TACTICAL_ADVISOR_API.md) for complete endpoint details.

**Endpoint**: `POST /api/tactical-advisor`

**Request Body**:
```json
{
  "sessionId": "string",
  "perspective": "attacker" | "defender",
  "detailLevel": "quick" | "detailed"
}
```

**Response**:
```typescript
{
  suggestions: TacticalSuggestion[];
  context: {
    cpAvailable: number;
    vpDifferential: number;
    unitsAnalyzed: number;
    objectivesHeld: number;
  };
  generatedAt: string;
  detailLevel: 'quick' | 'detailed';

  // Optional (UI support)
  meta?: { /* primary mission + objective markers */ };
  unitDirectory?: Record<string, { /* UnitInstance directory */ }>;
}
```

## LLM Configuration

- **Model**: `gemini-3-flash-preview`
- **Temperature**: 0.7
- **Max Tokens**: 2000 (quick) / 4000 (detailed)
- **Response Format**: JSON (`responseMimeType: 'application/json'`)
- **System Prompt**: Warhammer 40k tactical advisor persona with game rules knowledge
- **User Prompt**: Structured game state context with phase, turn, and perspective

## Prompt Engineering

The prompt includes:

1. **Role Definition**: "You are a Warhammer 40,000 tactical advisor"
2. **Context**: Current phase, turn, perspective
3. **Game State**: Formatted unit data, objectives, CP/VP, recent actions
4. **Instructions**: 
   - Quick mode: 3-5 concise tips
   - Detailed mode: 5-10 in-depth suggestions with reasoning
5. **Format Requirements**: JSON structure with specific fields

## Error Handling

- **Session Not Found**: Returns 404 with error message
- **Invalid Parameters**: Returns 400 with validation errors
- **LLM Parsing Errors**: Falls back to error message with retry option
- **Network Errors**: Displays error state with retry button

## Keyboard Shortcuts

- **`Shift+S`** - Open/close Tactical Advisor modal

## Related Documentation

- [Tactical Advisor API](../api/TACTICAL_ADVISOR_API.md) - Complete API reference
- [Tactical Advisor User Guide](../guides/TACTICAL_ADVISOR_USER_GUIDE.md) - How to use the Tactical Advisor in-game
- [Strategic Assistant](STRATEGIC_ASSISTANT.md) - Previous static rules filtering system (deprecated)
- [Unit Icon Generation](UNIT_ICON_GENERATION.md) - Icon resolution + generation workflow used by Quick Tips unit icon strips
- [Missions API](../api/MISSIONS_API.md) - How primary missions are selected/tracked
- [Google Gemini Integration](GOOGLE_GEMINI_INTEGRATION.md) - Multi-provider AI support

## Technical Notes

### JSON Parsing

The LLM response may include markdown code fences (` ```json `). The parser strips these automatically:

```typescript
cleanedText = cleanedText.replace(/^```json\s*/i, '');
cleanedText = cleanedText.replace(/^```\s*/i, '');
cleanedText = cleanedText.replace(/\s*```$/i, '');
```

### Token Limits

- Quick mode: 2000 tokens (sufficient for 3-5 concise suggestions)
- Detailed mode: 4000 tokens (allows 5-10 detailed suggestions with reasoning)

### Performance

- Context building: ~800ms (database queries)
- LLM analysis: ~6-7s (Gemini 3 Flash)
- Total response time: ~8-10s

## Future Enhancements

Potential improvements:

- Caching suggestions for same game state
- Historical suggestion tracking
- Unit-specific targeting recommendations
- Board position analysis (if tactical map integration)
- Stratagem cost-benefit analysis
- Threat assessment scoring

