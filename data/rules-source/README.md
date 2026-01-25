# Strategic Rules Source Files

This directory contains source files (PDFs or text) for Warhammer 40K rules that will be parsed and imported into the Strategic Assistant database.

## File Naming Conventions

The import script uses filenames to determine rule type and faction:

### Core Stratagems (Universal)
- `core-stratagems.txt` - Core rules that apply to all armies

### Faction Rules
- `space-marines.txt` - General faction stratagems (not detachment-specific)
- `tyranids.txt`
- `necrons.txt`
- etc.

### Detachment Rules
- `space-marines-gladius.txt` - Faction + Detachment name
- `space-marines-vanguard.txt`
- `tyranids-invasion.txt`
- etc.

## File Format

Files should be plain text (.txt) with rules formatted clearly. The AI will extract:

- **Stratagem Name**
- **CP Cost**
- **Category** (Battle Tactic, Strategic Ploy, Epic Deed, etc.)
- **When** (Phase and timing)
- **Target** (What can be targeted)
- **Effect** (What the stratagem does)
- **Required Keywords** (e.g., INFANTRY, VEHICLE)
- **Usage Restrictions** (once per battle, once per turn, etc.)

### Example Format

```
FIRE OVERWATCH (2 CP)
Category: Battle Tactic
When: Opponent's Movement or Charge phase
Target: One unit from your army
Effect: That unit can fire Overwatch. Each time a model in that unit makes a ranged attack, a successful unmodified Hit roll of 6 scores a Critical Hit.
Keywords: Any
Restriction: Once per turn
```

## Running the Import

### Import All Files
```bash
npx tsx scripts/importStrategicRules.ts
```

### Import Specific File
```bash
npx tsx scripts/importStrategicRules.ts --file core-stratagems.txt
```

### Import with Faction Override
```bash
npx tsx scripts/importStrategicRules.ts --file custom-rules.txt --faction "Space Marines"
```

### Import with Detachment
```bash
npx tsx scripts/importStrategicRules.ts --file gladius-rules.txt --faction "Space Marines" --detachment "Gladius"
```

### Override Existing Rules
```bash
npx tsx scripts/importStrategicRules.ts --override
```

## Tips

1. **Start with Core Rules**: Import core stratagems first as they apply to all games
2. **One Faction at a Time**: Process one faction completely before moving to the next
3. **Test with Small Files**: Try importing a small file first to verify format
4. **Check Console Output**: The import script shows what it's parsing in real-time

## What Gets Imported

The import script creates:
- **CoreStratagem** entries for universal rules
- **StratagemData** entries for faction/detachment rules  
- **Ability** entries for special abilities

All entries include phase-aware metadata for the Strategic Assistant filtering system.

