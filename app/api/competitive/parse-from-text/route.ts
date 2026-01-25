/**
 * Parse Competitive Context from Pasted Text
 * POST /api/competitive/parse-from-text
 * 
 * Takes raw text (transcript, article, notes) and extracts competitive insights
 * for a specific unit.
 */

import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { withAdminAuth } from '@/lib/auth/adminAuth';

// Initialize Gemini
const gemini = new GoogleGenAI({
  apiKey: process.env.GOOGLE_API_KEY,
});

const PARSER_MODEL = 'gemini-3-flash-preview';

interface ParseFromTextBody {
  text: string;
  unitName: string;
  faction?: string;
}

// JSON Schema for unit-specific extraction
const UNIT_CONTEXT_SCHEMA = {
  type: "object",
  properties: {
    found: {
      type: "boolean",
      description: "Whether the unit was mentioned in the text"
    },
    tierRank: {
      type: "string",
      enum: ["S", "A", "B", "C", "D", "F"],
      description: "Tier ranking if mentioned"
    },
    tierReasoning: {
      type: "string",
      description: "Why this tier was assigned"
    },
    bestTargets: {
      type: "array",
      items: { type: "string" },
      description: "What this unit is best against"
    },
    counters: {
      type: "array",
      items: { type: "string" },
      description: "What counters this unit"
    },
    synergies: {
      type: "array",
      items: { type: "string" },
      description: "Units that synergize well"
    },
    playstyleNotes: {
      type: "string",
      description: "How to play this unit"
    },
    deploymentTips: {
      type: "string",
      description: "Deployment advice"
    },
    additionalNotes: {
      type: "string",
      description: "Any other relevant notes"
    },
    confidence: {
      type: "integer",
      minimum: 0,
      maximum: 100,
      description: "Confidence in the extracted data"
    }
  },
  required: ["found", "confidence"]
};

function buildSystemPrompt(): string {
  return `You are an expert Warhammer 40,000 competitive analyst. Extract competitive insights about a SPECIFIC unit from the provided text.

HANDLING NOISY TRANSCRIPTS:
1. The text may be a messy auto-transcript with heavy repetition (words or sentences repeated multiple times). Look past the repetition.
2. The unit name may be phonetically misspelled (e.g., "Adra Eggatone" instead of "Adrax Agatone"). Use your knowledge of Warhammer 40k to identify the intended unit.
3. Only extract information that is clearly about the target unit.

IMPORTANT:
1. If the unit is discussed, set "found" to true.
2. If the unit is absolutely not mentioned, set "found" to false.
3. Be specific with tactical advice.

TIER RANKINGS (if mentioned or implied):
- S = Meta-defining, auto-include
- A = Very strong, competitive staple  
- B = Solid, viable choice
- C = Situational, has niche uses
- D = Below average
- F = Avoid

If the unit isn't mentioned, return { "found": false, "confidence": 100 }`;
}

function buildUserPrompt(text: string, unitName: string, faction?: string): string {
  return `Extract competitive insights about "${unitName}"${faction ? ` (${faction})` : ''} from this text:

---
${text}
---

Look for any information about:
- Tier rankings or power level
- Best targets / what it's good against
- Counters / what it's weak to  
- Synergies with other units
- How to play it
- Deployment tips
- Points efficiency

Extract ONLY information about "${unitName}".`;
}

export async function POST(request: NextRequest) {
  return withAdminAuth(async () => {
    try {
      const body: ParseFromTextBody = await request.json();
      const { text, unitName, faction } = body;

      if (!text || !text.trim()) {
        return NextResponse.json(
          { error: 'Text is required' },
          { status: 400 }
        );
      }

      if (!unitName) {
        return NextResponse.json(
          { error: 'Unit name is required' },
          { status: 400 }
        );
      }

      // Use full text content without truncation
      const content = text.trim();

      console.log(`🎯 Parsing "${unitName}" from pasted text (${content.length} chars) using ${PARSER_MODEL}`);

      const systemPrompt = buildSystemPrompt();
      const userPrompt = buildUserPrompt(content, unitName, faction);

      // Call Gemini using the standard Gemini pattern
      const response = await gemini.models.generateContent({
        model: PARSER_MODEL,
        contents: userPrompt,
        config: {
          systemInstruction: systemPrompt,
          temperature: 0.3,
          responseMimeType: 'application/json',
          responseJsonSchema: UNIT_CONTEXT_SCHEMA,
        },
      });

      const responseText = response.text || '';

      if (!responseText) {
        return NextResponse.json(
          { error: 'Empty response from AI' },
          { status: 500 }
        );
      }

      let parsed;
      try {
        parsed = JSON.parse(responseText);
      } catch {
        console.error('Failed to parse AI response:', responseText);
        return NextResponse.json(
          { error: 'Failed to parse AI response' },
          { status: 500 }
        );
      }

      if (!parsed.found) {
        return NextResponse.json({
          success: true,
          found: false,
          message: `"${unitName}" was not found in the provided text`,
        });
      }

      console.log(`✅ Extracted context for "${unitName}":`, parsed);

      return NextResponse.json({
        success: true,
        found: true,
        context: {
          tierRank: parsed.tierRank || null,
          tierReasoning: parsed.tierReasoning || null,
          bestTargets: parsed.bestTargets || [],
          counters: parsed.counters || [],
          synergies: parsed.synergies || [],
          playstyleNotes: parsed.playstyleNotes || null,
          deploymentTips: parsed.deploymentTips || null,
          additionalNotes: parsed.additionalNotes || null,
          confidence: parsed.confidence || 50,
        },
      });
    } catch (error) {
      console.error('Error in parse-from-text:', error);
      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      );
    }
  });
}

