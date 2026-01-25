# Parse Armies Endpoint

**Last Updated:** 2025-12-31
**Status:** Complete
**Version:** 4.54.0

## Overview

The Parse Armies endpoint uses OpenAI's GPT-5-mini with Structured Outputs to automatically parse Warhammer 40K army lists from text files, PDFs, or images. It matches units to comprehensive datasheets with full weapon profiles and abilities.

**New in v4.54.0:**
- Added `leaderRules` and `leaderAbilities` to `parsedDatasheet` for character attachment accuracy.
- Enhanced database query to include full character rules.

**New in v4.24.0:**
- Enhanced weapon matching with post-processing for profile variants
- Improved AI prompt with weapon naming conventions
- Proper wargear classification (Storm Shield, Death Totem)
- All 528 weapons sent to AI (removed 200 limit)

**Previous (v4.9.0):** Enhanced faction validation with support for Divergent Chapters (e.g., Space Wolves) and Forbidden Keyword filtering.

## Endpoint

```
POST /api/armies/parse
```

## Request

### Headers

```
Content-Type: multipart/form-data
```

### Body (FormData)

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `file` | File | Yes | Army list file (text, PDF, or image) |
| `factionId` | string | No | Faction ID to filter datasheets (RECOMMENDED) |
| `factionName` | string | No | Faction name for logging |

### Supported File Types

- **Text:** `.txt` (plain text)
- **PDF:** `.pdf` (extracted via OCR)
- **Images:** `.jpg`, `.jpeg`, `.png` (OCR via vision model)

### File Size Limits

- Maximum: 10MB

## Response

### Success (200 OK)

```typescript
{
  detectedFaction: string | null,           // Auto-detected faction
  detectedPointsLimit: number | null,       // Auto-detected points limit
  units: Array<{
    name: string,                           // Unit name from list
    datasheet: string,                      // Datasheet name
    parsedDatasheet: {
      datasheetId: string | null,           // Database ID (null if not matched)
      name: string,                         // Matched datasheet name
      factionId: string | null,             // Faction ID
      faction: string | null,               // Faction name
      subfaction: string | null,            // Subfaction (e.g., "Space Wolves")
      role: string | null,                  // Role (e.g., "Battleline", "Character")
      keywords: string[],                   // Array of keywords
      movement: string | null,              // Movement characteristic
      toughness: number | null,             // Toughness characteristic
      save: string | null,                  // Save characteristic
      invulnerableSave: string | null,      // Invulnerable save
      wounds: number | null,                // Wounds characteristic
      leadership: number | null,            // Leadership characteristic
      objectiveControl: number | null,      // Objective Control characteristic
      pointsCost: number | null,            // Base points cost
      leaderRules: string | null,           // Which units this character can attach to
      leaderAbilities: string | null,       // Abilities granted when leading
      matchConfidence: number,              // 0-1 confidence score
      needsReview: boolean                  // True if confidence < 0.8
    },
    weapons: Array<{
      weaponId: string | null,              // Database ID (null if not matched)
      name: string,                         // Weapon name
      range: string | null,                 // e.g., "24\"", "Melee"
      type: string | null,                  // e.g., "Assault 2", "Heavy D6"
      attacks: string | null,               // e.g., "2", "D6"
      ballisticSkill: string | null,        // BS for ranged weapons
      weaponSkill: string | null,           // WS for melee weapons
      strength: string | null,              // e.g., "4", "User"
      armorPenetration: string | null,      // e.g., "0", "-1", "-3"
      damage: string | null,                // e.g., "1", "D6"
      abilities: string[],                  // Weapon special rules
      matchConfidence: number,              // 0-1 confidence score
      needsReview: boolean                  // True if confidence < 0.8
    }>,
    abilities: Array<{
      abilityId: string | null,             // Database ID (null if not matched)
      name: string,                         // Ability name
      type: string | null,                  // "core", "faction", "unit", etc.
      description: string | null,           // Full ability text
      phase: string | null,                 // When ability is used
      matchConfidence: number,              // 0-1 confidence score
      needsReview: boolean                  // True if confidence < 0.8
    }>,
    keywords: string[],                     // Unit keywords
    pointsCost: number,                     // Points cost for this unit
    modelCount: number,                     // Number of models in unit
    wargear: string[],                      // Legacy wargear list
    enhancements: string[],                 // Enhancements/upgrades
    needsReview: boolean                    // True if any component needs review
  }>,
  parsingConfidence: number                 // Overall parse confidence (0-1)
}
```

### Error Responses

#### 400 Bad Request

**No file provided:**
```json
{
  "error": "No file provided"
}
```

**Unsupported file type:**
```json
{
  "error": "Unsupported file type"
}
```

#### 500 Internal Server Error

**Parse failure:**
```json
{
  "error": "Failed to parse army list",
  "details": "Error message details"
}
```

## Implementation Details

### Faction Filtering & Validation ⭐ NEW v4.9.0

**How It Works:**

1.  **Faction Context Loading:**
    *   Parse endpoint receives `factionId` from UI.
    *   Fetches faction and checks for `parentFactionId`.
    *   Builds filter: `{ factionId: { in: [selectedId, parentId] } }`.
    *   *Example*: Selecting "Space Wolves" loads datasheets for both "Space Wolves" AND "Space Marines".

2.  **Forbidden Keyword Filtering:**
    *   Checks `Faction.metaData.forbiddenKeywords`.
    *   Filters out any parent datasheets that contain forbidden keywords.
    *   *Example*: Space Wolves cannot see "Roboute Guilliman" (has `ULTRAMARINES` keyword).

3.  **Performance Benefit:**
    *   **Before:** Loads all 300+ datasheets.
    *   **After:** Loads ~150 relevant datasheets (filtered by hierarchy and keywords).
    *   **Result:** Faster parsing, higher accuracy, and rule-compliant suggestions.

### AI Context

The AI receives faction-filtered context:

1.  **Filtered Datasheets** from database (50-165 per faction)
2.  **Top 200 Weapons** with full profiles
3.  **Top 100 Abilities** with descriptions
4.  **Matching Rules** with confidence thresholds
5.  **Duplicate Unit Handling** instructions
6.  **Known Detachments** for the faction

## Related Documentation

-   [Faction System](../features/FACTION_SYSTEM.md) - Feature overview
-   [Army Import Guide](../guides/ARMY_IMPORT_GUIDE.md) - User guide
