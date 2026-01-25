# PDF Rules Import Guide

**Last Updated:** 2025-10-23  
**Status:** Complete

## Overview

Step-by-step guide to importing Warhammer 40K rules from PDF files into the Strategic Assistant database.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Two-Step Process](#two-step-process)
- [Step 1: Extract from PDF](#step-1-extract-from-pdf)
- [Step 2: Import to Database](#step-2-import-to-database)
- [Verification](#verification)
- [Troubleshooting](#troubleshooting)

---

## Prerequisites

### Required

- Python 3.11+ installed
- OpenAI API key in `.env` file
- PDF files with Warhammer 40K rules

### Install Python Dependencies

```bash
pip install pymupdf openai tqdm
```

### Verify Installation

```bash
python --version  # Should show 3.11 or higher
python -c "import fitz; print('PyMuPDF OK')"
```

---

## Two-Step Process

The import pipeline uses two separate scripts:

1. **Extract** (`parsePdfWithVision.py`) - GPT-5-mini Vision extracts raw text from PDF
2. **Import** (`importStrategicRules.ts`) - GPT-5-mini parses text and imports to database

**Why two steps?**
- Review/edit extracted text before importing
- Vision API is expensive - only run once
- Different PDFs have different formats
- Error recovery without re-extraction

---

## Step 1: Extract from PDF

### Place Your PDF Files

Put PDFs in `data/pdf-source/`:
```
data/pdf-source/
  eng_08-10_warhammer40000_faction_pack_space_wolves.pdf
  eng_22-10_warhammer40000_faction_pack_tyranids.pdf
  eng_17-09_warhammer40000_core_rules_chapter_approved_tournament_companion.pdf
```

### Run Extraction Script

**For Faction Pack:**
```bash
python scripts/parsePdfWithVision.py \
  --input data/pdf-source/eng_08-10_warhammer40000_faction_pack_space_wolves.pdf \
  --faction "Space Marines" \
  --detachment "Saga of the Beastslayer"
```

**For Core Rules:**
```bash
python scripts/parsePdfWithVision.py \
  --input data/pdf-source/eng_17-09_warhammer40000_core_rules_chapter_approved_tournament_companion.pdf
```

**Optional: Custom Output Path**
```bash
python scripts/parsePdfWithVision.py \
  --input data/pdf-source/your-codex.pdf \
  --output my-custom-name.md \
  --faction "Your Faction"
```

### What Happens During Extraction

1. **PDF Rendering:** PyMuPDF renders each page at 2x resolution
2. **Vision API:** Each page sent to GPT-5-mini Vision
3. **Text Extraction:** AI extracts all text preserving exact wording
4. **Output:** Raw markdown file in `data/rules-source/`
5. **Progress:** Shows progress bar with pages/sec

**Time:** ~30-40 seconds per page  
**Cost:** ~$0.001 per page (GPT-5-mini Vision)

### Output Files

Extraction creates markdown files:
```
data/rules-source/
  eng_08-10_warhammer40000_faction_pack_space_wolves.md
  eng_22-10_warhammer40000_faction_pack_tyranids.md
  ...
```

### Review Extracted Text

**Recommended:** Review the markdown file before importing:
```bash
code data/rules-source/eng_08-10_warhammer40000_faction_pack_space_wolves.md
```

Check for:
- Stratagems extracted completely
- No missing CP costs
- Text is readable
- No obvious OCR errors

**Edit if needed** - the file is plain markdown.

---

## Step 2: Import to Database

### Run Import Script

**For Faction Rules:**
```bash
npx tsx scripts/importStrategicRules.ts \
  --file eng_08-10_warhammer40000_faction_pack_space_wolves.md \
  --faction "Space Marines" \
  --detachment "Saga of the Beastslayer"
```

**For Core Rules:**
```bash
npx tsx scripts/importStrategicRules.ts \
  --file eng_17-09_warhammer40000_core_rules_chapter_approved_tournament_companion.md
```

**With Override (Replace Existing):**
```bash
npx tsx scripts/importStrategicRules.ts \
  --file your-rules.md \
  --faction "Your Faction" \
  --override
```

### What Happens During Import

1. **Read Markdown:** Loads extracted text file
2. **AI Parsing:** GPT-5-mini analyzes text and extracts:
   - Stratagem names and CP costs
   - Phase and timing metadata
   - Required keywords
   - Reactive status
   - Usage restrictions
3. **Validation:** Zod schema validates structured data
4. **Database Import:** Upserts to CoreStratagem or StratagemData tables
5. **Progress:** Shows each stratagem as imported

**Time:** ~10-30 seconds per file  
**Cost:** ~$0.01 per file (GPT-5-mini parsing)

### Import Output

```
🎮 Strategic Rules Import Script
📁 Found 1 file(s) to process

============================================================
📄 Processing: eng_08-10_warhammer40000_faction_pack_space_wolves.md
============================================================

📖 Parsing detachment rules with GPT-5-mini...
✅ Parsed 6 stratagems, 35 abilities

📜 Importing 6 stratagems...
  ✓ PREYTAKER'S EYE (Space Marines - Saga of the Beastslayer)
  ✓ ARMOUR OF CONTEMPT (Space Marines - Saga of the Beastslayer)
  ...

⚡ Importing 35 abilities...
  ✓ THE GREAT WOLF WATCHES (faction)
  ...

============================================================
✅ Import Complete!
============================================================
📊 Total imported:
   - 6 stratagems
   - 32 abilities
```

---

## Verification

### Check Database with Supabase MCP

After import, verify data:

```sql
-- Check stratagems imported
SELECT name, "cpCost", "triggerPhase", "requiredKeywords"
FROM "StratagemData"
WHERE faction = 'Space Marines' AND detachment = 'Saga of the Beastslayer';

-- Check core stratagems
SELECT name, "cpCost", "triggerPhase"
FROM "CoreStratagem"
ORDER BY name;

-- Check abilities with phase metadata
SELECT name, type, "triggerPhase", "isReactive"
FROM "Ability"
WHERE "triggerPhase" IS NOT NULL
LIMIT 10;
```

### Test in Strategic Assistant

1. Open Strategic Assistant (`Shift+S`)
2. Verify stratagems appear
3. Change phase - verify rules update
4. Check keyword filtering works
5. Test search function

---

## Troubleshooting

### PDF Extraction Issues

**Problem:** "Error converting PDF" or "No pages converted"

**Solutions:**
1. Verify PDF file exists and is readable
2. Check PDF isn't corrupted or password-protected
3. Try with different PDF
4. Check Python and PyMuPDF installation

**Problem:** "No rules found" for all pages

**Solutions:**
1. PDF might be image-only (scanned) - try higher quality scan
2. Check PDF actually contains stratagem rules
3. Review first few pages manually

**Problem:** GPT-5-mini Vision API errors

**Solutions:**
1. Check OpenAI API key in `.env`
2. Verify API key has sufficient credits
3. Check rate limits (script waits 1s between pages)
4. Reduce PDF size or split into smaller files

### Import Parsing Issues

**Problem:** "Invalid JSON arguments" or schema validation errors

**Solutions:**
1. Re-run extraction with `--override` flag
2. Manually edit markdown file to fix formatting
3. Check markdown has proper structure (## headings, etc.)

**Problem:** Stratagems imported with wrong metadata

**Solutions:**
1. Review extracted markdown - check phase information is present
2. Manually edit markdown to clarify timing
3. Re-import with `--override` flag

**Problem:** Duplicate stratagems or "Skipping existing"

**Solutions:**
- Use `--override` flag to replace existing entries
- Or manually delete from database first

### Common Mistakes

**Wrong Faction Name:**
```bash
# ❌ Wrong
--faction "Space Wolves"  # Should be "Space Marines" with subfaction

# ✅ Correct
--faction "Space Marines" --detachment "Saga of the Beastslayer"
```

**Missing Detachment:**
```bash
# ❌ Less specific
--faction "Space Marines"  # All stratagems become faction-wide

# ✅ More specific
--faction "Space Marines" --detachment "Saga of the Beastslayer"
```

---

## Advanced Usage

### Parallel Processing

Process multiple PDFs simultaneously:

```bash
# Terminal 1
python scripts/parsePdfWithVision.py --input data/pdf-source/space-wolves.pdf --faction "Space Marines" --detachment "Saga of the Beastslayer"

# Terminal 2  
python scripts/parsePdfWithVision.py --input data/pdf-source/tyranids.pdf --faction "Tyranids" --detachment "Subterranean Assault"

# Terminal 3
python scripts/parsePdfWithVision.py --input data/pdf-source/core-rules.pdf
```

**Tip:** Use PowerShell ISE or Windows Terminal tabs for parallel execution.

### Re-Importing After Updates

If rules are errata'd or updated:

1. Extract new PDF
2. Import with `--override` flag
3. Verify changes in database

---

## Cost Estimates

### Per PDF

**Extraction (Step 1):**
- 40-page PDF: ~$0.04 (GPT-5-mini Vision)
- 20-page PDF: ~$0.02

**Import (Step 2):**
- Per file: ~$0.01 (GPT-5-mini parsing)

**Total per faction:** ~$0.05-$0.10

### For Full Setup

- 2 faction packs: ~$0.10
- 2 core rules: ~$0.10
- **Total: ~$0.20** for complete rules database

Very affordable for high-quality AI extraction and parsing!

---

## Related Documentation

- **User Guide**: [STRATEGIC_ASSISTANT_USER_GUIDE.md](STRATEGIC_ASSISTANT_USER_GUIDE.md) - How to use Strategic Assistant
- **Feature Overview**: [STRATEGIC_ASSISTANT.md](../features/STRATEGIC_ASSISTANT.md) - Feature architecture
- **API Reference**: [STRATEGIC_ASSISTANT_API.md](../api/STRATEGIC_ASSISTANT_API.md) - API documentation

