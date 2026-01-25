/**
 * Quick test script to verify the parser schema changes
 */
import { z } from 'zod';

// Import the schemas from parseDatasheets (need to export them first)
// For now, just verify the structure compiles

const CompositionEntrySchema = z.object({
  name: z.string(),
  role: z.enum(['leader', 'regular']),
  count: z.number(),
  woundsPerModel: z.number(),
});

const WargearEffectSchema = z.object({
  wounds: z.number().optional(),
  toughness: z.number().optional(),
  save: z.string().optional(),
  invulnerableSave: z.string().optional(),
  movement: z.string().optional(),
});

// Test data
const testComposition = [
  { name: "Ravener Prime", role: "leader" as const, count: 1, woundsPerModel: 6 },
  { name: "Ravener", role: "regular" as const, count: 4, woundsPerModel: 3 },
];

const testEffects = {
  wounds: 6,
  invulnerableSave: "4+",
};

// Validate
const compositionResult = z.array(CompositionEntrySchema).safeParse(testComposition);
const effectsResult = WargearEffectSchema.safeParse(testEffects);

console.log("=== Parser Schema Test ===");
console.log("\n✅ CompositionEntry validation:", compositionResult.success ? "PASSED" : "FAILED");
if (compositionResult.success) {
  console.log("   Data:", JSON.stringify(compositionResult.data, null, 2));
}

console.log("\n✅ WargearEffect validation:", effectsResult.success ? "PASSED" : "FAILED");
if (effectsResult.success) {
  console.log("   Data:", JSON.stringify(effectsResult.data, null, 2));
}

// Calculate total wounds
const totalWounds = testComposition.reduce((sum, entry) => sum + (entry.count * entry.woundsPerModel), 0);
console.log("\n📊 Total wounds calculation:");
console.log("   Prime: 1 × 6W = 6W");
console.log("   Raveners: 4 × 3W = 12W");
console.log("   Total:", totalWounds, "wounds");

console.log("\n✨ Schema test complete!");

