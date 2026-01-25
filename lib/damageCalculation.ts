/**
 * MathHammer Damage Engine v2.0
 * 
 * Calculates statistical expected damage for Warhammer 40k 10th Edition.
 * Uses structured data from Weapon models (StrengthValue, APValue, StructuredAbilities).
 * 
 * RULE CLARIFICATIONS (10th Edition):
 * - Lethal Hits: Triggers on ANY 6 to hit (including rerolled 6s)
 * - Anti-X Y+: Unmodified wound roll of Y+ = Critical Wound (only vs targets with the keyword)
 * - Sustained Hits: Extra hits do NOT benefit from Lethal Hits
 * - Devastating Wounds: Critical wounds become mortal wounds equal to damage characteristic
 * - Feel No Pain: Works against ALL damage including mortal wounds
 * - Modifiers Cap: Hit/wound modifiers capped at +1/-1
 */

// Types for calculation inputs
export interface AttackerProfile {
  bs_ws: string; // "3+", "4+"
  strength: number;
  ap: number; // e.g., -1, 0
  damage: number; // Average damage (e.g., 2, 3.5 for D6)
  attacks: number; // Number of attacks
  abilities: WeaponAbility[];
}

export interface DefenderProfile {
  toughness: number;
  save: string; // "3+"
  invuln?: string; // "4++"
  wounds: number; // Wounds per model
  fnp?: number; // Feel No Pain (e.g., 6 for 6+, 5 for 5+)
  modelCount?: number; // Number of models in target unit
}

export interface WeaponAbility {
  kind: string; // "LETHAL_HITS", "SUSTAINED_HITS", "ANTI", etc.
  value?: number; // X value
  condition?: string; // "4+" for Anti
  targetKeyword?: string; // "VEHICLE" for Anti
}

export interface Modifiers {
  reroll_hits?: 'ones' | 'all';
  reroll_wounds?: 'ones' | 'all';
  plus_to_hit?: number; // +1 or -1
  plus_to_wound?: number; // +1 or -1
  cover?: boolean; // Benefit of Cover
  stealth?: boolean; // Stealth (-1 to hit)
  sustained_hits?: number; // Add Sustained Hits X
  lethal_hits?: boolean; // Add Lethal Hits
  devastating_wounds?: boolean; // Add Devastating Wounds
  lance?: boolean; // Add Lance (+1 to wound on charge)
  hit_on_6_only?: boolean; // Fire Overwatch - only hits on unmodified 6s
  ap_reduction?: number; // Reduce incoming AP (e.g., Armour of Contempt)
  crit_hit_on?: number; // Critical hits on X+ (default 6)
  crit_wound_on?: number; // Critical wounds on X+ (default 6, Anti-X overrides)
  anti_keyword_active?: boolean; // Whether Anti-X keyword matches target
}

export interface DamageResult {
  expected_hits: number;
  expected_wounds: number;
  expected_unsaved: number;
  expected_damage: number;
  models_killed: number;
  mortal_wounds: number; // Track mortals separately
  
  // Detailed breakdown for explanation
  hit_rate: number;
  wound_rate: number;
  save_rate: number;
  crit_hit_chance: number;
  crit_wound_chance: number;
  
  // Probability distributions (Phase 2)
  probability_to_kill?: {
    atLeast1: number;
    exactly: number[]; // [P(0 kills), P(1 kill), P(2 kills), ...]
  };
}

/**
 * Parse dice notation to average
 * "D6" -> 3.5
 * "D6+1" -> 4.5
 * "2D6" -> 7
 * "3" -> 3
 */
export function parseDiceAverage(formula: string): number {
  if (!formula) return 0;
  const clean = formula.toUpperCase().replace(/\s/g, '');
  
  // Flat number
  if (/^\d+$/.test(clean)) return parseInt(clean);
  
  // D notation
  // eslint-disable-next-line security/detect-unsafe-regex -- simple dice formula pattern
  const match = clean.match(/^(\d*)D(\d+)(?:\+(\d+))?$/);
  if (match) {
    const count = match[1] ? parseInt(match[1]) : 1;
    const faces = parseInt(match[2]);
    const mod = match[3] ? parseInt(match[3]) : 0;
    return count * ((faces + 1) / 2) + mod;
  }
  
  return 0;
}

/**
 * Convert "3+" string to probability (0-1)
 */
function parseRoll(roll: string): number {
  const target = parseInt(roll);
  if (isNaN(target)) return 0;
  return Math.max(0, Math.min(1, (7 - target) / 6));
}

/**
 * Calculate probability of getting at least one 6 on n dice with rerolls
 */
function calculateCritChanceWithRerolls(
  numDice: number,
  critThreshold: number, // Usually 6
  rerollType: 'none' | 'ones' | 'all',
  hitTarget: number // e.g., 3 for 3+
): number {
  // Probability of rolling critThreshold+ on a single die
  const baseCritChance = (7 - critThreshold) / 6;
  
  // With rerolls, we need to consider rerolled dice can also crit
  if (rerollType === 'all') {
    // Reroll all misses (anything below hitTarget)
    // Miss chance = target / 6 (for 3+, miss on 1-2, so 2/6)
    const missChance = (hitTarget - 1) / 6;
    // Crit chance = base + (misses that become crits)
    return baseCritChance + missChance * baseCritChance;
  } else if (rerollType === 'ones') {
    // Reroll 1s only
    return baseCritChance + (1 / 6) * baseCritChance;
  }
  
  return baseCritChance;
}

/**
 * Main Calculation Function
 * 
 * FIXED LOGIC:
 * 1. Lethal Hits: ANY 6 to hit (including rerolled 6s) auto-wounds
 * 2. Sustained Hits: Extra hits from 6s do NOT get Lethal Hits
 * 3. Anti-X: Only changes crit wound threshold, not the base wound target
 * 4. Devastating Wounds: Critical wounds become mortals equal to damage characteristic
 */
export function calculateDamage(
  attacker: AttackerProfile,
  defender: DefenderProfile,
  modifiers: Modifiers = {}
): DamageResult {
  
  // === 1. HIT ROLL ===
  
  // Fire Overwatch: Only hit on unmodified 6s
  if (modifiers.hit_on_6_only) {
    const hitChance = 1 / 6; // Only 6s hit
    const expectedHits = attacker.attacks * hitChance;
    
    // In Overwatch, 6s still trigger abilities but simplified
    const hasLethal = attacker.abilities.some(a => a.kind === 'LETHAL_HITS') || modifiers.lethal_hits;
    const hasSustained = attacker.abilities.some(a => a.kind === 'SUSTAINED_HITS') || (modifiers.sustained_hits ?? 0) > 0;
    
    // All hits in overwatch are on 6s
    let lethalHits = hasLethal ? expectedHits : 0;
    let regularHits = hasLethal ? 0 : expectedHits;
    
    // Sustained adds extra hits on 6s (but these don't get Lethal)
    const sustainedValue = attacker.abilities.find(a => a.kind === 'SUSTAINED_HITS')?.value || modifiers.sustained_hits || 0;
    const sustainedHits = hasSustained ? (attacker.attacks * hitChance * sustainedValue) : 0;
    regularHits += sustainedHits; // Sustained hits go to regular pool
    
    // Continue with wound calculations...
    return calculateWoundsAndDamage(attacker, defender, modifiers, regularHits, lethalHits, hitChance);
  }
  
  // Normal hit roll
  let hitTarget = parseInt(attacker.bs_ws);
  
  // Apply Modifiers (+1/-1 cap per 10th Edition rules)
  let hitMod = (modifiers.plus_to_hit || 0);
  if (modifiers.stealth) hitMod -= 1; // Stealth gives -1 to hit
  if (attacker.abilities.some(a => a.kind === 'HEAVY')) hitMod += 1; // Heavy (assumes stationary)
  hitMod = Math.max(-1, Math.min(1, hitMod)); // CAP at +1/-1
  
  // Effective target (can't go below 2 or above 6)
  const effectiveHitTarget = Math.max(2, Math.min(6, hitTarget - hitMod));
  
  // Base hit chance
  let hitChance = (7 - effectiveHitTarget) / 6;
  
  // Critical Hit threshold (usually 6, can be modified by abilities)
  const critHitThreshold = modifiers.crit_hit_on || 6;
  
  // Calculate crit rate accounting for rerolls
  // RULE: Lethal Hits trigger on ANY 6, including rerolled 6s
  let adjustedCritHitRate = calculateCritChanceWithRerolls(
    1, // Per die
    critHitThreshold,
    modifiers.reroll_hits || 'none',
    effectiveHitTarget
  );
  
  // Apply hit rerolls to overall hit chance
  if (modifiers.reroll_hits === 'all') {
    // Reroll all fails: P(hit) = P(hit) + P(miss) * P(hit)
    hitChance = hitChance + (1 - hitChance) * hitChance;
  } else if (modifiers.reroll_hits === 'ones') {
    // Reroll 1s: P(hit) = P(hit) + P(1) * P(hit)
    hitChance = hitChance + (1 / 6) * hitChance;
  }
  
  // === SUSTAINED HITS ===
  // Extra hits on critical hits (6s by default, or critHitThreshold)
  // IMPORTANT: Extra hits from Sustained do NOT benefit from Lethal Hits
  const hasSustained = attacker.abilities.some(a => a.kind === 'SUSTAINED_HITS') || (modifiers.sustained_hits ?? 0) > 0;
  const sustainedValue = attacker.abilities.find(a => a.kind === 'SUSTAINED_HITS')?.value || modifiers.sustained_hits || 0;
  
  // Sustained hits are generated based on crit chance
  const sustainedHitsPerAttack = hasSustained ? (adjustedCritHitRate * sustainedValue) : 0;
  
  // === LETHAL HITS ===
  // Critical hits (6s) auto-wound - skip wound roll entirely
  // IMPORTANT: Only applies to the original 6s, NOT to sustained extra hits
  const hasLethal = attacker.abilities.some(a => a.kind === 'LETHAL_HITS') || modifiers.lethal_hits;
  
  // Total expected hits from attacks
  const baseHits = attacker.attacks * hitChance;
  const sustainedExtraHits = attacker.attacks * sustainedHitsPerAttack;
  const totalExpectedHits = baseHits + sustainedExtraHits;
  
  // Split hits into Lethal (skip wound roll) and Regular (roll wound)
  // Lethal Hits: Only the 6s from original attacks, NOT sustained hits
  let lethalHits = 0;
  let regularHits = totalExpectedHits;
  
  if (hasLethal) {
    // Lethal hits = original attacks that rolled crits (6s)
    lethalHits = attacker.attacks * adjustedCritHitRate;
    // Regular hits = total hits minus lethal hits
    // Note: Sustained hits go to regular pool (they don't get lethal)
    regularHits = totalExpectedHits - lethalHits;
  }
  
  return calculateWoundsAndDamage(attacker, defender, modifiers, regularHits, lethalHits, hitChance, adjustedCritHitRate);
}

/**
 * Calculate wounds and damage from hits
 */
function calculateWoundsAndDamage(
  attacker: AttackerProfile,
  defender: DefenderProfile,
  modifiers: Modifiers,
  regularHits: number,
  lethalHits: number,
  hitChance: number,
  critHitRate: number = 1/6
): DamageResult {
  
  // === 2. WOUND ROLL ===
  
  // Base wound target from Strength vs Toughness
  let woundTarget = 4;
  if (attacker.strength >= defender.toughness * 2) woundTarget = 2;
  else if (attacker.strength > defender.toughness) woundTarget = 3;
  else if (attacker.strength === defender.toughness) woundTarget = 4;
  else if (attacker.strength * 2 <= defender.toughness) woundTarget = 6;
  else woundTarget = 5;
  
  // Apply Modifiers (+1/-1 cap)
  let woundMod = (modifiers.plus_to_wound || 0);
  if (modifiers.lance) woundMod += 1; // Lance gives +1 to wound
  woundMod = Math.max(-1, Math.min(1, woundMod)); // CAP at +1/-1
  
  const effectiveWoundTarget = Math.max(2, Math.min(6, woundTarget - woundMod));
  let woundChance = (7 - effectiveWoundTarget) / 6;
  
  // === ANTI-X LOGIC (FIXED) ===
  // Anti-X Y+: On UNMODIFIED wound roll of Y+, it's a Critical Wound
  // This does NOT change the base wound target - it only affects when crits happen
  let critWoundThreshold = modifiers.crit_wound_on || 6;
  
  // Check for Anti-X ability
  const anti = attacker.abilities.find(a => a.kind === 'ANTI');
  if (anti && anti.condition && modifiers.anti_keyword_active !== false) {
    // Anti-4+ means crit wounds on 4+
    const antiVal = parseInt(anti.condition);
    if (!isNaN(antiVal)) {
      critWoundThreshold = Math.min(critWoundThreshold, antiVal);
    }
  }
  
  // Critical wound chance (unmodified roll)
  const baseCritWoundChance = (7 - critWoundThreshold) / 6;
  
  // Apply wound rerolls
  if (modifiers.reroll_wounds === 'all') {
    woundChance = woundChance + (1 - woundChance) * woundChance;
  } else if (modifiers.reroll_wounds === 'ones') {
    woundChance = woundChance + (1 / 6) * woundChance;
  }
  
  // Twin-Linked (Reroll Wounds)
  if (attacker.abilities.some(a => a.kind === 'TWIN_LINKED')) {
    // Twin linked is effectively full reroll
    woundChance = woundChance + (1 - woundChance) * woundChance;
  }
  
  // Calculate crit wound rate with rerolls
  let adjustedCritWoundRate = baseCritWoundChance;
  if (modifiers.reroll_wounds === 'all') {
    adjustedCritWoundRate = baseCritWoundChance + (1 - baseCritWoundChance) * baseCritWoundChance;
  } else if (modifiers.reroll_wounds === 'ones') {
    adjustedCritWoundRate = baseCritWoundChance + (1 / 6) * baseCritWoundChance;
  }
  if (attacker.abilities.some(a => a.kind === 'TWIN_LINKED')) {
    adjustedCritWoundRate = baseCritWoundChance + (1 - baseCritWoundChance) * baseCritWoundChance;
  }
  
  // === DEVASTATING WOUNDS ===
  // Critical wounds become mortal wounds equal to damage characteristic, bypass all saves
  const hasDev = attacker.abilities.some(a => a.kind === 'DEVASTATING_WOUNDS') || modifiers.devastating_wounds;
  
  // Calculate wounds from regular hits
  const successfulWounds = regularHits * woundChance;
  
  // Lethal Hits add directly to the wound pool (they skip wound roll, not crit)
  // Note: Lethal hits are "normal" wounds, they go through saves
  let normalWounds = lethalHits;
  let mortals = 0;
  
  if (hasDev) {
    // Devastating Wounds: Critical wounds become mortals
    // Critical wounds = successful wound rolls that were critWoundThreshold+
    const regularCritWounds = regularHits * adjustedCritWoundRate;
    mortals = regularCritWounds * attacker.damage; // Mortals = damage value * crit wounds
    
    // Non-crit successful wounds go to normal pool
    // successfulWounds includes all wound successes, remove crits for normal
    const nonCritWounds = successfulWounds - regularCritWounds;
    normalWounds += Math.max(0, nonCritWounds); // Add non-crit wounds
  } else {
    // No Devastating Wounds - all successful wounds go to normal pool
    normalWounds += successfulWounds;
  }
  
  // === 3. SAVE ROLL ===
  
  const sv = parseInt(defender.save);
  const inv = defender.invuln ? parseInt(defender.invuln) : 99;
  
  // Apply AP (AP is negative, e.g., -1, -2)
  // Modified Save = Save - AP
  let modSave = sv - attacker.ap;
  
  // Apply AP reduction (e.g., Armour of Contempt)
  if (modifiers.ap_reduction) {
    modSave -= modifiers.ap_reduction; // Worsen AP = lower save number = better for defender
  }
  
  // Cover (+1 to Save, unless weapon ignores cover)
  const ignoresCover = attacker.abilities.some(a => a.kind === 'IGNORES_COVER');
  if (modifiers.cover && !ignoresCover) {
    // Cover can't improve save better than 3+ against AP 0
    if (attacker.ap < 0 || sv > 3) {
      modSave -= 1;
    }
  }
  
  // Use Invuln if better (lower target = better save)
  const finalSaveTarget = Math.min(Math.max(modSave, 2), inv); // Invuln ignores AP
  
  // Save chance (if target > 6, save is impossible)
  const saveChance = finalSaveTarget > 6 ? 0 : Math.max(0, (7 - finalSaveTarget) / 6);
  
  // Failed saves = wounds that get through
  const failedSaves = normalWounds * (1 - saveChance);
  
  // === 4. DAMAGE ===
  
  // Total damage = failed saves * damage + mortals (which bypass saves)
  let totalDamage = (failedSaves * attacker.damage) + mortals;
  
  // === FEEL NO PAIN ===
  // Works against ALL damage including mortal wounds
  if (defender.fnp) {
    const fnpChance = (7 - defender.fnp) / 6;
    // FNP ignores individual points of damage
    totalDamage = totalDamage * (1 - fnpChance);
  }
  
  // === MODELS KILLED ===
  // For multi-wound models, damage doesn't spill over (except mortals which do)
  // For averages, we calculate expected models killed
  
  const damagePerShot = Math.min(attacker.damage, defender.wounds);
  const deadFromShots = (failedSaves * damagePerShot) / defender.wounds;
  const deadFromMortals = mortals / defender.wounds; // Mortals do spill over
  
  // Apply FNP to model kills calculation too
  let modelsKilled = deadFromShots + deadFromMortals;
  if (defender.fnp) {
    const fnpChance = (7 - defender.fnp) / 6;
    modelsKilled = modelsKilled * (1 - fnpChance);
  }
  
  return {
    expected_hits: regularHits + lethalHits,
    expected_wounds: normalWounds + (mortals / attacker.damage), // Convert mortals back to "wound count"
    expected_unsaved: failedSaves,
    expected_damage: totalDamage,
    models_killed: modelsKilled,
    mortal_wounds: mortals,
    
    hit_rate: hitChance,
    wound_rate: woundChance,
    save_rate: saveChance,
    crit_hit_chance: critHitRate,
    crit_wound_chance: adjustedCritWoundRate
  };
}

// ============================================
// PHASE 2: PROBABILITY DISTRIBUTION FUNCTIONS
// ============================================

/**
 * Binomial coefficient (n choose k)
 */
function binomial(n: number, k: number): number {
  if (k < 0 || k > n) return 0;
  if (k === 0 || k === n) return 1;
  
  let result = 1;
  for (let i = 0; i < k; i++) {
    result = result * (n - i) / (i + 1);
  }
  return Math.round(result);
}

/**
 * Binomial probability P(X = k) for n trials with probability p
 */
function binomialPMF(n: number, k: number, p: number): number {
  if (p <= 0) return k === 0 ? 1 : 0;
  if (p >= 1) return k === n ? 1 : 0;
  return binomial(n, k) * Math.pow(p, k) * Math.pow(1 - p, n - k);
}

/**
 * Calculate probability distribution for kills
 */
export interface ProbabilityResult {
  expected: number;           // Average value
  probabilities: number[];    // [P(0), P(1), P(2), ...]
  probabilityAtLeast: number[]; // [P(>=0), P(>=1), P(>=2), ...]
  variance: number;
}

/**
 * Calculate kill probabilities using binomial distribution
 * 
 * @param attacks - Number of attacks
 * @param hitChance - Probability of hitting (0-1)
 * @param woundChance - Probability of wounding (0-1)
 * @param failSaveChance - Probability of failing save (0-1)
 * @param damagePerWound - Average damage per unsaved wound
 * @param woundsPerModel - Wounds per model
 * @param maxModels - Maximum models in target unit
 */
export function calculateKillProbabilities(
  attacks: number,
  hitChance: number,
  woundChance: number,
  failSaveChance: number,
  damagePerWound: number,
  woundsPerModel: number,
  maxModels: number
): ProbabilityResult {
  // Combined probability of one attack killing (getting through all rolls)
  // Note: This is simplified - actual probability is more complex
  const throughChance = hitChance * woundChance * failSaveChance;
  
  // For single-wound models
  if (woundsPerModel === 1) {
    const expected = attacks * throughChance;
    const probabilities: number[] = [];
    const probabilityAtLeast: number[] = [];
    
    // Calculate P(X = k) for k = 0 to min(attacks, maxModels)
    const maxK = Math.min(attacks, maxModels);
    for (let k = 0; k <= maxK; k++) {
      probabilities.push(binomialPMF(attacks, k, throughChance));
    }
    
    // Calculate P(X >= k)
    let cumulative = 0;
    for (let k = maxK; k >= 0; k--) {
      cumulative += probabilities[k];
      probabilityAtLeast[k] = cumulative;
    }
    
    // Variance of binomial distribution
    const variance = attacks * throughChance * (1 - throughChance);
    
    return {
      expected: Math.min(expected, maxModels),
      probabilities,
      probabilityAtLeast,
      variance
    };
  }
  
  // For multi-wound models, use simplified approximation
  // Expected unsaved wounds
  const expectedUnsaved = attacks * throughChance;
  const effectiveDamage = Math.min(damagePerWound, woundsPerModel);
  const expectedKills = (expectedUnsaved * effectiveDamage) / woundsPerModel;
  
  // For multi-wound models, probability distribution is more complex
  // Using normal approximation for simplicity
  const probabilities: number[] = [];
  const probabilityAtLeast: number[] = [];
  
  // Simplified: Use expected value and rough probabilities
  const maxK = Math.min(Math.ceil(expectedKills * 2) + 1, maxModels);
  
  for (let k = 0; k <= maxK; k++) {
    // Approximate using modified binomial
    const p = Math.min(throughChance * effectiveDamage / woundsPerModel, 1);
    probabilities.push(binomialPMF(attacks, k, p));
  }
  
  // Calculate P(X >= k)
  let cumulative = 0;
  for (let k = maxK; k >= 0; k--) {
    cumulative += probabilities[k] || 0;
    probabilityAtLeast[k] = Math.min(cumulative, 1);
  }
  
  const variance = attacks * throughChance * (1 - throughChance);
  
  return {
    expected: Math.min(expectedKills, maxModels),
    probabilities,
    probabilityAtLeast,
    variance
  };
}

/**
 * Calculate full damage result with probability distributions
 */
export function calculateDamageWithProbabilities(
  attacker: AttackerProfile,
  defender: DefenderProfile,
  modifiers: Modifiers = {}
): DamageResult {
  // Get base damage result
  const result = calculateDamage(attacker, defender, modifiers);
  
  // Calculate kill probabilities
  const modelCount = defender.modelCount || 1;
  const killProbs = calculateKillProbabilities(
    attacker.attacks,
    result.hit_rate,
    result.wound_rate,
    1 - result.save_rate,
    attacker.damage,
    defender.wounds,
    modelCount
  );
  
  // Add probability data to result
  result.probability_to_kill = {
    atLeast1: killProbs.probabilityAtLeast[1] || 0,
    exactly: killProbs.probabilities.slice(0, Math.min(5, modelCount + 1)) // First 5 values
  };
  
  return result;
}
