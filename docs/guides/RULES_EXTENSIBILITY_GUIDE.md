# Rules Extensibility Guide

## Overview

The Grimlog rules system is designed to be **fully extensible** - allowing you to add new rule PDFs, categories, and extraction logic without modifying core application code.

**Last Updated:** November 11, 2024

---

## Architecture

### Rules Registry System

All rules are managed through a central registry:

```
data/rules-source/rules-registry.json
  ↓
Defines: Sources, Categories, Extraction Rules
  ↓
scripts/parseGameplayRules.ts
  ↓
Extracts: Structured JSON by category
  ↓
data/parsed-rules/*.json
  ↓
scripts/seedGameplayRules.ts
  ↓
Database: GameRule, SecondaryObjective, PrimaryMission
  ↓
Context Builder & AI Tools
  ↓
Automatically available in gameplay
```

---

## Adding a New Rules PDF

### Step 1: Add to Registry

Edit `data/rules-source/rules-registry.json`:

```json
{
  "sources": [
    {
      "id": "unique-identifier",
      "name": "Human-Readable Name",
      "file": "filename.pdf",
      "version": "1.0",
      "date": "2024-11",
      "categories": ["category-1", "category-2"],
      "priority": 1
    }
  ]
}
```

**Fields:**
- `id`: Unique identifier (kebab-case)
- `name`: Display name
- `file`: PDF filename in `data/pdf-source/`
- `version`: Version number (for tracking updates)
- `date`: Release date
- `categories`: Which rule categories this source contains
- `priority`: Lower = higher priority (for conflict resolution)

### Step 2: Add Category (If New)

If your PDF introduces a new category of rules:

```json
{
  "categories": {
    "your-category-name": {
      "description": "What this category contains",
      "contextTiers": ["minimal", "full"],
      "enabled": true,
      "extractionRules": {
        "searchFor": "What to look for",
        "outputFormat": "How to structure output"
      }
    }
  }
}
```

**Context Tiers:**
- `minimal`: Lightweight context (phase/CP tracking only)
- `secondaries`: Secondary objectives context
- `full`: Full context with all rules

### Step 3: Add Extractor (If New Category)

Edit `scripts/parseGameplayRules.ts`:

```typescript
// Add extraction function
async function extractYourCategory(
  content: string,
  source: RuleSource
): Promise<any[]> {
  const prompt = `Extract [your rules] from this document...`;
  
  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      { role: 'system', content: prompt },
      { role: 'user', content: content }
    ],
    response_format: { type: 'json_object' }
  });
  
  const result = JSON.parse(response.choices[0]?.message?.content || '{}');
  return result.rules || [];
}

// Add to registry
RULE_EXTRACTORS['your-category-name'] = {
  category: 'your-category-name',
  extractFromContent: extractYourCategory,
  validate: (rules) => rules.every(r => r.name && r.ruleData)
};
```

### Step 4: Run Parser

```bash
# Parse specific source
npx tsx scripts/parseGameplayRules.ts --source your-source-id

# Or parse all sources
npx tsx scripts/parseGameplayRules.ts --sync
```

### Step 5: Seed Database

```bash
# Seed specific category
npx tsx scripts/seedGameplayRules.ts --category your-category-name

# Or seed all
npx tsx scripts/seedGameplayRules.ts --sync
```

### Step 6: Verify

```bash
# Check database
npx prisma studio

# Verify in game
# Rules should automatically appear in AI context
```

---

## Adding a New AI Tool

When you want the AI to perform special actions with rules:

### Step 1: Define Tool in aiTools.ts

```typescript
{
  type: "function" as const,
  name: "your_tool_name",
  strict: false,
  description: "What this tool does and when to use it",
  parameters: {
    type: "object",
    properties: {
      parameter1: {
        type: "string",
        description: "What this parameter is"
      }
    },
    required: ["parameter1"],
    additionalProperties: false
  }
}
```

### Step 2: Add Type Definition

```typescript
export interface YourToolArgs {
  parameter1: string;
  parameter2?: number;
}

// Add to union type
export type ToolCallArgs = 
  | ...existing types...
  | YourToolArgs;
```

### Step 3: Implement Handler

In `lib/toolHandlers.ts`:

```typescript
// Add to switch statement
case 'your_tool_name':
  return await yourToolHandler(args as YourToolArgs, sessionId, customTimestamp);

// Implement handler
async function yourToolHandler(
  args: YourToolArgs,
  sessionId: string,
  customTimestamp?: Date
): Promise<ToolExecutionResult> {
  // 1. Fetch rules from database
  const rules = await prisma.gameRule.findMany({
    where: { category: 'your-category' }
  });
  
  // 2. Apply rules logic
  const result = applyYourLogic(args, rules);
  
  // 3. Validate
  if (!result.isValid) {
    return {
      toolName: 'your_tool_name',
      success: false,
      message: result.error
    };
  }
  
  // 4. Update database
  await updateGameState(sessionId, result);
  
  // 5. Create timeline event
  await prisma.timelineEvent.create({
    data: {
      gameSessionId: sessionId,
      eventType: 'custom',
      phase: session.currentPhase,
      description: `Your action description`,
      metadata: JSON.stringify({ ... }),
      timestamp: customTimestamp || new Date()
    }
  });
  
  return {
    toolName: 'your_tool_name',
    success: true,
    message: 'Success message',
    data: result
  };
}
```

### Step 4: Add to Context (If Needed)

Update `lib/rulesReference.ts` if tool needs context documentation:

```typescript
export const YOUR_RULES_CONTEXT = `
=== YOUR FEATURE RULES ===

Tool: your_tool_name(param1, param2)

Usage:
- When to use it
- What it does
- Examples
`;
```

Then add to `formatContextForPrompt()`:

```typescript
if (context.tier === 'full') {
  prompt += YOUR_RULES_CONTEXT + '\n\n';
}
```

---

## Updating Existing Rules

When GW releases rule updates:

### Step 1: Update Registry Version

```json
{
  "id": "chapter-approved-2024",
  "version": "1.3",  // Updated from 1.2
  "date": "2024-12"
}
```

### Step 2: Re-Parse

```bash
npx tsx scripts/parseGameplayRules.ts --source chapter-approved-2024
```

### Step 3: Re-Seed

```bash
npx tsx scripts/seedGameplayRules.ts --sync
```

The seeding script will:
- Mark old rules as `isActive: false` (preserves history)
- Insert new rules with new version
- Context builder automatically uses latest active rules

---

## Rule Versioning

### How It Works

```typescript
// GameRule model tracks versions
model GameRule {
  sourceVersion   String
  isActive        Boolean  // Old rules marked false
  
  // Context builder queries active rules only
  where: {
    isActive: true,
    category: 'secondary-objectives'
  }
}
```

### Rollback (If Needed)

To rollback to a previous version:

```sql
-- Deactivate current version
UPDATE "GameRule" 
SET "isActive" = false 
WHERE "sourceId" = 'chapter-approved-2024' 
  AND "sourceVersion" = '1.3';

-- Reactivate old version
UPDATE "GameRule" 
SET "isActive" = true 
WHERE "sourceId" = 'chapter-approved-2024' 
  AND "sourceVersion" = '1.2';
```

---

## Category Examples

### Existing Categories

1. **primary-missions**
   - 20 tournament missions
   - Scoring formulas
   - Deployment types

2. **secondary-objectives**
   - All secondary objectives
   - VP calculations
   - Max VP limits

3. **cp-rules**
   - CP gain/spend limits
   - Validation rules
   - Per-turn caps

4. **phase-rules**
   - Phase sequences
   - Battle-shock mechanics
   - Turn structure

### Example: Adding Faction Stratagems

**Registry Entry:**
```json
{
  "id": "space-marines-detachments-2024",
  "name": "Space Marines Detachment Rules",
  "file": "eng_space_marines_detachments.pdf",
  "version": "1.0",
  "categories": ["faction-stratagems"],
  "priority": 1
}
```

**Category Config:**
```json
{
  "faction-stratagems": {
    "description": "Faction-specific detachment stratagems",
    "contextTiers": ["full"],
    "enabled": true
  }
}
```

**Extractor:**
```typescript
async function extractFactionStratagems(content, source) {
  // Use existing stratagem extraction logic
  // Return structured stratagem objects
}

RULE_EXTRACTORS['faction-stratagems'] = {
  category: 'faction-stratagems',
  extractFromContent: extractFactionStratagems,
  validate: (rules) => rules.every(r => r.name && r.cpCost)
};
```

---

## Best Practices

### 1. Version Control

- Always increment version when updating rules
- Keep old versions in registry for reference
- Document changes in source comments

### 2. Category Organization

- Group related rules in same category
- Use clear, descriptive category names
- Consider context tier assignments carefully

### 3. Extraction Quality

- Use GPT-4o for complex PDFs
- Validate extracted data with Zod schemas
- Test parsing on sample pages first

### 4. Database Performance

- Index frequently queried fields
- Use JSON for flexible rule data
- Create specialized views for hot paths

### 5. Testing

- Test extraction on representative samples
- Verify VP calculations manually
- Check validation logic with edge cases

---

## Troubleshooting

### Parsing Failed

**Symptom:** Extractor returns empty array  
**Causes:**
- PDF not converted to markdown
- Prompt too vague
- Content too long (>100k chars)

**Fix:**
- Convert PDF to markdown first: `npx tsx scripts/parsePdfRules.ts`
- Refine extraction prompt
- Chunk large PDFs into sections

### Rules Not Appearing in Context

**Symptom:** New rules don't show in AI prompts  
**Causes:**
- Category not enabled in registry
- Context tier mismatch
- Rules marked inactive

**Fix:**
- Check `enabled: true` in registry
- Verify `applicableTiers` includes desired tier
- Query database to verify `isActive: true`

### VP Calculation Incorrect

**Symptom:** Wrong VP scored  
**Causes:**
- vpCalculation JSON structure wrong
- Condition evaluation logic needs update
- Thresholds in wrong order

**Fix:**
- Verify vpCalculation structure matches schema
- Debug `calculateVP()` function
- Ensure thresholds sorted by VP descending

---

## Future Enhancements

### Potential Extensions

1. **Faction-Specific Detachments**
   - Add faction stratagem categories
   - Parse detachment PDFs
   - Context filtering by army faction

2. **Mission Packs**
   - Crusade missions
   - Narrative missions
   - Custom mission builder

3. **Terrain Rules**
   - Terrain type definitions
   - Cover calculations
   - Movement modifiers

4. **Advanced Secondaries**
   - Tactical secondary draw system
   - End-of-game scoring
   - Progressive secondaries

5. **Rule Interactions**
   - Ability stacking validation
   - Stratagem conflict detection
   - Complex rule combinations

---

## Support

For questions or issues:
- Check existing documentation in `docs/`
- Review example implementations
- Test with dry-run mode first
- Consult CHANGELOG.md for recent changes

---

## Example: Complete Workflow

### Adding "Crusade Missions" Category

**1. Prepare PDF**
```bash
cp crusade_missions.pdf data/pdf-source/
npx tsx scripts/parsePdfRules.ts --input crusade_missions.pdf --output crusade-missions.md
```

**2. Update Registry**
```json
{
  "sources": [{
    "id": "crusade-missions-2024",
    "name": "Crusade Mission Pack",
    "file": "crusade_missions.pdf",
    "version": "1.0",
    "categories": ["crusade-missions"],
    "priority": 2
  }],
  "categories": {
    "crusade-missions": {
      "description": "Narrative crusade missions",
      "contextTiers": ["full"],
      "enabled": true
    }
  }
}
```

**3. Add Extractor**
```typescript
async function extractCrusadeMissions(content, source) {
  const prompt = `Extract crusade missions with:
  - Mission name
  - Objective
  - Special rules
  - Rewards`;
  
  // ... GPT-4 extraction logic
  return missions;
}

RULE_EXTRACTORS['crusade-missions'] = {
  category: 'crusade-missions',
  extractFromContent: extractCrusadeMissions,
  validate: (rules) => rules.every(r => r.name)
};
```

**4. Parse & Seed**
```bash
npx tsx scripts/parseGameplayRules.ts --source crusade-missions-2024
npx tsx scripts/seedGameplayRules.ts --category crusade-missions
```

**5. Done!**

Crusade missions now available in database and AI context.

---

## Summary

The extensibility system allows:
- ✅ Adding new PDFs in ~15 minutes
- ✅ No code changes for rule updates
- ✅ Automatic versioning and history
- ✅ Dynamic context building
- ✅ Graceful handling of conflicts

This ensures Grimlog stays current with official rules releases without requiring full code rewrites.


