/**
 * Create Competitive Source from Pasted Text
 * POST /api/competitive/create-from-text
 * 
 * Creates a CompetitiveSource from manually pasted transcript/text.
 * Admin-only endpoint.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAdminAuth } from '@/lib/auth/adminAuth';
import { randomUUID } from 'crypto';

interface CreateFromTextBody {
  title: string;
  transcript: string;
  sourceType?: 'youtube' | 'reddit' | 'article' | 'forum' | 'discord' | 'other';
  sourceUrl?: string;
  authorName?: string;
  gameVersion?: string;
  gameVersionDate?: string;
}

export async function POST(request: NextRequest) {
  return withAdminAuth(async () => {
    try {
      const body: CreateFromTextBody = await request.json();
      const { 
        title, 
        transcript, 
        sourceType = 'other',
        sourceUrl,
        authorName,
        gameVersion, 
        gameVersionDate 
      } = body;

      // Validate required fields
      if (!title || !title.trim()) {
        return NextResponse.json(
          { error: 'Title is required' },
          { status: 400 }
        );
      }

      if (!transcript || !transcript.trim()) {
        return NextResponse.json(
          { error: 'Transcript text is required' },
          { status: 400 }
        );
      }

      // Generate unique identifiers for pasted content
      const generatedId = randomUUID();
      const effectiveUrl = sourceUrl?.trim() || `paste://${generatedId}`;
      const effectiveSourceId = `paste-${generatedId}`;

      // Check if this URL already exists (for actual URLs)
      if (sourceUrl?.trim()) {
        const existing = await prisma.competitiveSource.findUnique({
          where: { sourceUrl: sourceUrl.trim() },
        });

        if (existing) {
          return NextResponse.json(
            { error: 'A source with this URL already exists', existingId: existing.id },
            { status: 409 }
          );
        }
      }

      // Prepare game version date if provided
      let parsedGameVersionDate: Date | null = null;
      if (gameVersionDate) {
        parsedGameVersionDate = new Date(gameVersionDate);
        if (isNaN(parsedGameVersionDate.getTime())) {
          parsedGameVersionDate = null;
        }
      }

      // Create the source
      const source = await prisma.competitiveSource.create({
        data: {
          sourceUrl: effectiveUrl,
          sourceType: sourceType,
          sourceId: effectiveSourceId,
          contentTitle: title.trim(),
          authorName: authorName?.trim() || `Pasted ${sourceType}`,
          content: transcript.trim(),
          contentLang: 'en',
          status: 'fetched', // Ready for parsing
          fetchedAt: new Date(),
          gameVersion: gameVersion || null,
          gameVersionDate: parsedGameVersionDate,
        },
      });

      console.log(`📝 Created source from pasted text: "${title}" (${transcript.length} chars)`);

      return NextResponse.json({
        success: true,
        source: {
          id: source.id,
          contentTitle: source.contentTitle,
          authorName: source.authorName,
          sourceType: source.sourceType,
          status: source.status,
          contentLength: source.content?.length || 0,
          gameVersion: source.gameVersion,
          createdAt: source.createdAt,
        },
        message: 'Source created successfully. Ready for parsing.',
      }, { status: 201 });
    } catch (error) {
      console.error('Error in create-from-text:', error);
      
      // Handle unique constraint violations
      if (error instanceof Error && error.message.includes('Unique constraint')) {
        return NextResponse.json(
          { error: 'A source with this identifier already exists' },
          { status: 409 }
        );
      }

      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      );
    }
  });
}

