/**
 * Generate Vocabulary from Wahapedia Data
 * 
 * Extracts all Warhammer 40K terms from imported faction data and generates:
 * 1. A comprehensive vocabulary list for AI context
 * 2. Phonetic variations for common misrecognitions
 * 3. Session-specific vocabulary hints
 * 
 * Usage:
 *   npx tsx scripts/generateVocabulary.ts
 *   npx tsx scripts/generateVocabulary.ts --faction tyranids
 *   npx tsx scripts/generateVocabulary.ts --output lib/generatedVocabulary.ts
 */

import * as fs from 'fs-extra';
import * as path from 'path';

const WAHAPEDIA_IMPORT_DIR = path.join(process.cwd(), 'data', 'wahapedia-import');
const OUTPUT_FILE = path.join(process.cwd(), 'lib', 'generatedVocabulary.ts');

// ============================================
// Types for faction data
// ============================================

interface Stratagem {
  name: string;
  cpCost: number;
  type: string;
  when: string;
  target: string;
  effect: string;
}

interface Enhancement {
  name: string;
  pointsCost: number;
  description: string;
}

interface Detachment {
  name: string;
  abilityName?: string;
  stratagems: Stratagem[];
  enhancements: Enhancement[];
}

interface ArmyRule {
  name: string;
  description: string;
}

interface Datasheet {
  name: string;
  role: string;
  keywords?: string[];
}

interface FactionData {
  faction: {
    name: string;
    keywords: string[];
  };
  armyRules?: ArmyRule[];
  detachments?: Detachment[];
  datasheets?: Datasheet[];
}

// ============================================
// Phonetic Pattern Generation
// ============================================

/**
 * Generate common phonetic variations for a term
 * Based on common speech-to-text errors
 */
function generatePhoneticVariations(term: string): string[] {
  const variations: Set<string> = new Set();
  const lower = term.toLowerCase();
  
  // Add space-separated version for compound words
  const spaceSeparated = lower.replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase();
  if (spaceSeparated !== lower) {
    variations.add(spaceSeparated);
  }
  
  // Common letter substitutions
  const substitutions: [RegExp, string][] = [
    [/ph/g, 'f'],
    [/ae/g, 'e'],
    [/oe/g, 'e'],
    [/th/g, 't'],
    [/ck/g, 'k'],
    [/x/g, 'ks'],
    [/qu/g, 'kw'],
    [/'/, ''],
    [/-/g, ' '],
  ];
  
  let variant = lower;
  for (const [pattern, replacement] of substitutions) {
    if (pattern.test(variant)) {
      const newVariant = variant.replace(pattern, replacement);
      if (newVariant !== variant) {
        variations.add(newVariant);
      }
    }
  }
  
  // Split compound words with common suffixes/prefixes
  const compoundPatterns = [
    /^(mega)(.+)$/,
    /^(super)(.+)$/,
    /^(over)(.+)$/,
    /^(under)(.+)$/,
    /^(hyper)(.+)$/,
    /(.+)(guard)$/,
    /(.+)(knight)$/,
    /(.+)(lord)$/,
    /(.+)(marine)$/,
    /(.+)(walker)$/,
    /(.+)(blade)$/,
    /(.+)(skull)$/,
    /(.+)(fist)$/,
  ];
  
  for (const pattern of compoundPatterns) {
    const match = lower.match(pattern);
    if (match) {
      variations.add(`${match[1]} ${match[2]}`);
    }
  }
  
  return Array.from(variations);
}

/**
 * Extract syllables for phonetic hints
 */
function getSyllableHint(term: string): string {
  // Simple syllable approximation
  const vowelGroups = term.toLowerCase().match(/[aeiouy]+/g);
  if (!vowelGroups) return term;
  return `${vowelGroups.length} syllables`;
}

// ============================================
// Vocabulary Extraction
// ============================================

interface VocabularyEntry {
  term: string;
  category: 'unit' | 'stratagem' | 'enhancement' | 'ability' | 'faction' | 'detachment' | 'keyword';
  faction?: string;
  phoneticHints?: string[];
}

async function extractVocabulary(): Promise<VocabularyEntry[]> {
  const vocabulary: VocabularyEntry[] = [];
  const seenTerms = new Set<string>();
  
  // Read all faction files
  const files = await fs.readdir(WAHAPEDIA_IMPORT_DIR);
  const jsonFiles = files.filter(f => f.endsWith('.json'));
  
  console.log(`📚 Processing ${jsonFiles.length} faction files...`);
  
  for (const file of jsonFiles) {
    const filePath = path.join(WAHAPEDIA_IMPORT_DIR, file);
    const data: FactionData = await fs.readJson(filePath);
    
    const factionName = data.faction?.name;
    if (!factionName) continue;
    
    console.log(`  → ${factionName}`);
    
    // Add faction name
    if (!seenTerms.has(factionName.toLowerCase())) {
      vocabulary.push({
        term: factionName,
        category: 'faction',
        phoneticHints: generatePhoneticVariations(factionName),
      });
      seenTerms.add(factionName.toLowerCase());
    }
    
    // Add faction keywords
    for (const keyword of data.faction.keywords || []) {
      if (!seenTerms.has(keyword.toLowerCase())) {
        vocabulary.push({
          term: keyword,
          category: 'keyword',
          faction: factionName,
          phoneticHints: generatePhoneticVariations(keyword),
        });
        seenTerms.add(keyword.toLowerCase());
      }
    }
    
    // Add army rules
    for (const rule of data.armyRules || []) {
      if (!seenTerms.has(rule.name.toLowerCase())) {
        vocabulary.push({
          term: rule.name,
          category: 'ability',
          faction: factionName,
          phoneticHints: generatePhoneticVariations(rule.name),
        });
        seenTerms.add(rule.name.toLowerCase());
      }
    }
    
    // Add detachments
    for (const detachment of data.detachments || []) {
      if (!seenTerms.has(detachment.name.toLowerCase())) {
        vocabulary.push({
          term: detachment.name,
          category: 'detachment',
          faction: factionName,
          phoneticHints: generatePhoneticVariations(detachment.name),
        });
        seenTerms.add(detachment.name.toLowerCase());
      }
      
      // Add detachment ability
      if (detachment.abilityName && !seenTerms.has(detachment.abilityName.toLowerCase())) {
        vocabulary.push({
          term: detachment.abilityName,
          category: 'ability',
          faction: factionName,
          phoneticHints: generatePhoneticVariations(detachment.abilityName),
        });
        seenTerms.add(detachment.abilityName.toLowerCase());
      }
      
      // Add stratagems
      for (const stratagem of detachment.stratagems || []) {
        if (!seenTerms.has(stratagem.name.toLowerCase())) {
          vocabulary.push({
            term: stratagem.name,
            category: 'stratagem',
            faction: factionName,
            phoneticHints: generatePhoneticVariations(stratagem.name),
          });
          seenTerms.add(stratagem.name.toLowerCase());
        }
      }
      
      // Add enhancements
      for (const enhancement of detachment.enhancements || []) {
        if (!seenTerms.has(enhancement.name.toLowerCase())) {
          vocabulary.push({
            term: enhancement.name,
            category: 'enhancement',
            faction: factionName,
            phoneticHints: generatePhoneticVariations(enhancement.name),
          });
          seenTerms.add(enhancement.name.toLowerCase());
        }
      }
    }
    
    // Add datasheets (unit names)
    for (const datasheet of data.datasheets || []) {
      if (!seenTerms.has(datasheet.name.toLowerCase())) {
        vocabulary.push({
          term: datasheet.name,
          category: 'unit',
          faction: factionName,
          phoneticHints: generatePhoneticVariations(datasheet.name),
        });
        seenTerms.add(datasheet.name.toLowerCase());
      }
    }
  }
  
  return vocabulary;
}

// ============================================
// Output Generation
// ============================================

function generateTypeScriptOutput(vocabulary: VocabularyEntry[]): string {
  // Group by category
  const byCategory: Record<string, VocabularyEntry[]> = {};
  for (const entry of vocabulary) {
    if (!byCategory[entry.category]) {
      byCategory[entry.category] = [];
    }
    byCategory[entry.category].push(entry);
  }
  
  // Generate the TypeScript file
  let output = `/**
 * Generated Warhammer 40K Vocabulary
 * Auto-generated from Wahapedia import data
 * 
 * Generated: ${new Date().toISOString()}
 * Total terms: ${vocabulary.length}
 */

`;

  // All terms list
  output += `/**
 * All Warhammer 40K vocabulary terms
 */
export const ALL_VOCABULARY: string[] = [
${vocabulary.map(v => `  "${v.term.replace(/"/g, '\\"')}",`).join('\n')}
];

`;

  // By category exports
  for (const [category, entries] of Object.entries(byCategory)) {
    const constName = category.toUpperCase() + '_VOCABULARY';
    output += `/**
 * ${category.charAt(0).toUpperCase() + category.slice(1)} vocabulary (${entries.length} terms)
 */
export const ${constName}: string[] = [
${entries.map(v => `  "${v.term.replace(/"/g, '\\"')}",`).join('\n')}
];

`;
  }

  // Phonetic hints map
  const phoneticMap: Record<string, string> = {};
  for (const entry of vocabulary) {
    for (const hint of entry.phoneticHints || []) {
      if (hint !== entry.term.toLowerCase()) {
        phoneticMap[hint] = entry.term;
      }
    }
  }
  
  output += `/**
 * Phonetic variations to correct term mapping
 * Generated from vocabulary analysis
 */
export const GENERATED_PHONETIC_CORRECTIONS: Record<string, string> = {
${Object.entries(phoneticMap)
  .filter(([k, v]) => k !== v.toLowerCase())
  .map(([misheard, correct]) => `  "${misheard.replace(/"/g, '\\"')}": "${correct.replace(/"/g, '\\"')}",`)
  .join('\n')}
};

`;

  // Faction-specific vocabulary helper
  output += `/**
 * Get vocabulary for a specific faction
 */
export function getFactionVocabulary(factionName: string): string[] {
  const lowerFaction = factionName.toLowerCase();
  return ALL_VOCABULARY.filter((term, idx) => {
    // Check if this term belongs to the faction
    // This is a simplified version - in production you might want more precise mapping
    return true; // Return all for now, can be refined
  });
}

/**
 * Build a Whisper API prompt with vocabulary context
 */
export function buildWhisperPrompt(factionNames?: string[]): string {
  const coreTerms = [
    'Command Points', 'Victory Points', 'CP', 'VP', 'OC',
    'Stratagem', 'Detachment', 'Battleshock', 'Synapse',
    'Movement Phase', 'Shooting Phase', 'Charge Phase', 'Fight Phase',
    'Deep Strike', 'Overwatch', 'Mortal Wounds', 'Feel No Pain',
    'Lethal Hits', 'Sustained Hits', 'Devastating Wounds',
  ];
  
  const factionTerms = factionNames 
    ? UNIT_VOCABULARY.slice(0, 50) // Top 50 unit names
    : [];
  
  const allTerms = [...coreTerms, ...factionTerms];
  
  return \`Warhammer 40,000 tabletop game terms: \${allTerms.join(', ')}\`;
}

/**
 * Check if a term is likely a Warhammer vocabulary word
 */
export function isWarhammerTerm(term: string): boolean {
  const lower = term.toLowerCase();
  return ALL_VOCABULARY.some(v => v.toLowerCase() === lower);
}
`;

  return output;
}

// ============================================
// JSON Output for Runtime Use
// ============================================

interface VocabularyJSON {
  generated: string;
  totalTerms: number;
  byCategory: Record<string, string[]>;
  phoneticCorrections: Record<string, string>;
}

function generateJSONOutput(vocabulary: VocabularyEntry[]): VocabularyJSON {
  const byCategory: Record<string, string[]> = {};
  const phoneticCorrections: Record<string, string> = {};
  
  for (const entry of vocabulary) {
    if (!byCategory[entry.category]) {
      byCategory[entry.category] = [];
    }
    byCategory[entry.category].push(entry.term);
    
    for (const hint of entry.phoneticHints || []) {
      if (hint !== entry.term.toLowerCase()) {
        phoneticCorrections[hint] = entry.term;
      }
    }
  }
  
  return {
    generated: new Date().toISOString(),
    totalTerms: vocabulary.length,
    byCategory,
    phoneticCorrections,
  };
}

// ============================================
// Main Execution
// ============================================

async function main() {
  console.log('🔤 Generating Warhammer 40K Vocabulary from Wahapedia Data\n');
  
  // Parse arguments
  const args = process.argv.slice(2);
  const factionArg = args.find(a => a.startsWith('--faction='));
  const outputArg = args.find(a => a.startsWith('--output='));
  const jsonOutput = args.includes('--json');
  
  const outputPath = outputArg 
    ? path.resolve(outputArg.split('=')[1])
    : OUTPUT_FILE;
  
  try {
    // Check if import directory exists
    if (!await fs.pathExists(WAHAPEDIA_IMPORT_DIR)) {
      console.error(`❌ Wahapedia import directory not found: ${WAHAPEDIA_IMPORT_DIR}`);
      console.log('   Run the Wahapedia scraper first to generate faction data.');
      process.exit(1);
    }
    
    // Extract vocabulary
    const vocabulary = await extractVocabulary();
    
    console.log(`\n📊 Vocabulary Statistics:`);
    console.log(`   Total terms: ${vocabulary.length}`);
    
    // Count by category
    const categoryCounts: Record<string, number> = {};
    for (const entry of vocabulary) {
      categoryCounts[entry.category] = (categoryCounts[entry.category] || 0) + 1;
    }
    for (const [category, count] of Object.entries(categoryCounts)) {
      console.log(`   ${category}: ${count}`);
    }
    
    // Count phonetic variations
    const totalPhonetic = vocabulary.reduce((sum, v) => sum + (v.phoneticHints?.length || 0), 0);
    console.log(`   Phonetic variations: ${totalPhonetic}`);
    
    // Generate output
    if (jsonOutput) {
      const jsonPath = outputPath.replace(/\.ts$/, '.json');
      const jsonData = generateJSONOutput(vocabulary);
      await fs.writeJson(jsonPath, jsonData, { spaces: 2 });
      console.log(`\n✅ Generated JSON vocabulary: ${jsonPath}`);
    } else {
      const tsOutput = generateTypeScriptOutput(vocabulary);
      await fs.writeFile(outputPath, tsOutput, 'utf-8');
      console.log(`\n✅ Generated TypeScript vocabulary: ${outputPath}`);
    }
    
  } catch (error) {
    console.error('❌ Error generating vocabulary:', error);
    process.exit(1);
  }
}

main();

