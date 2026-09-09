import prisma from '@/lib/prisma';
import type { Prisma } from '@prisma/client';
import { InventoryTransactionType, InventoryAlertType, InventoryAlertStatus, StockStatus } from '@prisma/client';
import { sendEmail } from '@/lib/email';
import { sendLowStockAlert } from '@/lib/inventory-alerts';
import { emitDomainEvent } from '@/lib/domain-events/emit';
import { notifyOperators } from '@/lib/notifications/dispatch';
import { inventoryAlertSpec } from '@/lib/inventory/alert-notifications';

export interface InventoryAdjustment {
  productId: string;
  quantity: number;
  type: InventoryTransactionType;
  reason?: string;
  notes?: string;
  orderId?: string;
  /** Set when the stock arrived by receiving a purchase order. */
  purchaseOrderId?: string;
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
 * Compute stock status from available quantity and threshold
 */
function computeStockStatus(available: number, lowStockThreshold: number): StockStatus {
  if (available <= 0) return StockStatus.OUT_OF_STOCK;
  if (available <= lowStockThreshold) return StockStatus.LOW_STOCK;
  return StockStatus.IN_STOCK;
}

/**
 * Retry a Prisma serializable transaction up to maxRetries times on P2034
 * (serialization conflict / write conflict).
 */
async function withSerializableRetry<T>(fn: () => Promise<T>, maxRetries = 3): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      if (error?.code === 'P2034' && attempt < maxRetries - 1) {
        lastError = error;
        continue;
      }
      throw error;
    }
  }
  throw lastError;
}

/**
 * Adjust inventory for a product and create transaction record
 */
export async function adjustInventory(adjustment: InventoryAdjustment) {
  const { productId, quantity, type, reason, notes, orderId, purchaseOrderId, userId } = adjustment;

  // Get current product
  const product = await prisma.product.findUnique({
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

  const previousStock = product.inventory;
  const newStock = previousStock + quantity;

  if (newStock < 0) {
    throw new Error(
      `Insufficient inventory for ${product.name} (SKU: ${product.sku}). ` +
      `Current: ${previousStock}, Requested: ${Math.abs(quantity)}`
    );
  }

  // Validate that new inventory doesn't drop below reserved stock
  if (newStock < product.stockReserved) {
    throw new Error(
      `Cannot set inventory below reserved stock for ${product.name} (SKU: ${product.sku}). ` +
      `New inventory: ${newStock}, Reserved: ${product.stockReserved}`
    );
  }

  const newAvailable = newStock - product.stockReserved;
  const newStockStatus = computeStockStatus(newAvailable, product.lowStockThreshold);

  // Update product inventory and create transaction in a single transaction
  const [updatedProduct, transaction] = await prisma.$transaction([
    prisma.product.update({
      where: { id: productId },
      data: { inventory: newStock, stockStatus: newStockStatus },
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
        purchaseOrderId,
        userId,
      },
    }),
  ]);

  // Check if we crossed the low stock threshold (only trigger email on threshold crossing)
  const crossedThreshold = previousStock > product.lowStockThreshold && newStock <= product.lowStockThreshold;

  if (crossedThreshold) {
    try {
      await sendLowStockAlert(productId);
    } catch (alertError) {
      // Don't fail the inventory adjustment if email sending fails
      console.error(`[adjustInventory] Failed to send low stock alert for product ${productId}:`, alertError);
    }
  }

  // Check if we need to create or resolve alerts
  try {
    await checkAndUpdateAlerts(productId, newStock, product.lowStockThreshold);
  } catch (alertError) {
    console.error(`[adjustInventory] Alert sync failed for product ${productId}:`, alertError);
  }

  return {
    product: updatedProduct,
    transaction,
    previousStock,
    newStock,
  };
}

/**
 * Adjust inventory for multiple products (bulk operation).
 * Provides atomic all-or-nothing behavior via a single transaction.
 * After the transaction commits, fires alert checks for all affected products.
 */
export async function bulkAdjustInventory(adjustments: InventoryAdjustment[]) {
  const results = await withSerializableRetry(() =>
    prisma.$transaction(
      async (tx) => bulkAdjustInventoryInTx(adjustments, tx),
      {
        isolationLevel: 'Serializable',
      }
    )
  );

  // Check if we need to create alerts after adjustments (non-critical — adjustments already committed)
  for (const result of results) {
    try {
      await checkAndUpdateAlerts(
        result.product.id,
        result.newStock,
        result.product.lowStockThreshold
      );
    } catch (alertError) {
      console.error(
        `[bulkAdjustInventory] Alert sync failed for product ${result.product.id}:`,
        alertError
      );
    }
  }

  return results;
}

/**
 * Adjust inventory for multiple products within a single transaction.
 * Provides atomic all-or-nothing behavior for bulk adjustments.
 * If any product validation fails, the entire operation rolls back.
 *
 * Does NOT trigger alert checks or emails — the caller is responsible
 * for firing alerts after the enclosing transaction commits.
 */
export async function bulkAdjustInventoryInTx(
  adjustments: InventoryAdjustment[],
  tx: Prisma.TransactionClient
) {
  // Step 1: Fetch all products and validate in a single batch query
  const productIds = adjustments.map(adj => adj.productId);
  const products = await tx.product.findMany({
    where: { id: { in: productIds } },
    select: {
      id: true,
      name: true,
      sku: true,
      inventory: true,
      stockReserved: true,
      lowStockThreshold: true,
    },
  });

  // Create a map for O(1) lookup
  const productMap = new Map(products.map(p => [p.id, p]));

  // Step 2: Validate all adjustments BEFORE making any changes
  const validatedAdjustments = [];
  for (const adjustment of adjustments) {
    const { productId, quantity } = adjustment;
    const product = productMap.get(productId);

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

    if (newStock < product.stockReserved) {
      throw new Error(
        `Cannot set inventory below reserved stock for ${product.name} (SKU: ${product.sku}). ` +
        `New inventory: ${newStock}, Reserved: ${product.stockReserved}`
      );
    }

    const newAvailable = newStock - product.stockReserved;
    const newStockStatus = computeStockStatus(newAvailable, product.lowStockThreshold);

    validatedAdjustments.push({
      adjustment,
      product,
      previousStock,
      newStock,
      newStockStatus,
    });
  }

  // Step 3: If ALL validations pass, update inventory for ALL products atomically
  const results = [];
  for (const { adjustment, product, previousStock, newStock, newStockStatus } of validatedAdjustments) {
    const { productId, quantity, type, reason, notes, orderId, purchaseOrderId, userId } = adjustment;

    // Update product inventory
    const updatedProduct = await tx.product.update({
      where: { id: productId },
      data: { inventory: newStock, stockStatus: newStockStatus },
    });

    // Create inventory transaction record
    const transaction = await tx.inventoryTransaction.create({
      data: {
        productId,
        type,
        quantity,
        previousStock,
        newStock,
        reason,
        notes,
        orderId,
        purchaseOrderId,
        userId,
      },
    });

    results.push({
      product: updatedProduct,
      transaction,
      previousStock,
      newStock,
    });
  }

  return results;
}

/**
 * Reserve inventory for a product (e.g., during checkout)
 * Uses Serializable transaction isolation to prevent race conditions.
 * Retries up to 3 times on serialization conflicts (P2034).
 */
export async function reserveInventory(reservation: InventoryReservation) {
  const { productId, quantity, orderId, userId, notes } = reservation;

  if (quantity <= 0) {
    throw new Error('Reservation quantity must be positive');
  }

  return withSerializableRetry(() =>
    prisma.$transaction(
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
        const newAvailable = product.inventory - newReserved;
        const newStockStatus = computeStockStatus(newAvailable, product.lowStockThreshold);

        // Update product's reserved stock and stockStatus
        const updatedProduct = await tx.product.update({
          where: { id: productId },
          data: { stockReserved: newReserved, stockStatus: newStockStatus },
        });

        // Create inventory transaction record
        const transaction = await tx.inventoryTransaction.create({
          data: {
            productId,
            type: InventoryTransactionType.RESERVATION,
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
          availableStock: newAvailable,
        };
      },
      {
        isolationLevel: 'Serializable',
      }
    )
  );
}

/**
 * Helper function to reserve inventory within an existing transaction.
 * Used by reserveMultipleProducts to enable atomic multi-product reservations.
 */
async function reserveInventorySingleTransaction(
  reservation: InventoryReservation,
  tx: Prisma.TransactionClient
) {
  const { productId, quantity, orderId, userId, notes } = reservation;

  if (quantity <= 0) {
    throw new Error('Reservation quantity must be positive');
  }

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
  const newAvailable = product.inventory - newReserved;
  const newStockStatus = computeStockStatus(newAvailable, product.lowStockThreshold);

  // Update product's reserved stock and stockStatus
  const updatedProduct = await tx.product.update({
    where: { id: productId },
    data: { stockReserved: newReserved, stockStatus: newStockStatus },
  });

  // Create inventory transaction record
  const transaction = await tx.inventoryTransaction.create({
    data: {
      productId,
      type: InventoryTransactionType.RESERVATION,
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
    availableStock: newAvailable,
  };
}

/**
 * Reserve inventory for multiple products (bulk operation).
 * Uses a single Serializable transaction for atomic all-or-nothing behavior.
 * If any product has insufficient stock, the entire reservation fails and rolls back.
 * Retries up to 3 times on serialization conflicts (P2034).
 */
export async function reserveMultipleProducts(reservations: InventoryReservation[]) {
  return withSerializableRetry(() =>
    prisma.$transaction(
      async (tx) => {
        const results = [];

        // Step 1: Validate all products have sufficient stock BEFORE reserving anything
        for (const reservation of reservations) {
          const product = await tx.product.findUnique({
            where: { id: reservation.productId },
            select: {
              id: true,
              name: true,
              sku: true,
              inventory: true,
              stockReserved: true,
            },
          });

          if (!product) {
            throw new Error(`Product not found: ${reservation.productId}`);
          }

          const available = product.inventory - product.stockReserved;
          if (available < reservation.quantity) {
            throw new Error(
              `Insufficient stock for ${product.name} (SKU: ${product.sku}). ` +
              `Available: ${available}, Requested: ${reservation.quantity}`
            );
          }
        }

        // Step 2: If ALL validations pass, reserve inventory for ALL products atomically
        for (const reservation of reservations) {
          const result = await reserveInventorySingleTransaction(reservation, tx);
          results.push({ success: true, ...result });
        }

        return results;
      },
      {
        isolationLevel: 'Serializable',
        maxWait: 5000,
        timeout: 10000,
      }
    )
  );
}

/**
 * Release previously reserved inventory for a product (e.g., after order cancellation).
 * Uses Serializable transaction isolation to prevent race conditions.
 * Retries up to 3 times on serialization conflicts (P2034).
 */
export async function releaseInventory(reservation: InventoryReservation) {
  const { productId, quantity, orderId, userId, notes } = reservation;

  if (quantity <= 0) {
    throw new Error('Release quantity must be positive');
  }

  return withSerializableRetry(() =>
    prisma.$transaction(
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
        const newAvailable = product.inventory - newReserved;
        const newStockStatus = computeStockStatus(newAvailable, product.lowStockThreshold);

        // Update product's reserved stock and stockStatus
        const updatedProduct = await tx.product.update({
          where: { id: productId },
          data: { stockReserved: newReserved, stockStatus: newStockStatus },
        });

        // Create inventory transaction record
        const transaction = await tx.inventoryTransaction.create({
          data: {
            productId,
            type: InventoryTransactionType.RELEASE,
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
          availableStock: newAvailable,
        };
      },
      {
        isolationLevel: 'Serializable',
      }
    )
  );
}

/**
 * Deduct reserved inventory when order is completed.
 * Decreases both stockReserved and actual inventory.
 * Uses Serializable transaction isolation to prevent race conditions.
 * Retries up to 3 times on serialization conflicts (P2034).
 */
export async function deductReservedInventory(reservation: InventoryReservation) {
  const { productId, orderId } = reservation;

  const result = await withSerializableRetry(() =>
    prisma.$transaction(
      async (tx) => deductReservedInventoryInTx(reservation, tx),
      {
        isolationLevel: 'Serializable',
      }
    )
  );

  // Check if we need to create alerts after deduction (non-critical — deduction already committed)
  try {
    await checkAndUpdateAlerts(productId, result.newInventory, result.product.lowStockThreshold);
  } catch (alertError) {
    console.error(
      `[deductReservedInventory] Alert sync failed for product ${productId}` +
      `${orderId ? ` (order ${orderId})` : ''}:`,
      alertError
    );
  }

  return result;
}

/**
 * Deduct reserved inventory within an existing transaction.
 * Used by checkout/complete to keep the order-PAID update and inventory deduction atomic.
 * Does NOT call checkAndUpdateAlerts — the caller is responsible for firing alerts
 * after the enclosing transaction commits.
 */
export async function deductReservedInventoryInTx(
  reservation: InventoryReservation,
  tx: Prisma.TransactionClient
) {
  const { productId, quantity, orderId, userId, notes } = reservation;

  if (quantity <= 0) {
    throw new Error('Deduction quantity must be positive');
  }

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
  const newAvailable = newInventory - newReserved;
  const newStockStatus = computeStockStatus(newAvailable, product.lowStockThreshold);

  // Update product's reserved stock, inventory, and stockStatus
  const updatedProduct = await tx.product.update({
    where: { id: productId },
    data: {
      stockReserved: newReserved,
      inventory: newInventory,
      stockStatus: newStockStatus,
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
    availableStock: newAvailable,
  };
}

/**
 * Idempotent wrapper around {@link deductReservedInventoryInTx}.
 *
 * A paid order can be finalized by two separate code paths — the checkout route
 * and the provider webhook — that each complete the same order. The danger is not
 * the truly-concurrent case (Serializable isolation forces one side to roll back);
 * it is the webhook arriving *after* the route has already committed. In that
 * sequential replay `deductReservedInventoryInTx` would deduct a second time: the
 * reservation for this order is already gone, so it either throws or silently
 * consumes another customer's reservation, overselling the product.
 *
 * This guard makes the deduction idempotent per order item: it skips any item that
 * already has an `ORDER_COMPLETION` transaction for the order. Returns the deduction
 * result, or `null` when the item was already deducted.
 *
 * Must run inside the enclosing (Serializable) transaction so the check-then-deduct
 * is atomic. `orderId` is required — the whole guard keys on it, and Prisma would
 * silently drop an `undefined` `orderId` predicate and match any product's completed
 * deduction, skipping a legitimate one.
 */
export async function deductReservedInventoryOnceInTx(
  reservation: InventoryReservation,
  tx: Prisma.TransactionClient
) {
  const { productId, orderId } = reservation;

  if (!orderId) {
    throw new Error('deductReservedInventoryOnceInTx requires an orderId to guard against double-deduction');
  }

  const existingDeduction = await tx.inventoryTransaction.findFirst({
    where: {
      productId,
      orderId,
      reason: 'ORDER_COMPLETION',
    },
  });

  if (existingDeduction) {
    return null;
  }

  return deductReservedInventoryInTx(reservation, tx);
}

/**
 * Bulk idempotent version of {@link deductReservedInventoryInTx}.
 *
 * Deducts reserved inventory for multiple order items in a single transaction,
 * skipping any items that already have an `ORDER_COMPLETION` transaction.
 * Uses a single batched query to check all existing deductions, avoiding N+1.
 *
 * Returns an array of results in the same order as the input reservations:
 * each element is either the deduction result, or `null` when already deducted.
 *
 * Must run inside the enclosing (Serializable) transaction. All reservations
 * must have an `orderId` — the whole guard keys on it.
 */
export async function bulkDeductReservedInventoryOnceInTx(
  reservations: InventoryReservation[],
  tx: Prisma.TransactionClient
) {
  // Validate all reservations have orderIds
  for (const reservation of reservations) {
    if (!reservation.orderId) {
      throw new Error('bulkDeductReservedInventoryOnceInTx requires an orderId on each reservation to guard against double-deduction');
    }
  }

  // Batch check for existing deductions in a single query
  const existingDeductions = await tx.inventoryTransaction.findMany({
    where: {
      OR: reservations.map(r => ({
        productId: r.productId,
        orderId: r.orderId,
        reason: 'ORDER_COMPLETION',
      })),
    },
    select: {
      productId: true,
      orderId: true,
    },
  });

  // Create a Set of already-deducted product-order pairs for O(1) lookup
  const deductedPairs = new Set(
    existingDeductions.map(d => `${d.productId}:${d.orderId}`)
  );

  // Process each reservation, maintaining input order
  const results = [];
  for (const reservation of reservations) {
    const key = `${reservation.productId}:${reservation.orderId}`;
    if (deductedPairs.has(key)) {
      results.push(null);
    } else {
      const result = await deductReservedInventoryInTx(reservation, tx);
      results.push(result);
    }
  }

  return results;
}

/**
 * Check inventory levels and create/resolve alerts.
 * Exported so callers can fire alerts after a committed transaction.
 */
export async function checkAndUpdateAlerts(
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
      await announceAlert(alert, true, currentStock, lowStockThreshold);
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
      await announceAlert(alert, false, currentStock, lowStockThreshold);
    }
  }
}

/**
 * Record a newly raised alert as a domain fact and put it in front of an operator.
 *
 * Called only where a new alert row is created, so this is edge-triggered: the event marks
 * the moment stock crossed the line, not the ongoing state of being below it. Every failure
 * is swallowed — the stock movement that caused this has already been committed, and losing
 * the announcement must never undo it.
 */
async function announceAlert(
  alert: Awaited<ReturnType<typeof createAlert>>,
  outOfStock: boolean,
  stockLevel: number,
  threshold: number
) {
  try {
    await emitDomainEvent({
      type: outOfStock ? 'inventory.out_of_stock' : 'inventory.low',
      entityType: 'product',
      entityId: alert.productId,
      payload: {
        alertId: alert.id,
        productName: alert.product.name,
        sku: alert.product.sku,
        stockLevel,
        threshold,
      },
    });

    await notifyOperators(
      inventoryAlertSpec({
        productId: alert.productId,
        productName: alert.product.name,
        sku: alert.product.sku,
        stockLevel,
        threshold,
        outOfStock,
      })
    );
  } catch (error) {
    console.warn('[inventory] Could not announce alert for', alert.productId, error);
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
 * Send low stock email notification (exported for testing)
 */
export async function sendLowStockEmail(
  to: string,
  productName: string,
  sku: string,
  productId: string,
  stockLevel: number,
  alertType: string,
  threshold: number
) {
  if (!process.env.RESEND_API_KEY) {
    return { skipped: true };
  }

  try {
    const subject = alertType === 'OUT_OF_STOCK'
      ? `🚨 OUT OF STOCK: ${productName}`
      : `⚠️ LOW STOCK ALERT: ${productName}`;

    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: ${alertType === 'OUT_OF_STOCK' ? '#dc2626' : '#f59e0b'};">
          ${alertType === 'OUT_OF_STOCK' ? 'Out of Stock Alert' : 'Low Stock Alert'}
        </h2>
        <p>The following product needs attention:</p>
        <div style="background: #f3f4f6; padding: 16px; border-radius: 8px; margin: 16px 0;">
          <p><strong>Product:</strong> ${productName}</p>
          <p><strong>SKU:</strong> ${sku}</p>
          <p><strong>Current Stock:</strong> <span style="color: ${alertType === 'OUT_OF_STOCK' ? '#dc2626' : '#f59e0b'}; font-weight: bold;">${stockLevel}</span></p>
          ${alertType === 'LOW_STOCK' ? `<p><strong>Threshold:</strong> ${threshold}</p>` : ''}
        </div>
        <p>Please restock this product as soon as possible.</p>
        <a href="${process.env.NEXTAUTH_URL}/admin/products/${productId}"
           style="display: inline-block; background: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin-top: 16px;">
          View Product
        </a>
      </div>
    `;

    await sendEmail({
      to,
      subject,
      html: htmlContent,
    });

    return { success: true };
  } catch (error) {
    console.error('Failed to send low stock email:', error);
    return { error: true };
  }
}

/**
 * Check and create alert if needed (exported for testing)
 */
export async function checkAndCreateAlert(
  productId: string,
  stockLevel: number,
  threshold: number
) {
  // Don't create alert if stock is above threshold
  if (stockLevel > threshold) {
    return null;
  }

  const alertType = stockLevel === 0
    ? InventoryAlertType.OUT_OF_STOCK
    : InventoryAlertType.LOW_STOCK;

  // Check if active or acknowledged alert already exists
  const existingAlert = await prisma.inventoryAlert.findFirst({
    where: {
      productId,
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

  // Return existing alert if found
  if (existingAlert) {
    return existingAlert;
  }

  // Create new alert
  const alert = await prisma.inventoryAlert.create({
    data: {
      productId,
      type: alertType,
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

  return alert;
}

/**
 * Create restock notification and send emails
 */
export async function createRestockNotification(
  productId: string,
  productName: string,
  sku: string,
  currentStock: number,
  threshold: number,
  avgDailySales?: number
) {
  // Check if API key is configured
  if (!process.env.RESEND_API_KEY) {
    return { skipped: true };
  }

  // Check if admin emails are configured
  const adminEmails = process.env.INVENTORY_ALERT_EMAILS?.split(',').map(e => e.trim()) || [];
  if (adminEmails.length === 0) {
    return { skipped: true, reason: 'No admin emails configured' };
  }

  // Calculate restock quantity: use higher of 30-day sales or 3x threshold
  const recommendedStock = avgDailySales
    ? Math.max(Math.ceil(avgDailySales * 30), threshold * 3)
    : threshold * 3;

  const restockQuantity = Math.max(0, recommendedStock - currentStock);

  // Determine urgency
  let urgency: 'critical' | 'high' | 'medium';
  if (currentStock === 0) {
    urgency = 'critical';
  } else if (currentStock <= threshold * 0.5) {
    urgency = 'high';
  } else {
    urgency = 'medium';
  }

  // Calculate days remaining if we have sales data
  const daysRemaining = avgDailySales && avgDailySales > 0
    ? Math.floor(currentStock / avgDailySales)
    : undefined;

  // Build email content
  const urgencyEmoji = urgency === 'critical' ? '🔴' : urgency === 'high' ? '🟠' : '🟡';
  const urgencyText = urgency === 'critical'
    ? 'CRITICAL - Out of Stock'
    : urgency === 'high'
    ? 'HIGH - Critically Low Stock'
    : 'MEDIUM - Low Stock';

  const subject = `${urgencyEmoji} ${urgency.toUpperCase()} RESTOCK NEEDED: ${productName}`;

  const htmlContent = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: ${urgency === 'critical' ? '#dc2626' : urgency === 'high' ? '#f59e0b' : '#fbbf24'};">
        ${urgencyText}
      </h2>
      <p>The following product needs restocking:</p>
      <div style="background: #f3f4f6; padding: 16px; border-radius: 8px; margin: 16px 0;">
        <p><strong>Product:</strong> ${productName}</p>
        <p><strong>SKU:</strong> ${sku}</p>
        <p><strong>Current Stock:</strong> <span style="color: ${urgency === 'critical' ? '#dc2626' : '#f59e0b'}; font-weight: bold;">${currentStock}</span></p>
        ${daysRemaining !== undefined ? `<p><strong>Days of Stock Remaining:</strong> ${daysRemaining} days</p>` : ''}
        <p><strong>Recommended Restock Quantity:</strong> ${restockQuantity} units</p>
        <p><em>This will bring inventory to approximately ${recommendedStock} units (30 days of sales)</em></p>
      </div>
      <a href="${process.env.NEXTAUTH_URL}/admin/products/${productId}"
         style="display: inline-block; background: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin-top: 16px;">
        View Product & Restock
      </a>
    </div>
  `;

  try {
    // Send emails to all admin addresses
    let emailsSent = 0;
    for (const email of adminEmails) {
      await sendEmail({
        to: email,
        subject,
        html: htmlContent,
      });
      emailsSent++;
    }

    // Create database record
    const notification = await prisma.restockNotification.create({
      data: {
        productId,
        stockLevel: currentStock,
        recommendedQty: restockQuantity,
        sentAt: new Date(),
        sentTo: adminEmails,
      },
    });

    return {
      success: true,
      urgency,
      restockQuantity,
      recommendedStock,
      emailsSent,
      notification,
    };
  } catch (error) {
    console.error('Failed to create restock notification:', error);
    return { error: true };
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

/**
 * Hand an order's inventory reservation back, exactly once.
 *
 * Several paths can be the one that discovers an order will never be paid — the payment
 * confirmation coming back unsuccessful, a provider capture failing, the customer closing
 * the tab and the expire-pending-orders sweep finding it later — and more than one of them
 * can run for the same order. `releaseInventory` is not idempotent: reservations are taken
 * before the order row exists, so the RESERVATION rows carry no `orderId` and there is
 * nothing to compare a second release against. Releasing twice would quietly under-count
 * `Product.stockReserved` and oversell the product.
 *
 * So the claim happens first and in the database: a conditional update on
 * `inventoryReleasedAt` that only matches while the field is still null. Whoever wins the
 * update owns the release; everyone else returns `released: false` and does nothing. The
 * per-item releases run after the claim, and a failure on one item is logged rather than
 * thrown so the remaining items still come back.
 *
 * @returns `released: false` when another path already released this order.
 */
export async function releaseOrderReservation(
  orderId: string,
  notes: string,
): Promise<{ released: boolean; itemsReleased: number; failures: number }> {
  // Claim the release. `count === 0` means the field was already set, so another path
  // got here first and the stock is already back.
  const claim = await prisma.order.updateMany({
    where: { id: orderId, inventoryReleasedAt: null },
    data: { inventoryReleasedAt: new Date() },
  });

  if (claim.count === 0) {
    return { released: false, itemsReleased: 0, failures: 0 };
  }

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { userId: true, items: { select: { productId: true, quantity: true } } },
  });

  if (!order) {
    return { released: true, itemsReleased: 0, failures: 0 };
  }

  const results = await Promise.allSettled(
    order.items.map((item) =>
      releaseInventory({
        productId: item.productId,
        quantity: item.quantity,
        orderId,
        userId: order.userId || undefined,
        notes,
      })
    )
  );

  let failures = 0;
  for (const result of results) {
    if (result.status === 'rejected') {
      failures += 1;
      console.error(`[Inventory] Failed to release reservation for order ${orderId}:`, result.reason);
    }
  }

  return { released: true, itemsReleased: results.length - failures, failures };
}
