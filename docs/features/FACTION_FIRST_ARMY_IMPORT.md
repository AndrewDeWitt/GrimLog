# Faction-First Army Import

**Status:** ✅ Complete  
**Version:** v3.9.0  
**Date:** November 18, 2024

## Overview

Updated the army list import flow to require faction selection **before** file upload, enabling faster and more accurate parsing by filtering datasheets to only the relevant faction.

## Key Changes

### 1. New Faction API Endpoint
**File:** `app/api/factions/route.ts`

- **GET /api/factions** - Returns all factions that have datasheets
- Includes:
  - Faction ID and name
  - Datasheet count
  - Stratagem count
  - Parent faction relationship (for subfactions like Space Wolves)

### 2. Updated Import UI
**File:** `app/armies/new/page.tsx`

**Old Flow:**
1. Upload file → Parse → Review → Select faction

**New Flow:**
1. **Select faction** → Upload file → Parse (filtered) → Review

**Changes:**
- Faction selector moved to Step 1 (before upload)
- Faction selection is now **required** before upload
- Fetches factions dynamically from database
- Shows datasheet/stratagem counts for each faction
- Displays parent faction info (e.g., "Space Wolves includes Space Marines units")
- File upload is disabled until faction is selected
- Faction field auto-filled in review step (read-only)
- **Detachment Selection (v4.10.0):**
  - Fetches available detachments for selected faction
  - Auto-selects if AI detects a match
  - Required field for army creation

### 3. Enhanced Parse API
**File:** `app/api/armies/parse/route.ts`

**Accepts:**
- `factionId` - The selected faction ID
- `factionName` - The selected faction name (for logging)

**Filtering Logic:**
- If faction has a parent (e.g., Space Wolves → Space Marines):
  - Loads datasheets from **both** the selected faction AND parent faction
  - This allows Space Wolves armies to match both specific and shared units
- If no parent faction:
  - Loads only that faction's datasheets

**Benefits:**
- **Faster parsing** - Only loads relevant datasheets instead of all 300+
- **Better accuracy** - AI matches against smaller, relevant dataset
- **Subfaction support** - Space Wolves get both specific + Space Marine units

### 4. Detachment Integration (v4.10.0)
**File:** `app/armies/new/page.tsx`

**Endpoint:** `GET /api/factions/[id]/detachments`

The import flow now includes mandatory detachment selection:
1. User selects faction (Step 1)
2. System asynchronously fetches valid detachments for that faction
3. After parsing, if AI detects a detachment (e.g., "Gladius Task Force"):
   - It auto-selects that detachment in the dropdown
4. If no detachment detected:
   - User must manually select one from the dropdown
5. **Validation:** Cannot create army without selected detachment

**Benefit:** Ensures correct stratagems are loaded for the army immediately upon creation.

## Database Schema

The `Faction` model supports parent relationships:

```prisma
model Faction {
  id              String    @id @default(uuid())
  name            String    @unique
  metaData        String?   // JSON for icons, colors
  parentFactionId String?
  parentFaction   Faction?  @relation("SubFactions")
  subFactions     Faction[] @relation("SubFactions")
  
  // Relations
  stratagemData   StratagemData[]
  datasheets      Datasheet[]
  armies          Army[]
}
```

## User Experience

### Before
1. User uploads file blindly
2. AI tries to match against ALL factions (slow, less accurate)
3. User manually selects faction afterward

### After
1. User sees all supported factions with counts
2. Selects their faction (e.g., "Space Wolves (50 datasheets)")
3. System shows: "✓ Includes Space Marines units"
4. Upload is enabled
5. AI parses with filtered, relevant data (fast, accurate)

## Example Faction Display

```
Space Wolves (50 datasheets)
📋 50 datasheets available
📜 25 stratagems
✓ Includes Space Marines units
```

## Benefits

1. **Speed** - Parsing is faster with filtered datasheets
2. **Accuracy** - AI matches more accurately with focused dataset
3. **User Clarity** - Users know what's supported before uploading
4. **Subfaction Support** - Automatic parent faction inclusion
5. **Better UX** - Clear 2-step process (faction → upload)

## Testing

To test the new flow:

1. Go to `/armies/new`
2. Select a faction (e.g., "Space Wolves")
3. Notice:
   - Datasheet count displayed
   - Parent faction info shown
   - Upload section enabled
4. Upload an army list
5. Parsing should be faster and more accurate

## Future Enhancements

- [ ] Add faction icons/colors from `metaData`
- [ ] Show subfaction dropdown for factions with multiple sub-factions
- [ ] Cache faction list in localStorage
- [ ] Add "Recently Used" factions to top of list

