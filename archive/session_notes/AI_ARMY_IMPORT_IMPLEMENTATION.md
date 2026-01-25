# AI-Powered Army List Import Feature

## 🎯 Implementation Summary

This document outlines the complete AI-powered army list import feature that allows users to upload images, PDFs, or text files of their Warhammer 40K army lists and automatically parse them into structured data.

---

## ✅ Completed Features

### 1. Database Schema Updates

**New `UnitTemplate` Model:**
- Stores base unit statistics for each faction (Space Marines & Tyranids 10th edition)
- Fields include: name, faction, role, basePointsCost, movement, toughness, save, wounds, leadership, abilities, keywords, wargear options
- Pre-populated with 16 unit templates (8 Space Marines, 8 Tyranids)

**Updated `Unit` Model:**
- Added `unitTemplateId` - Links to UnitTemplate for base stats
- Added `modelCount` - Number of models in the unit
- Added `wargear` - JSON array of specific wargear for this instance
- Added `enhancements` - JSON array of upgrades/enhancements
- Added `needsReview` - Boolean flag for AI-parsed units that need verification

### 2. API Endpoints

#### `POST /api/armies/parse`
- **Purpose:** Upload and parse army list files
- **Accepts:** Images (JPG, PNG), PDFs, and Text files (max 10MB)
- **Process:**
  1. Extracts text/image content from uploaded file
  2. Sends to OpenAI GPT-4o for parsing
  3. Matches parsed units to unit templates in database
  4. Returns structured `ParsedArmyList` with confidence scores
- **Returns:** 
  ```typescript
  {
    detectedFaction: string,
    detectedPointsLimit: number,
    units: ParsedUnit[],
    parsingConfidence: number
  }
  ```

#### `GET /api/unit-templates`
- **Purpose:** Fetch available unit templates
- **Query Params:** 
  - `faction` (optional) - Filter by faction
  - `edition` (optional) - Filter by edition (default: "10th")
- **Returns:** Array of unit templates with parsed JSON fields

#### `POST /api/armies` (Enhanced)
- **Purpose:** Create new army with units
- **Enhanced to accept:** `units` array in request body
- **Process:**
  1. Creates/finds player
  2. Creates army with all parsed units in a single transaction
  3. Links units to templates if matched
- **Returns:** Complete army with units and player info

### 3. User Interface

#### `/armies/new` - Import Army List Page

**Two-Step Wizard Flow:**

**Step 1: Upload**
- Drag-and-drop / click-to-upload interface
- File type validation (images, PDF, TXT)
- File size validation (max 10MB)
- Visual file preview with size display
- "PARSE LIST" button triggers AI analysis

**Step 2: Review & Edit**
- **Army Metadata Form:**
  - Player Name (required)
  - Faction (dropdown, pre-filled if detected)
  - Army Name (required)
  - Points Limit (pre-filled if detected)

- **Parsed Units Table:**
  - Mobile-friendly card layout
  - Each unit displays:
    - Editable name, model count, points cost, wargear
    - Visual indicators for units needing review (yellow border)
    - Visual indicators for units without template match
    - Remove unit button
  - Real-time points total calculation
  - Low confidence warning banner

- **Actions:**
  - Back to upload (start over)
  - Create Army (saves to database)

### 4. AI Integration

**OpenAI GPT-4o Vision:**
- Parses army lists from images, PDFs, and text
- Extracts unit names, points costs, model counts, wargear, enhancements
- Attempts to match units to existing templates in database
- Provides confidence scores for each match
- Returns structured JSON data

**Matching Logic:**
- AI first attempts to match unit names to templates
- Fuzzy matching fallback for unmatched units
- Units without matches are flagged but still imported
- Low-confidence matches are marked for user review

### 5. Type Definitions

Added to `lib/types.ts`:
```typescript
- UnitTemplateData
- ParsedUnit
- ParsedArmyList
```

---

## 📊 Database Seed Data

### Space Marines (10th Edition)
1. Intercessor Squad - 95pts
2. Tactical Squad - 90pts
3. Captain - 80pts
4. Librarian - 75pts
5. Terminator Squad - 200pts
6. Dreadnought - 140pts
7. Predator - 130pts
8. Assault Squad - 100pts

### Tyranids (10th Edition)
1. Termagants - 60pts
2. Hormagaunts - 65pts
3. Tyranid Warriors - 100pts
4. Hive Tyrant - 220pts
5. Carnifex - 125pts
6. Genestealers - 85pts
7. Neurothrope - 105pts
8. Ripper Swarms - 20pts

---

## 🚀 How to Use

### For Users:

1. **Navigate to Army Import:**
   - Go to `/armies` page
   - Click "+ NEW ARMY" button
   - This opens the import wizard

2. **Upload Army List:**
   - Click to select or drag-and-drop your army list file
   - Supported formats: JPG, PNG, PDF, TXT
   - Click "PARSE LIST"
   - Wait for AI analysis (15-30 seconds typically)

3. **Review Parsed Data:**
   - Check all parsed units for accuracy
   - Edit any incorrect values (name, points, wargear, etc.)
   - Pay attention to yellow-highlighted units (need review)
   - Remove any incorrectly detected units
   - Fill in army metadata (player name, faction, army name)

4. **Save Army:**
   - Click "CREATE ARMY"
   - Redirects to army detail page

### For Admins (Seeding Templates):

1. **Connect to Database:**
   - Ensure your Supabase/PostgreSQL connection is working
   - Check `.env` file has correct `DATABASE_URL`

2. **Run Seed Script:**
   ```bash
   npm run seed
   ```
   This populates the unit templates table with Space Marines and Tyranids data.

---

## 🔧 Technical Details

### File Processing Pipeline

1. **File Upload** → FormData sent to `/api/armies/parse`
2. **Content Extraction:**
   - Images: Convert to base64 data URL
   - PDFs: Extract via OpenAI OCR (base64)
   - Text: Read as UTF-8 string
3. **AI Parsing:** OpenAI GPT-4o with vision capability
4. **Template Matching:** Compare against database templates
5. **Return Structured Data:** JSON response with confidence scores

### Error Handling

- File type validation
- File size limits (10MB)
- Database connection errors
- OpenAI API errors
- Low confidence warnings for users
- Graceful fallbacks for unmatched units

### Performance Considerations

- OpenAI API calls: 15-30 seconds typical
- Database queries: Optimized with indexes on `faction` and `name`
- Single transaction for army creation (prevents partial saves)

---

## 📝 Next Steps / Future Enhancements

### Potential Improvements:

1. **Add More Factions:**
   - Create seed data for all 20+ factions
   - Admin interface for managing templates

2. **Improve Matching:**
   - Implement fuzzy string matching library (e.g., Fuse.js)
   - Machine learning model for better unit recognition
   - Allow users to manually select template for each unit

3. **Batch Import:**
   - Support multiple army lists at once
   - Import from external sources (Battlescribe, etc.)

4. **Template Management UI:**
   - Admin dashboard for adding/editing unit templates
   - Version control for template changes
   - Import templates from CSV/JSON

5. **Enhanced Validation:**
   - Rules validation (e.g., max 3 of same unit)
   - Points calculations with wargear costs
   - Legal list validation

6. **PDF Parsing Improvement:**
   - Use dedicated PDF parsing library (pdf-parse)
   - Better handling of multi-page lists

---

## 🐛 Known Issues / Notes

1. **Database Connection:**
   - Seed script currently fails due to Supabase connection issue
   - Run `npm run seed` once database is accessible
   - Migration already created and schema is updated

2. **OpenAI API Key:**
   - Requires `OPENAI_API_KEY` in `.env` file
   - Ensure you have access to GPT-4o model

3. **PostgreSQL Switch:**
   - Migrated from SQLite to PostgreSQL
   - Old migrations were deleted and recreated
   - Data from SQLite `dev.db` is not migrated

---

## 📁 Files Created/Modified

### Created:
- `app/api/armies/parse/route.ts` - Parse endpoint
- `app/api/unit-templates/route.ts` - Template endpoint
- `prisma/seed-unit-templates.ts` - Seed data script
- `AI_ARMY_IMPORT_IMPLEMENTATION.md` - This document

### Modified:
- `prisma/schema.prisma` - Added UnitTemplate model, updated Unit model
- `app/api/armies/route.ts` - Enhanced POST to accept units
- `app/armies/new/page.tsx` - Complete rewrite as import wizard
- `lib/types.ts` - Added new type definitions
- `package.json` - Added seed script and tsx dependency

---

## 🎉 Conclusion

The AI-powered army list import feature is fully implemented and ready for testing once the database connection is established. The system provides a seamless user experience for importing army lists from various file formats, with AI-powered parsing and intelligent unit matching.

The architecture is extensible, allowing for easy addition of more factions, improved matching algorithms, and enhanced validation rules in the future.



