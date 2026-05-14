import { NextRequest } from 'next/server';
import { requirePermission } from '@/lib/rbac';
import { fail } from '@/lib/api';
import { logAudit } from '@/lib/audit';
import prisma from '@/lib/prisma';

function sanitizeCsvCell(v: string): string {
  return /^[=+\-@\t\r]/.test(v) ? `\t${v}` : v;
}

/**
 * GET /api/admin/users/export
 * Export users as CSV
 */
export async function GET(req: NextRequest) {
  try {
    // Verify permissions
    const user = await requirePermission('users:export');

    // Parse query params for filtering
    const { searchParams } = new URL(req.url);
    const search = searchParams.get('search') || '';
    const role = searchParams.get('role') || '';

    // Build where clause (same as list endpoint)
    const where: any = {};

    if (search) {
      where.OR = [
        { email: { contains: search, mode: 'insensitive' } },
        { name: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (role && role !== 'all') {
      where.role = role;
    }

    // Fetch all users matching filters
    const users = await prisma.user.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isEmailVerified: true,
        phone: true,
        createdAt: true,
        lastLoginAt: true,
      },
    });

    // Log audit
    await logAudit({
      userId: user.id,
      action: 'users.export',
      entityType: 'user',
      changes: { count: users.length, filters: { search, role } },
    });

    // Build CSV content
    const headers = [
      'ID',
      'Email',
      'Name',
      'Role',
      'Email Verified',
      'Phone',
      'Created At',
      'Last Login At',
    ];

    const rows = users.map((user) => [
      user.id,
      `"${sanitizeCsvCell(user.email).replace(/"/g, '""')}"`,
      user.name ? `"${sanitizeCsvCell(user.name).replace(/"/g, '""')}"` : '',
      user.role,
      user.isEmailVerified ? 'Yes' : 'No',
      user.phone ? `"${sanitizeCsvCell(user.phone).replace(/"/g, '""')}"` : '',
      user.createdAt.toISOString(),
      user.lastLoginAt?.toISOString() || '',
    ]);

    const csv = [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');

    // Return CSV file
    return new Response(csv, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="users-${new Date().toISOString().split('T')[0]}.csv"`,
      },
    });
  } catch (error: any) {
    console.error('Error exporting users:', error);
    const msg: string = error.message || '';
    const status = error.status
      ? error.status
      : /unauthorized/i.test(msg)
        ? 401
        : /forbidden/i.test(msg)
          ? 403
          : 500;
    return fail(msg, status);
  }
}
