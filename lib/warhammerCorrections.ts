/**
 * Warhammer 40K Phonetic Corrections
 * Fixes common speech-to-text misrecognitions for domain-specific terminology
 * 
 * The Web Speech API doesn't support custom vocabulary, so we apply
 * post-processing corrections to improve recognition accuracy.
 */

/**
 * Phonetic corrections map: misheard phrase → correct Warhammer term
 * Keys are lowercase for case-insensitive matching
 */
export const PHONETIC_CORRECTIONS: Record<string, string> = {
  // ============================================
  // TYRANIDS
  // ============================================
  
  // Termagants (very commonly misheard)
  "term against": "Termagants",
  "term a gant": "Termagants",
  "term a gants": "Termagants",
  "termigants": "Termagants",
  "tournaments": "Termagants",
  "tournament": "Termagant",
  "terra gants": "Termagants",
  "terra giants": "Termagants",
  "terma gents": "Termagants",
  
  // Hormagaunts
  "horror gaunts": "Hormagaunts",
  "horror gaunt": "Hormagaunt",
  "horma gaunts": "Hormagaunts",
  "hormone gaunts": "Hormagaunts",
  "hormiguants": "Hormagaunts",
  
  // Tyrannofex
  "tyranno flex": "Tyrannofex",
  "tyrannosaur flex": "Tyrannofex",
  "tyranno fax": "Tyrannofex",
  "tyranos fex": "Tyrannofex",
  "tyrannosaur fex": "Tyrannofex",
  "terra no flex": "Tyrannofex",
  
  // Carnifex
  "carnage fex": "Carnifex",
  "carni fex": "Carnifex",
  "carny fex": "Carnifex",
  "carno fex": "Carnifex",
  
  // Hive Tyrant
  "high tyrant": "Hive Tyrant",
  "hive tire ant": "Hive Tyrant",
  
  // Genestealers
  "gene stealers": "Genestealers",
  "jeans dealers": "Genestealers",
  "jean stealers": "Genestealers",
  
  // Tyranid Warriors
  "tyrant warriors": "Tyranid Warriors",
  "tireless warriors": "Tyranid Warriors",
  "tyrannid warriors": "Tyranid Warriors",
  
  // Exocrine
  "exo crane": "Exocrine",
  "exo green": "Exocrine",
  "exo crime": "Exocrine",
  
  // Haruspex
  "harus pecs": "Haruspex",
  "harrow specs": "Haruspex",
  
  // Zoanthropes
  "zoe entropes": "Zoanthropes",
  "zohan throws": "Zoanthropes",
  "zone throws": "Zoanthropes",
  
  // Neurogaunts
  "neuro gaunts": "Neurogaunts",
  "neural gaunts": "Neurogaunts",
  
  // Pyrovores
  "pyro vores": "Pyrovores",
  "fire vores": "Pyrovores",
  
  // Biovores
  "bio vores": "Biovores",
  "bio wars": "Biovores",
  
  // Lictor
  "liquor": "Lictor",
  "licker": "Lictor",
  
  // Maleceptor
  "male scepter": "Maleceptor",
  "mal scepter": "Maleceptor",
  
  // Tervigon
  "terve gun": "Tervigon",
  "turvy gone": "Tervigon",
  
  // Synapse
  "sign apps": "Synapse",
  "sin apps": "Synapse",
  "sigh naps": "Synapse",
  
  // ============================================
  // SPACE MARINES
  // ============================================
  
  // Intercessors
  "intercesses": "Intercessors",
  "inter cessors": "Intercessors",
  "intercession": "Intercessor",
  "inter seizers": "Intercessors",
  "inter sisters": "Intercessors",
  
  // Hellblasters
  "hell blasters": "Hellblasters",
  "health blasters": "Hellblasters",
  
  // Eradicators
  "a radiators": "Eradicators",
  "eradicators": "Eradicators",
  
  // Bladeguard Veterans
  "blade guard": "Bladeguard",
  "blade guard veterans": "Bladeguard Veterans",
  
  // Aggressors
  "aggressives": "Aggressors",
  
  // Terminators
  "terminates": "Terminators",
  
  // Redemptor Dreadnought
  "redemption dreadnought": "Redemptor Dreadnought",
  "redeemer dreadnought": "Redemptor Dreadnought",
  "red tempter": "Redemptor",
  
  // Repulsor
  "repulse or": "Repulsor",
  "re pulsar": "Repulsor",
  
  // Primaris
  "pre meris": "Primaris",
  "pre maris": "Primaris",
  "primary s": "Primaris",
  "primarys": "Primaris",
  
  // Astartes
  "a star teas": "Astartes",
  "a start ease": "Astartes",
  "ass tardies": "Astartes",
  
  // Inceptors
  "in scepters": "Inceptors",
  "interceptors": "Inceptors",
  "inceptors": "Inceptors",
  
  // Devastators
  "devastate ors": "Devastators",
  
  // Sternguard
  "stern guard": "Sternguard",
  "stern guard veterans": "Sternguard Veterans",
  
  // Vanguard
  "van guard": "Vanguard",
  "van guard veterans": "Vanguard Veterans",
  
  // Chaplain
  "chap lane": "Chaplain",
  "chapel in": "Chaplain",
  
  // Librarian
  "library an": "Librarian",
  
  // Apothecary
  "a potty carry": "Apothecary",
  
  // Rhino
  "rino": "Rhino",
  
  // ============================================
  // SPACE WOLVES
  // ============================================
  
  // Thunderwolf Cavalry
  "thunder wolf": "Thunderwolf",
  "thunder wolf cavalry": "Thunderwolf Cavalry",
  
  // Wulfen
  "wolf in": "Wulfen",
  "wulfin": "Wulfen",
  
  // Fenrisian Wolves
  "fern reason": "Fenrisian",
  "fenrisian wolves": "Fenrisian Wolves",
  
  // ============================================
  // ASTRA MILITARUM
  // ============================================
  
  // Astra Militarum
  "astra military": "Astra Militarum",
  "astra mill a taram": "Astra Militarum",
  
  // Leman Russ
  "lemon russ": "Leman Russ",
  "lehman russ": "Leman Russ",
  "layman russ": "Leman Russ",
  
  // Baneblade
  "bane blade": "Baneblade",
  "bain blade": "Baneblade",
  
  // Chimera
  "chi mera": "Chimera",
  
  // Basilisk
  "basil isk": "Basilisk",
  
  // Kasrkin
  "cars can": "Kasrkin",
  "cars kin": "Kasrkin",
  
  // Cadians
  "cadence": "Cadians",
  "canadians": "Cadians",
  
  // ============================================
  // NECRONS
  // ============================================
  
  // Necrons
  "neck rons": "Necrons",
  "neckrons": "Necrons",
  
  // Canoptek
  "canopy tech": "Canoptek",
  "can opic": "Canoptek",
  
  // Skorpekh
  "score peck": "Skorpekh",
  "scor peck": "Skorpekh",
  "scorpex": "Skorpekh",
  
  // Lokhust
  "low cust": "Lokhust",
  "locust": "Lokhust",
  
  // Ophydian
  "ophidian": "Ophydian",
  "a fiddling": "Ophydian",
  
  // C'tan
  "see tan": "C'tan",
  "c tan": "C'tan",
  "satan": "C'tan",
  
  // Nightbringer
  "night bringer": "Nightbringer",
  
  // Deceiver
  "de sever": "Deceiver",
  
  // Triarch
  "try ark": "Triarch",
  "tree ark": "Triarch",
  
  // Praetorians
  "pretoria": "Praetorians",
  "pretoreans": "Praetorians",
  
  // Immortals
  "in mortals": "Immortals",
  
  // Lychguard
  "litch guard": "Lychguard",
  "lick guard": "Lychguard",
  
  // Overlord
  "over lord": "Overlord",
  
  // Cryptek
  "crypt tech": "Cryptek",
  "crypto tech": "Cryptek",
  
  // ============================================
  // ORKS
  // ============================================
  
  // Boyz
  "boys": "Boyz",
  "orcs boys": "Ork Boyz",
  
  // Nobz
  "knobs": "Nobz",
  "nobs": "Nobz",
  
  // Warboss
  "war boss": "Warboss",
  
  // Weirdboy
  "weird boy": "Weirdboy",
  
  // Mekboy
  "mech boy": "Mekboy",
  "meek boy": "Mekboy",
  
  // Deffkoptas
  "death copters": "Deffkoptas",
  "def copters": "Deffkoptas",
  
  // Trukk
  "truck": "Trukk",
  "trucks": "Trukks",
  
  // Battlewagon
  "battle wagon": "Battlewagon",
  
  // Squighog Boyz
  "squid hog": "Squighog",
  "squig hog": "Squighog",
  
  // Meganobz
  "mega nobs": "Meganobz",
  "mega knobs": "Meganobz",
  
  // Gorkanaut
  "gor kanat": "Gorkanaut",
  "gork and art": "Gorkanaut",
  
  // Morkanaut
  "more kanat": "Morkanaut",
  "mork and art": "Morkanaut",
  
  // Stompa
  "stomper": "Stompa",
  
  // WAAAGH!
  "waa": "WAAAGH!",
  "waaa": "WAAAGH!",
  "wog": "WAAAGH!",
  
  // ============================================
  // CHAOS SPACE MARINES
  // ============================================
  
  // Khorne
  "corn": "Khorne",
  "horn": "Khorne",
  "korn": "Khorne",
  
  // Nurgle
  "nurgle": "Nurgle",
  "nergle": "Nurgle",
  
  // Slaanesh
  "sla nash": "Slaanesh",
  "slain ash": "Slaanesh",
  "slannesh": "Slaanesh",
  
  // Tzeentch
  "zeench": "Tzeentch",
  "zinch": "Tzeentch",
  "teens": "Tzeentch",
  "tzeech": "Tzeentch",
  
  // Berzerkers
  "berserkers": "Berzerkers",
  "beserk ers": "Berzerkers",
  
  // Havocs
  "have ox": "Havocs",
  
  // Obliterators
  "a liberators": "Obliterators",
  
  // Possessed
  "possess": "Possessed",
  
  // Helbrute
  "hell brute": "Helbrute",
  "health brute": "Helbrute",
  
  // Defiler
  "defile er": "Defiler",
  
  // Daemon Prince
  "demon prince": "Daemon Prince",
  
  // ============================================
  // T'AU EMPIRE
  // ============================================
  
  // T'au
  "tau": "T'au",
  "tow": "T'au",
  
  // Fire Warriors
  "fire worriers": "Fire Warriors",
  
  // Crisis Suits
  "crisis suites": "Crisis Suits",
  
  // Riptide
  "rip tied": "Riptide",
  
  // Stormsurge
  "storm surge": "Stormsurge",
  
  // Ghostkeel
  "ghost keel": "Ghostkeel",
  "ghost kill": "Ghostkeel",
  
  // Broadside
  "broad side": "Broadside",
  
  // Kroot
  "crute": "Kroot",
  "root": "Kroot",
  
  // Ethereal
  "a therial": "Ethereal",
  
  // ============================================
  // AELDARI / ELDAR
  // ============================================
  
  // Aeldari
  "all dairy": "Aeldari",
  "el dairy": "Aeldari",
  "elder eye": "Aeldari",
  
  // Howling Banshees
  "howling banshees": "Howling Banshees",
  "howling ban shes": "Howling Banshees",
  
  // Wraithguard
  "wraith guard": "Wraithguard",
  "race guard": "Wraithguard",
  
  // Wraithknight
  "wraith knight": "Wraithknight",
  "race knight": "Wraithknight",
  
  // Avatar of Khaine
  "avatar of cane": "Avatar of Khaine",
  "avatar of kane": "Avatar of Khaine",
  
  // Farseer
  "far seer": "Farseer",
  "far see her": "Farseer",
  
  // Warlock
  "war lock": "Warlock",
  
  // Striking Scorpions
  "striking scorpions": "Striking Scorpions",
  
  // Fire Dragons
  "fire dragons": "Fire Dragons",
  
  // Dark Reapers
  "dark reapers": "Dark Reapers",
  
  // Dire Avengers
  "dire avengers": "Dire Avengers",
  "dire avenges": "Dire Avengers",
  
  // Harlequins
  "harlequin": "Harlequin",
  "harley quinn": "Harlequin",
  
  // ============================================
  // GAME TERMS & MECHANICS
  // ============================================
  
  // Oath of Moment
  "oath of movement": "Oath of Moment",
  "oath of moments": "Oath of Moment",
  "oath a moment": "Oath of Moment",
  "otho moment": "Oath of Moment",
  
  // Command Points
  "command point": "Command Points",
  "cp": "CP",
  "see pee": "CP",
  
  // Victory Points
  "victory point": "Victory Points",
  "vp": "VP",
  "vee pee": "VP",
  
  // Objective Control
  "oc": "OC",
  "oh see": "OC",
  
  // Stratagems
  "strata gems": "Stratagems",
  "strata jam": "Stratagem",
  "strategy gem": "Stratagem",
  "strat a gem": "Stratagem",
  "strata jams": "Stratagems",
  
  // Phases
  "command face": "Command Phase",
  "movement face": "Movement Phase",
  "shooting face": "Shooting Phase",
  "charge face": "Charge Phase",
  "fight face": "Fight Phase",
  
  // Detachment
  "de tachment": "Detachment",
  "detach meant": "Detachment",
  
  // Battle-shock
  "battle shock": "Battle-shock",
  "battleshock": "Battle-shock",
  
  // Feel No Pain
  "feel no pain": "Feel No Pain",
  "fnp": "FNP",
  
  // Invulnerable Save
  "invulnerable save": "Invulnerable Save",
  "invuln": "Invulnerable Save",
  "in vaulne": "Invulnerable Save",
  
  // Deep Strike
  "deep strike": "Deep Strike",
  "deepstrike": "Deep Strike",
  
  // Overwatch
  "over watch": "Overwatch",
  
  // Deadly Demise
  "deadly demise": "Deadly Demise",
  "deadly de mise": "Deadly Demise",
  
  // Lone Operative
  "lone operative": "Lone Operative",
  "lone operation": "Lone Operative",
  
  // Mortal Wounds
  "mortal wounds": "Mortal Wounds",
  "mortal wound": "Mortal Wounds",
  "mortals": "Mortal Wounds",
  
  // Lethal Hits
  "lethal hits": "Lethal Hits",
  "leathal hits": "Lethal Hits",
  
  // Sustained Hits
  "sustained hits": "Sustained Hits",
  "sustain hits": "Sustained Hits",
  
  // Devastating Wounds
  "devastating wounds": "Devastating Wounds",
  "dev wounds": "Devastating Wounds",
  
  // Anti-X
  "anti infantry": "Anti-Infantry",
  "anti vehicle": "Anti-Vehicle",
  "anti monster": "Anti-Monster",
  
  // ============================================
  // COMMON SECONDARY OBJECTIVES
  // ============================================
  
  // Assassination
  "a assassination": "Assassination",
  
  // Behind Enemy Lines
  "behind enemy lines": "Behind Enemy Lines",
  
  // Bring It Down
  "bring it down": "Bring It Down",
  "bring them down": "Bring It Down",
  
  // No Prisoners
  "no prisoners": "No Prisoners",
  
  // Engage on All Fronts
  "engage on all fronts": "Engage on All Fronts",
  
  // Cleanse
  "cleans": "Cleanse",
  
  // Tempting Target
  "tempting target": "Tempting Target",
  
  // Area Denial
  "area denial": "Area Denial",
};

/**
 * Word-level corrections for individual terms within phrases
 * These apply when the term appears as a standalone word
 */
export const WORD_CORRECTIONS: Record<string, string> = {
  // Common single-word misrecognitions
  "termigants": "Termagants",
  "tournaments": "Termagants",
  "intercesses": "Intercessors",
  "tyrannoflex": "Tyrannofex",
  "strata gems": "Stratagems",
  "stratagem": "Stratagem",
  "detachments": "Detachments",
  "synapse": "Synapse",
  "primaris": "Primaris",
  "astartes": "Astartes",
};

/**
 * Apply phonetic corrections to transcribed text
 * Uses phrase-level matching for multi-word terms
 */
export function applyPhoneticCorrections(text: string): string {
  if (!text) return text;
  
  let corrected = text;
  const lowerText = text.toLowerCase();
  
  // Apply phrase corrections (longer phrases first to avoid partial matches)
  const sortedPhrases = Object.keys(PHONETIC_CORRECTIONS)
    .sort((a, b) => b.length - a.length);
  
  for (const misheard of sortedPhrases) {
    const regex = new RegExp(escapeRegex(misheard), 'gi');
    if (regex.test(lowerText)) {
      corrected = corrected.replace(regex, PHONETIC_CORRECTIONS[misheard]);
    }
  }
  
  return corrected;
}

/**
 * Escape special regex characters in a string
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Get correction suggestions for a term
 * Returns null if no correction needed
 */
export function getSuggestion(text: string): string | null {
  const lower = text.toLowerCase().trim();
  
  // Check exact phrase match
  if (PHONETIC_CORRECTIONS[lower]) {
    return PHONETIC_CORRECTIONS[lower];
  }
  
  // Check word corrections
  if (WORD_CORRECTIONS[lower]) {
    return WORD_CORRECTIONS[lower];
  }
  
  return null;
}

/**
 * Check if text likely contains Warhammer-related content
 * (even if misrecognized)
 */
export function likelyContainsWarhammerTerms(text: string): boolean {
  const lower = text.toLowerCase();
  
  // Check for phonetic patterns that might be Warhammer terms
  const phoneticPatterns = [
    /term[ai]?g[au]nt/i,
    /tyrann?o/i,
    /carni?f/i,
    /inter[cs]ess/i,
    /strata?g/i,
    /command\s*p/i,
    /victory\s*p/i,
    /battle.*shock/i,
    /deep\s*strik/i,
    /mortal\s*wound/i,
    /over\s*watch/i,
  ];
  
  return phoneticPatterns.some(pattern => pattern.test(lower));
}

/**
 * Dynamic vocabulary context - can be extended at runtime
 * with session-specific unit names
 */
let sessionVocabulary: Map<string, string> = new Map();

/**
 * Add session-specific vocabulary (e.g., current army unit names)
 */
export function addSessionVocabulary(misheard: string, correct: string): void {
  sessionVocabulary.set(misheard.toLowerCase(), correct);
}

/**
 * Clear session vocabulary (call when session ends)
 */
export function clearSessionVocabulary(): void {
  sessionVocabulary.clear();
}

/**
 * Apply all corrections including session-specific vocabulary
 */
export function applyAllCorrections(text: string): string {
  let corrected = applyPhoneticCorrections(text);
  
  // Apply session-specific corrections
  const lower = corrected.toLowerCase();
  for (const [misheard, correct] of sessionVocabulary) {
    const regex = new RegExp(escapeRegex(misheard), 'gi');
    if (regex.test(lower)) {
      corrected = corrected.replace(regex, correct);
    }
  }
  
  return corrected;
}

