import prisma from '@/lib/prisma';
import { InventoryTransactionType, InventoryAlertType, InventoryAlertStatus } from '@prisma/client';
import { sendEmail } from '@/lib/email';

export interface InventoryAdjustment {
  productId: string;
  quantity: number;
  type: InventoryTransactionType;
  reason?: string;
  notes?: string;
  orderId?: string;
  userId?: string;
}

export interface InventoryCheckResult {
  productId: string;
  currentStock: number;
  lowStockThreshold: number;
  isLowStock: boolean;
  isOutOfStock: boolean;
}

/**
 * Update product stock and record transaction
 *
 * @param productId - Product ID to update
 * @param quantity - Quantity to add (positive) or remove (negative)
 * @param type - Type of inventory transaction
 * @param userId - User ID performing the update (optional)
 * @param reason - Optional reason for the update
 * @param notes - Optional notes about the update
 * @param orderId - Optional order ID if transaction is order-related
 * @returns Updated product with transaction details
 * @throws Error if product not found or stock would go negative
 */
export async function updateStock(
  productId: string,
  quantity: number,
  type: InventoryTransactionType,
  userId?: string,
  reason?: string,
  notes?: string,
  orderId?: string
) {
  return adjustInventory({
    productId,
    quantity,
    type,
    userId,
    reason,
    notes,
    orderId,
  });
}

/**
 * Adjust inventory for a product and create transaction record
 */
export async function adjustInventory(adjustment: InventoryAdjustment) {
  const { productId, quantity, type, reason, notes, orderId, userId } = adjustment;

  // Get current product
  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: {
      id: true,
      name: true,
      sku: true,
      inventory: true,
      lowStockThreshold: true
    },
  });

  if (!product) {
    throw new Error(`Product not found: ${productId}`);
  }

  const previousStock = product.inventory;
  const newStock = previousStock + quantity;

  if (newStock < 0) {
    throw new Error(
      `Insufficient inventory for ${product.name} (SKU: ${product.sku}). ` +
      `Current: ${previousStock}, Requested: ${Math.abs(quantity)}`
    );
  }

  // Update product inventory and create transaction in a single transaction
  const [updatedProduct, transaction] = await prisma.$transaction([
    prisma.product.update({
      where: { id: productId },
      data: { inventory: newStock },
    }),
    prisma.inventoryTransaction.create({
      data: {
        productId,
        type,
        quantity,
        previousStock,
        newStock,
        reason,
        notes,
        orderId,
        userId,
      },
    }),
  ]);

  // Check if we need to create or resolve alerts
  await checkAndUpdateAlerts(productId, newStock, product.lowStockThreshold);

  return {
    product: updatedProduct,
    transaction,
    previousStock,
    newStock,
  };
}

/**
 * Adjust inventory for multiple products (bulk operation)
 */
export async function bulkAdjustInventory(adjustments: InventoryAdjustment[]) {
  const results = [];

  for (const adjustment of adjustments) {
    try {
      const result = await adjustInventory(adjustment);
      results.push({ success: true, ...result });
    } catch (error: any) {
      results.push({
        success: false,
        productId: adjustment.productId,
        error: error.message,
      });
    }
  }

  return results;
}

/**
 * Check inventory levels and create/resolve alerts
 */
async function checkAndUpdateAlerts(
  productId: string,
  currentStock: number,
  lowStockThreshold: number
) {
  const isOutOfStock = currentStock === 0;
  const isLowStock = currentStock > 0 && currentStock <= lowStockThreshold;
  const isStockNormal = currentStock > lowStockThreshold;

  // Get active alerts for this product
  const activeAlerts = await prisma.inventoryAlert.findMany({
    where: {
      productId,
      status: {
        in: [InventoryAlertStatus.ACTIVE, InventoryAlertStatus.ACKNOWLEDGED],
      },
    },
  });

  // If stock is normal, resolve all active alerts
  if (isStockNormal && activeAlerts.length > 0) {
    await prisma.inventoryAlert.updateMany({
      where: {
        productId,
        status: {
          in: [InventoryAlertStatus.ACTIVE, InventoryAlertStatus.ACKNOWLEDGED],
        },
      },
      data: {
        status: InventoryAlertStatus.RESOLVED,
        resolvedAt: new Date(),
        resolutionNotes: 'Stock level returned to normal',
      },
    });
    return;
  }

  // If out of stock, create or update alert
  if (isOutOfStock) {
    const existingOutOfStockAlert = activeAlerts.find(
      (alert) => alert.type === InventoryAlertType.OUT_OF_STOCK
    );

    if (!existingOutOfStockAlert) {
      const alert = await createAlert(
        productId,
        InventoryAlertType.OUT_OF_STOCK,
        currentStock,
        lowStockThreshold
      );
      await notifyLowStock(alert);
    }
    return;
  }

  // If low stock, create or update alert
  if (isLowStock) {
    const existingLowStockAlert = activeAlerts.find(
      (alert) => alert.type === InventoryAlertType.LOW_STOCK
    );

    if (!existingLowStockAlert) {
      const alert = await createAlert(
        productId,
        InventoryAlertType.LOW_STOCK,
        currentStock,
        lowStockThreshold
      );
      await notifyLowStock(alert);
    }
  }
}

/**
 * Check and create alert for low stock detection
 * Prevents duplicate alerts and handles proper status management
 *
 * @param productId - Product ID to check
 * @param currentStock - Current stock level
 * @param lowStockThreshold - Low stock threshold for the product
 * @returns Created alert or null if no alert needed or duplicate exists
 */
export async function checkAndCreateAlert(
  productId: string,
  currentStock: number,
  lowStockThreshold: number
) {
  const isOutOfStock = currentStock === 0;
  const isLowStock = currentStock > 0 && currentStock <= lowStockThreshold;

  // No alert needed if stock is normal
  if (!isOutOfStock && !isLowStock) {
    return null;
  }

  // Determine alert type
  const alertType = isOutOfStock
    ? InventoryAlertType.OUT_OF_STOCK
    : InventoryAlertType.LOW_STOCK;

  // Check for existing active alerts of this type to prevent duplicates
  const existingAlert = await prisma.inventoryAlert.findFirst({
    where: {
      productId,
      type: alertType,
      status: {
        in: [InventoryAlertStatus.ACTIVE, InventoryAlertStatus.ACKNOWLEDGED],
      },
    },
    include: {
      product: {
        select: {
          id: true,
          name: true,
          sku: true,
          inventory: true,
        },
      },
    },
  });

  // Don't create duplicate alert if one already exists
  if (existingAlert) {
    return existingAlert;
  }

  // Create new alert
  const alert = await createAlert(
    productId,
    alertType,
    currentStock,
    lowStockThreshold
  );

  // Send notification for new alert
  await notifyLowStock(alert);

  return alert;
}

/**
 * Create an inventory alert
 */
async function createAlert(
  productId: string,
  type: InventoryAlertType,
  stockLevel: number,
  threshold: number
) {
  return await prisma.inventoryAlert.create({
    data: {
      productId,
      type,
      stockLevel,
      threshold,
      status: InventoryAlertStatus.ACTIVE,
    },
    include: {
      product: {
        select: {
          id: true,
          name: true,
          sku: true,
          inventory: true,
        },
      },
    },
  });
}

/**
 * Send low stock email notification
 */
export async function sendLowStockEmail(
  to: string,
  productName: string,
  productSku: string,
  productId: string,
  stockLevel: number,
  alertType: InventoryAlertType,
  threshold?: number
) {
  const resendApiKey = process.env.RESEND_API_KEY;
  if (!resendApiKey) {
    console.warn('RESEND_API_KEY not set; skipping low stock email');
    return { skipped: true };
  }

  try {
    const subject = alertType === InventoryAlertType.OUT_OF_STOCK
      ? `🚨 OUT OF STOCK: ${productName}`
      : `⚠️ LOW STOCK ALERT: ${productName}`;

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, ${alertType === InventoryAlertType.OUT_OF_STOCK ? '#dc2626 0%, #991b1b 100%' : '#f59e0b 0%, #d97706 100%'}); padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 28px;">
              ${alertType === InventoryAlertType.OUT_OF_STOCK ? '🚨 Out of Stock Alert' : '⚠️ Low Stock Alert'}
            </h1>
          </div>

          <div style="background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
            <p style="font-size: 16px; margin-bottom: 20px;">
              The following product needs immediate attention:
            </p>

            <div style="background: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid ${alertType === InventoryAlertType.OUT_OF_STOCK ? '#dc2626' : '#f59e0b'};">
              <p style="margin: 8px 0; font-size: 14px;">
                <strong style="color: #374151;">Product:</strong>
                <span style="color: #111827;">${productName}</span>
              </p>
              <p style="margin: 8px 0; font-size: 14px;">
                <strong style="color: #374151;">SKU:</strong>
                <span style="color: #111827;">${productSku}</span>
              </p>
              <p style="margin: 8px 0; font-size: 14px;">
                <strong style="color: #374151;">Current Stock:</strong>
                <span style="color: ${alertType === InventoryAlertType.OUT_OF_STOCK ? '#dc2626' : '#f59e0b'}; font-weight: bold; font-size: 18px;">${stockLevel}</span>
              </p>
              ${threshold !== undefined && alertType === InventoryAlertType.LOW_STOCK ? `
              <p style="margin: 8px 0; font-size: 14px;">
                <strong style="color: #374151;">Threshold:</strong>
                <span style="color: #111827;">${threshold}</span>
              </p>
              ` : ''}
            </div>

            <div style="background: ${alertType === InventoryAlertType.OUT_OF_STOCK ? '#fef2f2' : '#fef3c7'}; border-left: 4px solid ${alertType === InventoryAlertType.OUT_OF_STOCK ? '#dc2626' : '#f59e0b'}; padding: 15px; margin: 20px 0; border-radius: 4px;">
              <p style="margin: 0; font-size: 14px; color: ${alertType === InventoryAlertType.OUT_OF_STOCK ? '#991b1b' : '#92400e'};">
                <strong>${alertType === InventoryAlertType.OUT_OF_STOCK ? '🔴 This product is completely out of stock!' : '⚠️ Stock level is below threshold.'}</strong>
              </p>
              <p style="margin: 8px 0 0 0; font-size: 14px; color: ${alertType === InventoryAlertType.OUT_OF_STOCK ? '#991b1b' : '#92400e'};">
                Please restock this product as soon as possible.
              </p>
            </div>

            <div style="text-align: center; margin: 30px 0;">
              <a href="${process.env.NEXTAUTH_URL}/admin/products/${productId}"
                 style="background: #3b82f6; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: 600; font-size: 16px;">
                View Product Details
              </a>
            </div>

            <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">

            <p style="font-size: 12px; color: #9ca3af; text-align: center; margin: 0;">
              Jose Madrid Salsa - Inventory Management<br>
              This is an automated message, please do not reply.
            </p>
          </div>
        </body>
      </html>
    `;

    const res = await sendEmail({
      to,
      subject,
      html,
    });

    return res;
  } catch (e) {
    console.error('Failed to send low stock email', e);
    return { error: true };
  }
}

/**
 * Send low stock notification email
 */
async function notifyLowStock(alert: any) {
  try {
    const { product, type, stockLevel } = alert;

    // Get admin email addresses from environment or database
    const adminEmails = process.env.INVENTORY_ALERT_EMAILS?.split(',') || [];

    if (adminEmails.length === 0) {
      console.warn('No admin emails configured for inventory alerts');
      return;
    }

    // Send email to all admin addresses
    for (const email of adminEmails) {
      await sendLowStockEmail(
        email.trim(),
        product.name,
        product.sku,
        product.id,
        stockLevel,
        type,
        alert.threshold
      );
    }

    // Update alert with notification info
    await prisma.inventoryAlert.update({
      where: { id: alert.id },
      data: {
        notifiedAt: new Date(),
        notifiedTo: adminEmails.map(e => e.trim()),
      },
    });

  } catch (error) {
    console.error('Failed to send low stock notification:', error);
  }
}

/**
 * Get inventory status for a product
 */
export async function getInventoryStatus(productId: string): Promise<InventoryCheckResult> {
  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: {
      id: true,
      inventory: true,
      lowStockThreshold: true,
    },
  });

  if (!product) {
    throw new Error(`Product not found: ${productId}`);
  }

  return {
    productId: product.id,
    currentStock: product.inventory,
    lowStockThreshold: product.lowStockThreshold,
    isLowStock: product.inventory > 0 && product.inventory <= product.lowStockThreshold,
    isOutOfStock: product.inventory === 0,
  };
}

/**
 * Get all low stock products
 */
export async function getLowStockProducts() {
  const products = await prisma.product.findMany({
    where: {
      isActive: true,
      inventory: {
        lte: prisma.product.fields.lowStockThreshold,
      },
    },
    include: {
      category: true,
      inventoryAlerts: {
        where: {
          status: {
            in: [InventoryAlertStatus.ACTIVE, InventoryAlertStatus.ACKNOWLEDGED],
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
        take: 1,
      },
    },
    orderBy: {
      inventory: 'asc',
    },
  });

  return products.map((product) => ({
    ...product,
    isLowStock: product.inventory > 0 && product.inventory <= product.lowStockThreshold,
    isOutOfStock: product.inventory === 0,
  }));
}

/**
 * Get inventory transaction history for a product
 */
export async function getInventoryHistory(productId: string, limit = 50) {
  return await prisma.inventoryTransaction.findMany({
    where: { productId },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });
}

/**
 * Acknowledge an inventory alert
 */
export async function acknowledgeAlert(alertId: string, userId?: string) {
  return await prisma.inventoryAlert.update({
    where: { id: alertId },
    data: {
      status: InventoryAlertStatus.ACKNOWLEDGED,
      updatedAt: new Date(),
    },
  });
}

/**
 * Resolve an inventory alert
 */
export async function resolveAlert(alertId: string, userId?: string, notes?: string) {
  return await prisma.inventoryAlert.update({
    where: { id: alertId },
    data: {
      status: InventoryAlertStatus.RESOLVED,
      resolvedAt: new Date(),
      resolvedBy: userId,
      resolutionNotes: notes,
    },
  });
}

/**
 * Resolve multiple inventory alerts (bulk operation)
 */
export async function resolveAlerts(
  alertIds: string[],
  userId?: string,
  notes?: string
) {
  const results = [];

  for (const alertId of alertIds) {
    try {
      const alert = await resolveAlert(alertId, userId, notes);
      results.push({ success: true, alertId, alert });
    } catch (error: any) {
      results.push({
        success: false,
        alertId,
        error: error.message,
      });
    }
  }

  return results;
}

/**
 * Dismiss an inventory alert
 */
export async function dismissAlert(alertId: string, userId?: string, notes?: string) {
  return await prisma.inventoryAlert.update({
    where: { id: alertId },
    data: {
      status: InventoryAlertStatus.DISMISSED,
      resolvedAt: new Date(),
      resolvedBy: userId,
      resolutionNotes: notes,
    },
  });
}

/**
 * Create and send restock notification for critical stock levels
 * Calculates recommended restock quantity and urgency level
 *
 * @param productId - Product ID to restock
 * @param productName - Product name
 * @param productSku - Product SKU
 * @param currentStock - Current stock level
 * @param lowStockThreshold - Low stock threshold
 * @param averageDailySales - Average daily sales (optional, for calculating restock quantity)
 * @returns Email send result
 */
export async function createRestockNotification(
  productId: string,
  productName: string,
  productSku: string,
  currentStock: number,
  lowStockThreshold: number,
  averageDailySales?: number
) {
  const resendApiKey = process.env.RESEND_API_KEY;
  if (!resendApiKey) {
    console.warn('RESEND_API_KEY not set; skipping restock notification');
    return { skipped: true };
  }

  try {
    // Calculate recommended restock quantity
    // Base calculation: bring stock to 3x threshold or 30 days of sales (whichever is higher)
    let recommendedRestock = lowStockThreshold * 3;

    if (averageDailySales && averageDailySales > 0) {
      const thirtyDaysStock = Math.ceil(averageDailySales * 30);
      recommendedRestock = Math.max(recommendedRestock, thirtyDaysStock);
    }

    // Adjust for current stock - we need to add enough to reach the recommended level
    const restockQuantity = Math.max(0, recommendedRestock - currentStock);

    // Determine urgency level
    let urgency: 'critical' | 'high' | 'medium';
    let urgencyColor: string;
    let urgencyIcon: string;
    let urgencyText: string;

    if (currentStock === 0) {
      urgency = 'critical';
      urgencyColor = '#dc2626';
      urgencyIcon = '🔴';
      urgencyText = 'CRITICAL - Out of Stock';
    } else if (currentStock <= lowStockThreshold * 0.5) {
      urgency = 'high';
      urgencyColor = '#f59e0b';
      urgencyIcon = '🟠';
      urgencyText = 'HIGH - Critically Low Stock';
    } else {
      urgency = 'medium';
      urgencyColor = '#eab308';
      urgencyIcon = '🟡';
      urgencyText = 'MEDIUM - Low Stock';
    }

    // Days of stock remaining (if we have sales data)
    let daysRemaining = '';
    if (averageDailySales && averageDailySales > 0 && currentStock > 0) {
      const days = Math.floor(currentStock / averageDailySales);
      daysRemaining = `
        <p style="margin: 8px 0; font-size: 14px;">
          <strong style="color: #374151;">Days of Stock Remaining:</strong>
          <span style="color: ${days <= 7 ? '#dc2626' : '#111827'}; font-weight: ${days <= 7 ? 'bold' : 'normal'};">${days} days</span>
        </p>
      `;
    }

    const subject = `${urgencyIcon} RESTOCK NEEDED (${urgency.toUpperCase()}): ${productName}`;

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, ${urgencyColor} 0%, ${urgency === 'critical' ? '#991b1b' : urgency === 'high' ? '#d97706' : '#ca8a04'} 100%); padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 28px;">
              ${urgencyIcon} Restock Required
            </h1>
            <p style="color: rgba(255,255,255,0.95); margin: 10px 0 0 0; font-size: 14px; font-weight: 600;">
              Urgency Level: ${urgencyText}
            </p>
          </div>

          <div style="background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
            <p style="font-size: 16px; margin-bottom: 20px;">
              The following product requires restocking:
            </p>

            <div style="background: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid ${urgencyColor};">
              <p style="margin: 8px 0; font-size: 14px;">
                <strong style="color: #374151;">Product:</strong>
                <span style="color: #111827;">${productName}</span>
              </p>
              <p style="margin: 8px 0; font-size: 14px;">
                <strong style="color: #374151;">SKU:</strong>
                <span style="color: #111827;">${productSku}</span>
              </p>
              <p style="margin: 8px 0; font-size: 14px;">
                <strong style="color: #374151;">Current Stock:</strong>
                <span style="color: ${urgencyColor}; font-weight: bold; font-size: 18px;">${currentStock}</span>
              </p>
              <p style="margin: 8px 0; font-size: 14px;">
                <strong style="color: #374151;">Low Stock Threshold:</strong>
                <span style="color: #111827;">${lowStockThreshold}</span>
              </p>
              ${daysRemaining}
            </div>

            <div style="background: #ecfdf5; border-left: 4px solid #10b981; padding: 20px; margin: 20px 0; border-radius: 4px;">
              <p style="margin: 0 0 10px 0; font-size: 16px; color: #047857; font-weight: 600;">
                📦 Recommended Restock Quantity
              </p>
              <p style="margin: 0; font-size: 28px; color: #059669; font-weight: bold;">
                ${restockQuantity} units
              </p>
              <p style="margin: 10px 0 0 0; font-size: 13px; color: #065f46;">
                This will bring stock to approximately ${recommendedRestock} units
                ${averageDailySales && averageDailySales > 0 ? `(~${Math.ceil(recommendedRestock / averageDailySales)} days of inventory)` : '(3x threshold)'}
              </p>
            </div>

            <div style="background: ${urgency === 'critical' ? '#fef2f2' : urgency === 'high' ? '#fef3c7' : '#fefce8'}; border-left: 4px solid ${urgencyColor}; padding: 15px; margin: 20px 0; border-radius: 4px;">
              <p style="margin: 0; font-size: 14px; color: ${urgency === 'critical' ? '#991b1b' : urgency === 'high' ? '#92400e' : '#854d0e'};">
                <strong>${urgencyIcon} ${urgency === 'critical' ? 'This product is out of stock and should be restocked immediately!' : urgency === 'high' ? 'Stock level is critically low. Immediate action recommended.' : 'Stock level is below threshold. Please plan for restocking soon.'}</strong>
              </p>
            </div>

            <div style="text-align: center; margin: 30px 0;">
              <a href="${process.env.NEXTAUTH_URL}/admin/products/${productId}"
                 style="background: #3b82f6; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: 600; font-size: 16px;">
                View Product & Restock
              </a>
            </div>

            <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">

            <p style="font-size: 12px; color: #9ca3af; text-align: center; margin: 0;">
              Jose Madrid Salsa - Inventory Management<br>
              This is an automated message, please do not reply.
            </p>
          </div>
        </body>
      </html>
    `;

    // Get admin email addresses from environment or database
    const adminEmails = process.env.INVENTORY_ALERT_EMAILS?.split(',') || [];

    if (adminEmails.length === 0) {
      console.warn('No admin emails configured for restock notifications');
      return { skipped: true, reason: 'No admin emails configured' };
    }

    // Send email to all admin addresses
    const results = [];
    for (const email of adminEmails) {
      const res = await sendEmail({
        to: email.trim(),
        subject,
        html,
      });
      results.push(res);
    }

    return {
      success: true,
      urgency,
      restockQuantity,
      recommendedStock: recommendedRestock,
      emailsSent: adminEmails.length,
      results,
    };
  } catch (e) {
    console.error('Failed to send restock notification', e);
    return { error: true };
  }
}
