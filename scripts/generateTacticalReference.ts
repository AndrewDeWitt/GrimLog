/**
 * Generate Tactical Advisor Rules Reference
 * 
 * Parses Warhammer 40K 10th Edition rules source files and generates
 * a structured reference optimized for AI tactical advice.
 * 
 * Usage: npx tsx scripts/generateTacticalReference.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';

// Load environment variables from .env file
dotenv.config();

// Initialize Gemini
const gemini = new GoogleGenAI({
  apiKey: process.env.GOOGLE_API_KEY,
});

const MODEL = 'gemini-3-flash-preview';

// Source files to process
const RULES_SOURCE_DIR = path.join(process.cwd(), 'data', 'rules-source');
const PARSED_RULES_DIR = path.join(process.cwd(), 'data', 'parsed-rules');
const OUTPUT_FILE = path.join(PARSED_RULES_DIR, 'tactical-advisor-reference.json');

interface TacticalReference {
  version: string;
  generatedAt: string;
  gameOverview: {
    edition: string;
    turnStructure: string;
    winConditions: string;
    battleRounds: number;
    maxVP: number;
  };
  phases: Record<string, PhaseReference>;
  secondaryObjectives: SecondaryReference;
  coreStratagems: StratagemReference[];
  keyRules: KeyRule[];
  tacticalWisdom: TacticalWisdom;
}

interface PhaseReference {
  order: number;
  name: string;
  sequence: string[];
  keyRules: string[];
  legalActions: string[];
  restrictions: string[];
  tacticalPriorities: string[];
  commonStratagems: string[];
  scoringOpportunities: string[];
}

interface SecondaryReference {
  fixed: SecondaryObjective[];
  tactical: SecondaryObjective[];
  generalRules: string[];
}

interface SecondaryObjective {
  name: string;
  category: string;
  scoringMethod: string;
  maxVP: number;
  maxVPPerTurn?: number;
  requiredKeywords?: string[];
  tips: string[];
}

interface StratagemReference {
  name: string;
  cpCost: number;
  when: string;
  phase: string;
  effect: string;
  restrictions?: string[];
  tacticalUse: string;
}

interface KeyRule {
  name: string;
  category: string;
  rule: string;
  tacticalImplication: string;
}

interface TacticalWisdom {
  generalPrinciples: string[];
  commonMistakes: string[];
  advancedTips: string[];
  missionFocus: string[];
}

async function readSourceFiles(): Promise<string> {
  const files = [
    'eng_22-10_warhammer40000_core_rules_updates.md',
    'eng_17-09_warhammer40000_core_rules_chapter_approved_tournament_companion.md',
  ];
  
  let combinedContent = '';
  
  for (const file of files) {
    const filePath = path.join(RULES_SOURCE_DIR, file);
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf-8');
      combinedContent += `\n\n=== SOURCE: ${file} ===\n\n${content}`;
      console.log(`📖 Read ${file} (${content.length} chars)`);
    } else {
      console.log(`⚠️ File not found: ${file}`);
    }
  }
  
  // Also read existing parsed rules for additional context
  const parsedFiles = ['phase-rules.json', 'cp-rules.json', 'secondary-objectives.json'];
  for (const file of parsedFiles) {
    const filePath = path.join(PARSED_RULES_DIR, file);
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf-8');
      combinedContent += `\n\n=== PARSED: ${file} ===\n\n${content}`;
      console.log(`📖 Read parsed ${file}`);
    }
  }
  
  return combinedContent;
}

async function generatePhaseReference(sourceContent: string): Promise<Record<string, PhaseReference>> {
  console.log('\n🔄 Generating phase reference...');
  
  const prompt = `You are an expert Warhammer 40,000 10th Edition rules analyst. Based on the source rules provided, generate a comprehensive reference for each game phase.

For EACH phase (Command, Movement, Shooting, Charge, Fight), provide:
1. The sequence of steps within that phase
2. Key rules that apply
3. Legal actions players can take
4. Restrictions on what cannot be done
5. Tactical priorities for that phase
6. Common stratagems used in that phase
7. Scoring opportunities (primaries/secondaries)

SOURCE RULES:
${sourceContent.substring(0, 80000)}

Respond with a JSON object where keys are phase names and values match this structure:
{
  "Command": {
    "order": 1,
    "name": "Command Phase",
    "sequence": ["Step 1: Command step (gain 1CP, use detachment abilities)", "Step 2: Battle-shock step", "Step 3: Score primary mission (end of phase)"],
    "keyRules": ["Gain 1CP automatically", "Test Battle-shock for units below half strength", "Max +1CP from other sources per round"],
    "legalActions": ["Use detachment abilities", "Draw tactical secondaries", "Use Command phase stratagems"],
    "restrictions": ["Cannot gain more than +1 extra CP per round from abilities", "Must test Battle-shock before scoring"],
    "tacticalPriorities": ["Draw/discard tactical secondaries strategically", "Use key detachment abilities", "Plan movement for the turn"],
    "commonStratagems": ["Insane Bravery (auto-pass Battle-shock)"],
    "scoringOpportunities": ["Primary mission scores at end of Command phase", "Some secondaries check at start of Command phase"]
  },
  // ... other phases
}`;

  const response = await gemini.models.generateContent({
    model: MODEL,
    contents: prompt,
    config: {
      temperature: 0.3,
      maxOutputTokens: 8000,
      responseMimeType: 'application/json',
    }
  });

  const text = response.text || '{}';
  try {
    return JSON.parse(text.replace(/```json\n?/g, '').replace(/```\n?/g, ''));
  } catch (e) {
    console.error('Failed to parse phases response:', e);
    return {};
  }
}

async function generateSecondaryReference(sourceContent: string): Promise<SecondaryReference> {
  console.log('\n🔄 Generating secondary objectives reference...');
  
  const prompt = `You are an expert Warhammer 40,000 10th Edition rules analyst. Based on the source rules, generate a comprehensive reference for secondary objectives.

Include:
1. All Fixed secondary objectives (always available)
2. Common Tactical secondary objectives
3. General rules for secondary scoring
4. Tips for scoring and denying each secondary

For each secondary, include:
- Name
- Category (Fixed or Tactical)
- How it scores (specific conditions)
- Max VP total and per turn if applicable
- Required keywords if any (CHARACTER, MONSTER, VEHICLE, etc.)
- Tactical tips for scoring AND denying

SOURCE RULES:
${sourceContent.substring(0, 60000)}

Respond with JSON matching this structure:
{
  "fixed": [
    {
      "name": "Assassination",
      "category": "Fixed",
      "scoringMethod": "4VP each time an enemy CHARACTER model is destroyed. If enemy Warlord destroyed, +1VP.",
      "maxVP": 15,
      "requiredKeywords": ["CHARACTER"],
      "tips": ["Target isolated characters", "Characters attached to units are harder to kill", "Opponent will protect Warlord"]
    }
  ],
  "tactical": [...],
  "generalRules": [
    "Max 2 secondary objectives active at a time",
    "Tactical missions drawn at start of Command phase",
    "Can discard tactical secondary for 1CP (once per turn)",
    "Fixed missions cannot be discarded"
  ]
}`;

  const response = await gemini.models.generateContent({
    model: MODEL,
    contents: prompt,
    config: {
      temperature: 0.3,
      maxOutputTokens: 8000,
      responseMimeType: 'application/json',
    }
  });

  const text = response.text || '{}';
  try {
    return JSON.parse(text.replace(/```json\n?/g, '').replace(/```\n?/g, ''));
  } catch (e) {
    console.error('Failed to parse secondaries response:', e);
    return { fixed: [], tactical: [], generalRules: [] };
  }
}

async function generateCoreStratagemsReference(sourceContent: string): Promise<StratagemReference[]> {
  console.log('\n🔄 Generating core stratagems reference...');
  
  const prompt = `You are an expert Warhammer 40,000 10th Edition rules analyst. Generate a reference for all CORE stratagems (universal stratagems available to all armies).

For each stratagem, provide:
- Name and CP cost
- When it can be used (phase and timing)
- What it does
- Any restrictions
- Tactical use cases

Include these core stratagems:
- Command Re-roll (1CP)
- Insane Bravery (1CP)
- Fire Overwatch (1CP)
- Heroic Intervention (1CP)
- Rapid Ingress (1CP)
- Tank Shock (1CP)
- Grenade (1CP)
- Counter-Offensive (2CP)
- Go to Ground (1CP)
- Smokescreen (1CP)

SOURCE RULES:
${sourceContent.substring(0, 40000)}

Respond with a JSON array:
[
  {
    "name": "Command Re-roll",
    "cpCost": 1,
    "when": "Any phase, after making a roll",
    "phase": "Any",
    "effect": "Re-roll one dice roll (hit, wound, save, damage, charge, advance, etc.)",
    "restrictions": ["Can only re-roll one dice from fast dice rolling"],
    "tacticalUse": "Save for crucial rolls - charge rolls, key saves, important damage rolls"
  }
]`;

  const response = await gemini.models.generateContent({
    model: MODEL,
    contents: prompt,
    config: {
      temperature: 0.3,
      maxOutputTokens: 6000,
      responseMimeType: 'application/json',
    }
  });

  const text = response.text || '[]';
  try {
    return JSON.parse(text.replace(/```json\n?/g, '').replace(/```\n?/g, ''));
  } catch (e) {
    console.error('Failed to parse stratagems response:', e);
    return [];
  }
}

async function generateKeyRules(sourceContent: string): Promise<KeyRule[]> {
  console.log('\n🔄 Generating key rules reference...');
  
  const prompt = `You are an expert Warhammer 40,000 10th Edition rules analyst. Extract the most important rules that affect tactical decision-making.

Focus on rules that a tactical advisor needs to know:
- CP generation and limits
- Battle-shock effects and timing
- Deep Strike restrictions
- Objective control rules
- Charging and fighting restrictions
- Transport rules
- Line of sight and targeting
- Weapon abilities (Devastating Wounds, Lethal Hits, etc.)

For each rule, explain its tactical implication - how it affects gameplay decisions.

SOURCE RULES:
${sourceContent.substring(0, 60000)}

Respond with a JSON array:
[
  {
    "name": "CP Per-Round Limit",
    "category": "Resources",
    "rule": "Outside the automatic 1CP in Command phase, players can only gain +1CP per battle round from all other sources combined.",
    "tacticalImplication": "Don't discard multiple tactical secondaries expecting CP - you only get 1 extra max. Plan CP usage across the round."
  }
]`;

  const response = await gemini.models.generateContent({
    model: MODEL,
    contents: prompt,
    config: {
      temperature: 0.3,
      maxOutputTokens: 8000,
      responseMimeType: 'application/json',
    }
  });

  const text = response.text || '[]';
  try {
    return JSON.parse(text.replace(/```json\n?/g, '').replace(/```\n?/g, ''));
  } catch (e) {
    console.error('Failed to parse key rules response:', e);
    return [];
  }
}

async function generateTacticalWisdom(sourceContent: string): Promise<TacticalWisdom> {
  console.log('\n🔄 Generating tactical wisdom...');
  
  const prompt = `You are an expert Warhammer 40,000 10th Edition competitive player and coach. Based on the rules and your expertise, generate tactical wisdom for players.

Include:
1. General principles of good 40k play
2. Common mistakes players make
3. Advanced tips for competitive play
4. Mission-focused advice (playing to win, not just kill)

SOURCE RULES:
${sourceContent.substring(0, 30000)}

Respond with JSON:
{
  "generalPrinciples": [
    "Play the mission - VP wins games, not kills",
    "Trade efficiently - don't commit more than necessary to achieve objectives",
    "Control the board - positioning matters more than raw damage",
    "Protect your scoring units - bodyguard and screen valuable units",
    "Deny opponent's secondaries - know what they're trying to score"
  ],
  "commonMistakes": [
    "Overcommitting to kill a single unit",
    "Forgetting to score primaries in Command phase",
    "Not screening against Deep Strike",
    "Using stratagems without checking phase restrictions",
    "Ignoring opponent's secondary objectives"
  ],
  "advancedTips": [
    "Position for NEXT turn, not just this turn",
    "Count VP math - know when you're ahead/behind",
    "Time management - don't run out of time on critical turns",
    "Bait overcommitment - sacrifice cheap units to draw out enemy threats"
  ],
  "missionFocus": [
    "Primaries score more than secondaries (50 vs 40 max)",
    "Holding objectives at end of Command phase is key",
    "Some missions reward holding MORE objectives, others reward holding SPECIFIC objectives",
    "Round 5 scoring is often decisive - plan your endgame"
  ]
}`;

  const response = await gemini.models.generateContent({
    model: MODEL,
    contents: prompt,
    config: {
      temperature: 0.5,
      maxOutputTokens: 4000,
      responseMimeType: 'application/json',
    }
  });

  const text = response.text || '{}';
  try {
    return JSON.parse(text.replace(/```json\n?/g, '').replace(/```\n?/g, ''));
  } catch (e) {
    console.error('Failed to parse tactical wisdom response:', e);
    return {
      generalPrinciples: [],
      commonMistakes: [],
      advancedTips: [],
      missionFocus: []
    };
  }
}

async function main() {
  console.log('🎮 Generating Tactical Advisor Rules Reference');
  console.log('================================================\n');
  
  // Check for API key
  if (!process.env.GOOGLE_API_KEY) {
    console.error('❌ GOOGLE_API_KEY environment variable not set');
    process.exit(1);
  }
  
  // Read source files
  const sourceContent = await readSourceFiles();
  console.log(`\n📚 Total source content: ${sourceContent.length} characters\n`);
  
  // Generate each section
  const phases = await generatePhaseReference(sourceContent);
  const secondaries = await generateSecondaryReference(sourceContent);
  const coreStratagems = await generateCoreStratagemsReference(sourceContent);
  const keyRules = await generateKeyRules(sourceContent);
  const tacticalWisdom = await generateTacticalWisdom(sourceContent);
  
  // Assemble the reference
  const reference: TacticalReference = {
    version: '1.0',
    generatedAt: new Date().toISOString(),
    gameOverview: {
      edition: '10th Edition',
      turnStructure: 'Each battle round: Player 1 turn (Command→Movement→Shooting→Charge→Fight), then Player 2 turn (same phases)',
      winConditions: 'Most VP at end of 5 battle rounds wins. Max 100VP (50 primary + 40 secondary + 10 painted army)',
      battleRounds: 5,
      maxVP: 100
    },
    phases,
    secondaryObjectives: secondaries,
    coreStratagems,
    keyRules,
    tacticalWisdom
  };
  
  // Write output
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(reference, null, 2));
  console.log(`\n✅ Generated tactical reference: ${OUTPUT_FILE}`);
  
  // Summary
  console.log('\n📊 Summary:');
  console.log(`   Phases: ${Object.keys(phases).length}`);
  console.log(`   Fixed Secondaries: ${secondaries.fixed?.length || 0}`);
  console.log(`   Tactical Secondaries: ${secondaries.tactical?.length || 0}`);
  console.log(`   Core Stratagems: ${coreStratagems.length}`);
  console.log(`   Key Rules: ${keyRules.length}`);
  console.log(`   Tactical Principles: ${tacticalWisdom.generalPrinciples?.length || 0}`);
}

main().catch(console.error);

