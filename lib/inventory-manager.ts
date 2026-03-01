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

export interface InventoryReservation {
  productId: string;
  quantity: number;
  orderId?: string;
  userId?: string;
  notes?: string;
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
 * Reserve inventory for a product (e.g., during checkout)
 * Uses Serializable transaction isolation to prevent race conditions
 */
export async function reserveInventory(reservation: InventoryReservation) {
  const { productId, quantity, orderId, userId, notes } = reservation;

  if (quantity <= 0) {
    throw new Error('Reservation quantity must be positive');
  }

  // Use Serializable isolation level to prevent race conditions
  const result = await prisma.$transaction(
    async (tx) => {
      // Get current product with lock
      const product = await tx.product.findUnique({
        where: { id: productId },
        select: {
          id: true,
          name: true,
          sku: true,
          inventory: true,
          stockReserved: true,
          lowStockThreshold: true,
        },
      });

      if (!product) {
        throw new Error(`Product not found: ${productId}`);
      }

      const currentReserved = product.stockReserved;
      const availableStock = product.inventory - currentReserved;

      // Validate sufficient available stock
      if (availableStock < quantity) {
        throw new Error(
          `Insufficient available inventory for ${product.name} (SKU: ${product.sku}). ` +
          `Available: ${availableStock}, Requested: ${quantity}`
        );
      }

      const newReserved = currentReserved + quantity;

      // Update product's reserved stock
      const updatedProduct = await tx.product.update({
        where: { id: productId },
        data: { stockReserved: newReserved },
      });

      // Create inventory transaction record
      // Note: Using ADJUSTMENT type until RESERVATION type is added to schema
      const transaction = await tx.inventoryTransaction.create({
        data: {
          productId,
          type: InventoryTransactionType.ADJUSTMENT,
          quantity,
          previousStock: product.inventory,
          newStock: product.inventory, // Inventory doesn't change, only reserved
          reason: 'RESERVATION',
          notes: notes || `Reserved ${quantity} units${orderId ? ` for order ${orderId}` : ''}`,
          orderId,
          userId,
        },
      });

      return {
        product: updatedProduct,
        transaction,
        previousReserved: currentReserved,
        newReserved,
        availableStock: product.inventory - newReserved,
      };
    },
    {
      isolationLevel: 'Serializable',
    }
  );

  return result;
}

/**
 * Reserve inventory for multiple products (bulk operation)
 */
export async function reserveMultipleProducts(reservations: InventoryReservation[]) {
  const results = [];

  for (const reservation of reservations) {
    try {
      const result = await reserveInventory(reservation);
      results.push({ success: true, ...result });
    } catch (error: any) {
      results.push({
        success: false,
        productId: reservation.productId,
        error: error.message,
      });
    }
  }

  return results;
}

/**
 * Release previously reserved inventory for a product (e.g., after order cancellation)
 * Uses Serializable transaction isolation to prevent race conditions
 */
export async function releaseInventory(reservation: InventoryReservation) {
  const { productId, quantity, orderId, userId, notes } = reservation;

  if (quantity <= 0) {
    throw new Error('Release quantity must be positive');
  }

  // Use Serializable isolation level to prevent race conditions
  const result = await prisma.$transaction(
    async (tx) => {
      // Get current product with lock
      const product = await tx.product.findUnique({
        where: { id: productId },
        select: {
          id: true,
          name: true,
          sku: true,
          inventory: true,
          stockReserved: true,
          lowStockThreshold: true,
        },
      });

      if (!product) {
        throw new Error(`Product not found: ${productId}`);
      }

      const currentReserved = product.stockReserved;

      // Validate sufficient reserved stock to release
      if (currentReserved < quantity) {
        throw new Error(
          `Cannot release more than reserved for ${product.name} (SKU: ${product.sku}). ` +
          `Reserved: ${currentReserved}, Requested: ${quantity}`
        );
      }

      const newReserved = currentReserved - quantity;

      // Update product's reserved stock
      const updatedProduct = await tx.product.update({
        where: { id: productId },
        data: { stockReserved: newReserved },
      });

      // Create inventory transaction record
      // Note: Using ADJUSTMENT type until RELEASE type is added to schema
      const transaction = await tx.inventoryTransaction.create({
        data: {
          productId,
          type: InventoryTransactionType.ADJUSTMENT,
          quantity: -quantity, // Negative to indicate release
          previousStock: product.inventory,
          newStock: product.inventory, // Inventory doesn't change, only reserved
          reason: 'RELEASE',
          notes: notes || `Released ${quantity} units${orderId ? ` for order ${orderId}` : ''}`,
          orderId,
          userId,
        },
      });

      return {
        product: updatedProduct,
        transaction,
        previousReserved: currentReserved,
        newReserved,
        availableStock: product.inventory - newReserved,
      };
    },
    {
      isolationLevel: 'Serializable',
    }
  );

  return result;
}

/**
 * Deduct reserved inventory when order is completed
 * Decreases both stockReserved and actual inventory
 * Uses Serializable transaction isolation to prevent race conditions
 */
export async function deductReservedInventory(reservation: InventoryReservation) {
  const { productId, quantity, orderId, userId, notes } = reservation;

  if (quantity <= 0) {
    throw new Error('Deduction quantity must be positive');
  }

  // Use Serializable isolation level to prevent race conditions
  const result = await prisma.$transaction(
    async (tx) => {
      // Get current product with lock
      const product = await tx.product.findUnique({
        where: { id: productId },
        select: {
          id: true,
          name: true,
          sku: true,
          inventory: true,
          stockReserved: true,
          lowStockThreshold: true,
        },
      });

      if (!product) {
        throw new Error(`Product not found: ${productId}`);
      }

      const currentReserved = product.stockReserved;
      const currentInventory = product.inventory;

      // Validate sufficient reserved stock to deduct
      if (currentReserved < quantity) {
        throw new Error(
          `Cannot deduct more than reserved for ${product.name} (SKU: ${product.sku}). ` +
          `Reserved: ${currentReserved}, Requested: ${quantity}`
        );
      }

      // Validate sufficient inventory to deduct
      if (currentInventory < quantity) {
        throw new Error(
          `Insufficient inventory for ${product.name} (SKU: ${product.sku}). ` +
          `Current: ${currentInventory}, Requested: ${quantity}`
        );
      }

      const newReserved = currentReserved - quantity;
      const newInventory = currentInventory - quantity;

      // Update product's reserved stock and inventory
      const updatedProduct = await tx.product.update({
        where: { id: productId },
        data: {
          stockReserved: newReserved,
          inventory: newInventory,
        },
      });

      // Create inventory transaction record
      const transaction = await tx.inventoryTransaction.create({
        data: {
          productId,
          type: InventoryTransactionType.SALE,
          quantity: -quantity, // Negative to indicate deduction
          previousStock: currentInventory,
          newStock: newInventory,
          reason: 'ORDER_COMPLETION',
          notes: notes || `Deducted ${quantity} units${orderId ? ` for order ${orderId}` : ''}`,
          orderId,
          userId,
        },
      });

      return {
        product: updatedProduct,
        transaction,
        previousInventory: currentInventory,
        newInventory,
        previousReserved: currentReserved,
        newReserved,
        availableStock: newInventory - newReserved,
      };
    },
    {
      isolationLevel: 'Serializable',
    }
  );

  // Check if we need to create alerts after deduction
  await checkAndUpdateAlerts(productId, result.newInventory, result.product.lowStockThreshold);

  return result;
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

    const subject = type === InventoryAlertType.OUT_OF_STOCK
      ? `🚨 OUT OF STOCK: ${product.name}`
      : `⚠️ LOW STOCK ALERT: ${product.name}`;

    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: ${type === InventoryAlertType.OUT_OF_STOCK ? '#dc2626' : '#f59e0b'};">
          ${type === InventoryAlertType.OUT_OF_STOCK ? 'Out of Stock Alert' : 'Low Stock Alert'}
        </h2>
        <p>The following product needs attention:</p>
        <div style="background: #f3f4f6; padding: 16px; border-radius: 8px; margin: 16px 0;">
          <p><strong>Product:</strong> ${product.name}</p>
          <p><strong>SKU:</strong> ${product.sku}</p>
          <p><strong>Current Stock:</strong> <span style="color: ${type === InventoryAlertType.OUT_OF_STOCK ? '#dc2626' : '#f59e0b'}; font-weight: bold;">${stockLevel}</span></p>
          ${type === InventoryAlertType.LOW_STOCK ? `<p><strong>Threshold:</strong> ${alert.threshold}</p>` : ''}
        </div>
        <p>Please restock this product as soon as possible.</p>
        <a href="${process.env.NEXTAUTH_URL}/admin/products/${product.id}"
           style="display: inline-block; background: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin-top: 16px;">
          View Product
        </a>
      </div>
    `;

    // Send email to all admin addresses
    for (const email of adminEmails) {
      await sendEmail({
        to: email.trim(),
        subject,
        html: htmlContent,
      });
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
