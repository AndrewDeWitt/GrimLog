# Army HTML Export

**Last Updated:** 2025-12-14
**Status:** Complete

## Overview

The Army HTML Export feature allows users to download a beautifully formatted HTML document containing their complete army roster. The export includes all essential information for game preparation: unit composition, wound tracking, weapons, abilities, stratagems, and character attachments.

## Table of Contents

- [Features](#features)
- [Usage](#usage)
- [Export Content](#export-content)
- [Styling](#styling)
- [Architecture](#architecture)
- [Related Documentation](#related-documentation)

## Features

### One-Click Export
- **📄 EXPORT** button in army detail page toolbar
- Direct file download (no new tab)
- Filename: `{army-name}_roster.html`

### Comprehensive Content
- Complete army overview with point totals
- Detailed unit breakdowns with wound tracking
- Stratagem reference for the selected detachment
- Character attachment visualization

### Print-Ready
- Dark theme for screen viewing
- Light theme automatically applied when printing
- Proper page breaks to avoid splitting cards

## Usage

### From the UI

1. Navigate to any army detail page (`/armies/[id]`)
2. Click the green **📄 EXPORT** button in the toolbar
3. Browser downloads `{army-name}_roster.html`
4. Open the file in any browser to view or print

### Direct URL Access

```
# View in browser
GET /api/armies/{id}/export

# Download as file
GET /api/armies/{id}/export?format=download
```

## Export Content

### Army Header
| Field | Description |
|-------|-------------|
| Army Name | Large title with grimdark styling |
| Player Name | Commander identification |
| Faction | Full faction name (e.g., "Space Marines (Space Wolves)") |
| Detachment | Selected detachment name |
| Total Points | Sum of all unit costs |
| Points Limit | Army list limit |
| Units | Total unit count |
| Models | Total model count across all units |
| Total Wounds | Sum of all wounds in the army |

### Detachment Section
- Detachment name with styled card
- Detachment ability name (bold, gold)
- Full ability description

### Character Attachments
Visual arrows showing leader-to-unit relationships:
```
Logan Grimnar → Wolf Guard Terminators
Wolf Priest → Intercessor Squad
```

### Units (Characters & Battle)
Characters are displayed in a separate section with gold left-border accent.

Each unit card includes:

| Section | Content |
|---------|---------|
| Header | Unit name, points cost, model count, total wounds |
| Composition | Per-role breakdown: `3× regular (Master-crafted power weapon, Storm Shield) — 4W each` |
| Weapons | Grid of weapon cards with name and profile (range, type) |
| Abilities | Tag-style display of all abilities |
| Enhancements | Green highlighted tags for equipped enhancements |

### Stratagems
Grouped by type:
- **Battle Tactic** - Combat bonuses
- **Strategic Ploy** - Tactical advantages  
- **Epic Deed** - Heroic actions

Each stratagem shows:
- Name and CP cost
- When it can be used (timing)
- Full effect text

### Available Enhancements
List of enhancements available for the detachment:
- Enhancement name
- Points cost
- Full description

### Notable Abilities
Summary of key abilities from units, highlighting:
- Leader abilities
- Unit abilities
- Core abilities

## Styling

### Screen Theme (Dark)
```css
--bg-dark: #0a0a0c
--bg-card: #141418
--accent-gold: #c9a227
--text-primary: #e8e6e3
```

### Typography
- **Headings:** Cinzel (serif, all-caps)
- **Body:** Crimson Pro (readable serif)
- **Monospace:** Reserved for IDs and stats

### Print Theme
Automatically applies light theme:
- White background
- Dark text
- Light gray cards
- Gold accents converted to darker gold for readability

## Architecture

### Files

```
app/api/armies/[id]/export/route.ts  # API endpoint
app/armies/[id]/page.tsx             # UI button
```

### Data Flow

```
1. User clicks EXPORT button
2. Browser requests /api/armies/{id}/export?format=download
3. API fetches:
   - Army with units (composition, weapons, abilities)
   - Detachment info
   - Faction stratagems
   - Core stratagems
   - Available enhancements
4. generateArmyHTML() builds complete HTML document
5. Response sent with Content-Disposition: attachment
6. Browser downloads file
```

### Key Functions

```typescript
// Generate complete HTML document
generateArmyHTML(army, detachment, stratagems, coreStratagems, enhancements): string

// Render individual unit card
renderUnitCard(unit, isCharacter): string

// Calculate total wounds from composition
calculateTotalWounds(composition): number

// Safe JSON parsing with fallback
safeParseJSON<T>(str, fallback): T
```

## Related Documentation

- [Export Endpoint API](../api/ARMY_EXPORT_ENDPOINT.md) - Technical API reference
- [Army Parser Datasheet System](./ARMY_PARSER_DATASHEET_SYSTEM.md) - How units are parsed
- [Army Register: Tactics & Battle Ready](./ARMY_REGISTER_TACTICS_AND_BATTLE_READY.md) - Character attachments
- [Stratagem Detachment System](./STRATAGEM_DETACHMENT_SYSTEM.md) - How stratagems are loaded

