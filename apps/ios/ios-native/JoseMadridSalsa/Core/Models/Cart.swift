import Foundation

struct CartItem: Codable, Identifiable, Sendable {
    let id: String
    let productId: String
    let quantity: Int
    let product: Product?

    var lineTotal: Double {
        guard let product else { return 0 }
        return product.price * Double(quantity)
    }
}
