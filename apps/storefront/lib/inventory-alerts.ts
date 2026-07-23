import prisma from '@/lib/prisma';
import type { InventoryAlert, Product } from '@prisma/client';
import { InventoryAlertType, InventoryAlertStatus, UserRole } from '@prisma/client';
import { sendEmail } from '@/lib/email';
import { render } from '@react-email/render';
import { LowStockAlertEmail } from '@/lib/email/templates/low-stock-alert';
import { fallbackPermissionsFor } from '@/lib/permissions-data';
import { isMissingTableError } from '@/lib/prisma-errors';

interface ProductInfo {
  name: string;
  sku: string;
  currentStock: number;
  threshold: number;
}

interface AlertWithProduct extends InventoryAlert {
  product: Pick<Product, 'id' | 'name' | 'sku' | 'inventory' | 'lowStockThreshold'>;
}

/**
 * Get admin users with inventory:write permission
 */
async function getInventoryAdmins(): Promise<Array<{ id: string; email: string; name: string | null }>> {
  try {
    // Try to query users with inventory:write permission from RBAC
    const usersWithPermission = await prisma.user.findMany({
      where: {
        role: {
          in: [UserRole.ADMIN, UserRole.STAFF, UserRole.DEVELOPER],
        },
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
      },
    });

    // Filter users who have inventory:write permission
    const filteredUsers: Array<{ id: string; email: string; name: string | null }> = [];

    for (const user of usersWithPermission) {
      try {
        // Check if user has permission in database
        const hasPermissionInDb = await prisma.rolePermission.findFirst({
          where: {
            role: user.role,
            permission: {
              name: 'inventory:write',
            },
          },
        });

        if (hasPermissionInDb) {
          filteredUsers.push({
            id: user.id,
            email: user.email,
            name: user.name,
          });
          continue;
        }

        // Fall back to default permissions if DB record doesn't exist
        if (fallbackPermissionsFor(user.role).includes('inventory:write')) {
          filteredUsers.push({
            id: user.id,
            email: user.email,
            name: user.name,
          });
        }
      } catch (error) {
        // If permission check fails for this user, continue to next
        console.error(`[getInventoryAdmins] Error checking permission for user ${user.id}:`, error);
      }
    }

    return filteredUsers;
  } catch (error) {
    if (isMissingTableError(error)) {
      console.warn('[getInventoryAdmins] RBAC tables missing, falling back to ADMIN role users');

      // Fallback: just get all ADMIN users
      const adminUsers = await prisma.user.findMany({
        where: {
          role: UserRole.ADMIN,
        },
        select: {
          id: true,
          email: true,
          name: true,
        },
      });

      return adminUsers;
    }

    console.error('[getInventoryAdmins] Error querying inventory admins:', error);
    throw error;
  }
}

/**
 * Send low stock alert email to admins
 */
export async function sendLowStockAlert(productId: string): Promise<{ success: boolean; error?: string }> {
  try {
    // Get product with inventory info
    const product = await prisma.product.findUnique({
      where: { id: productId },
      select: {
        id: true,
        name: true,
        sku: true,
        inventory: true,
        lowStockThreshold: true,
      },
    });

    if (!product) {
      return {
        success: false,
        error: `Product not found: ${productId}`,
      };
    }

    // Check if product is actually low on stock
    if (product.inventory > product.lowStockThreshold) {
      return {
        success: false,
        error: `Product ${product.name} is not low on stock (current: ${product.inventory}, threshold: ${product.lowStockThreshold})`,
      };
    }

    // Get admin users with inventory:write permission
    const admins = await getInventoryAdmins();

    if (admins.length === 0) {
      console.warn('[sendLowStockAlert] No admin users found with inventory:write permission');
      return {
        success: false,
        error: 'No admin users found to notify',
      };
    }

    // Prepare product info for email template
    const productInfo: ProductInfo = {
      name: product.name,
      sku: product.sku,
      currentStock: product.inventory,
      threshold: product.lowStockThreshold,
    };

    // Get or create alert record
    const alertType = product.inventory === 0
      ? InventoryAlertType.OUT_OF_STOCK
      : InventoryAlertType.LOW_STOCK;

    let alert = await prisma.inventoryAlert.findFirst({
      where: {
        productId,
        type: alertType,
        status: {
          in: [InventoryAlertStatus.ACTIVE, InventoryAlertStatus.ACKNOWLEDGED],
        },
      },
    });

    if (!alert) {
      alert = await prisma.inventoryAlert.create({
        data: {
          productId,
          type: alertType,
          status: InventoryAlertStatus.ACTIVE,
          stockLevel: product.inventory,
          threshold: product.lowStockThreshold,
        },
      });
    }

    // Send email to each admin
    const notifiedEmails: string[] = [];
    const inventoryUrl = `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/admin/inventory`;
    const unsubscribeUrl = `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/unsubscribe`;

    for (const admin of admins) {
      try {
        const emailHtml = await render(
          LowStockAlertEmail({
            recipientName: admin.name || admin.email.split('@')[0],
            products: [productInfo],
            inventoryUrl,
            unsubscribeUrl,
          })
        );

        await sendEmail({
          to: admin.email,
          subject: product.inventory === 0
            ? `🚨 OUT OF STOCK: ${product.name}`
            : `⚠️ LOW STOCK ALERT: ${product.name}`,
          html: emailHtml,
        });

        notifiedEmails.push(admin.email);
      } catch (emailError) {
        console.error(`[sendLowStockAlert] Failed to send email to ${admin.email}:`, emailError);
      }
    }

    // Update alert with notification info
    if (notifiedEmails.length > 0) {
      await prisma.inventoryAlert.update({
        where: { id: alert.id },
        data: {
          notifiedAt: new Date(),
          notifiedTo: notifiedEmails,
        },
      });
    } else {
      // Every admin email send failed — the alert was recorded but nobody was
      // notified. Report failure so callers don't treat this as delivered.
      return {
        success: false,
        error: 'Failed to send low stock alert to any admin',
      };
    }

    return {
      success: true,
    };
  } catch (error) {
    console.error('[sendLowStockAlert] Error sending low stock alert:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Send batch low stock alerts for multiple products
 */
export async function sendBatchLowStockAlerts(productIds: string[]): Promise<{
  success: boolean;
  results: Array<{ productId: string; success: boolean; error?: string }>;
}> {
  const results = [];

  for (const productId of productIds) {
    const result = await sendLowStockAlert(productId);
    results.push({
      productId,
      ...result,
    });
  }

  const allSucceeded = results.every(r => r.success);

  return {
    success: allSucceeded,
    results,
  };
}

/**
 * Send consolidated low stock alert email (all low stock products in one email)
 */
export async function sendConsolidatedLowStockAlert(): Promise<{ success: boolean; error?: string }> {
  try {
    // Get all products and filter those below threshold
    // Note: Prisma doesn't support comparing two columns directly in where clause
    const allProducts = await prisma.product.findMany({
      select: {
        id: true,
        name: true,
        sku: true,
        inventory: true,
        lowStockThreshold: true,
      },
    });

    const lowStockProducts = allProducts.filter(
      p => p.inventory <= p.lowStockThreshold
    );

    if (lowStockProducts.length === 0) {
      return {
        success: true,
      };
    }

    // Get admin users
    const admins = await getInventoryAdmins();

    if (admins.length === 0) {
      console.warn('[sendConsolidatedLowStockAlert] No admin users found');
      return {
        success: false,
        error: 'No admin users found to notify',
      };
    }

    // Prepare product info for email
    const productInfoList: ProductInfo[] = lowStockProducts.map(p => ({
      name: p.name,
      sku: p.sku,
      currentStock: p.inventory,
      threshold: p.lowStockThreshold,
    }));

    // Send consolidated email to each admin
    const inventoryUrl = `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/admin/inventory`;
    const unsubscribeUrl = `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/unsubscribe`;

    for (const admin of admins) {
      try {
        const emailHtml = await render(
          LowStockAlertEmail({
            recipientName: admin.name || admin.email.split('@')[0],
            products: productInfoList,
            inventoryUrl,
            unsubscribeUrl,
          })
        );

        await sendEmail({
          to: admin.email,
          subject: `⚠️ LOW STOCK ALERT: ${productInfoList.length} ${productInfoList.length === 1 ? 'product' : 'products'} need attention`,
          html: emailHtml,
        });
      } catch (emailError) {
        console.error(`[sendConsolidatedLowStockAlert] Failed to send email to ${admin.email}:`, emailError);
      }
    }

    return {
      success: true,
    };
  } catch (error) {
    console.error('[sendConsolidatedLowStockAlert] Error sending consolidated alert:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Check and send alerts for products below threshold
 * (can be called by a cron job or after inventory adjustments)
 */
export async function checkAndNotifyLowStock(): Promise<{
  success: boolean;
  notifiedCount: number;
  error?: string;
}> {
  try {
    // Find products below threshold that don't have recent active alerts
    // Note: Prisma doesn't support comparing two columns directly in where clause
    const allProducts = await prisma.product.findMany({
      select: {
        id: true,
        name: true,
        sku: true,
        inventory: true,
        lowStockThreshold: true,
      },
    });

    const lowStockProducts = allProducts.filter(
      p => p.inventory <= p.lowStockThreshold
    );

    let notifiedCount = 0;

    for (const product of lowStockProducts) {
      // Check if there's already an active alert
      const existingAlert = await prisma.inventoryAlert.findFirst({
        where: {
          productId: product.id,
          status: {
            in: [InventoryAlertStatus.ACTIVE, InventoryAlertStatus.ACKNOWLEDGED],
          },
        },
      });

      // Only send notification if no active alert exists
      if (!existingAlert) {
        const result = await sendLowStockAlert(product.id);
        if (result.success) {
          notifiedCount++;
        }
      }
    }

    return {
      success: true,
      notifiedCount,
    };
  } catch (error) {
    console.error('[checkAndNotifyLowStock] Error checking and notifying:', error);
    return {
      success: false,
      notifiedCount: 0,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
