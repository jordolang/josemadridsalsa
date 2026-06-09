import Foundation

enum OrderStatus: String, Codable, Sendable {
    case pending = "PENDING"
    case confirmed = "CONFIRMED"
    case processing = "PROCESSING"
    case shipped = "SHIPPED"
    case delivered = "DELIVERED"
    case cancelled = "CANCELLED"
    case refunded = "REFUNDED"
}

enum PaymentStatus: String, Codable, Sendable {
    case pending = "PENDING"
    case processing = "PROCESSING"
    case succeeded = "SUCCEEDED"
    case paid = "PAID"
    case failed = "FAILED"
    case canceled = "CANCELED"
    case refunded = "REFUNDED"
    case partiallyRefunded = "PARTIALLY_REFUNDED"
}

struct Order: Codable, Identifiable, Sendable {
    let id: String
    let orderNumber: String?
    let status: OrderStatus
    let paymentStatus: PaymentStatus
    let subtotal: Double
    let tax: Double
    let shipping: Double
    let total: Double
    let items: [OrderItem]?
    let createdAt: String
    let updatedAt: String
}

struct OrderItem: Codable, Identifiable, Sendable {
    let id: String
    let productId: String
    let quantity: Int
    let price: Double
    let product: Product?
}
