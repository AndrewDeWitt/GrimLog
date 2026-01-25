export interface FactionDefinition {
  name: string;
  parentFaction?: string; // Name of parent faction
  keywords: string[]; // Keywords that identify this faction (for auto-detection)
  forbiddenKeywords?: string[]; // Keywords this faction CANNOT take from parent
  isDivergent?: boolean; // True if this is a divergent chapter (Space Wolves, etc.)
}

export const FACTION_DATA: FactionDefinition[] = [
  // Parent Factions
  {
    name: "Space Marines",
    keywords: ["ADEPTUS ASTARTES"],
    forbiddenKeywords: [],
    isDivergent: false
  },
  {
    name: "Tyranids",
    keywords: ["TYRANIDS"],
    forbiddenKeywords: [],
    isDivergent: false
  },
  {
    name: "Astra Militarum",
    keywords: ["ASTRA MILITARUM"],
    forbiddenKeywords: [],
    isDivergent: false
  },
  
  // Divergent Chapters (Children of Space Marines)
  {
    name: "Space Wolves",
    parentFaction: "Space Marines",
    keywords: ["SPACE WOLVES"],
    forbiddenKeywords: ["BLOOD ANGELS", "DARK ANGELS", "BLACK TEMPLARS", "DEATHWATCH", "ULTRAMARINES", "IMPERIAL FISTS", "SALAMANDERS", "IRON HANDS", "RAVEN GUARD", "WHITE SCARS"],
    isDivergent: true
  },
  {
    name: "Blood Angels",
    parentFaction: "Space Marines",
    keywords: ["BLOOD ANGELS"],
    forbiddenKeywords: ["SPACE WOLVES", "DARK ANGELS", "BLACK TEMPLARS", "DEATHWATCH", "ULTRAMARINES", "IMPERIAL FISTS", "SALAMANDERS", "IRON HANDS", "RAVEN GUARD", "WHITE SCARS"],
    isDivergent: true
  },
  {
    name: "Dark Angels",
    parentFaction: "Space Marines",
    keywords: ["DARK ANGELS"],
    forbiddenKeywords: ["SPACE WOLVES", "BLOOD ANGELS", "BLACK TEMPLARS", "DEATHWATCH", "ULTRAMARINES", "IMPERIAL FISTS", "SALAMANDERS", "IRON HANDS", "RAVEN GUARD", "WHITE SCARS"],
    isDivergent: true
  },
  {
    name: "Black Templars",
    parentFaction: "Space Marines",
    keywords: ["BLACK TEMPLARS"],
    forbiddenKeywords: ["SPACE WOLVES", "BLOOD ANGELS", "DARK ANGELS", "DEATHWATCH", "ULTRAMARINES", "IMPERIAL FISTS", "SALAMANDERS", "IRON HANDS", "RAVEN GUARD", "WHITE SCARS", "LIBRARIAN"],
    isDivergent: true
  },
  {
    name: "Deathwatch",
    parentFaction: "Space Marines",
    keywords: ["DEATHWATCH"],
    forbiddenKeywords: ["SPACE WOLVES", "BLOOD ANGELS", "DARK ANGELS", "BLACK TEMPLARS", "ULTRAMARINES", "IMPERIAL FISTS", "SALAMANDERS", "IRON HANDS", "RAVEN GUARD", "WHITE SCARS"],
    isDivergent: true
  }
];

