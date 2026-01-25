/**
 * POST /api/armies/[id]/units - Add a new unit to an existing army
 * GET /api/armies/[id]/units - List all units in an army
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: armyId } = await params;
    const body = await request.json();

    // Verify army exists
    const army = await prisma.army.findUnique({
      where: { id: armyId },
    });

    if (!army) {
      return NextResponse.json(
        { error: 'Army not found' },
        { status: 404 }
      );
    }

    // Extract unit data from request body
    const {
      name,
      datasheet,
      datasheetId,
      modelCount = 1,
      pointsCost = 0,
      composition,
      weapons,
      abilities,
      keywords,
      wargear,
      enhancements,
      needsReview = false,
      goal,
    } = body;

    if (!name) {
      return NextResponse.json(
        { error: 'Unit name is required' },
        { status: 400 }
      );
    }

    // Validate datasheetId if provided
    let validatedDatasheetId = null;
    if (datasheetId) {
      const datasheetExists = await prisma.datasheet.findUnique({
        where: { id: datasheetId },
      });
      if (datasheetExists) {
        validatedDatasheetId = datasheetId;
      }
    }

    // Create the unit
    const unit = await prisma.unit.create({
      data: {
        name,
        datasheet: datasheet || name,
        datasheetId: validatedDatasheetId,
        armyId,
        modelCount,
        pointsCost,
        composition: composition ? JSON.stringify(composition) : null,
        weapons: weapons ? JSON.stringify(weapons) : null,
        abilities: abilities ? JSON.stringify(abilities) : null,
        keywords: JSON.stringify(keywords || []),
        wargear: wargear ? JSON.stringify(wargear) : null,
        enhancements: enhancements ? JSON.stringify(enhancements) : null,
        needsReview,
        goal,
      },
      include: {
        fullDatasheet: {
          select: {
            id: true,
            name: true,
            faction: true,
            role: true,
            keywords: true,
            movement: true,
            toughness: true,
            save: true,
            wounds: true,
            leadership: true,
            objectiveControl: true,
            pointsCost: true,
          },
        },
      },
    });

    // Parse JSON fields for response
    const response = {
      ...unit,
      keywords: JSON.parse(unit.keywords),
      composition: unit.composition ? JSON.parse(unit.composition) : null,
      weapons: unit.weapons ? JSON.parse(unit.weapons) : null,
      abilities: unit.abilities ? JSON.parse(unit.abilities) : null,
      wargear: unit.wargear ? JSON.parse(unit.wargear) : null,
      enhancements: unit.enhancements ? JSON.parse(unit.enhancements) : null,
    };

    return NextResponse.json(response, { status: 201 });
  } catch (error) {
    console.error('Error adding unit to army:', error);
    return NextResponse.json(
      { error: 'Failed to add unit to army' },
      { status: 500 }
    );
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: armyId } = await params;

    // Verify army exists
    const army = await prisma.army.findUnique({
      where: { id: armyId },
    });

    if (!army) {
      return NextResponse.json(
        { error: 'Army not found' },
        { status: 404 }
      );
    }

    // Get all units for the army
    const units = await prisma.unit.findMany({
      where: { armyId },
      include: {
        fullDatasheet: {
          select: {
            id: true,
            name: true,
            faction: true,
            role: true,
            keywords: true,
            movement: true,
            toughness: true,
            save: true,
            invulnerableSave: true,
            wounds: true,
            leadership: true,
            objectiveControl: true,
            pointsCost: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    // Parse JSON fields
    const response = units.map(unit => ({
      ...unit,
      keywords: JSON.parse(unit.keywords),
      composition: unit.composition ? JSON.parse(unit.composition) : null,
      weapons: unit.weapons ? JSON.parse(unit.weapons) : null,
      abilities: unit.abilities ? JSON.parse(unit.abilities) : null,
      wargear: unit.wargear ? JSON.parse(unit.wargear) : null,
      enhancements: unit.enhancements ? JSON.parse(unit.enhancements) : null,
    }));

    return NextResponse.json({
      armyId,
      count: response.length,
      units: response,
    });
  } catch (error) {
    console.error('Error fetching army units:', error);
    return NextResponse.json(
      { error: 'Failed to fetch army units' },
      { status: 500 }
    );
  }
}
