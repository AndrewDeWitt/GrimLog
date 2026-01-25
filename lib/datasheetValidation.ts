/**
 * Datasheet Validation Schemas
 * 
 * Zod schemas for validating datasheet data during create/update operations.
 */

import { z } from 'zod';

// Weapon schema for datasheet weapons
export const WeaponInputSchema = z.object({
  name: z.string().min(1, 'Weapon name is required'),
  range: z.string().min(1, 'Range is required'), // e.g., "24\"", "Melee"
  type: z.string().min(1, 'Type is required'), // e.g., "Assault 2", "Heavy D6"
  attacks: z.string().min(1, 'Attacks is required'), // e.g., "2", "D6"
  ballisticSkill: z.string().nullable().optional(), // e.g., "3+", "4+"
  weaponSkill: z.string().nullable().optional(), // e.g., "3+", "4+"
  strength: z.string().min(1, 'Strength is required'), // e.g., "4", "8"
  armorPenetration: z.string().min(1, 'AP is required'), // e.g., "0", "-1"
  damage: z.string().min(1, 'Damage is required'), // e.g., "1", "D6"
  abilities: z.array(z.string()).default([]), // e.g., ["RAPID FIRE 2"]
  isDefault: z.boolean().default(true),
  quantity: z.string().nullable().optional(),
});

// Ability schema for datasheet abilities
export const AbilityInputSchema = z.object({
  name: z.string().min(1, 'Ability name is required'),
  type: z.enum(['core', 'faction', 'unit', 'leader', 'wargear']),
  description: z.string().min(1, 'Description is required'),
  triggerPhase: z.array(z.string()).nullable().optional(), // e.g., ["Shooting", "Fight"]
  triggerSubphase: z.string().nullable().optional(),
  isReactive: z.boolean().default(false),
  requiredKeywords: z.array(z.string()).nullable().optional(),
});

// Wargear option schema
export const WargearOptionInputSchema = z.object({
  name: z.string().min(1, 'Wargear name is required'),
  description: z.string().min(1, 'Description is required'),
  pointsCost: z.number().int().min(0).default(0),
  type: z.enum(['weapon', 'equipment', 'upgrade']),
});

// Main datasheet creation schema
export const CreateDatasheetSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  faction: z.string().min(1, 'Faction is required'),
  factionId: z.string().uuid().nullable().optional(),
  subfaction: z.string().nullable().optional(),
  role: z.enum([
    'Character',
    'Battleline',
    'Elites',
    'Fast Attack',
    'Heavy Support',
    'Dedicated Transport',
    'Fortification',
    'Allied Units',
  ]),
  keywords: z.array(z.string()).min(1, 'At least one keyword is required'),

  // Core Stats
  movement: z.string().min(1, 'Movement is required'), // e.g., "6\""
  toughness: z.number().int().min(1).max(20),
  save: z.string().regex(/^\d\+$/, 'Save must be in format like "3+"'),
  invulnerableSave: z.string().regex(/^\d\+$/).nullable().optional(),
  wounds: z.number().int().min(1).max(50),
  leadership: z.number().int().min(1).max(12),
  objectiveControl: z.number().int().min(0).max(10),

  // Unit Composition
  composition: z.string().min(1, 'Composition is required'),
  compositionData: z.string().nullable().optional(), // JSON string
  unitSize: z.string().nullable().optional(),

  // Leader Rules
  leaderRules: z.string().nullable().optional(),
  leaderAbilities: z.string().nullable().optional(),

  // Transport Rules
  transportCapacity: z.string().nullable().optional(),

  // Points
  pointsCost: z.number().int().min(0),

  // Metadata
  edition: z.string().default('10th'),
  sourceBook: z.string().nullable().optional(),

  // Competitive Context
  competitiveTier: z.enum(['S', 'A', 'B', 'C', 'D', 'F']).nullable().optional(),
  tierReasoning: z.string().nullable().optional(),
  bestTargets: z.array(z.string()).nullable().optional(),
  counters: z.array(z.string()).nullable().optional(),
  synergies: z.array(z.string()).nullable().optional(),
  playstyleNotes: z.string().nullable().optional(),
  deploymentTips: z.string().nullable().optional(),
  competitiveNotes: z.string().nullable().optional(),

  // Related data
  weapons: z.array(WeaponInputSchema).default([]),
  abilities: z.array(AbilityInputSchema).default([]),
  wargearOptions: z.array(WargearOptionInputSchema).default([]),
});

// Update schema - all fields optional except version info
export const UpdateDatasheetSchema = CreateDatasheetSchema.partial().extend({
  changelog: z.string().optional(), // What changed in this update
});

// Fork schema - minimal data needed to fork
export const ForkDatasheetSchema = z.object({
  name: z.string().min(1).max(100).optional(), // Optional new name
  visibility: z.enum(['private', 'link', 'public']).default('private'),
});

// Share settings schema
export const ShareSettingsSchema = z.object({
  visibility: z.enum(['private', 'link', 'public']),
});

// Types derived from schemas
export type WeaponInput = z.infer<typeof WeaponInputSchema>;
export type AbilityInput = z.infer<typeof AbilityInputSchema>;
export type WargearOptionInput = z.infer<typeof WargearOptionInputSchema>;
export type CreateDatasheetInput = z.infer<typeof CreateDatasheetSchema>;
export type UpdateDatasheetInput = z.infer<typeof UpdateDatasheetSchema>;
export type ForkDatasheetInput = z.infer<typeof ForkDatasheetSchema>;
export type ShareSettingsInput = z.infer<typeof ShareSettingsSchema>;

// Helper to validate keywords format
export function validateKeywords(keywords: string[]): boolean {
  return keywords.every(kw => /^[A-Z][A-Z0-9\s-]*$/.test(kw));
}

// Helper to validate save format
export function validateSaveFormat(save: string): boolean {
  return /^\d\+$/.test(save);
}

// Helper to validate movement format
export function validateMovementFormat(movement: string): boolean {
  return /^\d+"$/.test(movement) || movement === '-';
}
