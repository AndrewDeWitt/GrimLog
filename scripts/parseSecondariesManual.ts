/**
 * Manual Secondary Missions Parser
 * 
 * Parses secondary missions from Chapter Approved 2025-26 (v1.2)
 * into the new GameRule-based schema format.
 * 
 * Source: https://wahapedia.ru/wh40k10ed/the-rules/chapter-approved-2025-26/#Secondary-Mission-deck
 * 
 * Usage:
 *   npx tsx scripts/parseSecondariesManual.ts
 */

import * as fs from 'fs-extra';
import * as path from 'path';

const OUTPUT_PATH = path.join(process.cwd(), 'data', 'parsed-rules', 'secondary-objectives.json');

// Source metadata
const SOURCE_INFO = {
  id: 'chapter-approved-2025-26',
  name: 'Chapter Approved 2025-26',
  version: '1.2',
  lastExtracted: new Date().toISOString()
};

// Raw secondary missions data from Chapter Approved 2025-26
const SECONDARY_MISSIONS = [
  {
    name: 'Behind Enemy Lines',
    description: 'Your orders are clear: break through the enemy and cut off their escape routes.',
    category: 'Tactical',
    type: 'Position Control',
    scoringType: 'per_turn',
    vpCalculation: {
      type: 'threshold',
      thresholds: [
        { condition: 'One unit (excluding AIRCRAFT and Battle-shocked) wholly within opponent deployment zone', vp: 3 },
        { condition: 'Two or more units (excluding AIRCRAFT and Battle-shocked) wholly within opponent deployment zone', vp: 4 }
      ],
      vpPerUnit: null,
      fixedVP: null
    },
    maxVPPerTurn: 4,
    maxVPTotal: 20,
    scoringTrigger: 'End of your turn',
    requiredKeywords: [],
    drawCondition: 'If it is the first battle round, you can draw a new Secondary Mission card',
    hasDrawCondition: true
  },
  {
    name: 'Storm Hostile Objective',
    description: 'You must dominate the field of battle. Storm every site of tactical import and leave the foe with no place to hide.',
    category: 'Tactical',
    type: 'Objective Control',
    scoringType: 'per_turn',
    vpCalculation: {
      type: 'threshold',
      thresholds: [
        { condition: 'Control one or more objectives controlled by opponent at start of turn', vp: 4 },
        { condition: 'Round 2+: Opponent controlled no objectives at start, you control one+ you did not control', vp: 4 }
      ],
      vpPerUnit: null,
      fixedVP: null
    },
    maxVPPerTurn: 4,
    maxVPTotal: 20,
    scoringTrigger: 'End of your turn',
    requiredKeywords: [],
    drawCondition: 'If it is the first battle round, you can draw a new Secondary Mission card',
    hasDrawCondition: true
  },
  {
    name: 'Engage on All Fronts',
    description: 'This area is of extreme importance. You are to lead an immediate all-out assault to capture it and deny it to our enemy for good.',
    category: 'Tactical',
    type: 'Area Control',
    scoringType: 'per_turn',
    vpCalculation: {
      type: 'threshold',
      thresholds: [
        { condition: 'Presence in two table quarters', vp: 1 },
        { condition: 'Presence in three table quarters', vp: 2 },
        { condition: 'Presence in four table quarters', vp: 4 }
      ],
      vpPerUnit: null,
      fixedVP: null
    },
    maxVPPerTurn: 4,
    maxVPTotal: 20,
    scoringTrigger: 'End of your turn',
    requiredKeywords: [],
    drawCondition: null,
    hasDrawCondition: false
  },
  {
    name: 'Establish Locus',
    description: 'You must guide allied forces onto the battlefield by any means necessary; this objective must be completed swiftly to pave the road to victory.',
    category: 'Tactical',
    type: 'Action',
    scoringType: 'per_turn',
    vpCalculation: {
      type: 'threshold',
      thresholds: [
        { condition: 'Unit established locus within 6" of battlefield center', vp: 2 },
        { condition: 'Unit established locus within opponent deployment zone', vp: 4 }
      ],
      vpPerUnit: null,
      fixedVP: null
    },
    maxVPPerTurn: 4,
    maxVPTotal: 20,
    scoringTrigger: 'End of your turn',
    requiredKeywords: [],
    drawCondition: null,
    hasDrawCondition: false
  },
  {
    name: 'Cleanse',
    description: 'Your forces have identified a series of tainted objectives in this area; these locations must be purified.',
    category: 'Both',
    type: 'Action',
    scoringType: 'per_turn',
    vpCalculation: {
      type: 'threshold',
      thresholds: [
        { condition: 'One objective cleansed (Fixed)', vp: 2 },
        { condition: 'One objective cleansed (Tactical)', vp: 4 },
        { condition: 'Two or more objectives cleansed (Fixed)', vp: 4 },
        { condition: 'Two or more objectives cleansed (Tactical)', vp: 5 }
      ],
      vpPerUnit: null,
      fixedVP: null
    },
    maxVPPerTurn: 5,
    maxVPTotal: 20,
    scoringTrigger: 'End of your turn',
    requiredKeywords: [],
    drawCondition: null,
    hasDrawCondition: false
  },
  {
    name: 'Assassination',
    description: 'The enemy looks to their champions for courage. You must identify and eliminate such targets with extreme prejudice.',
    category: 'Both',
    type: 'Unit Destruction',
    scoringType: 'automatic',
    vpCalculation: {
      type: 'threshold',
      thresholds: [
        { condition: 'CHARACTER with 4+ wounds destroyed (Fixed)', vp: 4 },
        { condition: 'CHARACTER with <4 wounds destroyed (Fixed)', vp: 3 },
        { condition: 'One or more CHARACTERs destroyed this turn (Tactical)', vp: 5 },
        { condition: 'All enemy CHARACTERs destroyed (Tactical)', vp: 5 }
      ],
      vpPerUnit: null,
      fixedVP: null
    },
    maxVPPerTurn: 5,
    maxVPTotal: 20,
    scoringTrigger: 'While card is active (Fixed) / End of either player\'s turn (Tactical)',
    requiredKeywords: ['CHARACTER'],
    drawCondition: null,
    hasDrawCondition: false
  },
  {
    name: 'No Prisoners',
    description: 'Show no mercy. Exterminate your enemies.',
    category: 'Both',
    type: 'Unit Destruction',
    scoringType: 'automatic',
    vpCalculation: {
      type: 'per_unit',
      thresholds: [],
      vpPerUnit: 2,
      fixedVP: null
    },
    maxVPPerTurn: 5,
    maxVPTotal: 20,
    scoringTrigger: 'While card is active',
    requiredKeywords: [],
    drawCondition: null,
    hasDrawCondition: false
  },
  {
    name: 'Cull the Horde',
    description: 'The enemy come forth in teeming masses. Their ranks must be thinned if the day is to be won.',
    category: 'Both',
    type: 'Unit Destruction',
    scoringType: 'automatic',
    vpCalculation: {
      type: 'threshold',
      thresholds: [
        { condition: 'INFANTRY unit with 13+ Starting Strength destroyed (Fixed)', vp: 5 },
        { condition: 'One or more INFANTRY units with 13+ Starting Strength destroyed this turn (Tactical)', vp: 5 }
      ],
      vpPerUnit: null,
      fixedVP: null
    },
    maxVPPerTurn: 5,
    maxVPTotal: 20,
    scoringTrigger: 'While card is active (Fixed) / End of either player\'s turn (Tactical)',
    requiredKeywords: ['INFANTRY'],
    drawCondition: 'If no enemy units satisfy condition, can discard and redraw',
    hasDrawCondition: true
  },
  {
    name: 'Bring It Down',
    description: 'The opposing army contains numerous heavily armoured units. You must prioritise their destruction.',
    category: 'Both',
    type: 'Unit Destruction',
    scoringType: 'automatic',
    vpCalculation: {
      type: 'threshold',
      thresholds: [
        { condition: 'MONSTER or VEHICLE destroyed (Fixed)', vp: 2 },
        { condition: '+ 15+ total wounds at Starting Strength (Fixed, cumulative)', vp: 2 },
        { condition: '+ 20+ total wounds at Starting Strength (Fixed, cumulative)', vp: 2 },
        { condition: 'One or more MONSTER or VEHICLE destroyed this turn (Tactical)', vp: 4 }
      ],
      vpPerUnit: null,
      fixedVP: null
    },
    maxVPPerTurn: null,
    maxVPTotal: 20,
    scoringTrigger: 'While card is active (Fixed) / End of either player\'s turn (Tactical)',
    requiredKeywords: ['MONSTER', 'VEHICLE'],
    drawCondition: 'If no enemy MONSTER or VEHICLE units, can discard and redraw',
    hasDrawCondition: true
  },
  {
    name: 'Defend Stronghold',
    description: 'You are charged with the defence of a critical objective. It must not be permitted to fall into enemy hands.',
    category: 'Tactical',
    type: 'Objective Control',
    scoringType: 'per_turn',
    vpCalculation: {
      type: 'threshold',
      thresholds: [
        { condition: 'Control one or more objectives in your deployment zone', vp: 3 }
      ],
      vpPerUnit: null,
      fixedVP: null
    },
    maxVPPerTurn: 3,
    maxVPTotal: 20,
    scoringTrigger: 'End of opponent\'s turn or end of battle (round 2+)',
    requiredKeywords: [],
    drawCondition: 'If first battle round, draw new card',
    hasDrawCondition: true
  },
  {
    name: 'Marked for Death',
    description: 'You have been ordered to eliminate specific enemy assets to ensure victory, no matter how insignificant they may seem.',
    category: 'Tactical',
    type: 'Unit Destruction',
    scoringType: 'per_turn',
    vpCalculation: {
      type: 'threshold',
      thresholds: [
        { condition: 'One or more Alpha Target units destroyed or removed', vp: 5 },
        { condition: 'No Alpha Targets destroyed, but Gamma Target destroyed or removed', vp: 2 }
      ],
      vpPerUnit: null,
      fixedVP: null
    },
    maxVPPerTurn: 5,
    maxVPTotal: 20,
    scoringTrigger: 'End of either player\'s turn',
    requiredKeywords: [],
    drawCondition: 'If no enemy units on battlefield, discard and redraw. Opponent selects 3 Alpha Targets, you select 1 Gamma Target.',
    hasDrawCondition: true
  },
  {
    name: 'Secure No Man\'s Land',
    description: 'You must advance swiftly into no man\'s land and seize it before the enemy can, lest they take control of the entire battlefield.',
    category: 'Tactical',
    type: 'Objective Control',
    scoringType: 'per_turn',
    vpCalculation: {
      type: 'threshold',
      thresholds: [
        { condition: 'Control one objective in No Man\'s Land', vp: 2 },
        { condition: 'Control two or more objectives in No Man\'s Land', vp: 5 }
      ],
      vpPerUnit: null,
      fixedVP: null
    },
    maxVPPerTurn: 5,
    maxVPTotal: 20,
    scoringTrigger: 'End of your turn',
    requiredKeywords: [],
    drawCondition: null,
    hasDrawCondition: false
  },
  {
    name: 'Sabotage',
    description: 'This region is replete with strategic assets or supply caches vital to your foe. See to it that they are reduced to just so much flaming wreckage.',
    category: 'Tactical',
    type: 'Action',
    scoringType: 'per_turn',
    vpCalculation: {
      type: 'threshold',
      thresholds: [
        { condition: 'Unit committed sabotage outside opponent deployment', vp: 3 },
        { condition: 'Unit committed sabotage in opponent deployment', vp: 6 }
      ],
      vpPerUnit: null,
      fixedVP: null
    },
    maxVPPerTurn: 6,
    maxVPTotal: 20,
    scoringTrigger: 'End of opponent\'s turn or end of battle',
    requiredKeywords: [],
    drawCondition: null,
    hasDrawCondition: false
  },
  {
    name: 'Area Denial',
    description: 'It is critical that this area is dominated. No enemy vanguard or guerrilla units can be allowed to disrupt your plans.',
    category: 'Tactical',
    type: 'Area Control',
    scoringType: 'per_turn',
    vpCalculation: {
      type: 'threshold',
      thresholds: [
        { condition: 'Your units within 3" of center, no enemy within 3" of center', vp: 2 },
        { condition: 'Your units within 3" of center, no enemy within 6" of center', vp: 5 }
      ],
      vpPerUnit: null,
      fixedVP: null
    },
    maxVPPerTurn: 5,
    maxVPTotal: 20,
    scoringTrigger: 'End of your turn',
    requiredKeywords: [],
    drawCondition: null,
    hasDrawCondition: false
  },
  {
    name: 'Recover Assets',
    description: 'You must locate and reclaim scattered strategic assets.',
    category: 'Tactical',
    type: 'Action',
    scoringType: 'per_turn',
    vpCalculation: {
      type: 'threshold',
      thresholds: [
        { condition: 'Two units recovered assets', vp: 3 },
        { condition: 'Three or more units recovered assets', vp: 5 }
      ],
      vpPerUnit: null,
      fixedVP: null
    },
    maxVPPerTurn: 5,
    maxVPTotal: 20,
    scoringTrigger: 'End of your turn or end of battle',
    requiredKeywords: [],
    drawCondition: 'If Incursion mission or fewer than 3 units, can discard and redraw',
    hasDrawCondition: true
  },
  {
    name: 'A Tempting Target',
    description: 'An opportunity to seize a valuable asset has been identified, but the enemy are likely to use it as bait in a trap. Move to secure the site, but be wary of enemy ambushes.',
    category: 'Tactical',
    type: 'Objective Control',
    scoringType: 'per_turn',
    vpCalculation: {
      type: 'threshold',
      thresholds: [
        { condition: 'Control Tempting Target objective marker', vp: 5 }
      ],
      vpPerUnit: null,
      fixedVP: null
    },
    maxVPPerTurn: 5,
    maxVPTotal: 20,
    scoringTrigger: 'End of either player\'s turn',
    requiredKeywords: [],
    drawCondition: 'Opponent selects one objective in No Man\'s Land as Tempting Target',
    hasDrawCondition: true
  },
  {
    name: 'Extend Battle Lines',
    description: 'The battleground is conquered one yard at a time. Lead your forces forward and establish a strong presence in the area.',
    category: 'Tactical',
    type: 'Objective Control',
    scoringType: 'per_turn',
    vpCalculation: {
      type: 'threshold',
      thresholds: [
        { condition: 'Control objectives in deployment + No Man\'s Land', vp: 4 },
        { condition: 'Control objectives in No Man\'s Land only', vp: 2 }
      ],
      vpPerUnit: null,
      fixedVP: null
    },
    maxVPPerTurn: 4,
    maxVPTotal: 20,
    scoringTrigger: 'End of your turn',
    requiredKeywords: [],
    drawCondition: null,
    hasDrawCondition: false
  },
  {
    name: 'Overwhelming Force',
    description: 'You must scour the enemy from the face of the battlefield.',
    category: 'Both',
    type: 'Unit Destruction',
    scoringType: 'automatic',
    vpCalculation: {
      type: 'per_unit',
      thresholds: [],
      vpPerUnit: 3,
      fixedVP: null
    },
    maxVPPerTurn: 5,
    maxVPTotal: 20,
    scoringTrigger: 'While card is active',
    requiredKeywords: [],
    drawCondition: null,
    hasDrawCondition: false
  },
  {
    name: 'Display of Might',
    description: 'Intimidation is the most potent of weapons. Degrade the combat abilities of your opponent to demonstrate your superiority and erode enemy morale.',
    category: 'Tactical',
    type: 'Area Control',
    scoringType: 'per_turn',
    vpCalculation: {
      type: 'threshold',
      thresholds: [
        { condition: 'More of your units than opponent\'s wholly within No Man\'s Land', vp: 4 }
      ],
      vpPerUnit: null,
      fixedVP: null
    },
    maxVPPerTurn: 4,
    maxVPTotal: 20,
    scoringTrigger: 'End of your turn',
    requiredKeywords: [],
    drawCondition: 'If first battle round, draw new card',
    hasDrawCondition: true
  }
];

async function parseSecondaries() {
  console.log('🎯 Parsing Secondary Missions from Chapter Approved 2025-26\n');
  console.log('═══════════════════════════════════════════════════════════\n');

  // Transform to new schema format
  const rules = SECONDARY_MISSIONS.map(secondary => ({
    sourceId: SOURCE_INFO.id,
    sourceName: SOURCE_INFO.name,
    sourceVersion: SOURCE_INFO.version,
    name: secondary.name,
    description: secondary.description,
    category: secondary.category,
    type: secondary.type,
    scoringType: secondary.scoringType,
    vpCalculation: secondary.vpCalculation,
    maxVPPerTurn: secondary.maxVPPerTurn,
    maxVPTotal: secondary.maxVPTotal,
    scoringTrigger: secondary.scoringTrigger,
    requiredKeywords: secondary.requiredKeywords,
    drawCondition: secondary.drawCondition,
    hasDrawCondition: secondary.hasDrawCondition
  }));

  const output = {
    rules,
    sources: [SOURCE_INFO]
  };

  // Ensure directory exists
  await fs.ensureDir(path.dirname(OUTPUT_PATH));

  // Write to file
  await fs.writeJSON(OUTPUT_PATH, output, { spaces: 2 });

  console.log(`✅ Parsed ${rules.length} secondary missions`);
  console.log(`📄 Output written to: ${OUTPUT_PATH}\n`);

  // Summary by category
  const byCategory = rules.reduce((acc, rule) => {
    acc[rule.category] = (acc[rule.category] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  console.log('📊 Summary by Category:');
  Object.entries(byCategory).forEach(([category, count]) => {
    console.log(`   ${category}: ${count}`);
  });

  console.log('\n✨ Parsing complete!\n');
}

// Run if called directly
if (require.main === module) {
  parseSecondaries()
    .catch((error) => {
      console.error('💥 Fatal error:', error);
      process.exit(1);
    });
}

export { parseSecondaries };

