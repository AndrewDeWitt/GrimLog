
import * as fs from 'fs-extra';
import * as path from 'path';
import { PrismaClient } from '@prisma/client';
import { glob } from 'glob';

const prisma = new PrismaClient();
const PARSED_RULES_DIR = path.join(process.cwd(), 'data', 'parsed-rules');

interface StratagemRaw {
  name: string;
  type: string;
  cpCost: string;
  phase: string;
  fluff: string;
  when: string;
  target: string;
  effect: string;
  restrictions: string;
  detachment?: string;
  faction: string;
  source: string;
}

async function seedStratagems() {
  console.log('🌱 Seeding Stratagems...');

  // Find all stratagem files
  const files = await glob('stratagems-*.json', { cwd: PARSED_RULES_DIR });
  
  if (files.length === 0) {
    console.log('⚠️ No stratagem files found in data/parsed-rules/');
    return;
  }

  // Pre-fetch factions map
  const factions = await prisma.faction.findMany();
  const factionMap = new Map(factions.map(f => [f.name.toLowerCase(), f.id]));
  const factionMapRaw = new Map(factions.map(f => [f.name, f.id]));

  console.log(`ℹ️ Loaded ${factions.length} factions for lookup.`);

  for (const file of files) {
    console.log(`\n📦 Processing ${file}...`);
    const filePath = path.join(PARSED_RULES_DIR, file);
    const data = await fs.readJson(filePath);
    
    if (!data.stratagems || !Array.isArray(data.stratagems)) {
        console.warn(`⚠️ Invalid format in ${file}: missing 'stratagems' array`);
        continue;
    }

    const stratagems: StratagemRaw[] = data.stratagems;
    let added = 0;
    let updated = 0;
    let errors = 0;

    for (const s of stratagems) {
        try {
            // Skip Boarding Actions and other alternative game modes
            const boardingActionsDetachments = [
                'Boarding Strike',
                'Pilum Strike Team',
                'Terminator Assault',
                'Combat Patrol'
            ];
            
            if (s.detachment && boardingActionsDetachments.includes(s.detachment)) {
                console.log(`  ⏭️ Skipping Boarding Actions stratagem: ${s.name} (${s.detachment})`);
                continue;
            }
            
            // Clean up CP cost (convert "1CP" to 1)
            const cpCostInt = parseInt(s.cpCost.replace(/\D/g, '')) || 0;
            
            const detachment = s.detachment === 'Unknown' ? null : s.detachment;
            
            // Resolve Faction ID
            let factionId = factionMapRaw.get(s.faction);
            if (!factionId) {
                factionId = factionMap.get(s.faction.toLowerCase());
            }
            
            // Auto-create faction if missing (optional, but good for seeding)
            if (!factionId && s.faction) {
                console.log(`  ⚠️ Faction '${s.faction}' not found in DB. Creating...`);
                const newFaction = await prisma.faction.create({
                    data: { name: s.faction }
                });
                factionId = newFaction.id;
                factionMap.set(s.faction.toLowerCase(), factionId);
                factionMapRaw.set(s.faction, factionId);
            }

            // Check for existing
            const existing = await prisma.stratagemData.findFirst({
                where: {
                    name: s.name,
                    faction: s.faction,
                    detachment: detachment
                }
            });

            const stratagemData = {
                name: s.name,
                faction: s.faction,
                factionId: factionId, // Link to faction table
                subfaction: null, 
                detachment: detachment,
                cpCost: cpCostInt,
                type: s.type,
                when: s.when,
                target: s.target,
                effect: s.effect,
                restrictions: s.restrictions,
                // Metadata
                sourceBook: 'Wahapedia',
                updatedAt: new Date()
            };

            if (existing) {
                await prisma.stratagemData.update({
                    where: { id: existing.id },
                    data: stratagemData
                });
                updated++;
            } else {
                await prisma.stratagemData.create({
                    data: stratagemData
                });
                added++;
            }

        } catch (err) {
            console.error(`❌ Error processing ${s.name}:`, err);
            errors++;
        }
    }
    
    console.log(`  ✅ Added: ${added}, ↻ Updated: ${updated}, ❌ Errors: ${errors}`);
  }
  
  console.log('\n✨ Stratagem seeding complete!');
}

async function main() {
  try {
    await seedStratagems();
  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  main();
}
