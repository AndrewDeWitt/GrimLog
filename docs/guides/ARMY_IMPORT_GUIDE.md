# Army Import Guide

**Last Updated:** 2025-12-27
**Status:** Complete
**Version:** 4.46.0

## Overview

Grimlog's AI-powered army import system allows you to upload army lists in multiple formats (images, PDFs, text files) and automatically parse them into structured unit data. The system uses **multi-provider AI** (OpenAI GPT-5-mini or Google Gemini 3 Flash) with structured outputs to match units to datasheets from the database and extract comprehensive game data.

**NEW v4.46.0:** Upgraded all competitive context extraction to **Gemini 3 Flash** (`gemini-3-flash-preview`) with noise-tolerant parsing for repetitive transcripts and phonetic misspellings. Removed context window limits, supporting transcripts up to 500,000 characters.

**NEW v4.35.0:** Added Gemini 3 Flash as an alternative provider option. Administrators can configure the provider via `ARMY_PARSE_PROVIDER` environment variable.

**Fixed in v4.29.1:** Datasheet linking now works correctly for subfactions (Space Wolves, Blood Angels, etc.). User's faction selection is preserved and parent faction inheritance validated.
**New in v4.10.0:** Required Detachment selection ensures correct stratagems are loaded.
**New in v4.9.0:** Enhanced support for Divergent Chapters (e.g., Space Wolves, Blood Angels) with intelligent faction validation and keyword filtering.

## Table of Contents

- [Supported Formats](#supported-formats)
- [How to Import](#how-to-import)
- [Faction Selection (NEW)](#faction-selection)
- [Detachment Selection (NEW)](#detachment-selection)
- [Datasheet Matching](#datasheet-matching)
- [Review Process](#review-process)
- [Troubleshooting](#troubleshooting)
- [Related Documentation](#related-documentation)

---

## Supported Formats

### File Types
- **Images**: JPG, PNG (up to 10MB)
- **PDFs**: Standard PDF documents (up to 10MB)
- **Text**: Plain text files (.txt)

### Recommended Sources
- Battlescribe exports (PDF or HTML screenshot)
- Warhammer 40K App screenshots
- Hand-written lists (clear photos)
- New Recruit exports
- Manually typed lists

**Best Results:** Use official app screenshots or Battlescribe PDFs for highest accuracy.

---

## How to Import

### Step 1: Select Faction ⭐ NEW v4.9.0

1. Navigate to `/armies/new`
2. **Select your faction** from the dropdown (REQUIRED)
   - Factions loaded dynamically from database
   - Shows datasheet count (e.g., "Space Marines (165 datasheets)")
   - Shows stratagem count
   - Displays parent faction info if applicable
3. Faction info displayed:
   - Number of datasheets available
   - Number of stratagems
   - Parent faction relationship (e.g., "✓ Includes Space Marines units")

**Example Display:**
```
Space Wolves (165 datasheets)
📋 165 datasheets available
📜 25 stratagems
✓ Includes Space Marines units
```

**Why Select First:**
- Faster parsing (only loads relevant datasheets)
- More accurate AI matching (focused dataset)
- See what's supported before uploading

### Step 2: Upload File

1. File upload section enabled after faction selection
2. Click to select file or drag-and-drop
3. File is validated (type and size)
4. Click **"PARSE LIST"**

**Processing Time:** 5-20 seconds (faster than before due to faction filtering).  
**Note:** Processing time may vary based on configured AI provider (OpenAI vs Gemini 3 Flash).

### Step 3: Review Parsed Units

After parsing, you'll see:
- **Faction** (auto-filled from Step 1, read-only)
- **Detected points** (e.g., 2000)
- **Detected detachment** (e.g., "Gladius Task Force")
- **Parsed units** with match confidence indicators

**Unit Card Indicators:**
- 🟢 **High (80%+)** - Perfect match, good to go
- 🟡 **Medium (50-79%)** - Needs review, likely correct
- 🔴 **Low (<50%)** - Needs review, may be incorrect
- 🟠 **Amber border** - Overall unit flagged for review

**What Each Card Shows:**
- Unit name and datasheet match
- Model count and points cost
- Role (Character, Battleline, etc.)
- Datasheet stats (M, T, SV, W, LD, OC)
- Keywords
- Weapons with full profiles
- Abilities with descriptions
- Match confidence percentage

### Step 4: Edit Units (Optional)

**Editable Fields:**
- Unit name
- Model count
- Points cost
- Wargear list

**Actions:**
- **Edit** - Click fields to modify
- **Remove** - Click ✕ button to delete unit
- **Reorder** - Drag and drop (future)

### Step 5: Review & Detachment
   
   After parsing, review your units and set army details:
   
   1. **Review Units**: Check match confidence and missing wargear.
   2. **Select Detachment** (REQUIRED):
      - The system auto-fetches valid detachments for your faction.
      - If the AI detected a detachment in your list, it will be auto-selected.
      - If not, manually select one from the dropdown.
      - *Note: This determines which stratagems you can use.*
   3. **Add Metadata**: Player Name, Army Name, Points Limit.

### Step 6: Create Army

Click **"CREATE ARMY"** button.

**Success Message:**
```
✓ Army created successfully!
  5 units added (2 need review)
```

You'll be redirected to the army detail page.

---

## Faction Selection

### How Faction Selection Works ⭐ NEW v4.9.0

**Dynamic Faction List:**
- Fetched from `Faction` table in database
- Only shows factions with available datasheets
- Real-time datasheet and stratagem counts
- Parent faction relationships displayed

**Benefits:**
1.  **Faster Parsing** - Only loads relevant datasheets (50-165 vs 300+)
2.  **Better Accuracy** - AI matches against focused dataset
3.  **Subfaction Support** - Space Wolves gets Space Marines datasheets automatically
4.  **Keyword Validation** - Prevents illegal units (e.g., Space Wolves taking Blood Angels units)
5.  ⭐ **v4.29.1** - User selection preserved (AI detection no longer overwrites your choice)

**Current Supported Factions:**
- Space Marines (165 datasheets, 136 stratagems)
- Space Wolves (165 datasheets via parent, 25 stratagems)
- Blood Angels (165 datasheets via parent)
- Dark Angels (165 datasheets via parent)
- Black Templars (165 datasheets via parent)
- Deathwatch (165 datasheets via parent)
- Tyranids (73 datasheets, 13 stratagems)
- Astra Militarum (65 datasheets)

**Adding New Factions:**
See [Wahapedia Scraping Guide](WAHAPEDIA_SCRAPING_GUIDE.md) for how to add new factions.

---

## Detachment Selection

### Why It's Required
In 10th Edition, your **Detachment** determines your enhancements and stratagems. To ensure Grimlog shows you the correct "Fire Overwatch" vs "Saga of the Hunter" options, you must select a detachment.

### How It Works
1. **Dynamic Loading**: When you select a faction in Step 1, the system loads its detachments.
2. **Auto-Detection**: The AI looks for detachment names (e.g., "Gladius Task Force") in your uploaded list.
3. **Manual Override**: You can change the detachment in the dropdown if the AI guessed wrong.

**Note:** You can change your detachment later on the Army Detail page.

---

## Datasheet Matching

### How Matching Works

**AI Matching Process (v4.9.0):**
1. User selects faction (e.g., Space Wolves)
2. Backend loads datasheets for Space Wolves + Space Marines (parent)
3. **Filtering:** Removes any parent units with forbidden keywords (e.g., `BLOOD ANGELS`)
4. AI receives filtered list of valid datasheets
5. For each parsed unit, AI matches to best datasheet
6. Returns `datasheetId`, full stats, and `matchConfidence`
7. Also matches weapons and abilities from database
8. Units flagged for review if confidence < 0.8

### Datasheet Coverage (v4.9.0)

**Space Marines:** 165 datasheets
- All units from Codex: Space Marines
- Chapter-specific units
- Characters, Battleline, Elites, Heavy Support, etc.

**Tyranids:** 73 datasheets  
- Synapse creatures, Swarms, Monsters
- Hive Fleet variants

**Astra Militarum:** 65 datasheets
- Infantry, Vehicles, Artillery
- Regiment variants

### Match Confidence Levels

| Confidence | Badge Color | Meaning | Action |
|------------|-------------|---------|--------|
| 80-100% | 🟢 Green | High confidence match | Accept |
| 50-79% | 🟡 Yellow | Medium confidence | Review |
| 0-49% | 🔴 Red | Low confidence | Review carefully |

### Why Units Need Review

Units are flagged `needsReview: true` when:
1. **Low confidence** - AI uncertain about datasheet match (< 80%)
2. **No datasheet match** - Unit not in database for selected faction
3. **Missing weapons** - Weapons couldn't be matched
4. **Faction mismatch** - Detected faction differs from selected faction

**Important:** Units with low confidence still save. You can verify them later on the army detail page.

---

## Review Process

### Understanding Review Flags

**⚠ Needs Review - Low Match Confidence:**
- AI matched but confidence < 0.8
- May be incorrect match
- Verify unit name and template

**🔵 No Template Match Found:**
- Unit not in template library
- Will work but won't have auto-calculated wounds
- Need to manually set model count

### How to Handle Review Flags

**Option 1: Accept As-Is**
- If unit name and details look correct
- Click "CREATE ARMY" to save
- Unit will work without template

**Option 2: Edit Unit**
- Correct unit name to match template
- Adjust model count or points
- Re-save

**Option 3: Remove Unit**
- If unit was misidentified
- Click ✕ button to remove
- Add manually later

### After Import

Units are saved with:
- ✅ Full datasheet linkage (if matched)
- ✅ Weapon profiles and abilities
- ✅ Keywords and stats
- ✅ Automatic wound calculation from datasheet
- ⭐ **Stratagems automatically displayed** on army detail page (via faction link)

**Army Detail Page Enhancement (v4.9.0):**
When you view an army, the system now automatically fetches and displays all available stratagems for that faction. No need to manually add them!

---

## Troubleshooting

### "Failed to parse army list"

**Causes:**
- Image too blurry or low quality
- PDF password protected
- Text file empty
- AI API timeout

**Solutions:**
1. Try higher quality image
2. Use Battlescribe PDF export
3. Check file isn't corrupted
4. Retry upload

### "Foreign key constraint failed"

**Cause:** AI returned invalid datasheet IDs

**Solution:**
- Should be rare with faction filtering
- Try re-uploading with clearer image
- Report bug with faction and unit name

### All Units Show "Low Confidence"

**Causes:**
- Selected wrong faction in Step 1
- Unit names heavily abbreviated
- Custom or unofficial unit names

**Solutions:**
1. Go back and select correct faction
2. Check unit names match official datasheets
3. Try using official app export or Battlescribe

### All Units Show "Needs Review" with `datasheetId: null`

**Cause (Fixed in v4.29.1):** Prior to v4.29.1, importing armies for subfactions (Space Wolves, Blood Angels) could result in all units being saved with `datasheetId: null` and `needsReview: true`, even though the AI parsing correctly identified datasheets.

**Root Cause:** The AI detected a compound faction name like "Space Marines (Space Wolves)" which overwrote the user's faction dropdown selection. The backend couldn't resolve this compound name to a faction record, causing validation failures.

**Fix Applied:**
1. Frontend no longer overwrites user's faction selection with AI detection
2. Backend extracts subfaction from compound names as fallback
3. Parent faction inheritance correctly validates datasheets

**If You Still See This Issue:**
1. Ensure you select the specific subfaction (e.g., "Space Wolves") not the parent
2. Verify the faction exists in the database (`/api/factions`)
3. Check that datasheets exist for that faction

### "Insufficient Armies" Error

**Cause:** Less than 2 armies in database

**Solution:**
1. Click "CREATE ARMY" button
2. Import at least 2 armies
3. Return to session creation

---

## Advanced Usage

### Debugging Parse Issues

**Check Langfuse Traces:**
1. Go to Langfuse dashboard
2. Find latest "parse-army-list" trace
3. Check spans:
   - `fetch-game-data` - Should show filtered datasheets
   - `ai-parse-army-list` - Shows input/output and confidence

**Console Logging:**
Check server console for:
```
Loaded 165 datasheets, 679 weapons, 666 abilities for matching
AI Parse Response: { "units": [...], "parsingConfidence": 0.95 }
```

### Adding New Factions

To add datasheets for new factions:

1. **Scrape from Wahapedia:**
   ```bash
   npx tsx scripts/scrapeDatasheets.ts "Necrons"
   ```
   
2. **Seed the database:**
   ```bash
   npx tsx scripts/seedDatasheets.ts
   ```

3. **Verify in faction dropdown:**
   - New faction should appear in `/armies/new`
   - Shows correct datasheet count

See [Wahapedia Scraping Guide](WAHAPEDIA_SCRAPING_GUIDE.md) for detailed instructions.

---

## Best Practices

### For Best Parsing Results
- ✅ **Select correct faction first** (most important!)
- ✅ Use high-quality images (well-lit, clear text)
- ✅ Include full army list with points and detachment
- ✅ Use standard formats (Battlescribe, official app)
- ✅ Review all units before creating army

### Faction Selection Tips
- ✅ Check datasheet count before uploading
- ✅ Use specific subfactions (Space Wolves) not parent (Space Marines) for best results
- ✅ Note parent faction inclusion (subfactions get shared units)

### Reviewing Imports
- ✅ Always review flagged units
- ✅ Verify model counts are accurate
- ✅ Check points match your list
- ✅ Expand units to see matched weapons/abilities
- ✅ Remove duplicate or misidentified units

---

## Related Documentation

- **[Faction System](../features/FACTION_SYSTEM.md)** - How the faction database works
- **[Faction-First Import](../features/FACTION_FIRST_ARMY_IMPORT.md)** - Implementation details
- **[Session Setup Guide](SESSION_SETUP_GUIDE.md)** - How to create sessions with armies
- **[Wahapedia Scraping Guide](WAHAPEDIA_SCRAPING_GUIDE.md)** - Adding new factions
- **[Armies API](../api/ARMIES_ENDPOINT.md)** - API reference for army operations
