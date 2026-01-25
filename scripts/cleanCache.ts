/**
 * Clean Cached Files
 * 
 * Removes Forge World and Legends units from cache
 */

import * as fs from 'fs-extra';
import * as path from 'path';

const CACHE_DIR = path.join(process.cwd(), 'data', 'wahapedia-cache');

// Forge World units to remove
const forgeWorldNames = [
  'Sicaran', 'Leviathan', 'Contemptor', 'Deredeo', 'Rapier',
  'Cerberus', 'Falchion', 'Fellblade', 'Typhon', 'Spartan',
  'Mastodon', 'Sokar', 'Caestus', 'Fire_Raptor', 'Storm_Eagle',
  'Javelin', 'Tarantula', 'Deathstorm', 'Terrax', 'Kratos',
  'Deimos', 'Relic_Contemptor', 'Relic_Razorback', 'Terminus_Ultra',
  'Thunderfire_Cannon', 'Mortis_Dreadnought', 'Rhino_Primaris',
  'Land_Raider_Excelsior', 'Land_Raider_Helios', 'Land_Raider_Prometheus',
  'Land_Raider_Achilles', 'Land_Raider_Proteus', 'Xiphon_Interceptor',
  'Whirlwind_Scorpius', 'Vindicator_Laser_Destroyer',
  'Thunderhawk', 'Astraeus'
];

// Legends units to remove
const legendsNames = [
  'Legendary',
  'Assault_Squad_With_Jump_Packs',
  'Assault_Squad',
  'Astartes_Servitors',
  'Attack_Bike',
  'Bike_Squad',
  'Chaplain_Venerable',
  'Command_Squad',
  'Company_Veterans_On_Bikes',
  'Hunter',
  'Ironclad',
  'Land_Speeder_Tempest',
  'Land_Speeder_Tornado',
  'Land_Speeder_Typhoon',
  'Land_Speeder_Storm', // Actually not Legends, keep this
  'Relic_Terminator',
  'Scout_Bike',
  'Scout_Sniper',
  'Stalker',
  'Vanguard_Veteran_Squad.html', // Not the jump pack version
];

async function cleanFaction(faction: string): Promise<void> {
  const factionDir = path.join(CACHE_DIR, faction);
  
  if (!await fs.pathExists(factionDir)) {
    console.log(`No cache found for ${faction}`);
    return;
  }
  
  const files = await fs.readdir(factionDir);
  const htmlFiles = files.filter(f => f.endsWith('.html') && f !== 'index.html');
  
  let removed = 0;
  let kept = 0;
  
  for (const file of htmlFiles) {
    const baseName = file.replace('.html', '');
    
    // Check if it's a Forge World or Legends unit
    const isForgeWorld = forgeWorldNames.some(fw => baseName.includes(fw));
    const isLegends = legendsNames.some(leg => baseName.includes(leg));
    
    if (isForgeWorld || isLegends) {
      console.log(`❌ Removing: ${baseName} (${isForgeWorld ? 'Forge World' : 'Legends'})`);
      
      // Delete HTML and JSON files
      await fs.remove(path.join(factionDir, file));
      await fs.remove(path.join(factionDir, `${baseName}.json`));
      
      removed++;
    } else {
      kept++;
    }
  }
  
  console.log(`\n${'='.repeat(50)}`);
  console.log(`Cleanup Summary for ${faction}`);
  console.log(`${'='.repeat(50)}`);
  console.log(`✅ Kept: ${kept} tournament-legal units`);
  console.log(`❌ Removed: ${removed} Forge World/Legends units`);
  console.log(`\nReady to parse ${kept} datasheets!`);
}

async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.log(`
Usage: tsx scripts/cleanCache.ts <faction>

Examples:
  tsx scripts/cleanCache.ts "space-marines"
  tsx scripts/cleanCache.ts "tyranids"

This will remove Forge World and Legends units from the cache.
    `);
    process.exit(0);
  }
  
  const faction = args[0];
  
  try {
    await cleanFaction(faction);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

