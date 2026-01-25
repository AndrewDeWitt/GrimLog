import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth/apiAuth';

interface RouteParams {
  params: Promise<{ id: string }>;
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

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await requireAuth();
    const { id: armyId } = await params;

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

    const presets = await prisma.attachmentPreset.findMany({
      where: { armyId },
      orderBy: [{ isDefault: 'desc' }, { updatedAt: 'desc' }],
    });

    return NextResponse.json({ success: true, data: { presets } }, { status: 200 });
  } catch (error: any) {
    console.error('Error listing attachment presets:', error);
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json({ success: false, error: 'Failed to list presets' }, { status: 500 });
  }
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await requireAuth();
    const { id: armyId } = await params;
    const body = await request.json();

    const name = typeof body?.name === 'string' ? body.name.trim() : '';
    const attachmentsRaw = body?.attachments;
    const isDefault = body?.isDefault === true;

    if (!name) {
      return NextResponse.json({ success: false, error: 'Preset name is required' }, { status: 400 });
    }

    if (attachmentsRaw !== undefined && !isRecordOfStrings(attachmentsRaw)) {
      return NextResponse.json({ success: false, error: 'attachments must be an object of strings' }, { status: 400 });
    }

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

    const attachments = normalizeAttachments((attachmentsRaw || {}) as Record<string, string>);

    const created = await prisma.$transaction(async (tx) => {
      if (isDefault) {
        await tx.attachmentPreset.updateMany({
          where: { armyId },
          data: { isDefault: false },
        });
      }

      return await tx.attachmentPreset.create({
        data: {
          armyId,
          name,
          attachmentsJson: JSON.stringify(attachments),
          isDefault,
        },
      });
    });

    return NextResponse.json({ success: true, data: { preset: created } }, { status: 201 });
  } catch (error: any) {
    console.error('Error creating attachment preset:', error);
    if (error.code === 'P2002') {
      return NextResponse.json(
        { success: false, error: 'Preset name already exists for this army' },
        { status: 409 }
      );
    }
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json({ success: false, error: 'Failed to create preset' }, { status: 500 });
  }
}


