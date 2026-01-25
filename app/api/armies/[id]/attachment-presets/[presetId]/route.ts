import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth/apiAuth';

interface RouteParams {
  params: Promise<{ id: string; presetId: string }>;
}

function isRecordOfStrings(value: unknown): value is Record<string, string> {
  if (!value || typeof value !== 'object') return false;
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (typeof k !== 'string') return false;
    if (typeof v !== 'string') return false;
  }
  return true;
}

function normalizeAttachments(input: Record<string, string>): Record<string, string> {
  return Object.fromEntries(Object.entries(input).filter(([_, v]) => !!v));
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await requireAuth();
    const { id: armyId, presetId } = await params;
    const body = await request.json();

    const name = typeof body?.name === 'string' ? body.name.trim() : undefined;
    const attachmentsRaw = body?.attachments;
    const isDefault = body?.isDefault === true ? true : body?.isDefault === false ? false : undefined;

    if (name !== undefined && !name) {
      return NextResponse.json({ success: false, error: 'Preset name cannot be empty' }, { status: 400 });
    }

    if (attachmentsRaw !== undefined && !isRecordOfStrings(attachmentsRaw)) {
      return NextResponse.json({ success: false, error: 'attachments must be an object of strings' }, { status: 400 });
    }

    // Verify ownership via army
    const army = await prisma.army.findUnique({
      where: { id: armyId },
      select: { id: true, userId: true },
    });

    if (!army) {
      return NextResponse.json({ success: false, error: 'Army not found' }, { status: 404 });
    }

    if (army.userId !== user.id) {
      return NextResponse.json({ success: false, error: 'Not authorized' }, { status: 403 });
    }

    const existing = await prisma.attachmentPreset.findFirst({
      where: { id: presetId, armyId },
    });

    if (!existing) {
      return NextResponse.json({ success: false, error: 'Preset not found' }, { status: 404 });
    }

    const attachments = attachmentsRaw !== undefined ? normalizeAttachments(attachmentsRaw) : undefined;

    const updated = await prisma.$transaction(async (tx) => {
      if (isDefault === true) {
        await tx.attachmentPreset.updateMany({
          where: { armyId },
          data: { isDefault: false },
        });
      }

      return await tx.attachmentPreset.update({
        where: { id: presetId },
        data: {
          ...(name !== undefined && { name }),
          ...(attachments !== undefined && { attachmentsJson: JSON.stringify(attachments) }),
          ...(isDefault !== undefined && { isDefault }),
        },
      });
    });

    return NextResponse.json({ success: true, data: { preset: updated } }, { status: 200 });
  } catch (error: any) {
    console.error('Error updating attachment preset:', error);
    if (error.code === 'P2002') {
      return NextResponse.json(
        { success: false, error: 'Preset name already exists for this army' },
        { status: 409 }
      );
    }
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json({ success: false, error: 'Failed to update preset' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await requireAuth();
    const { id: armyId, presetId } = await params;

    const army = await prisma.army.findUnique({
      where: { id: armyId },
      select: { id: true, userId: true },
    });

    if (!army) {
      return NextResponse.json({ success: false, error: 'Army not found' }, { status: 404 });
    }

    if (army.userId !== user.id) {
      return NextResponse.json({ success: false, error: 'Not authorized' }, { status: 403 });
    }

    const existing = await prisma.attachmentPreset.findFirst({
      where: { id: presetId, armyId },
    });

    if (!existing) {
      return NextResponse.json({ success: false, error: 'Preset not found' }, { status: 404 });
    }

    await prisma.$transaction(async (tx) => {
      await tx.attachmentPreset.delete({ where: { id: presetId } });

      // If we deleted the default preset, promote the most recently updated remaining preset.
      if (existing.isDefault) {
        const next = await tx.attachmentPreset.findFirst({
          where: { armyId },
          orderBy: { updatedAt: 'desc' },
        });
        if (next) {
          await tx.attachmentPreset.update({
            where: { id: next.id },
            data: { isDefault: true },
          });
        }
      }
    });

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error: any) {
    console.error('Error deleting attachment preset:', error);
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json({ success: false, error: 'Failed to delete preset' }, { status: 500 });
  }
}


