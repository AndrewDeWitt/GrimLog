/**
 * PATCH /api/units/[id] - Update unit configuration
 * DELETE /api/units/[id] - Remove unit from army
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    // Find the unit first
    const existingUnit = await prisma.unit.findUnique({
      where: { id },
      include: { army: true },
    });

    if (!existingUnit) {
      return NextResponse.json(
        { error: 'Unit not found' },
        { status: 404 }
      );
    }

    // Build update data
    const updateData: any = {};

    if (body.name !== undefined) {
      updateData.name = body.name;
    }
    if (body.modelCount !== undefined) {
      updateData.modelCount = body.modelCount;
    }
    if (body.pointsCost !== undefined) {
      updateData.pointsCost = body.pointsCost;
    }
    if (body.composition !== undefined) {
      updateData.composition = JSON.stringify(body.composition);
    }
    if (body.weapons !== undefined) {
      updateData.weapons = JSON.stringify(body.weapons);
    }
    if (body.abilities !== undefined) {
      updateData.abilities = JSON.stringify(body.abilities);
    }
    if (body.wargear !== undefined) {
      updateData.wargear = JSON.stringify(body.wargear);
    }
    if (body.enhancements !== undefined) {
      updateData.enhancements = JSON.stringify(body.enhancements);
    }
    if (body.keywords !== undefined) {
      updateData.keywords = JSON.stringify(body.keywords);
    }
    if (body.datasheetId !== undefined) {
      updateData.datasheetId = body.datasheetId;
    }
    if (body.needsReview !== undefined) {
      updateData.needsReview = body.needsReview;
    }
    if (body.goal !== undefined) {
      updateData.goal = body.goal;
    }

    // Update the unit
    const updatedUnit = await prisma.unit.update({
      where: { id },
      data: updateData,
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
      ...updatedUnit,
      keywords: JSON.parse(updatedUnit.keywords),
      composition: updatedUnit.composition ? JSON.parse(updatedUnit.composition) : null,
      weapons: updatedUnit.weapons ? JSON.parse(updatedUnit.weapons) : null,
      abilities: updatedUnit.abilities ? JSON.parse(updatedUnit.abilities) : null,
      wargear: updatedUnit.wargear ? JSON.parse(updatedUnit.wargear) : null,
      enhancements: updatedUnit.enhancements ? JSON.parse(updatedUnit.enhancements) : null,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error updating unit:', error);
    return NextResponse.json(
      { error: 'Failed to update unit' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Find the unit first
    const existingUnit = await prisma.unit.findUnique({
      where: { id },
    });

    if (!existingUnit) {
      return NextResponse.json(
        { error: 'Unit not found' },
        { status: 404 }
      );
    }

    // Delete the unit
    await prisma.unit.delete({
      where: { id },
    });

    return NextResponse.json({
      success: true,
      message: 'Unit deleted successfully',
      deletedId: id,
    });
  } catch (error) {
    console.error('Error deleting unit:', error);
    return NextResponse.json(
      { error: 'Failed to delete unit' },
      { status: 500 }
    );
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const unit = await prisma.unit.findUnique({
      where: { id },
      include: {
        fullDatasheet: {
          include: {
            weapons: {
              include: { weapon: true },
            },
            abilities: {
              include: { ability: true },
            },
          },
        },
        army: {
          select: {
            id: true,
            name: true,
            factionId: true,
          },
        },
      },
    });

    if (!unit) {
      return NextResponse.json(
        { error: 'Unit not found' },
        { status: 404 }
      );
    }

    // Parse JSON fields
    const response = {
      ...unit,
      keywords: JSON.parse(unit.keywords),
      composition: unit.composition ? JSON.parse(unit.composition) : null,
      weapons: unit.weapons ? JSON.parse(unit.weapons) : null,
      abilities: unit.abilities ? JSON.parse(unit.abilities) : null,
      wargear: unit.wargear ? JSON.parse(unit.wargear) : null,
      enhancements: unit.enhancements ? JSON.parse(unit.enhancements) : null,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error fetching unit:', error);
    return NextResponse.json(
      { error: 'Failed to fetch unit' },
      { status: 500 }
    );
  }
}
