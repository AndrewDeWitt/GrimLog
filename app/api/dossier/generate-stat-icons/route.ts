/**
 * Stat Icon Generation API Endpoint
 * 
 * POST /api/dossier/generate-stat-icons
 * 
 * Generates grimdark comic book style icons for tactical highlight stats.
 * Each stat gets its own unique icon based on the AI-generated prompt.
 * 
 * Full Langfuse observability for LLM tracing.
 */

import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { langfuse } from '@/lib/langfuse';
import { createServiceClient } from '@/lib/supabase/service';
import { requireAuth } from '@/lib/auth/apiAuth';
import { checkRateLimit, getRateLimitIdentifier, getClientIp, RATE_LIMITS } from '@/lib/rateLimit';
import { createHash } from 'crypto';

const genai = new GoogleGenAI({ apiKey: process.env.GOOGLE_API_KEY });

// Model for image generation
const IMAGE_MODEL = 'gemini-3-pro-image-preview';

export interface StatIconRequest {
  name: string;           // Stat name (e.g., "Tread-Head Factor")
  iconPrompt: string;     // AI-generated prompt for the icon
}

export interface GenerateStatIconsRequest {
  stats: StatIconRequest[];
  faction: string;
  armyHash?: string;      // Optional hash for uniqueness
}

export interface StatIconResult {
  name: string;
  iconUrl: string | null;
  error?: string;
}

export interface GenerateStatIconsResponse {
  success: boolean;
  icons: StatIconResult[];
  error?: string;
}

/**
 * Generate a hash for stat icon storage
 */
function generateStatHash(faction: string, statName: string, prompt: string): string {
  const content = `${faction}:${statName}:${prompt.substring(0, 50)}`;
  return createHash('sha256').update(content).digest('hex').substring(0, 12);
}

/**
 * Generate a single stat icon
 */
async function generateSingleStatIcon(
  stat: StatIconRequest,
  faction: string,
  supabase: ReturnType<typeof createServiceClient>,
  bucket: string,
  trace: any
): Promise<StatIconResult> {
  const statHash = generateStatHash(faction, stat.name, stat.iconPrompt);
  
  try {
    // Build the full prompt with icon-specific style guidance
    const fullPrompt = `Create a CLOSE-UP, zoomed-in icon for a tactical stat called "${stat.name}":

${stat.iconPrompt}

STYLE REQUIREMENTS:
- CLOSE-UP, tightly cropped composition - fill the frame
- Bold comic book illustration with heavy ink outlines
- GRIMDARK Warhammer 40K aesthetic - battle-worn, gritty, ominous
- Dark moody background (deep blacks, dark grays, or faction colors) - NO white backgrounds
- Weathered metallic textures, rust, battle damage, scratches
- High contrast with dramatic shadows and glow effects
- Menacing and atmospheric - skulls, cogs, imperial aquilas welcome
- NO text, NO borders, NO frames
- Should feel like a dark emblem from a war-torn universe`;

    // Create generation span
    const generation = trace.span({
      name: `generate-stat-icon-${stat.name.replace(/\s+/g, '-').toLowerCase()}`,
      metadata: {
        statName: stat.name,
        promptLength: stat.iconPrompt.length,
      }
    });

    // Call Gemini for image generation
    const response = await genai.models.generateContent({
      model: IMAGE_MODEL,
      contents: [
        {
          role: 'user',
          parts: [{ text: fullPrompt }]
        }
      ],
      config: {
        responseModalities: ['IMAGE'],
        imageConfig: {
          aspectRatio: '1:1',
        }
      }
    });

    // Extract generated image
    const candidates = response.candidates;
    if (!candidates || candidates.length === 0) {
      generation.end({ level: "ERROR", statusMessage: 'No candidates' });
      return { name: stat.name, iconUrl: null, error: 'No image generated' };
    }

    const generatedPart = candidates[0].content?.parts?.find((p: any) => p.inlineData);
    if (!generatedPart || !generatedPart.inlineData?.data) {
      generation.end({ level: "ERROR", statusMessage: 'No image data' });
      return { name: stat.name, iconUrl: null, error: 'No image data in response' };
    }

    const imageData = generatedPart.inlineData.data;
    const generatedImageBuffer = Buffer.from(imageData, 'base64');

    // Process with Sharp (resize to 128x128 for stat icons - smaller than spirit icons)
    // Dynamic import sharp to avoid build-time errors on Vercel
    const sharp = (await import('sharp')).default;
    const resizedImageBuffer = await sharp(generatedImageBuffer)
      .resize(128, 128)
      .toFormat('png')
      .toBuffer();

    // Upload to Supabase Storage
    const safeFaction = faction.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    const safeStatName = stat.name.replace(/[^a-z0-9]/gi, '_').toLowerCase().substring(0, 20);
    const objectPath = `stat-icons/${safeFaction}/${statHash}_${safeStatName}.png`;

    const { error: uploadError } = await supabase.storage
      .from(bucket)
      .upload(objectPath, resizedImageBuffer, {
        contentType: 'image/png',
        upsert: true,
      });

    if (uploadError) {
      generation.end({ level: "ERROR", statusMessage: `Upload failed: ${uploadError.message}` });
      return { name: stat.name, iconUrl: null, error: `Upload failed: ${uploadError.message}` };
    }

    const { data: publicUrlData } = supabase.storage
      .from(bucket)
      .getPublicUrl(objectPath);

    const iconUrl = publicUrlData?.publicUrl ? `${publicUrlData.publicUrl}?v=${Date.now()}` : null;

    generation.end({
      metadata: {
        success: true,
        iconUrl,
      }
    });

    return { name: stat.name, iconUrl };

  } catch (error: any) {
    console.error(`Error generating icon for ${stat.name}:`, error);
    return { name: stat.name, iconUrl: null, error: error.message };
  }
}

export async function POST(request: NextRequest) {
  let trace: any = null;

  try {
    // Require authentication
    const user = await requireAuth();
    
    // Rate limiting
    const ipAddress = getClientIp(request);
    const identifier = getRateLimitIdentifier(user.id, ipAddress);
    const rateLimit = checkRateLimit(identifier, RATE_LIMITS.generateIcon);
    
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { 
          success: false,
          icons: [],
          error: 'Rate limit exceeded',
          message: `Too many icon generation requests. Please wait ${Math.ceil((rateLimit.resetTime - Date.now()) / 1000)} seconds.`,
          retryAfter: Math.ceil((rateLimit.resetTime - Date.now()) / 1000)
        },
        { 
          status: 429,
          headers: {
            'X-RateLimit-Limit': RATE_LIMITS.generateIcon.maxRequests.toString(),
            'X-RateLimit-Remaining': rateLimit.remaining.toString(),
            'X-RateLimit-Reset': new Date(rateLimit.resetTime).toISOString(),
            'Retry-After': Math.ceil((rateLimit.resetTime - Date.now()) / 1000).toString(),
          }
        }
      );
    }
    
    const body: GenerateStatIconsRequest = await request.json();
    const { stats, faction, armyHash } = body;

    // Validate required fields
    if (!stats || stats.length === 0 || !faction) {
      return NextResponse.json(
        { success: false, icons: [], error: 'Missing required fields: stats, faction' },
        { status: 400 }
      );
    }

    // Create Langfuse trace
    trace = langfuse.trace({
      name: "stat-icons-generation",
      metadata: {
        faction,
        statCount: stats.length,
        statNames: stats.map(s => s.name),
        armyHash,
      },
      tags: [
        'stat-icons',
        `faction-${faction.toLowerCase().replace(/\s+/g, '-')}`,
      ]
    });

    console.log(`🎨 Generating ${stats.length} Stat Icons for ${faction}`);

    // Setup Supabase
    const bucket = 'army-spirit-icons'; // Reuse the same bucket
    const supabase = createServiceClient();

    // Ensure bucket exists
    const { data: buckets } = await supabase.storage.listBuckets();
    const bucketExists = buckets?.some(b => b.name === bucket);

    if (!bucketExists) {
      await supabase.storage.createBucket(bucket, {
        public: true,
        fileSizeLimit: 5242880, // 5MB
      });
    }

    // Generate icons sequentially to avoid rate limits
    const results: StatIconResult[] = [];
    for (const stat of stats) {
      if (stat.iconPrompt && stat.iconPrompt.trim()) {
        const result = await generateSingleStatIcon(stat, faction, supabase, bucket, trace);
        results.push(result);
      } else {
        results.push({ name: stat.name, iconUrl: null, error: 'No icon prompt provided' });
      }
    }

    const successCount = results.filter(r => r.iconUrl).length;
    console.log(`✅ Generated ${successCount}/${stats.length} stat icons`);

    // Update trace with final results
    trace.update({
      output: {
        success: true,
        totalRequested: stats.length,
        successCount,
        failedCount: stats.length - successCount,
      },
      tags: [
        'stat-icons',
        `faction-${faction.toLowerCase().replace(/\s+/g, '-')}`,
        successCount === stats.length ? 'all-success' : 'partial-success'
      ]
    });

    // Flush trace asynchronously
    langfuse.flushAsync().catch(err =>
      console.error('Langfuse flush error:', err)
    );

    return NextResponse.json({
      success: true,
      icons: results,
    });

  } catch (error: any) {
    console.error('Stat Icons Generation error:', error);

    // Handle authentication errors
    if (error.message === 'Unauthorized') {
      return NextResponse.json(
        { success: false, icons: [], error: 'Unauthorized' },
        { status: 401 }
      );
    }

    if (trace) {
      try {
        trace.update({
          level: "ERROR",
          metadata: {
            error: error.message || 'Unknown error',
            errorType: error.name || 'Error'
          }
        });
        langfuse.flushAsync().catch(() => {});
      } catch (traceError) {
        console.error('Failed to update trace:', traceError);
      }
    }

    return NextResponse.json(
      { success: false, icons: [], error: error.message || 'Failed to generate icons' },
      { status: 500 }
    );
  }
}

