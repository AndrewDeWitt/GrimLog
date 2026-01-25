# Faction System

**Last Updated:** 2025-12-14  
**Status:** Complete

## Overview

The Faction System manages Warhammer 40k army factions with a flat architecture where each faction (including divergent chapters like Space Wolves, Blood Angels) has its own complete datasheet roster. The system includes a comprehensive data import pipeline for scraping faction data from Wahapedia.

## Table of Contents
- [Architecture](#architecture)
- [Database Schema](#database-schema)
- [Parent Faction Inheritance](#parent-faction-inheritance)
- [Data Import System](#data-import-system)
- [Unit Restrictions](#unit-restrictions)
- [Detachment System](#detachment-system)
- [Supported Factions](#supported-factions)
- [Scripts Reference](#scripts-reference)

## Architecture

The system uses a **flat faction model** where:
1. Each faction is a top-level entity (no parent/child relationships)
2. Each faction has its **own complete datasheet roster**
3. Unit restrictions are enforced via `isEnabled` flag (not data deletion)
4. Detachments are normalized with proper foreign key relationships

### Key Components
- `lib/factionConstants.ts`: Faction definitions and restriction rules
- `scripts/migrateFactionHierarchy.ts`: Flattens factions and duplicates datasheets
- `scripts/normalizeDetachments.ts`: Extracts and links detachments from stratagems
- `app/api/admin/factions/route.ts`: Admin CRUD operations

## Database Schema

### Faction Model
```prisma
model Faction {
  id              String    @id @default(uuid())
  name            String    @unique
  metaData        String?   // JSON: { keywords: [], forbiddenKeywords: [], isDivergent: boolean }
  parentFactionId String?   // Links subfactions to parent (e.g., Space Wolves → Space Marines)
  parentFaction   Faction?  @relation("FactionHierarchy", fields: [parentFactionId], references: [id])
  
  // Relations
  datasheets    Datasheet[]
  stratagemData StratagemData[]
  detachments   Detachment[]
}
```

### Datasheet Model
```prisma
model Datasheet {
  // ... other fields
  faction    String     // e.g., "Space Wolves"
  factionId  String?    // FK to Faction
  isEnabled  Boolean    @default(true)  // False = hidden from army builder
}
```

### Detachment Model
```prisma
model Detachment {
  id          String   @id @default(uuid())
  name        String   // e.g., "Champions of Fenris"
  faction     String   // e.g., "Space Wolves"
  factionId   String?  // FK to Faction
  
  // Relations
  stratagems   StratagemData[]
  enhancements Enhancement[]
  
  @@unique([name, faction])
}
```

## Parent Faction Inheritance

Subfactions (like Space Wolves, Blood Angels) can use datasheets from their parent faction (Space Marines). This is handled via `parentFactionId`.

### How It Works

1. **Database Structure:**
   - Space Wolves has `parentFactionId` → Space Marines
   - Blood Angels has `parentFactionId` → Space Marines
   - Parent factions (Space Marines, Tyranids) have `parentFactionId: null`

2. **Army Creation Validation** (`app/api/armies/route.ts`):
   ```typescript
   // Direct match: Army faction matches datasheet faction
   if (factionId === datasheet.factionId) {
     isValidFaction = true;
   }
   // Parent match: Army faction's parent matches datasheet faction
   else if (factionRecord?.parentFactionId === datasheet.factionId) {
     isValidFaction = true;
   }
   ```

3. **Faction Resolution:**
   - Exact match: "Space Wolves" → Space Wolves faction
   - Subfaction extraction: "Space Marines (Space Wolves)" → extracts "Space Wolves"
   - Contains match: Fallback for partial matches

### Example: Space Wolves Army

| Unit | Datasheet factionId | Army factionId | Match Type |
|------|---------------------|----------------|------------|
| Arjac Rockfist | Space Wolves | Space Wolves | Direct ✅ |
| Logan Grimnar | Space Wolves | Space Wolves | Direct ✅ |
| Intercessor Squad | Space Marines | Space Wolves | Parent ✅ |
| Lieutenant | Space Marines | Space Wolves | Parent ✅ |

### Forbidden Keywords

Subfactions can restrict certain parent datasheets via `metaData.forbiddenKeywords`:

```json
{
  "forbiddenKeywords": ["ULTRAMARINES", "BLOOD ANGELS"]
}
```

Space Wolves cannot take datasheets with `ULTRAMARINES` keyword even though they inherit from Space Marines.

### Related Files

- `app/api/armies/route.ts` - Faction resolution and validation (lines 195-290)
- `app/api/armies/parse/route.ts` - Faction filtering for AI context
- `app/api/factions/[id]/detachments/route.ts` - Detachment inheritance

## Unit Restrictions

Chapter-specific restrictions are enforced by setting `isEnabled: false` on datasheets:

| Chapter | Restriction Rule | Disabled Units |
|---------|-----------------|----------------|
| **Black Templars** | Cannot take PSYKER units | Librarian, Librarian In Phobos Armour, Librarian In Terminator Armour, Njal Stormcaller |
| **Deathwatch** | Cannot take Scout Squad, Tactical Squad, Devastator Squad | Scout Squad |
| **Space Wolves** | Cannot take Apothecary, Tactical Squad, Devastator Squad | (None in current dataset) |

### Why `isEnabled` Instead of Deletion?
- Preserves data integrity for edge cases
- Allows easy re-enabling if rules change
- Supports validation/audit queries
- Army builder simply filters by `isEnabled: true`

## Data Import System

### v4.22.0 - Complete Faction Import

The system now includes a comprehensive pipeline for importing faction data from Wahapedia or manual JSON files.

### Import Statistics (Current Database)

| Metric | Count |
|--------|-------|
| **Factions** | 26 |
| **Detachments** | 165 |
| **Stratagems** | 970 |
| **Enhancements** | 654 |
| **Army Rules** | 40 |

### What Gets Imported

- **Army Rules** - Faction-level abilities (Synapse, Oath of Moment, Waaagh!, etc.)
- **Detachments** - All detachments with abilities
- **Stratagems** - Complete data (CP cost, type, when/target/effect, restrictions)
- **Enhancements** - All enhancements with points costs

### Import Methods

1. **Wahapedia Scraper** - Automated extraction from Wahapedia
2. **JSON Import** - Manual or edited JSON files
3. **Admin UI** - Web interface for imports/exports

See [Faction Data Import Guide](../guides/FACTION_DATA_IMPORT_GUIDE.md) for complete instructions.

## Detachment System

Detachments are normalized with proper database records:

### Linking
- Each `StratagemData` links to a `Detachment` via `detachmentId`
- Each `Enhancement` links to a `Detachment` via `detachmentId`
- Legacy string fields preserved for reference

### Current Statistics

| Category | Total |
|----------|-------|
| Factions | 26 |
| Detachments | 165 |
| Stratagems | 970 |
| Enhancements | 654 |

## Supported Factions

All 26 factions are now fully imported with complete data:

### Space Marine Chapters (Separate Factions)

| Faction | Parent | Detachments | Stratagems | Enhancements |
|---------|--------|-------------|------------|--------------|
| **Space Marines** | - | 18 | 102 | 72 |
| **Blood Angels** | Space Marines | 3 | 18 | 12 |
| **Dark Angels** | Space Marines | 5 | 30 | 20 |
| **Space Wolves** | Space Marines | 4 | 24 | 16 |
| **Deathwatch** | Space Marines | 2 | 12 | 4 |

### Other Factions

| Faction | Detachments | Stratagems | Enhancements |
|---------|-------------|------------|--------------|
| Tyranids | 8 | 48 | 32 |
| Astra Militarum | 6 | 36 | 24 |
| Orks | 8 | 48 | 32 |
| Necrons | 6 | 36 | 24 |
| Aeldari | 9 | 60 | 36 |
| Chaos Space Marines | 10 | 60 | 40 |
| T'au Empire | 6 | 36 | 24 |
| Adeptus Custodes | 6 | 36 | 24 |
| Grey Knights | 6 | 36 | 24 |
| Adepta Sororitas | 5 | 30 | 20 |
| Death Guard | 7 | 42 | 28 |
| Thousand Sons | 6 | 36 | 24 |
| World Eaters | 6 | 36 | 24 |
| Drukhari | 6 | 36 | 24 |
| Chaos Daemons | 5 | 28 | 16 |
| Genestealer Cults | 6 | 36 | 24 |
| Leagues of Votann | 6 | 36 | 24 |
| Adeptus Mechanicus | 6 | 36 | 24 |
| Imperial Knights | 5 | 30 | 20 |
| Chaos Knights | 5 | 30 | 22 |
| Imperial Agents | 5 | 12 | 20 |

## Scripts Reference

### Data Import Scripts

| Script | Purpose |
|--------|---------|
| `scripts/scrapeWahapediaComplete.ts` | Scrape complete faction data from Wahapedia |
| `scripts/importFaction.ts` | Import JSON file into database |
| `scripts/splitSpaceMarineChapters.ts` | Split Space Marines into chapter factions |
| `scripts/resetGameData.ts` | Clear faction data (preserves user data) |

### Legacy Migration Scripts

| Script | Purpose |
|--------|---------|
| `scripts/migrateFactionHierarchy.ts` | Flatten factions, duplicate datasheets |
| `scripts/normalizeDetachments.ts` | Extract detachments from stratagems |

### Quick Commands

```bash
# Scrape a faction
npx tsx scripts/scrapeWahapediaComplete.ts tyranids

# Import a faction
npx tsx scripts/importFaction.ts data/wahapedia-import/tyranids.json

# Reset all faction data
npx tsx scripts/resetGameData.ts --confirm

# Split Space Marines into chapters
npx tsx scripts/splitSpaceMarineChapters.ts
```

## Related Documentation
- [Faction Data Import Guide](../guides/FACTION_DATA_IMPORT_GUIDE.md) - Complete import instructions
- [Admin Panel](ADMIN_PANEL.md) - Faction and detachment management UI
- [Stratagem & Detachment System](STRATAGEM_DETACHMENT_SYSTEM.md) - Detachment-based filtering
- [Army Import Guide](../guides/ARMY_IMPORT_GUIDE.md) - Importing army lists
