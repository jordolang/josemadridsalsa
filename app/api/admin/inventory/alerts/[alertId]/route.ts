import { NextRequest } from 'next/server';
import { requirePermission } from '@/lib/rbac';
import { ok, fail } from '@/lib/api';
import { logAudit } from '@/lib/audit';
import {
  acknowledgeAlert,
  resolveAlert,
  dismissAlert,
} from '@/lib/inventory-manager';

/**
 * PATCH /api/admin/inventory/alerts/[alertId]
 * Update alert status (acknowledge, resolve, dismiss)
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ alertId: string }> }
) {
  try {
    const user = await requirePermission('products:write');
    const { alertId } = await params;

    const body = await req.json();
    const { action, notes } = body;

    if (!action || !['acknowledge', 'resolve', 'dismiss'].includes(action)) {
      return fail('action must be one of: acknowledge, resolve, dismiss', 400);
    }

    let alert;

    switch (action) {
      case 'acknowledge':
        alert = await acknowledgeAlert(alertId, user.id);
        break;
      case 'resolve':
        alert = await resolveAlert(alertId, user.id, notes);
        break;
      case 'dismiss':
        alert = await dismissAlert(alertId, user.id, notes);
        break;
    }

    await logAudit({
      userId: user.id,
      action: `inventory.alert_${action}`,
      entityType: 'inventoryAlert',
      entityId: alertId,
      changes: { action, notes },
    });

    return ok({
      message: `Alert ${action}d successfully`,
      alert,
    });
  } catch (error: any) {
    console.error('Error updating alert:', error);
    return fail(error.message, error.status || 500);
  }
}
