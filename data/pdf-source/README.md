# PDF Rules Parser - Setup & Usage

This directory contains PDF files with Warhammer 40K rules to be parsed.

---

## Quick Start

### Option 1: Parse PDFs Directly (Recommended)

**Prerequisites:**
- GraphicsMagick or Ghostscript installed on your system

**Windows Installation:**
```powershell
# Install Ghostscript via Chocolatey
choco install ghostscript

# OR download installer from:
# https://ghostscript.com/releases/gsdnld.html
```

**Mac Installation:**
```bash
brew install ghostscript
```

**Linux Installation:**
```bash
sudo apt-get install ghostscript
```

**Usage:**
```bash
# Place your PDF in data/pdf-source/
# Then run:

# Core stratagems
npx tsx scripts/parsePdfRules.ts --input data/pdf-source/core-rules.pdf --output core-stratagems.md

# Space Marines - Saga of the Beastslayer
npx tsx scripts/parsePdfRules.ts --input data/pdf-source/space-marines.pdf --output space-marines-saga-beastslayer.md --faction "Space Marines" --detachment "Saga of the Beastslayer"

# Tyranids - Subterranean Assault
npx tsx scripts/parsePdfRules.ts --input data/pdf-source/tyranids.pdf --output tyranids-subterranean-assault.md --faction "Tyranids" --detachment "Subterranean Assault"
```

---

### Option 2: Use Pre-Converted Images (No Dependencies)

If you don't want to install system dependencies, you can:

1. **Convert PDF to images manually** using any tool (Adobe, online converters, etc.)
2. **Place images in:** `data/pdf-images/your-book-name/`
3. **Run image parser:**

```bash
npx tsx scripts/parseImageRules.ts --input data/pdf-images/space-marines/ --output space-marines.md --faction "Space Marines"
```

---

## What the Parser Does

1. **Converts** PDF pages to high-resolution images (300 DPI)
2. **Sends** each image to GPT-4 Vision API
3. **Extracts** stratagem text with:
   - Name and CP cost
   - Category (Battle Tactic, Strategic Ploy, Epic Deed)
   - Phase and timing
   - Target and effect text
   - Required keywords (INFANTRY, VEHICLE, etc.)
   - Usage restrictions
4. **Outputs** structured markdown ready for import

---

## Expected PDF Layout

Works best with:
- ✅ Official Codex PDFs
- ✅ Index/Datasheet PDFs
- ✅ FAQ/Errata documents
- ✅ Multi-column layouts
- ✅ Tables and complex formatting

---

## Example Output Format

The parser creates markdown files like this:

```markdown
## FIRE OVERWATCH (2 CP)
**Category:** Battle Tactic
**When:** Charge phase - After enemy declares charge
**Target:** One unit from your army that has been declared as a target
**Effect:** That unit can fire Overwatch. Each time a model in that unit makes a ranged attack, an unmodified Hit roll of 6 scores a Critical Hit.
**Keywords:** Any unit
**Restriction:** once_per_turn

---

## HEROIC INTERVENTION (1 CP)
**Category:** Battle Tactic
**When:** Charge phase - After enemy ends charge move
**Target:** One CHARACTER unit within 6" of that enemy unit
**Effect:** That CHARACTER can make a Heroic Intervention move of up to 6".
**Keywords:** CHARACTER
**Restriction:** none
```

---

## After Parsing

Once you have the markdown files:

```bash
# Import into database
npx tsx scripts/importStrategicRules.ts --file core-stratagems.md

npx tsx scripts/importStrategicRules.ts --file space-marines-saga-beastslayer.md --faction "Space Marines" --detachment "Saga of the Beastslayer"

npx tsx scripts/importStrategicRules.ts --file tyranids-subterranean-assault.md --faction "Tyranids" --detachment "Subterranean Assault"
```

---

## Troubleshooting

### "pdf2pic error: GraphicsMagick/Ghostscript not found"
**Solution:** Install Ghostscript (see installation commands above)

### "No stratagems extracted"
**Possible causes:**
- PDF is image-based (scanned) with poor quality
- Wrong pages (may need to specify page range)
- Non-standard formatting

**Solution:** Try Option 2 (manual image conversion with higher quality)

### "Rate limit error from OpenAI"
**Solution:** The script waits 1 second between pages. For large PDFs, this is normal. Wait and retry.

### "Output looks wrong"
**Solution:** 
1. Check the markdown output file
2. Manually edit any errors
3. The import script is forgiving of minor formatting issues

---

## Cost Estimation

**GPT-4 Vision API costs:**
- ~$0.01 per image (high detail)
- 20-page PDF = ~$0.20
- 50-page PDF = ~$0.50

The script processes **all pages** by default. If your PDF has lots of non-stratagem pages, consider:
1. Splitting the PDF to only include relevant pages
2. Manually reviewing and removing empty results

---

## Files to Place Here

Recommended naming:
- `core-rules.pdf` - Core/Universal stratagems
- `space-marines.pdf` - Full codex
- `space-marines-saga-beastslayer.pdf` - Just that detachment
- `tyranids-subterranean-assault.pdf` - Just that detachment
- `faq-2024.pdf` - Errata and clarifications

---

## Next Steps

1. **Place your PDFs** in this directory
2. **Run the parser** (see commands above)
3. **Review the output** markdown files
4. **Import to database** using importStrategicRules.ts
5. **Test Strategic Assistant** in your app!

---

**Need Help?**
- Check the parser script: `scripts/parsePdfRules.ts`
- Check the import script: `scripts/importStrategicRules.ts`
- Review sample output: `data/rules-source/sample-core-stratagems.txt`

