import type {
  InventoryAlertType,
  InventoryAlertStatus,
  InventoryTransactionType,
} from '@prisma/client'

/**
 * Request body for updating product inventory
 */
export type InventoryUpdateRequest = {
  productId: string
  quantity: number
  type: InventoryTransactionType
  reason?: string
  notes?: string
  orderId?: string
}

/**
 * Stock adjustment details
 */
export type StockAdjustment = {
  productId: string
  previousStock: number
  newStock: number
  quantity: number
  type: InventoryTransactionType
  userId?: string
  reason?: string
  notes?: string
}

/**
 * Alert configuration for inventory monitoring
 */
export type AlertConfiguration = {
  productId: string
  lowStockThreshold: number
  enableAlerts: boolean
  notificationEmails: string[]
  alertTypes: InventoryAlertType[]
}

/**
 * Restock notification payload
 */
export type RestockNotificationPayload = {
  productId: string
  productName: string
  productSku: string
  stockLevel: number
  threshold: number
  recommendedQty: number
  urgency: 'low' | 'medium' | 'high' | 'critical'
}

/**
 * Inventory statistics response
 */
export type InventoryStatsResponse = {
  totalProducts: number
  lowStockProducts: number
  outOfStockProducts: number
  activeAlerts: number
  recentTransactions: number
  totalInventoryValue: number
}

/**
 * Product inventory details
 */
export type ProductInventory = {
  id: string
  name: string
  sku: string
  inventory: number
  lowStockThreshold: number
  status: 'in-stock' | 'low-stock' | 'out-of-stock'
  hasActiveAlert: boolean
  lastRestockedAt?: string
}

/**
 * Inventory alert details
 */
export type InventoryAlertDetails = {
  id: string
  productId: string
  productName: string
  productSku: string
  type: InventoryAlertType
  status: InventoryAlertStatus
  stockLevel: number
  threshold: number
  notifiedAt?: string
  notifiedTo: string[]
  resolvedAt?: string
  resolvedBy?: string
  resolutionNotes?: string
  createdAt: string
}

/**
 * Inventory transaction record
 */
export type InventoryTransactionRecord = {
  id: string
  productId: string
  productName: string
  productSku: string
  type: InventoryTransactionType
  quantity: number
  previousStock: number
  newStock: number
  reason?: string
  notes?: string
  orderId?: string
  userId?: string
  createdAt: string
}

/**
 * Restock notification record
 */
export type RestockNotificationRecord = {
  id: string
  productId: string
  productName: string
  productSku: string
  stockLevel: number
  recommendedQty: number
  sentAt: string
  sentTo: string[]
}
