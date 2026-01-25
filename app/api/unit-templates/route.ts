import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const faction = searchParams.get('faction');
    const edition = searchParams.get('edition') || '10th';

    const where: any = { edition };
    
    if (faction) {
      where.faction = faction;
    }

    const templates = await prisma.datasheet.findMany({
      where,
      orderBy: [
        { faction: 'asc' },
        { role: 'asc' },
        { name: 'asc' },
      ],
    });

    // Parse JSON strings back to arrays for the response
    const templatesWithParsedJSON = templates.map(template => ({
      ...template,
      keywords: JSON.parse(template.keywords),
    }));

    return NextResponse.json(templatesWithParsedJSON);
  } catch (error) {
    console.error('Error fetching unit templates:', error);
    return NextResponse.json({ error: 'Failed to fetch unit templates' }, { status: 500 });
  }
}



