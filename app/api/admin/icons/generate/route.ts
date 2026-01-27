/**
 * Admin Icon Generation API Endpoint
 *
 * POST /api/admin/icons/generate
 *
 * Generates anime-style unit icons using Gemini image generation.
 *
 * Full Langfuse observability for LLM tracing.
 */

import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { withAdminAuth, AdminUser } from '@/lib/auth/adminAuth';
import { prisma } from '@/lib/prisma';
import { langfuse } from '@/lib/langfuse';
import { createServiceClient } from '@/lib/supabase/service';
import { randomUUID } from 'crypto';

const genai = new GoogleGenAI({ apiKey: process.env.GOOGLE_API_KEY });

// SSRF Protection: Allowed domains for image fetching
const ALLOWED_IMAGE_DOMAINS = [
  'warhammer.com',
  'games-workshop.com',
  'wahapedia.ru',
  'wh40k.lexicanum.com',
  'storage.googleapis.com',
  'i.imgur.com',
  'imgur.com',
  'wikimedia.org',
  'wikipedia.org',
  // Add other trusted domains as needed
];

// Maximum image size to fetch (10MB)
const MAX_IMAGE_SIZE = 10 * 1024 * 1024;

// Fetch timeout (10 seconds)
const FETCH_TIMEOUT_MS = 10000;

/**
 * Validate URL for SSRF protection
 * Blocks internal IPs, non-HTTPS, and non-allowlisted domains
 */
function validateImageUrl(urlString: string): { valid: boolean; error?: string } {
  try {
    const url = new URL(urlString);

    // Must be HTTPS (except in development)
    if (process.env.NODE_ENV === 'production' && url.protocol !== 'https:') {
      return { valid: false, error: 'Only HTTPS URLs are allowed' };
    }

    // Check against allowlist
    const hostname = url.hostname.toLowerCase();
    const isAllowed = ALLOWED_IMAGE_DOMAINS.some(domain =>
      hostname === domain || hostname.endsWith(`.${domain}`)
    );

    if (!isAllowed) {
      return { valid: false, error: `Domain not in allowlist: ${hostname}` };
    }

    // Block internal/private IP ranges
    const ipPatterns = [
      /^127\./,                    // localhost
      /^10\./,                     // Class A private
      /^172\.(1[6-9]|2[0-9]|3[01])\./, // Class B private
      /^192\.168\./,               // Class C private
      /^169\.254\./,               // Link-local
      /^0\./,                      // Current network
      /^100\.(6[4-9]|[7-9][0-9]|1[01][0-9]|12[0-7])\./, // Carrier-grade NAT
      /^::1$/,                     // IPv6 localhost
      /^fc00:/i,                   // IPv6 unique local
      /^fe80:/i,                   // IPv6 link-local
    ];

    for (const pattern of ipPatterns) {
      if (pattern.test(hostname)) {
        return { valid: false, error: 'Internal IP addresses are not allowed' };
      }
    }

    // Block metadata endpoints
    if (hostname === 'metadata.google.internal' ||
        hostname === '169.254.169.254' ||
        hostname.includes('metadata')) {
      return { valid: false, error: 'Cloud metadata endpoints are not allowed' };
    }

    return { valid: true };
  } catch (error) {
    return { valid: false, error: 'Invalid URL format' };
  }
}

/**
 * Fetch image with SSRF protections
 */
async function fetchImageSecurely(imageUrl: string): Promise<{ buffer: Buffer; contentType: string | null }> {
  // Create abort controller for timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(imageUrl, {
      signal: controller.signal,
      redirect: 'follow', // Allow redirects but URL already validated
      headers: {
        'User-Agent': 'GrimLog-IconGenerator/1.0',
      },
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`Failed to fetch image: ${response.statusText}`);
    }

    // Check content-length header if available
    const contentLength = response.headers.get('content-length');
    if (contentLength && parseInt(contentLength, 10) > MAX_IMAGE_SIZE) {
      throw new Error(`Image too large: ${contentLength} bytes (max ${MAX_IMAGE_SIZE})`);
    }

    // Read response with size limit
    const chunks: Uint8Array[] = [];
    let totalSize = 0;
    const reader = response.body?.getReader();

    if (!reader) {
      throw new Error('Failed to get response reader');
    }

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      totalSize += value.length;
      if (totalSize > MAX_IMAGE_SIZE) {
        reader.cancel();
        throw new Error(`Image exceeds maximum size of ${MAX_IMAGE_SIZE} bytes`);
      }

      chunks.push(value);
    }

    const buffer = Buffer.concat(chunks.map(chunk => Buffer.from(chunk)));
    return {
      buffer,
      contentType: response.headers.get('content-type'),
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function POST(request: NextRequest) {
  return withAdminAuth(async (admin: AdminUser) => {
    // Declare trace outside try block for error handling access
    let trace: any = null;
    
    try {
      const { imageUrl, unitName, faction, stylePrompt, datasheetId } = await request.json();

      if (!imageUrl || !unitName || !faction) {
        return NextResponse.json(
          { error: 'Missing required fields: imageUrl, unitName, faction' },
          { status: 400 }
        );
      }

      // SSRF Protection: Validate the image URL before fetching
      const urlValidation = validateImageUrl(imageUrl);
      if (!urlValidation.valid) {
        console.warn(`[SECURITY] SSRF attempt blocked: ${urlValidation.error} - URL: ${imageUrl.substring(0, 100)}`);
        return NextResponse.json(
          { error: `Invalid image URL: ${urlValidation.error}` },
          { status: 400 }
        );
      }

      // Create Langfuse trace for this icon generation request
      trace = langfuse.trace({
        name: "admin-icon-generation",
        userId: admin.id,
        metadata: {
          unitName,
          faction,
          datasheetId: datasheetId || null,
          hasCustomStylePrompt: !!stylePrompt,
        },
        tags: [
          'admin',
          'icon-generation',
          `faction-${faction.replace(/[^a-z0-9]/gi, '_').toLowerCase()}`,
        ]
      });

      // 1. Fetch the source image securely (with span tracking)
      const fetchSpan = trace.span({
        name: "fetch-source-image",
        metadata: { imageUrl: imageUrl.substring(0, 100) } // Truncate URL for logging
      });

      let imageBuffer: Buffer;
      let contentType: string | null;
      try {
        const fetchResult = await fetchImageSecurely(imageUrl);
        imageBuffer = fetchResult.buffer;
        contentType = fetchResult.contentType;
      } catch (fetchError: any) {
        fetchSpan.end({ level: "ERROR", statusMessage: fetchError.message || 'Failed to fetch image' });
        throw new Error(`Failed to fetch image: ${fetchError.message}`);
      }

      const base64Image = imageBuffer.toString('base64');

      fetchSpan.end({
        metadata: {
          imageSize: imageBuffer.length,
          contentType,
        }
      });

      // 2. Generate Icon with Gemini
      const prompt = stylePrompt || `Create a comic book style portrait icon of this Warhammer 40K miniature.

FRAMING:
- Show from waist/hip up - capture the full weapon and armor profile
- Include the character's signature weapons and distinctive armor details
- Centered composition with the subject filling most of the frame
- NOT full body - crop at waist level, but show all weapons and shoulder details

STYLE:
- Bold comic book illustration with strong ink outlines
- High contrast cel-shading with defined shadows
- Crisp, clean linework - no soft edges
- Vibrant saturated colors matching the faction's scheme
- Heroic/dramatic comic book aesthetic

BACKGROUND:
- Solid white background only
- NO borders, NO frames, NO circles, NO outlines around the image edges

OUTPUT:
- This is a small UI icon - prioritize clarity and instant recognition
- Bold shapes and high contrast for readability at small sizes`;

      const model = 'gemini-3-pro-image-preview';
      
      // Create generation span for Gemini image call
      const generation = trace.generation({
        name: "gemini-image-generation",
        model: model,
        input: {
          prompt: prompt,
          imageProvided: true,
          imageSize: imageBuffer.length,
        },
        metadata: {
          provider: 'google',
          responseModalities: ['IMAGE'],
          aspectRatio: '1:1',
          unitName,
          faction,
        }
      });
      
      let response;
      try {
        response = await genai.models.generateContent({
          model: model,
          contents: [
            {
              role: 'user',
              parts: [
                { text: prompt },
                {
                  inlineData: {
                    mimeType: 'image/jpeg',
                    data: base64Image
                  }
                }
              ]
            }
          ],
          config: {
            responseModalities: ['IMAGE'],
            imageConfig: {
              aspectRatio: '1:1',
            }
          }
        });
      } catch (aiError: any) {
        console.error('Gemini Image API error:', aiError);
        
        // End generation with error
        generation.end({
          level: "ERROR",
          statusMessage: aiError.message || 'Gemini API error'
        });
        
        // Flush trace before throwing
        await langfuse.flushAsync().catch(() => {});
        
        throw new Error(`Gemini image generation failed: ${aiError.message}`);
      }

      // 3. Extract Image
      const candidates = response.candidates;
      if (!candidates || candidates.length === 0) {
        generation.end({
          level: "ERROR",
          statusMessage: 'No image generated - no candidates'
        });
        await langfuse.flushAsync().catch(() => {});
        throw new Error('No image generated');
      }

      const generatedPart = candidates[0].content?.parts?.find((p: any) => p.inlineData);
      if (!generatedPart || !generatedPart.inlineData) {
        generation.end({
          level: "ERROR",
          statusMessage: 'No image data in response'
        });
        await langfuse.flushAsync().catch(() => {});
        throw new Error('No image data in response');
      }

      const imageData = generatedPart.inlineData.data;
      if (!imageData) {
        generation.end({
          level: "ERROR",
          statusMessage: 'No image data in response parts'
        });
        await langfuse.flushAsync().catch(() => {});
        throw new Error('No image data in response');
      }
      
      const generatedImageBuffer = Buffer.from(imageData, 'base64');
      
      // Update generation with success
      generation.update({
        output: {
          imageGenerated: true,
          generatedImageSize: generatedImageBuffer.length,
        },
        metadata: {
          candidatesCount: candidates.length,
        }
      });
      generation.end();

      // 4. Process with Sharp (Resize to 256x256)
      const processSpan = trace.span({
        name: "image-processing",
        metadata: { inputSize: generatedImageBuffer.length }
      });
      
      // Dynamic import sharp to avoid build-time errors on Vercel
      const sharp = (await import('sharp')).default;
      const resizedImageBuffer = await sharp(generatedImageBuffer)
        .resize(256, 256)
        .toFormat('png')
        .toBuffer();
      
      processSpan.end({
        metadata: {
          outputSize: resizedImageBuffer.length,
          outputFormat: 'png',
          dimensions: '256x256'
        }
      });

      // 5. Storage - Upload to Supabase Storage (global, shared)
      const uploadSpan = trace.span({
        name: "supabase-upload",
        metadata: { imageSize: resizedImageBuffer.length }
      });
      
      const safeFaction = faction.replace(/[^a-z0-9]/gi, '_').toLowerCase();
      const safeUnitName = unitName.replace(/[^a-z0-9]/gi, '_');
      
      const bucket = 'unit-icons';
      const objectPath = `icons/${safeFaction}/${safeUnitName}.png`;

      const supabase = createServiceClient();
      const { error: uploadError } = await supabase.storage.from(bucket).upload(objectPath, resizedImageBuffer, {
        contentType: 'image/png',
        upsert: true,
      });
      
      if (uploadError) {
        uploadSpan.end({
          level: "ERROR",
          statusMessage: `Upload failed: ${uploadError.message}`
        });
        await langfuse.flushAsync().catch(() => {});
        throw new Error(`Supabase Storage upload failed: ${uploadError.message}`);
      }

      const { data: publicUrlData } = supabase.storage.from(bucket).getPublicUrl(objectPath);
      const publicUrl = publicUrlData?.publicUrl;
      if (!publicUrl) {
        uploadSpan.end({
          level: "ERROR",
          statusMessage: 'Failed to compute public URL'
        });
        await langfuse.flushAsync().catch(() => {});
        throw new Error('Failed to compute Supabase public URL for uploaded icon');
      }
      
      uploadSpan.end({
        metadata: {
          bucket,
          objectPath,
          publicUrl,
        }
      });

      // Save global mapping to database (faction+unitName)
      const dbSpan = trace.span({
        name: "database-upsert",
        metadata: { unitName, faction }
      });
      
      await prisma.$executeRaw`
        insert into public."GlobalUnitIcon" (
          id,
          "datasheetId",
          "unitName",
          faction,
          bucket,
          path,
          "updatedAt"
        )
        values (
          ${randomUUID()},
          ${datasheetId || null},
          ${unitName},
          ${faction},
          ${bucket},
          ${objectPath},
          now()
        )
        on conflict (faction, "unitName")
        do update set
          "datasheetId" = excluded."datasheetId",
          bucket = excluded.bucket,
          path = excluded.path,
          "updatedAt" = now()
      `;
      
      dbSpan.end({ metadata: { success: true } });

      // Update trace with final results
      trace.update({
        output: {
          success: true,
          url: publicUrl,
          persisted: true,
        },
        tags: [
          'admin',
          'icon-generation',
          `faction-${safeFaction}`,
          'success'
        ]
      });

      // Flush trace asynchronously (don't block response)
      langfuse.flushAsync().catch(err => 
        console.error('Langfuse flush error:', err)
      );

      return NextResponse.json({ 
        success: true, 
        url: publicUrl,
        persisted: true,
      });

    } catch (error: any) {
      console.error('Icon Generation Error:', error);
      
      // Log error to trace if it was created
      if (trace) {
        try {
          trace.update({
            level: "ERROR",
            metadata: {
              error: error.message || 'Unknown error',
              errorType: error.name || 'Error'
            }
          });
          
          // Flush asynchronously
          langfuse.flushAsync().catch(flushError => 
            console.error('Failed to flush Langfuse trace:', flushError)
          );
        } catch (traceError) {
          console.error('Failed to update trace:', traceError);
        }
      }
      
      // Log detailed error server-side only
      const errorMessage = error.message || 'Unknown error';
      console.error(`Icon generation error details: ${errorMessage.substring(0, 200)}`);

      // Return generic error to client (don't expose internal details)
      return NextResponse.json(
        { error: 'Failed to generate icon. Please try again later.' },
        { status: 500 }
      );
    }
  });
}
