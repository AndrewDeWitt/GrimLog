/**
 * Split Space Marines data into separate chapter factions
 * 
 * This script takes the combined space-marines.json and splits it into:
 * - Space Marines (core detachments)
 * - Blood Angels
 * - Dark Angels
 * - Space Wolves
 * - Deathwatch
 */

import * as fs from 'fs-extra';
import * as path from 'path';

const INPUT_FILE = path.join(process.cwd(), 'data', 'wahapedia-import', 'space-marines.json');
const OUTPUT_DIR = path.join(process.cwd(), 'data', 'wahapedia-import');

// Define which detachments belong to which chapter
const CHAPTER_DETACHMENTS: Record<string, string[]> = {
  'blood-angels': [
    'The Lost Brethren',
    'The Angelic Host',
    'Angelic Inheritors',
  ],
  'dark-angels': [
    'Unforgiven Task Force',
    'Inner Circle Task Force',
    'Company of Hunters',
    'Wrath of the Rock',
    'Lion\u2019s Blade Task Force',  // Unicode right single quotation mark
  ],
  'space-wolves': [
    'Saga of the Hunter',
    'Saga of the Bold',
    'Saga of the Beastslayer',
    'Champions of Fenris',
  ],
  'deathwatch': [
    'Black Spear Task Force',
    'Shadowmark Talon',
  ],
};

// Army rules that are chapter-specific
const CHAPTER_ARMY_RULES: Record<string, string[]> = {
  'blood-angels': [], // Blood Angels use Oath of Moment
  'dark-angels': [],  // Dark Angels use Oath of Moment
  'space-wolves': [], // Space Wolves use Oath of Moment
  'deathwatch': ['Deathwatch'], // Deathwatch has its own rule
};

// Chapter faction info
const CHAPTER_INFO: Record<string, { name: string; keywords: string[]; parentFaction: string }> = {
  'blood-angels': {
    name: 'Blood Angels',
    keywords: ['BLOOD ANGELS', 'ADEPTUS ASTARTES'],
    parentFaction: 'Space Marines',
  },
  'dark-angels': {
    name: 'Dark Angels',
    keywords: ['DARK ANGELS', 'ADEPTUS ASTARTES'],
    parentFaction: 'Space Marines',
  },
  'space-wolves': {
    name: 'Space Wolves',
    keywords: ['SPACE WOLVES', 'ADEPTUS ASTARTES'],
    parentFaction: 'Space Marines',
  },
  'deathwatch': {
    name: 'Deathwatch',
    keywords: ['DEATHWATCH', 'ADEPTUS ASTARTES'],
    parentFaction: 'Space Marines',
  },
};

async function splitChapters() {
  console.log('📖 Loading Space Marines data...');
  const data = await fs.readJSON(INPUT_FILE);
  
  console.log(`   Found ${data.detachments.length} detachments`);
  console.log(`   Found ${data.armyRules?.length || 0} army rules`);
  
  // Track which detachments we've assigned
  const assignedDetachments = new Set<string>();
  
  // Create chapter-specific JSON files
  for (const [chapterSlug, detachmentNames] of Object.entries(CHAPTER_DETACHMENTS)) {
    const chapterInfo = CHAPTER_INFO[chapterSlug];
    const chapterRuleNames = CHAPTER_ARMY_RULES[chapterSlug];
    
    // Get detachments for this chapter
    const chapterDetachments = data.detachments.filter((d: any) => 
      detachmentNames.includes(d.name)
    );
    
    // Mark as assigned
    detachmentNames.forEach(name => assignedDetachments.add(name));
    
    // Get army rules - chapters inherit Oath of Moment from Space Marines
    // But also include any chapter-specific rules
    let chapterArmyRules: any[] = [];
    
    // Always include Oath of Moment for all chapters
    const oathOfMoment = data.armyRules?.find((r: any) => r.name === 'Oath of Moment');
    if (oathOfMoment) {
      chapterArmyRules.push(oathOfMoment);
    }
    
    // Add any chapter-specific rules
    if (chapterRuleNames.length > 0) {
      const specificRules = data.armyRules?.filter((r: any) => 
        chapterRuleNames.includes(r.name)
      ) || [];
      chapterArmyRules = [...chapterArmyRules, ...specificRules];
    }
    
    const chapterData = {
      faction: chapterInfo,
      armyRules: chapterArmyRules,
      detachments: chapterDetachments,
    };
    
    const outputPath = path.join(OUTPUT_DIR, `${chapterSlug}.json`);
    await fs.writeJSON(outputPath, chapterData, { spaces: 2 });
    
    const stratagemCount = chapterDetachments.reduce((sum: number, d: any) => 
      sum + (d.stratagems?.length || 0), 0
    );
    const enhancementCount = chapterDetachments.reduce((sum: number, d: any) => 
      sum + (d.enhancements?.length || 0), 0
    );
    
    console.log(`\n✅ Created ${chapterSlug}.json`);
    console.log(`   ${chapterInfo.name}: ${chapterDetachments.length} detachments, ${stratagemCount} stratagems, ${enhancementCount} enhancements`);
  }
  
  // Create core Space Marines with remaining detachments
  const coreDetachments = data.detachments.filter((d: any) => 
    !assignedDetachments.has(d.name)
  );
  
  // Core Space Marines gets Oath of Moment and Space Marine Chapters rules (not Deathwatch)
  const coreArmyRules = data.armyRules?.filter((r: any) => 
    r.name === 'Oath of Moment' || r.name === 'Space Marine Chapters'
  ) || [];
  
  const coreData = {
    faction: {
      name: 'Space Marines',
      keywords: ['ADEPTUS ASTARTES', 'SPACE MARINES'],
      parentFaction: null,
    },
    armyRules: coreArmyRules,
    detachments: coreDetachments,
  };
  
  const coreOutputPath = path.join(OUTPUT_DIR, 'space-marines-core.json');
  await fs.writeJSON(coreOutputPath, coreData, { spaces: 2 });
  
  const coreStratagemCount = coreDetachments.reduce((sum: number, d: any) => 
    sum + (d.stratagems?.length || 0), 0
  );
  const coreEnhancementCount = coreDetachments.reduce((sum: number, d: any) => 
    sum + (d.enhancements?.length || 0), 0
  );
  
  console.log(`\n✅ Created space-marines-core.json`);
  console.log(`   Space Marines: ${coreDetachments.length} detachments, ${coreStratagemCount} stratagems, ${coreEnhancementCount} enhancements`);
  
  console.log('\n' + '='.repeat(50));
  console.log('SUMMARY');
  console.log('='.repeat(50));
  console.log('Created files:');
  console.log('  - space-marines-core.json (core Space Marines)');
  console.log('  - blood-angels.json');
  console.log('  - dark-angels.json');
  console.log('  - space-wolves.json');
  console.log('  - deathwatch.json');
  console.log('\nNext steps:');
  console.log('  1. Delete current Space Marines faction from database');
  console.log('  2. Import space-marines-core.json');
  console.log('  3. Import each chapter JSON file');
}

splitChapters().catch(console.error);

