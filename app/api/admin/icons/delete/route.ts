/**
 * Admin Icon Delete API Endpoint
 * 
 * DELETE /api/admin/icons/delete
 * 
 * Deletes a unit icon from Supabase Storage and the database.
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAdminAuth, AdminUser } from '@/lib/auth/adminAuth';
import { prisma } from '@/lib/prisma';
import { createServiceClient } from '@/lib/supabase/service';

export async function DELETE(request: NextRequest) {
  return withAdminAuth(async (admin: AdminUser) => {
    try {
      const { unitName, faction } = await request.json();

      if (!unitName || !faction) {
        return NextResponse.json(
          { error: 'Missing required fields: unitName, faction' },
          { status: 400 }
        );
      }

      // 1. Find the icon record in the database
      type IconRow = { id: string; bucket: string; path: string };
      const icons = await prisma.$queryRaw<IconRow[]>`
        select id, bucket, path
        from public."GlobalUnitIcon"
        where faction = ${faction}
          and "unitName" = ${unitName}
        limit 1
      `;

      const icon = icons[0];
      if (!icon) {
        return NextResponse.json(
          { error: 'Icon not found' },
          { status: 404 }
        );
      }

      // 2. Delete from Supabase Storage
      const supabase = createServiceClient();
      const { error: storageError } = await supabase.storage
        .from(icon.bucket)
        .remove([icon.path]);

      if (storageError) {
        console.error('Storage delete error:', storageError);
        // Continue to delete DB record even if storage delete fails
        // (file might already be gone)
      }

      // 3. Delete from database
      await prisma.$executeRaw`
        delete from public."GlobalUnitIcon"
        where id = ${icon.id}
      `;

      console.log(`[Admin:${admin.id}] Deleted icon for ${faction}/${unitName}`);

      return NextResponse.json({ 
        success: true,
        deleted: {
          unitName,
          faction,
          path: icon.path,
        }
      });

    } catch (error: any) {
      console.error('Icon Delete Error:', error);
      return NextResponse.json(
        { error: error.message || 'Failed to delete icon' },
        { status: 500 }
      );
    }
  });
}

