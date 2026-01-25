/**
 * Strategic Rules Import Script
 * 
 * Uses GPT-5-mini with structured outputs to parse PDF/text rule sources 
 * into phase-aware database entries for the Strategic Assistant feature.
 * 
 * Supports: Core Stratagems, Faction Stratagems, Unit Abilities
 * 
 * Usage:
 *   1. Place your rules files (.txt) in data/rules-source/
 *   2. Run: npx tsx scripts/importStrategicRules.ts [options]
 * 
 * Options:
 *   --file <filename>     Process only this specific file
 *   --type <type>         Process only this type (core, faction, ability)
 *   --faction <name>      Faction name for faction-specific rules
 *   --detachment <name>   Detachment name for detachment-specific stratagems
 *   --override            Override existing rules with same name
 */

import * as fs from 'fs-extra';
import * as path from 'path';
import OpenAI from 'openai';
import { z } from 'zod';
import { PrismaClient } from '@prisma/client';
import cliProgress from 'cli-progress';

const prisma = new PrismaClient();
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const RULES_SOURCE_DIR = path.join(process.cwd(), 'data', 'rules-source');

// ============================================
// Zod Schemas for Validation
// ============================================

const StratagemRuleSchema = z.object({
  name: z.string().describe('Name of the stratagem'),
  cpCost: z.number().min(0).max(3).describe('Command Point cost (0-3)'),
  category: z.string().describe('Category: Battle Tactic, Strategic Ploy, Epic Deed, etc.'),
  when: z.string().describe('When can be used (phase/timing description)'),
  target: z.string().describe('What can be targeted'),
  effect: z.string().describe('What the stratagem does'),
  triggerPhase: z.array(z.string()).describe('Array of phases: ["Command", "Movement", "Shooting", "Charge", "Fight"]'),
  triggerSubphase: z.string().describe('Specific timing: "Start of Phase", "During Move", "End of Phase", or "" if not specified'),
  isReactive: z.boolean().describe('Can be used during opponent\'s turn (e.g., Overwatch, Counter-offensive)'),
  requiredKeywords: z.array(z.string()).describe('Required keywords in UPPERCASE: ["INFANTRY", "VEHICLE"], or [] if any unit'),
  usageRestriction: z.string().describe('Usage limit: "once_per_battle", "once_per_turn", "once_per_phase", or "" if unlimited'),
});

const AbilityRuleSchema = z.object({
  name: z.string().describe('Name of the ability'),
  type: z.enum(['core', 'faction', 'unit', 'leader', 'wargear']).describe('Type of ability'),
  description: z.string().describe('Full ability text'),
  triggerPhase: z.array(z.string()).describe('Array of phases when ability can be used'),
  triggerSubphase: z.string().describe('Specific timing within phase, or "" if not specified'),
  isReactive: z.boolean().describe('Can be used during opponent\'s turn'),
  requiredKeywords: z.array(z.string()).describe('Keywords required to use this ability, or [] if any unit'),
});

const ParsedRulesSchema = z.object({
  stratagems: z.array(StratagemRuleSchema),
  abilities: z.array(AbilityRuleSchema),
});

type ParsedStratagem = z.infer<typeof StratagemRuleSchema>;
type ParsedAbility = z.infer<typeof AbilityRuleSchema>;
type ParsedRules = z.infer<typeof ParsedRulesSchema>;

// ============================================
// JSON Schema for OpenAI Structured Outputs
// ============================================

const rulesJsonSchema = {
  type: 'object',
  properties: {
    stratagems: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          cpCost: { type: 'number' },
          category: { type: 'string' },
          when: { type: 'string' },
          target: { type: 'string' },
          effect: { type: 'string' },
          triggerPhase: { type: 'array', items: { type: 'string' } },
          triggerSubphase: { type: 'string' },
          isReactive: { type: 'boolean' },
          requiredKeywords: { type: 'array', items: { type: 'string' } },
          usageRestriction: { type: 'string' },
        },
        required: ['name', 'cpCost', 'category', 'when', 'target', 'effect', 'triggerPhase', 'triggerSubphase', 'isReactive', 'requiredKeywords', 'usageRestriction'],
        additionalProperties: false,
      },
    },
    abilities: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          type: { type: 'string', enum: ['core', 'faction', 'unit', 'leader', 'wargear'] },
          description: { type: 'string' },
          triggerPhase: { type: 'array', items: { type: 'string' } },
          triggerSubphase: { type: 'string' },
          isReactive: { type: 'boolean' },
          requiredKeywords: { type: 'array', items: { type: 'string' } },
        },
        required: ['name', 'type', 'description', 'triggerPhase', 'triggerSubphase', 'isReactive', 'requiredKeywords'],
        additionalProperties: false,
      },
    },
  },
  required: ['stratagems', 'abilities'],
  additionalProperties: false,
};

// ============================================
// Parsing Functions
// ============================================

async function parseRulesFromText(
  textContent: string,
  ruleType: 'core' | 'faction' | 'detachment',
  metadata: { faction?: string; detachment?: string }
): Promise<ParsedRules> {
  console.log(`\n📖 Parsing ${ruleType} rules with GPT-5-mini...`);

  const systemPrompt = `You are an expert at extracting Warhammer 40,000 10th Edition rules from text.

Extract ALL stratagems and abilities from the provided text and classify them with phase/timing metadata.

For each stratagem, determine:
- **triggerPhase**: Which game phases it can be used in (Command, Movement, Shooting, Charge, Fight)
- **triggerSubphase**: Specific timing like "Start of Phase", "During Move", "Before Rolling", "End of Phase". Use "" if not specified.
- **isReactive**: Can it be used during opponent's turn? (e.g., Overwatch, Counter-offensive = true)
- **requiredKeywords**: What unit keywords are needed? (e.g., INFANTRY, VEHICLE, BATTLELINE) - in UPPERCASE. Use [] if applies to any unit.
- **usageRestriction**: Is it "once_per_battle", "once_per_turn", "once_per_phase". Use "" if unlimited/not specified.

For abilities:
- Determine which phases they apply to
- Identify if they're reactive (opponent's turn abilities)
- Extract required keywords (use [] if no specific requirements)
- Use "" for triggerSubphase if not specified

Important:
- Use exact phase names: "Command", "Movement", "Shooting", "Charge", "Fight"
- Keywords should be UPPERCASE: "INFANTRY", "VEHICLE", "MONSTER", "ADEPTUS ASTARTES", etc.
- Be specific about timing to enable dynamic subphase filtering
- If a stratagem/ability applies to ALL phases, include all 5 phases in the array
- ALWAYS provide a value for triggerSubphase and usageRestriction (use "" if not applicable)
`;

  const completion = await openai.chat.completions.create({
    model: 'gpt-5-mini',
    messages: [
      { role: 'system', content: systemPrompt },
      { 
        role: 'user', 
        content: `Extract all stratagems and abilities from this ${ruleType} rules text:\n\n${textContent}` 
      },
    ],
    response_format: {
      type: 'json_schema',
      json_schema: {
        name: 'warhammer_rules_extraction',
        schema: rulesJsonSchema,
        strict: true,
      },
    },
  });

  const content = completion.choices[0]?.message?.content;
  if (!content) {
    throw new Error('No content returned from GPT-5-mini');
  }

  // Parse and validate with Zod
  const parsed = JSON.parse(content);
  const validated = ParsedRulesSchema.parse(parsed);

  console.log(`✅ Parsed ${validated.stratagems.length} stratagems, ${validated.abilities.length} abilities`);

  return validated;
}

// ============================================
// Database Import Functions
// ============================================

async function importCoreStratagems(stratagems: ParsedStratagem[], override: boolean): Promise<number> {
  let imported = 0;

  for (const strat of stratagems) {
    // Check if exists
    const existing = await prisma.coreStratagem.findUnique({
      where: { name: strat.name },
    });

    if (existing && !override) {
      console.log(`  ⏭️  Skipping existing: ${strat.name}`);
      continue;
    }

    // Upsert
    await prisma.coreStratagem.upsert({
      where: { name: strat.name },
      update: {
        cpCost: strat.cpCost,
        category: strat.category,
        when: strat.when,
        target: strat.target,
        effect: strat.effect,
        triggerPhase: JSON.stringify(strat.triggerPhase),
        triggerSubphase: strat.triggerSubphase || null,
        isReactive: strat.isReactive,
        requiredKeywords: JSON.stringify(strat.requiredKeywords),
        usageRestriction: strat.usageRestriction || null,
      },
      create: {
        name: strat.name,
        cpCost: strat.cpCost,
        category: strat.category,
        when: strat.when,
        target: strat.target,
        effect: strat.effect,
        triggerPhase: JSON.stringify(strat.triggerPhase),
        triggerSubphase: strat.triggerSubphase || null,
        isReactive: strat.isReactive,
        requiredKeywords: JSON.stringify(strat.requiredKeywords),
        usageRestriction: strat.usageRestriction || null,
      },
    });

    imported++;
    console.log(`  ✓ ${strat.name} (${strat.cpCost}CP, ${strat.triggerPhase.join('/')})`);
  }

  return imported;
}

async function importFactionStratagems(
  stratagems: ParsedStratagem[],
  faction: string,
  detachment: string | null,
  override: boolean
): Promise<number> {
  let imported = 0;

  for (const strat of stratagems) {
    // Check if exists
    const existing = await prisma.stratagemData.findUnique({
      where: {
        name_faction_detachment: {
          name: strat.name,
          faction: faction,
          detachment: detachment || '',
        },
      },
    });

    if (existing && !override) {
      console.log(`  ⏭️  Skipping existing: ${strat.name}`);
      continue;
    }

    // Upsert
    await prisma.stratagemData.upsert({
      where: {
        name_faction_detachment: {
          name: strat.name,
          faction: faction,
          detachment: detachment || '',
        },
      },
      update: {
        cpCost: strat.cpCost,
        type: strat.category,
        when: strat.when,
        target: strat.target,
        effect: strat.effect,
        triggerPhase: JSON.stringify(strat.triggerPhase),
        triggerSubphase: strat.triggerSubphase || null,
        isReactive: strat.isReactive,
        requiredKeywords: JSON.stringify(strat.requiredKeywords),
        usageRestriction: strat.usageRestriction || null,
      },
      create: {
        name: strat.name,
        faction: faction,
        detachment: detachment || null,
        cpCost: strat.cpCost,
        type: strat.category,
        when: strat.when,
        target: strat.target,
        effect: strat.effect,
        keywords: JSON.stringify(strat.requiredKeywords),
        triggerPhase: JSON.stringify(strat.triggerPhase),
        triggerSubphase: strat.triggerSubphase || null,
        isReactive: strat.isReactive,
        requiredKeywords: JSON.stringify(strat.requiredKeywords),
        usageRestriction: strat.usageRestriction || null,
      },
    });

    imported++;
    console.log(`  ✓ ${strat.name} (${faction}${detachment ? ` - ${detachment}` : ''})`);
  }

  return imported;
}

async function importAbilities(abilities: ParsedAbility[], override: boolean): Promise<number> {
  let imported = 0;

  for (const ability of abilities) {
    // Check if exists
    const existing = await prisma.ability.findUnique({
      where: { name: ability.name },
    });

    if (existing && !override) {
      console.log(`  ⏭️  Skipping existing: ${ability.name}`);
      continue;
    }

    // Upsert
    await prisma.ability.upsert({
      where: { name: ability.name },
      update: {
        type: ability.type,
        description: ability.description,
        triggerPhase: JSON.stringify(ability.triggerPhase),
        triggerSubphase: ability.triggerSubphase || null,
        isReactive: ability.isReactive,
        requiredKeywords: JSON.stringify(ability.requiredKeywords),
      },
      create: {
        name: ability.name,
        type: ability.type,
        description: ability.description,
        triggerPhase: JSON.stringify(ability.triggerPhase),
        triggerSubphase: ability.triggerSubphase || null,
        isReactive: ability.isReactive,
        requiredKeywords: JSON.stringify(ability.requiredKeywords),
      },
    });

    imported++;
    console.log(`  ✓ ${ability.name} (${ability.type})`);
  }

  return imported;
}

// ============================================
// Main Function
// ============================================

async function main() {
  console.log('🎮 Strategic Rules Import Script\n');

  // Parse command line arguments
  const args = process.argv.slice(2);
  const getArg = (flag: string) => {
    const index = args.indexOf(flag);
    return index !== -1 ? args[index + 1] : null;
  };

  const specificFile = getArg('--file');
  const ruleType = (getArg('--type') || 'all') as 'core' | 'faction' | 'ability' | 'all';
  const faction = getArg('--faction');
  const detachment = getArg('--detachment');
  const override = args.includes('--override');

  // Ensure data directory exists
  await fs.ensureDir(RULES_SOURCE_DIR);

  // Get files to process
  const allFiles = await fs.readdir(RULES_SOURCE_DIR);
  const textFiles = allFiles.filter(f => f.endsWith('.txt'));

  if (textFiles.length === 0) {
    console.log(`⚠️  No .txt files found in ${RULES_SOURCE_DIR}`);
    console.log(`\nPlace your rules files there with naming conventions:`);
    console.log(`  - core-stratagems.txt          (Core rules)`);
    console.log(`  - space-marines-gladius.txt    (Faction detachment)`);
    console.log(`  - space-marines.txt            (Faction general)`);
    process.exit(0);
  }

  const filesToProcess = specificFile ? [specificFile] : textFiles;

  console.log(`📁 Found ${filesToProcess.length} file(s) to process\n`);

  let totalStratagems = 0;
  let totalAbilities = 0;

  // Process each file
  for (const file of filesToProcess) {
    const filePath = path.join(RULES_SOURCE_DIR, file);
    console.log(`\n${'='.repeat(60)}`);
    console.log(`📄 Processing: ${file}`);
    console.log('='.repeat(60));

    const content = await fs.readFile(filePath, 'utf-8');

    // Determine rule type from filename
    const isCore = file.toLowerCase().includes('core');
    const detectedFaction = faction || extractFactionFromFilename(file);
    const detectedDetachment = detachment || extractDetachmentFromFilename(file);

    const type = isCore ? 'core' : detectedDetachment ? 'detachment' : 'faction';

    // Parse rules
    const parsed = await parseRulesFromText(content, type, {
      faction: detectedFaction,
      detachment: detectedDetachment,
    });

    // Import stratagems
    if (parsed.stratagems.length > 0) {
      console.log(`\n📜 Importing ${parsed.stratagems.length} stratagems...`);

      if (isCore) {
        const count = await importCoreStratagems(parsed.stratagems, override);
        totalStratagems += count;
      } else if (detectedFaction) {
        const count = await importFactionStratagems(
          parsed.stratagems,
          detectedFaction,
          detectedDetachment,
          override
        );
        totalStratagems += count;
      } else {
        console.log(`⚠️  Skipping stratagems (no faction detected). Use --faction flag.`);
      }
    }

    // Import abilities
    if (parsed.abilities.length > 0) {
      console.log(`\n⚡ Importing ${parsed.abilities.length} abilities...`);
      const count = await importAbilities(parsed.abilities, override);
      totalAbilities += count;
    }
  }

  // Summary
  console.log(`\n${'='.repeat(60)}`);
  console.log(`✅ Import Complete!`);
  console.log('='.repeat(60));
  console.log(`📊 Total imported:`);
  console.log(`   - ${totalStratagems} stratagems`);
  console.log(`   - ${totalAbilities} abilities`);
  console.log('');

  await prisma.$disconnect();
}

// ============================================
// Helper Functions
// ============================================

function extractFactionFromFilename(filename: string): string | null {
  const lower = filename.toLowerCase();
  
  // Common factions
  const factions = [
    'space-marines', 'tyranids', 'necrons', 'orks', 'aeldari', 'tau',
    'imperial-guard', 'chaos-space-marines', 'death-guard', 'thousand-sons',
    'chaos-daemons', 'drukhari', 'adeptus-mechanicus', 'grey-knights',
    'adeptus-custodes', 'imperial-knights', 'chaos-knights', 'genestealer-cults',
    'adepta-sororitas', 'leagues-of-votann', 'world-eaters', 'agents-of-the-imperium',
  ];

  for (const faction of factions) {
    if (lower.includes(faction)) {
      // Capitalize properly
      return faction
        .split('-')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
    }
  }

  return null;
}

function extractDetachmentFromFilename(filename: string): string | null {
  const lower = filename.toLowerCase().replace('.txt', '');
  const parts = lower.split('-');

  // If filename has more than 2 parts, last part might be detachment
  // e.g., "space-marines-gladius.txt" -> "Gladius"
  if (parts.length > 2) {
    const detachment = parts[parts.length - 1];
    return detachment.charAt(0).toUpperCase() + detachment.slice(1);
  }

  return null;
}

// ============================================
// Run
// ============================================

main()
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  });

