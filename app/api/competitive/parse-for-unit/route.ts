/**
 * Parse Competitive Context for a Specific Unit
 * POST /api/competitive/parse-for-unit
 * 
 * Takes an article URL or raw text and extracts competitive insights
 * specifically for the given unit name.
 * 
 * For YouTube videos, use the Python script locally and paste the transcript.
 */

import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { withAdminAuth } from '@/lib/auth/adminAuth';

// Initialize Gemini
const gemini = new GoogleGenAI({
  apiKey: process.env.GOOGLE_API_KEY,
});

const PARSER_MODEL = 'gemini-3-flash-preview';

interface ParseForUnitBody {
  sourceUrl?: string;
  text?: string;
  unitName: string;
  faction?: string;
}

// JSON Schema for unit-specific extraction
const UNIT_CONTEXT_SCHEMA = {
  type: "object",
  properties: {
    found: {
      type: "boolean",
      description: "Whether the unit was mentioned in the source"
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
  return `You are an expert Warhammer 40,000 competitive analyst. Your task is to extract competitive insights about a SPECIFIC unit from a video transcript or article.

IMPORTANT:
1. Only extract information that is EXPLICITLY about the target unit
2. If the unit is not mentioned, set "found" to false
3. Don't confuse similar unit names (e.g., "Intercessors" vs "Assault Intercessors")
4. Include the context of why something is good/bad
5. Be specific - "good against infantry" is better than just "good"

TIER RANKINGS:
- S = Meta-defining, auto-include
- A = Very strong, competitive staple  
- B = Solid, viable choice
- C = Situational, has niche uses
- D = Below average, rarely worth it
- F = Avoid, actively bad

If the source doesn't mention the unit at all, just return { "found": false, "confidence": 100 }`;
}

function buildUserPrompt(content: string, unitName: string, faction?: string): string {
  return `Extract competitive insights about "${unitName}"${faction ? ` (${faction})` : ''} from the following content.

Look for:
- Tier rankings or comparisons to other units
- What targets this unit is good/bad against
- What counters or hard-counters this unit
- Synergies with other units, characters, or abilities
- How to play/position this unit
- Deployment advice
- Points efficiency opinions
- Matchup-specific tips

CONTENT:
${content}

---

Extract ONLY information about "${unitName}". If the unit is not discussed, return { "found": false, "confidence": 100 }.`;
}

async function fetchGoonhammerArticle(url: string): Promise<string | null> {
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    
    const html = await response.text();
    
    // Simple HTML to text extraction - remove tags and scripts
    let text = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, '')
      .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, '')
      .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/\s+/g, ' ')
      .trim();
    
    // Use full text content without truncation
    return text;
  } catch (error) {
    console.error('Error fetching Goonhammer article:', error);
    return null;
  }
}

export async function POST(request: NextRequest) {
  return withAdminAuth(async () => {
    try {
      const body: ParseForUnitBody = await request.json();
      const { sourceUrl, text, unitName, faction } = body;

      console.log('📥 parse-for-unit request:', { sourceUrl: sourceUrl?.substring(0, 50), hasText: !!text, unitName, faction });

      if (!sourceUrl && !text) {
        console.log('❌ Missing sourceUrl and text');
        return NextResponse.json(
          { error: 'Either source URL or text is required' },
          { status: 400 }
        );
      }

      if (!unitName) {
        console.log('❌ Missing unitName');
        return NextResponse.json(
          { error: 'Unit name is required' },
          { status: 400 }
        );
      }

      let content: string | null = null;
      let sourceName = 'source';

      // If text is provided directly, use it
      if (text) {
        content = text.trim();
        sourceName = 'pasted text';
        console.log(`📝 Using provided text (${content.length} chars)`);
      } else if (sourceUrl) {
        // For YouTube URLs, reject and suggest using the Python script
        const isYouTube = sourceUrl.includes('youtube.com') || sourceUrl.includes('youtu.be');
        if (isYouTube) {
          return NextResponse.json(
            { 
              error: 'YouTube URL detected. Please use the Python script to fetch the transcript and paste it here.',
              suggestion: 'Run: python scripts/youtube_transcribe.py --url "' + sourceUrl + '"'
            },
            { status: 400 }
          );
        }

        // Fetch article content
        content = await fetchGoonhammerArticle(sourceUrl);
        if (!content) {
          return NextResponse.json(
            { error: 'Failed to fetch article content' },
            { status: 400 }
          );
        }
        
        const isGoonhammer = sourceUrl.includes('goonhammer.com');
        sourceName = isGoonhammer ? 'Goonhammer article' : 'article';
      }

      // Ensure we have content at this point
      if (!content) {
        return NextResponse.json(
          { error: 'No content available to parse' },
          { status: 400 }
        );
      }

      // Use full content without truncation
      if (content.length > 500000) {
        content = content.substring(0, 500000) + '... [extremely long content truncated]';
      }

      console.log(`🎯 Parsing "${unitName}" from ${sourceName} (${content.length} chars) using ${PARSER_MODEL}`);

      // Call Gemini to extract unit-specific context
      const systemPrompt = buildSystemPrompt();
      const userPrompt = buildUserPrompt(content, unitName, faction);

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
        return NextResponse.json(
          { error: 'Failed to parse AI response' },
          { status: 500 }
        );
      }

      if (!parsed.found) {
        return NextResponse.json({
          success: true,
          found: false,
          message: `"${unitName}" was not mentioned in this source`,
          source: sourceName,
        });
      }

      return NextResponse.json({
        success: true,
        found: true,
        source: sourceName,
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
      console.error('Error in parse-for-unit:', error);
      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      );
    }
  });
}

