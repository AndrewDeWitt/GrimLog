/**
 * Gameplay Rules Parser - Extensible PDF Extraction
 * 
 * Parses Warhammer 40K rules PDFs into structured JSON using GPT-4 Vision.
 * Supports modular rule categories via registry system.
 * 
 * Features:
 * - Registry-based extraction (add PDFs without code changes)
 * - Category-specific extractors (easy to extend)
 * - GPT-4 Vision for accurate PDF parsing
 * - Validation per category
 * - Version tracking
 * 
 * Usage:
 *   npx tsx scripts/parseGameplayRules.ts --sync           # Parse all sources
 *   npx tsx scripts/parseGameplayRules.ts --source <id>    # Parse specific source
 *   npx tsx scripts/parseGameplayRules.ts --category <cat> # Parse specific category
 */

import * as fs from 'fs-extra';
import * as path from 'path';
import OpenAI from 'openai';
import { z } from 'zod';
import cliProgress from 'cli-progress';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const REGISTRY_PATH = path.join(process.cwd(), 'data', 'rules-source', 'rules-registry.json');
const PDF_SOURCE_DIR = path.join(process.cwd(), 'data', 'pdf-source');
const MARKDOWN_SOURCE_DIR = path.join(process.cwd(), 'data', 'rules-source');
const OUTPUT_DIR = path.join(process.cwd(), 'data', 'parsed-rules');

// ============================================
// Types & Schemas
// ============================================

interface RulesRegistry {
  sources: RuleSource[];
  categories: Record<string, CategoryConfig>;
}

interface RuleSource {
  id: string;
  name: string;
  file: string;
  version: string;
  date: string;
  categories: string[];
  priority: number;
}

interface CategoryConfig {
  description: string;
  contextTiers: string[];
  enabled: boolean;
  extractionRules?: {
    searchFor: string;
    outputFormat: string;
  };
}

// Zod Schemas for Validation
const SecondaryObjectiveSchema = z.object({
  name: z.string(),
  category: z.string(), // "Fixed", "Tactical"
  type: z.string(), // "Assassination", "Bring It Down", etc.
  scoringType: z.string(), // "automatic", "per_turn", "end_of_game"
  vpCalculation: z.object({
    type: z.string(), // "threshold", "per_unit", "fixed"
    thresholds: z.array(z.object({
      condition: z.string(),
      vp: z.number()
    })).optional(),
    vpPerUnit: z.number().optional(),
    fixedVP: z.number().optional()
  }),
  maxVPPerTurn: z.number().nullable(),
  maxVPTotal: z.number(),
  description: z.string(),
  scoringTrigger: z.string(),
  requiredKeywords: z.array(z.string())
});

const PrimaryMissionSchema = z.object({
  name: z.string(),
  deploymentType: z.string(),
  scoringPhase: z.string(),
  scoringTiming: z.string(),
  scoringFormula: z.string(),
  maxVP: z.number(),
  specialRules: z.string().nullable(),
  description: z.string()
});

const CPRuleSchema = z.object({
  name: z.string(),
  category: z.string(), // "gain", "spend", "limit"
  rule: z.string(),
  limit: z.number().nullable(),
  description: z.string()
});

const PhaseRuleSchema = z.object({
  name: z.string(),
  phase: z.string(),
  timing: z.string(), // "start", "during", "end"
  rule: z.string(),
  description: z.string()
});

// ============================================
// Registry Loading
// ============================================

async function loadRegistry(): Promise<RulesRegistry> {
  try {
    const content = await fs.readFile(REGISTRY_PATH, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    throw new Error(`Failed to load rules registry: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// ============================================
// PDF/Markdown Loading
// ============================================

async function loadSourceContent(source: RuleSource): Promise<string> {
  // Check if we have a markdown version (already extracted)
  const mdPath = path.join(MARKDOWN_SOURCE_DIR, source.file.replace('.pdf', '.md'));
  if (await fs.pathExists(mdPath)) {
    console.log(`  ✓ Using markdown version: ${path.basename(mdPath)}`);
    return await fs.readFile(mdPath, 'utf-8');
  }
  
  // Otherwise, read PDF (note: actual PDF parsing would require pdf-parse or similar)
  const pdfPath = path.join(PDF_SOURCE_DIR, source.file);
  if (!await fs.pathExists(pdfPath)) {
    throw new Error(`Source file not found: ${source.file}`);
  }
  
  console.log(`  ⚠️ PDF found but markdown preferred. Consider running parsePdfRules.ts first.`);
  console.log(`  ℹ️ For now, reading as text (limited extraction)`);
  
  // For now, throw error - user should convert PDF to markdown first
  throw new Error(`Please convert ${source.file} to markdown format first using parsePdfRules.ts or manual extraction`);
}

// ============================================
// Extractor Functions
// ============================================

async function extractSecondaryObjectives(
  content: string,
  source: RuleSource
): Promise<any[]> {
  console.log(`\n  🎯 Extracting Secondary Objectives...`);
  
  const instructions = `You are an expert at extracting Warhammer 40,000 secondary objective rules.

Extract ALL secondary objectives from this rules document and structure them precisely.

For each secondary objective, extract:
- name: Full name of the secondary
- category: "Fixed" or "Tactical"
- type: Category like "Assassination", "Bring It Down", "No Prisoners", etc.
- scoringType: "automatic" (calculated by system), "per_turn", or "end_of_game"
- vpCalculation: Object with VP logic:
  - type: "threshold" (VP based on conditions), "per_unit" (VP per unit destroyed), or "fixed"
  - thresholds: Array of {condition: "description", vp: number} for threshold type
  - vpPerUnit: Number for per_unit type
  - fixedVP: Number for fixed type
- maxVPPerTurn: Max VP that can be scored in one turn (null if no limit)
- maxVPTotal: Total max VP for this secondary (usually 20)
- description: Full text description of the secondary
- scoringTrigger: When/how it scores (e.g., "CHARACTER destroyed", "Unit in deployment zone")
- requiredKeywords: Array of required keywords (e.g., ["CHARACTER"], ["MONSTER", "VEHICLE"])

Return ONLY valid JSON. Include a "secondaries" array with all extracted objectives.`;

  const jsonSchema = {
    type: 'object',
    properties: {
      secondaries: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            category: { type: 'string' },
            type: { type: 'string' },
            scoringType: { type: 'string' },
            vpCalculation: {
              type: 'object',
              properties: {
                type: { type: 'string' },
                thresholds: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      condition: { type: 'string' },
                      vp: { type: 'number' }
                    },
                    required: ['condition', 'vp'],
                    additionalProperties: false
                  }
                },
                vpPerUnit: { type: ['number', 'null'] },
                fixedVP: { type: ['number', 'null'] }
              },
              required: ['type', 'thresholds', 'vpPerUnit', 'fixedVP'],
              additionalProperties: false
            },
            maxVPPerTurn: { type: ['number', 'null'] },
            maxVPTotal: { type: 'number' },
            description: { type: 'string' },
            scoringTrigger: { type: 'string' },
            requiredKeywords: {
              type: 'array',
              items: { type: 'string' }
            }
          },
          required: ['name', 'category', 'type', 'scoringType', 'vpCalculation', 'maxVPPerTurn', 'maxVPTotal', 'description', 'scoringTrigger', 'requiredKeywords'],
          additionalProperties: false
        }
      }
    },
    required: ['secondaries'],
    additionalProperties: false
  };

  try {
    console.log(`  ⏳ Calling GPT-5-mini... (this may take 30-60 seconds)`);
    const startTime = Date.now();
    
    const response = await openai.responses.create({
      model: 'gpt-5-mini',
      instructions: instructions,
      input: content.substring(0, 100000), // Limit content size
      text: {
        format: {
          type: 'json_schema',
          name: 'secondary_objectives_extraction',
          strict: true,
          schema: jsonSchema
        }
      },
      store: false
    });
    
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`  ⏱️  Completed in ${duration}s`);
    
    const outputText = response.output_text || '';
    const result = JSON.parse(outputText);
    const secondaries = result.secondaries || [];
    
    // Validate each secondary
    const validated = secondaries.map((s: any) => SecondaryObjectiveSchema.parse(s));
    
    console.log(`  ✅ Extracted ${validated.length} secondary objectives`);
    return validated;
    
  } catch (error) {
    console.error(`  ❌ Failed to extract secondaries:`, error);
    return [];
  }
}

async function extractPrimaryMissions(
  content: string,
  source: RuleSource
): Promise<any[]> {
  console.log(`\n  🎯 Extracting Primary Missions...`);
  
  const instructions = `You are an expert at extracting Warhammer 40,000 mission rules.

Extract ALL primary missions from this tournament rules document.

For each mission, extract:
- name: Mission name
- deploymentType: Deployment map (e.g., "Hammer and Anvil", "Dawn of War", "Sweeping Engagement")
- scoringPhase: When scoring happens (e.g., "Command", "End of Turn")
- scoringTiming: Specific timing (e.g., "End of your Command phase")
- scoringFormula: How VP is calculated (e.g., "5 VP per objective controlled", "10 VP if controlling center + 2 in your half")
- maxVP: Maximum VP that can be scored from this mission (usually 50)
- specialRules: Any special rules or conditions (null if none)
- description: Full description of how the mission works

Return ONLY valid JSON with a "missions" array.`;

  const jsonSchema = {
    type: 'object',
    properties: {
      missions: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            deploymentType: { type: 'string' },
            scoringPhase: { type: 'string' },
            scoringTiming: { type: 'string' },
            scoringFormula: { type: 'string' },
            maxVP: { type: 'number' },
            specialRules: { type: ['string', 'null'] },
            description: { type: 'string' }
          },
          required: ['name', 'deploymentType', 'scoringPhase', 'scoringTiming', 'scoringFormula', 'maxVP', 'specialRules', 'description'],
          additionalProperties: false
        }
      }
    },
    required: ['missions'],
    additionalProperties: false
  };

  try {
    console.log(`  ⏳ Calling GPT-5-mini... (this may take 30-60 seconds)`);
    const startTime = Date.now();
    
    const response = await openai.responses.create({
      model: 'gpt-5-mini',
      instructions: instructions,
      input: content.substring(0, 100000),
      text: {
        format: {
          type: 'json_schema',
          name: 'primary_missions_extraction',
          strict: true,
          schema: jsonSchema
        }
      },
      store: false
    });
    
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`  ⏱️  Completed in ${duration}s`);
    
    const outputText = response.output_text || '';
    const result = JSON.parse(outputText);
    const missions = result.missions || [];
    
    // Validate each mission
    const validated = missions.map((m: any) => PrimaryMissionSchema.parse(m));
    
    console.log(`  ✅ Extracted ${validated.length} primary missions`);
    return validated;
    
  } catch (error) {
    console.error(`  ❌ Failed to extract missions:`, error);
    return [];
  }
}

async function extractCPRules(
  content: string,
  source: RuleSource
): Promise<any[]> {
  console.log(`\n  🎯 Extracting CP Rules...`);
  
  const instructions = `You are an expert at extracting Warhammer 40,000 command point rules.

Extract ALL CP gain/spend rules and limits from this document.

For each rule, extract:
- name: Rule name (e.g., "CP Gain Per Turn", "Secondary Discard CP")
- category: "gain", "spend", or "limit"
- rule: Concise statement of the rule
- limit: Numerical limit if applicable (null otherwise)
- description: Full description

Key rules to extract:
- CP gained at start of Command phase
- CP from discarding secondaries
- Maximum CP gain per turn
- Stratagem CP costs
- Any CP restrictions

Return ONLY valid JSON with a "cpRules" array.`;

  const jsonSchema = {
    type: 'object',
    properties: {
      cpRules: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            category: { type: 'string' },
            rule: { type: 'string' },
            limit: { type: ['number', 'null'] },
            description: { type: 'string' }
          },
          required: ['name', 'category', 'rule', 'limit', 'description'],
          additionalProperties: false
        }
      }
    },
    required: ['cpRules'],
    additionalProperties: false
  };

  try {
    console.log(`  ⏳ Calling GPT-5-mini... (this may take 30-60 seconds)`);
    const startTime = Date.now();
    
    const response = await openai.responses.create({
      model: 'gpt-5-mini',
      instructions: instructions,
      input: content.substring(0, 100000),
      text: {
        format: {
          type: 'json_schema',
          name: 'cp_rules_extraction',
          strict: true,
          schema: jsonSchema
        }
      },
      store: false
    });
    
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`  ⏱️  Completed in ${duration}s`);
    
    const outputText = response.output_text || '';
    const result = JSON.parse(outputText);
    const cpRules = result.cpRules || [];
    
    // Validate each rule
    const validated = cpRules.map((r: any) => CPRuleSchema.parse(r));
    
    console.log(`  ✅ Extracted ${validated.length} CP rules`);
    return validated;
    
  } catch (error) {
    console.error(`  ❌ Failed to extract CP rules:`, error);
    return [];
  }
}

async function extractPhaseRules(
  content: string,
  source: RuleSource
): Promise<any[]> {
  console.log(`\n  🎯 Extracting Phase Rules...`);
  
  const instructions = `You are an expert at extracting Warhammer 40,000 phase and turn structure rules.

Extract ALL phase-related rules including:
- Phase sequence
- Turn structure
- Battle-shock mechanics
- Persisting effects
- Phase transition rules

For each rule, extract:
- name: Rule name
- phase: Phase it applies to (Command, Movement, Shooting, Charge, Fight, or "All")
- timing: "start", "during", or "end"
- rule: Concise statement
- description: Full description

Return ONLY valid JSON with a "phaseRules" array.`;

  const jsonSchema = {
    type: 'object',
    properties: {
      phaseRules: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            phase: { type: 'string' },
            timing: { type: 'string' },
            rule: { type: 'string' },
            description: { type: 'string' }
          },
          required: ['name', 'phase', 'timing', 'rule', 'description'],
          additionalProperties: false
        }
      }
    },
    required: ['phaseRules'],
    additionalProperties: false
  };

  try {
    console.log(`  ⏳ Calling GPT-5-mini... (this may take 30-60 seconds)`);
    const startTime = Date.now();
    
    const response = await openai.responses.create({
      model: 'gpt-5-mini',
      instructions: instructions,
      input: content.substring(0, 100000),
      text: {
        format: {
          type: 'json_schema',
          name: 'phase_rules_extraction',
          strict: true,
          schema: jsonSchema
        }
      },
      store: false
    });
    
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`  ⏱️  Completed in ${duration}s`);
    
    const outputText = response.output_text || '';
    const result = JSON.parse(outputText);
    const phaseRules = result.phaseRules || [];
    
    // Validate each rule
    const validated = phaseRules.map((r: any) => PhaseRuleSchema.parse(r));
    
    console.log(`  ✅ Extracted ${validated.length} phase rules`);
    return validated;
    
  } catch (error) {
    console.error(`  ❌ Failed to extract phase rules:`, error);
    return [];
  }
}

// ============================================
// Extractor Registry
// ============================================

interface RuleExtractor {
  category: string;
  extractFromContent: (content: string, source: RuleSource) => Promise<any[]>;
  validate: (rules: any[]) => boolean;
}

const RULE_EXTRACTORS: Record<string, RuleExtractor> = {
  'secondary-objectives': {
    category: 'secondary-objectives',
    extractFromContent: extractSecondaryObjectives,
    validate: (rules) => rules.every(r => r.name && r.vpCalculation)
  },
  'primary-missions': {
    category: 'primary-missions',
    extractFromContent: extractPrimaryMissions,
    validate: (rules) => rules.every(r => r.name && r.scoringFormula)
  },
  'cp-rules': {
    category: 'cp-rules',
    extractFromContent: extractCPRules,
    validate: (rules) => rules.every(r => r.name && r.rule)
  },
  'phase-rules': {
    category: 'phase-rules',
    extractFromContent: extractPhaseRules,
    validate: (rules) => rules.every(r => r.name && r.phase)
  }
};

// ============================================
// Main Parsing Logic
// ============================================

async function parseSource(
  source: RuleSource,
  registry: RulesRegistry,
  categoriesToParse?: string[]
): Promise<void> {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`📄 Processing: ${source.name} (v${source.version})`);
  console.log(`${'='.repeat(60)}`);
  
  try {
    // Load source content
    const content = await loadSourceContent(source);
    
    // Determine which categories to extract
    const categories = categoriesToParse 
      ? source.categories.filter(c => categoriesToParse.includes(c))
      : source.categories;
    
    console.log(`📂 Categories to extract: ${categories.join(', ')}`);
    
    // Extract rules for each category
    for (const category of categories) {
      const categoryConfig = registry.categories[category];
      
      if (!categoryConfig) {
        console.warn(`⚠️ Unknown category: ${category}`);
        continue;
      }
      
      if (!categoryConfig.enabled) {
        console.log(`⏭️  Skipping disabled category: ${category}`);
        continue;
      }
      
      const extractor = RULE_EXTRACTORS[category];
      if (!extractor) {
        console.warn(`⚠️ No extractor for category: ${category}`);
        continue;
      }
      
      try {
        // Extract rules
        const rules = await extractor.extractFromContent(content, source);
        
        // Validate
        if (!extractor.validate(rules)) {
          console.error(`❌ Validation failed for ${category}`);
          continue;
        }
        
        // Save to file
        await saveRules(category, rules, source);
        
      } catch (error) {
        console.error(`❌ Error extracting ${category}:`, error);
      }
    }
    
    console.log(`\n✅ Completed parsing ${source.name}`);
    
  } catch (error) {
    console.error(`❌ Failed to process ${source.name}:`, error);
  }
}

async function saveRules(
  category: string,
  rules: any[],
  source: RuleSource
): Promise<void> {
  const outputPath = path.join(OUTPUT_DIR, `${category}.json`);
  
  // Load existing rules if any
  let existingData: any = { rules: [], sources: [] };
  if (await fs.pathExists(outputPath)) {
    existingData = await fs.readJson(outputPath);
  }
  
  // Remove rules from this source (we're updating)
  existingData.rules = existingData.rules.filter(
    (r: any) => r.sourceId !== source.id
  );
  
  // Add new rules with source metadata
  const rulesWithMetadata = rules.map(rule => ({
    ...rule,
    sourceId: source.id,
    sourceName: source.name,
    sourceVersion: source.version,
    extractedAt: new Date().toISOString()
  }));
  
  existingData.rules.push(...rulesWithMetadata);
  
  // Update sources list
  const sourceIndex = existingData.sources.findIndex((s: any) => s.id === source.id);
  if (sourceIndex >= 0) {
    existingData.sources[sourceIndex] = {
      id: source.id,
      name: source.name,
      version: source.version,
      lastExtracted: new Date().toISOString()
    };
  } else {
    existingData.sources.push({
      id: source.id,
      name: source.name,
      version: source.version,
      lastExtracted: new Date().toISOString()
    });
  }
  
  // Save
  await fs.ensureDir(OUTPUT_DIR);
  await fs.writeJson(outputPath, existingData, { spaces: 2 });
  
  console.log(`  💾 Saved ${rules.length} rules to ${path.basename(outputPath)}`);
}

// ============================================
// CLI Interface
// ============================================

async function main() {
  const args = process.argv.slice(2);
  
  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
Usage: tsx scripts/parseGameplayRules.ts [options]

Options:
  --sync                  Parse all sources in registry
  --source <id>           Parse specific source by ID
  --category <category>   Parse only specific category
  --help, -h              Show this help

Examples:
  tsx scripts/parseGameplayRules.ts --sync
  tsx scripts/parseGameplayRules.ts --source chapter-approved-2024
  tsx scripts/parseGameplayRules.ts --source chapter-approved-2024 --category secondary-objectives
    `);
    process.exit(0);
  }
  
  console.log(`\n🎮 Warhammer 40K Gameplay Rules Parser`);
  console.log(`${'='.repeat(60)}\n`);
  
  // Load registry
  const registry = await loadRegistry();
  console.log(`✅ Loaded rules registry`);
  console.log(`   Sources: ${registry.sources.length}`);
  console.log(`   Categories: ${Object.keys(registry.categories).length}\n`);
  
  // Determine what to parse
  const sourceId = args[args.indexOf('--source') + 1];
  const category = args[args.indexOf('--category') + 1];
  const syncAll = args.includes('--sync');
  
  if (syncAll) {
    // Parse all sources
    for (const source of registry.sources) {
      await parseSource(source, registry);
    }
  } else if (sourceId) {
    // Parse specific source
    const source = registry.sources.find(s => s.id === sourceId);
    if (!source) {
      console.error(`❌ Source not found: ${sourceId}`);
      process.exit(1);
    }
    
    const categoriesToParse = category ? [category] : undefined;
    await parseSource(source, registry, categoriesToParse);
  } else {
    console.error(`❌ Please specify --sync or --source <id>`);
    process.exit(1);
  }
  
  console.log(`\n✨ Parsing complete!`);
  console.log(`📁 Output directory: ${OUTPUT_DIR}\n`);
}

// Run if called directly
if (require.main === module) {
  main().catch(error => {
    console.error('💥 Fatal error:', error);
    process.exit(1);
  });
}

export { parseSource, loadRegistry, RULE_EXTRACTORS };


