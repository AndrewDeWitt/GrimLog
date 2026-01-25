# Quick Start: Import Space Wolves Datasheets

**Time Required:** ~15-20 minutes  
**Cost:** ~$0.50-$1.50 USD (OpenAI API with GPT-5-mini)

## Prerequisites

- ✅ Node.js and dependencies installed
- ✅ PostgreSQL database running
- ✅ `OPENAI_API_KEY` in your `.env` file
- ✅ Database schema pushed (`npx prisma db push` already run)

## Step-by-Step Guide

### 1. Scrape Space Wolves from Wahapedia (~2-3 minutes)

```bash
tsx scripts/scrapeWahapedia.ts "space-marines" "space-wolves"
```

**What happens:**
- Downloads ~40-50 unit pages from Wahapedia
- Saves HTML to `data/wahapedia-cache/space-marines/`
- Respects rate limits (1.5s between requests)

**Expected output:**
```
📊 Found 45 datasheets
✅ Success: 45
❌ Failed: 0
```

### 2. Parse HTML to JSON with GPT-5-mini (~5-10 minutes, ~$0.50-$1.50)

```bash
tsx scripts/parseDatasheets.ts "space-marines"
```

**What happens:**
- Sends each HTML file to GPT-5-mini with structured outputs
- Extracts stats, weapons, abilities with guaranteed schema compliance
- Double-validates with Zod schemas
- Saves JSON to `data/parsed-datasheets/space-marines/`

**Expected output:**
```
[45/45] Parsing Logan_Grimnar...
✅ Parsed and validated Logan Grimnar
📊 Parse Summary for space-marines
✅ Success: 45
❌ Failed: 0
```

**Note:** This step costs money (OpenAI API usage)

### 3. Import to Database (~30 seconds)

```bash
tsx scripts/seedDatasheets.ts "space-marines"
```

**What happens:**
- Reads parsed JSON files
- Creates Datasheet records
- Creates/links Weapon records
- Creates/links Ability records
- Sets up all relationships

**Expected output:**
```
✅ Imported Logan Grimnar with 5 weapons, 7 abilities
✅ Imported Arjac Rockfist with 3 weapons, 5 abilities
...
✅ Success: 45
❌ Failed: 0
```

### 4. Validate Import (~10 seconds)

```bash
tsx scripts/validateImport.ts "space-marines" "space-wolves"
```

**What happens:**
- Checks all datasheets are in database
- Validates stats are in correct ranges
- Verifies weapons and abilities present
- Spot checks famous units

**Expected output:**
```
📊 Validation Report for space-marines
Total Datasheets: 45
Valid: 45 (100%)
Issues Found: 0

✅ All datasheets passed validation!

🎯 Spot Check: Testing specific units
Checking Logan Grimnar...
  ✅ Found
  Stats: M 6" | T 6 | Sv 2+ | W 6 | Ld 6 | OC 1
  Weapons: 5
  Abilities: 7
  Points: 115
```

## Verify It Works

### Test API Endpoints

```bash
# Get Logan Grimnar's datasheet
curl http://localhost:3000/api/datasheets/space-marines/Logan-Grimnar

# Search for units
curl http://localhost:3000/api/datasheets/search?q=Grey%20Hunters

# List all Space Wolves
curl http://localhost:3000/api/datasheets/faction/space-marines?subfaction=space-wolves
```

### Test in Game Session

1. Open TacLog: http://localhost:3000
2. Start a new game session
3. Add Space Wolves units to your army
4. Test voice command: **"What's Logan Grimnar's toughness?"**
5. AI should respond: **"Logan Grimnar has Toughness 6"**

## Troubleshooting

### "No cached data found"
You skipped step 1. Run: `tsx scripts/scrapeWahapedia.ts "space-marines" "space-wolves"`

### "No parsed data found"
You skipped step 2. Run: `tsx scripts/parseDatasheets.ts "space-marines"`

### "OpenAI API error"
- Check your `.env` file has `OPENAI_API_KEY=sk-...`
- Verify you have API credits: https://platform.openai.com/usage
- Check OpenAI status: https://status.openai.com

### "Database error"
- Ensure database is running
- Check `DATABASE_URL` in `.env`
- Run `npx prisma db push` to sync schema

### Validation errors
- Review `data/parsed-datasheets/space-marines/parse-summary.json`
- Check individual JSON files for incomplete data
- May need to adjust parser prompt or re-run

## What's Next?

### Expand to Other Subfactions

```bash
# Blood Angels
tsx scripts/scrapeWahapedia.ts "space-marines" "blood-angels"
tsx scripts/parseDatasheets.ts "space-marines"
tsx scripts/seedDatasheets.ts "space-marines"

# Dark Angels
tsx scripts/scrapeWahapedia.ts "space-marines" "dark-angels"
tsx scripts/parseDatasheets.ts "space-marines"
tsx scripts/seedDatasheets.ts "space-marines"
```

### Other Factions

```bash
# Tyranids
tsx scripts/scrapeWahapedia.ts "tyranids"
tsx scripts/parseDatasheets.ts "tyranids"
tsx scripts/seedDatasheets.ts "tyranids"

# Necrons
tsx scripts/scrapeWahapedia.ts "necrons"
tsx scripts/parseDatasheets.ts "necrons"
tsx scripts/seedDatasheets.ts "necrons"
```

## Files Reference

- **Full guide:** `scripts/README.md`
- **Implementation details:** `DATASHEET_IMPLEMENTATION_SUMMARY.md`
- **Original plan:** `wahapedia-datasheet-integration.plan.md`

## Support

If you encounter issues:

1. Check `scripts/README.md` for detailed troubleshooting
2. Review `DATASHEET_IMPLEMENTATION_SUMMARY.md` for architecture details
3. Check console output for specific error messages
4. Verify all prerequisites are met

---

**Ready to import? Start with Step 1!** 🚀

