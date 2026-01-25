/**
 * Strategic Assistant - Core Logic Engine
 * 
 * Filters rules database by current game state to show phase-aware strategic guidance.
 * This is the "tool" that powers both the UI panel and AI assistant.
 */

import { prisma } from './prisma';

// ============================================
// Types
// ============================================

export interface RelevantRule {
  id: string;
  name: string;
  source: string;          // "Core Stratagem", "Detachment: Gladius", "Unit: Intercessors"
  type: 'stratagem' | 'ability';
  cpCost?: number;
  triggerSubphase: string; // "Start of Phase", "During Move", "Any", etc.
  fullText: string;
  requiredKeywords: string[];
  isReactive: boolean;
  category?: string;       // For stratagems: "Battle Tactic", etc.
}

export interface RelevantRulesResult {
  opportunities: RelevantRule[];  // Things the active side can do
  threats: RelevantRule[];        // Things the other side can do (reactive)
  subphases: string[];            // Available subphase tabs for dynamic UI
}

// ============================================
// Core Logic Function
// ============================================

/**
 * Get relevant rules filtered by game state
 * 
 * This function is callable by:
 * 1. UI Panel (direct call via API)
 * 2. AI Assistant (as a tool for conversational guidance)
 * 
 * @param sessionId - Current game session ID
 * @param currentPhase - Current game phase (Command, Movement, Shooting, Charge, Fight)
 * @param currentPlayerTurn - Whose turn it is (attacker or defender)
 * @returns Filtered rules categorized as opportunities or threats
 */
export async function getRelevantRules(
  sessionId: string,
  currentPhase: string,
  currentPlayerTurn: 'attacker' | 'defender'
): Promise<RelevantRulesResult> {
  
  console.log(`🔍 Strategic Assistant: Fetching rules for ${currentPhase} phase (${currentPlayerTurn}'s turn)`);
  
  // ============================================
  // 1. Fetch Game Session with Army Data
  // ============================================
  
  const session = await prisma.gameSession.findUnique({
    where: { id: sessionId },
    include: {
      attackerArmy: {
        include: {
          units: {
            include: {
              fullDatasheet: {
                include: {
                  abilities: {
                    include: {
                      ability: true
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  });
  
  if (!session) {
    throw new Error('Session not found');
  }
  
  // ============================================
  // 2. Extract Keywords from Attacker Army
  // ============================================
  
  const attackerKeywords = new Set<string>();
  const attackerFaction = session.attackerArmy?.units[0]?.fullDatasheet?.faction;
  
  // Collect keywords from all units in attacker's army
  session.attackerArmy?.units.forEach(unit => {
    try {
      const keywords = JSON.parse(unit.keywords) as string[];
      keywords.forEach(kw => attackerKeywords.add(kw.toUpperCase()));
    } catch (error) {
      console.warn(`Failed to parse keywords for unit ${unit.name}:`, error);
    }
  });
  
  console.log(`  📊 Attacker has ${attackerKeywords.size} unique keywords`);
  
  // ============================================
  // 3. Query Core Stratagems (Universal)
  // ============================================
  
  const coreStratagems = await prisma.coreStratagem.findMany({
    where: {
      OR: [
        // Stratagems that explicitly list this phase
        {
          triggerPhase: {
            contains: currentPhase
          }
        },
        // Stratagems with no phase restriction (universal)
        {
          triggerPhase: null
        }
      ]
    }
  });
  
  console.log(`  ⚙️  Found ${coreStratagems.length} core stratagems for ${currentPhase}`);
  
  // ============================================
  // 4. Query Faction/Detachment Stratagems
  // ============================================
  
  let factionStratagems: any[] = [];
  
  if (attackerFaction) {
    factionStratagems = await prisma.stratagemData.findMany({
      where: {
        faction: attackerFaction,
        OR: [
          {
            triggerPhase: {
              contains: currentPhase
            }
          },
          {
            triggerPhase: null
          }
        ]
      }
    });
    
    console.log(`  🎖️  Found ${factionStratagems.length} faction stratagems for ${attackerFaction}`);
  }
  
  // ============================================
  // 5. Query Unit Abilities (Strategic Only - Not Passive)
  // ============================================
  
  // Only include high-value abilities: faction rules and active leader abilities
  // Filter out passive triggers like "Deadly Demise", "Damaged", stat modifications
  
  const strategicAbilityTypes = ['faction']; // Only faction-wide rules (like Detachment abilities)
  
  const unitAbilities = await prisma.ability.findMany({
    where: {
      type: {
        in: strategicAbilityTypes
      },
      OR: [
        {
          triggerPhase: {
            contains: currentPhase
          }
        },
        {
          triggerPhase: null
        }
      ]
    }
  });
  
  console.log(`  ⚡ Found ${unitAbilities.length} strategic abilities for ${currentPhase}`);
  
  // ============================================
  // 6. Filter by Keywords (V1: Basic Matching)
  // ============================================
  
  const filterByKeywords = (rule: any): boolean => {
    if (!rule.requiredKeywords) return true; // No keyword requirement
    
    try {
      const required = JSON.parse(rule.requiredKeywords) as string[];
      if (required.length === 0) return true; // Empty array = no requirement
      
      // Check if attacker has ANY of the required keywords
      return required.some(kw => attackerKeywords.has(kw.toUpperCase()));
    } catch (error) {
      console.warn(`Failed to parse requiredKeywords:`, error);
      return true; // Include if parsing fails
    }
  };
  
  const filteredCoreStratagems = coreStratagems.filter(filterByKeywords);
  const filteredFactionStratagems = factionStratagems.filter(filterByKeywords);
  const filteredAbilities = unitAbilities.filter(filterByKeywords);
  
  console.log(`  🔽 After keyword filtering: ${filteredCoreStratagems.length} core, ${filteredFactionStratagems.length} faction, ${filteredAbilities.length} abilities`);
  
  // ============================================
  // 7. Convert to RelevantRule Format
  // ============================================
  
  const allRules: RelevantRule[] = [];
  
  // Core Stratagems
  filteredCoreStratagems.forEach(strat => {
    allRules.push({
      id: strat.id,
      name: strat.name,
      source: 'Core Stratagem',
      type: 'stratagem',
      cpCost: strat.cpCost,
      triggerSubphase: strat.triggerSubphase || 'Any',
      fullText: strat.effect,
      requiredKeywords: parseJsonArray(strat.requiredKeywords),
      isReactive: strat.isReactive,
      category: strat.category
    });
  });
  
  // Faction Stratagems
  filteredFactionStratagems.forEach(strat => {
    const source = strat.detachment 
      ? `${strat.faction} - ${strat.detachment}`
      : strat.faction;
    
    allRules.push({
      id: strat.id,
      name: strat.name,
      source: source,
      type: 'stratagem',
      cpCost: strat.cpCost,
      triggerSubphase: strat.triggerSubphase || 'Any',
      fullText: strat.effect,
      requiredKeywords: parseJsonArray(strat.requiredKeywords),
      isReactive: strat.isReactive,
      category: strat.type
    });
  });
  
  // Unit Abilities
  filteredAbilities.forEach(ability => {
    allRules.push({
      id: ability.id,
      name: ability.name,
      source: `Unit Ability (${ability.type})`,
      type: 'ability',
      triggerSubphase: ability.triggerSubphase || 'Any',
      fullText: ability.description,
      requiredKeywords: parseJsonArray(ability.requiredKeywords),
      isReactive: ability.isReactive
    });
  });
  
  // ============================================
  // 8. Categorize by Turn (Opportunities vs Threats)
  // ============================================
  
  const opportunities: RelevantRule[] = [];
  const threats: RelevantRule[] = [];
  
  allRules.forEach(rule => {
    if (currentPlayerTurn === 'attacker') {
      // On attacker's turn:
      // - Non-reactive rules are opportunities (things attacker can do)
      // - Reactive rules are things defender might do (threats)
      if (!rule.isReactive) {
        opportunities.push(rule);
      } else {
        // Reactive rules during attacker's turn are potential defender interrupts
        threats.push(rule);
      }
    } else {
      // On defender's turn:
      // - Reactive rules are attacker's opportunities (counter-actions)
      // - Non-reactive rules are defender's threats
      if (rule.isReactive) {
        opportunities.push(rule);
      } else {
        threats.push(rule);
      }
    }
  });
  
  // ============================================
  // 9. Extract Unique Subphases for Dynamic Tabs
  // ============================================
  
  const subphaseSet = new Set<string>();
  [...opportunities, ...threats].forEach(rule => {
    if (rule.triggerSubphase !== 'Any') {
      subphaseSet.add(rule.triggerSubphase);
    }
  });
  
  const subphases = Array.from(subphaseSet).sort();
  
  // ============================================
  // 10. Sort by Priority
  // ============================================
  
  const sortByPriority = (a: RelevantRule, b: RelevantRule): number => {
    // Priority ranking:
    // 1. Unit Abilities (most relevant to your army)
    // 2. Detachment Stratagems (faction-specific tactics)
    // 3. Phase-Specific Core Stratagems (timing-specific)
    // 4. Universal Stratagems (always available)
    
    const getPriority = (rule: RelevantRule): number => {
      if (rule.type === 'ability') return 1;
      if (rule.source.includes('-')) return 2; // Faction/Detachment
      if (rule.triggerSubphase !== 'Any') return 3; // Phase-specific timing
      return 4; // Universal
    };
    
    const priorityDiff = getPriority(a) - getPriority(b);
    
    // If same priority, sort alphabetically
    if (priorityDiff === 0) {
      return a.name.localeCompare(b.name);
    }
    
    return priorityDiff;
  };
  
  opportunities.sort(sortByPriority);
  threats.sort(sortByPriority);
  
  // ============================================
  // 11. Return Results
  // ============================================
  
  console.log(`  ✅ Returning ${opportunities.length} opportunities, ${threats.length} threats`);
  
  return {
    opportunities,
    threats,
    subphases
  };
}

// ============================================
// Helper Functions
// ============================================

function parseJsonArray(jsonString: string | null): string[] {
  if (!jsonString) return [];
  
  try {
    const parsed = JSON.parse(jsonString);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    return [];
  }
}

