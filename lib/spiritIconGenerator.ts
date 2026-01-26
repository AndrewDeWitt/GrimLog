/**
 * Spirit Icon Generator Utility
 *
 * Generates grimdark comic book style icons for armies using Gemini.
 * This module is shared between the API route and brief analysis.
 */

import { langfuse } from '@/lib/langfuse';
import { createServiceClient } from '@/lib/supabase/service';
import { randomUUID, createHash } from 'crypto';
import { getProvider, isGeminiProvider } from '@/lib/aiProvider';
import { getGeminiClient } from '@/lib/vertexAI';

// Model for image generation
const IMAGE_MODEL = 'gemini-3-pro-image-preview';

export interface GenerateSpiritIconRequest {
  imagePrompt: string;      // AI-generated prompt for the icon
  tagline: string;          // Army tagline for storage reference
  faction: string;          // Faction name
  armyListHash?: string;    // Optional hash of army list for uniqueness
}

export interface GenerateSpiritIconResponse {
  success: boolean;
  iconUrl?: string;
  iconId?: string;
  error?: string;
}

/**
 * Generate a hash from army list details for uniqueness tracking
 */
export function generateArmyHash(faction: string, tagline: string, prompt: string): string {
  const content = `${faction}:${tagline}:${prompt.substring(0, 100)}`;
  return createHash('sha256').update(content).digest('hex').substring(0, 16);
}

/**
 * Core spirit icon generation function - can be called internally or via API
 */
export async function generateSpiritIconInternal(
  imagePrompt: string,
  tagline: string,
  faction: string,
  parentTrace?: any // Optional parent Langfuse trace
): Promise<GenerateSpiritIconResponse> {
  const iconId = randomUUID();
  const armyHash = generateArmyHash(faction, tagline, imagePrompt);
  
  // Create span under parent trace or standalone trace
  const trace = parentTrace || langfuse.trace({
    name: "army-spirit-icon-generation",
    metadata: { faction, tagline, armyHash },
  });
  
  const span = trace.span({
    name: "spirit-icon-generation",
    metadata: {
      faction,
      tagline,
      armyHash,
      promptLength: imagePrompt.length,
    }
  });
  
  console.log(`🎨 Generating Army Spirit Icon: "${tagline}" for ${faction}`);

  try {
    // Get the Gemini client (supports both AI Studio and Vertex AI)
    const provider = getProvider();
    const geminiProvider = isGeminiProvider(provider) ? (provider as 'google' | 'vertex') : 'google';
    const genai = await getGeminiClient(geminiProvider);

    // Build the full prompt with grimdark comic book style guidance
    const fullPrompt = `Create a grimdark Warhammer 40K style icon/emblem based on this description:

${imagePrompt}

STYLE REQUIREMENTS:
- Bold comic book illustration style with heavy ink outlines
- GRIMDARK 40K aesthetic - weathered, battle-worn, ominous, menacing
- Dark moody background (deep blacks, dark grays, or faction-appropriate dark colors) - NO white backgrounds
- High contrast with dramatic shadows and subtle glow effects
- Weathered metallic textures, rust, battle damage, scratches
- Skulls, cogs, aquilas, and gothic elements welcome
- NO text, NO borders, NO frames around the image
- Should feel like a war-torn chapter badge or kill-team insignia
- Evocative, intimidating, and instantly recognizable`;

    // Create generation span
    const generation = span.generation({
      name: "gemini-spirit-icon-generation",
      model: IMAGE_MODEL,
      input: { prompt: fullPrompt, originalPrompt: imagePrompt },
      metadata: { provider: geminiProvider, faction, tagline }
    });

    // Call Gemini for image generation
    const response = await genai.models.generateContent({
      model: IMAGE_MODEL,
      contents: [{ role: 'user', parts: [{ text: fullPrompt }] }],
      config: {
        responseModalities: ['IMAGE'],
        imageConfig: { aspectRatio: '1:1' }
      }
    });
    
    // Extract generated image
    const candidates = response.candidates;
    if (!candidates || candidates.length === 0) {
      generation.end({ level: "ERROR", statusMessage: 'No image generated - no candidates' });
      span.end({ metadata: { error: 'No candidates' } });
      return { success: false, error: 'No image generated' };
    }
    
    const generatedPart = candidates[0].content?.parts?.find((p: any) => p.inlineData);
    if (!generatedPart || !generatedPart.inlineData?.data) {
      generation.end({ level: "ERROR", statusMessage: 'No image data in response' });
      span.end({ metadata: { error: 'No image data' } });
      return { success: false, error: 'No image data in response' };
    }
    
    const imageData = generatedPart.inlineData.data;
    const generatedImageBuffer = Buffer.from(imageData, 'base64');
    
    generation.update({ output: { imageGenerated: true, generatedImageSize: generatedImageBuffer.length } });
    generation.end();
    
    // Process with Sharp (resize to 512x512)
    // Dynamic import sharp to avoid build-time errors on Vercel
    const sharp = (await import('sharp')).default;
    const resizedImageBuffer = await sharp(generatedImageBuffer)
      .resize(512, 512)
      .toFormat('png')
      .toBuffer();
    
    // Upload to Supabase Storage
    const safeFaction = faction.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    const safeTagline = tagline.replace(/[^a-z0-9]/gi, '_').toLowerCase().substring(0, 30);
    
    const bucket = 'army-spirit-icons';
    const objectPath = `spirits/${safeFaction}/${armyHash}_${safeTagline}.png`;
    
    const supabase = createServiceClient();
    
    // Ensure bucket exists
    const { data: buckets } = await supabase.storage.listBuckets();
    const bucketExists = buckets?.some(b => b.name === bucket);
    if (!bucketExists) {
      await supabase.storage.createBucket(bucket, { public: true, fileSizeLimit: 5242880 });
    }
    
    const { error: uploadError } = await supabase.storage
      .from(bucket)
      .upload(objectPath, resizedImageBuffer, { contentType: 'image/png', upsert: true });
    
    if (uploadError) {
      span.end({ metadata: { error: `Upload failed: ${uploadError.message}` } });
      return { success: false, error: `Storage upload failed: ${uploadError.message}` };
    }
    
    const { data: publicUrlData } = supabase.storage.from(bucket).getPublicUrl(objectPath);
    const publicUrl = publicUrlData?.publicUrl;
    
    if (!publicUrl) {
      span.end({ metadata: { error: 'Failed to get public URL' } });
      return { success: false, error: 'Failed to get public URL' };
    }
    
    const iconUrl = `${publicUrl}?v=${Date.now()}`;
    
    console.log(`✅ Army Spirit Icon generated: ${iconUrl}`);
    span.end({ metadata: { success: true, iconUrl, armyHash } });
    
    return { success: true, iconUrl, iconId };
    
  } catch (error: any) {
    console.error('Spirit icon generation error:', error);
    span.end({ level: "ERROR", metadata: { error: error.message } });
    return { success: false, error: error.message || 'Failed to generate icon' };
  }
}

