import Foundation

/// Backend GET /api/cart returns this shape, not a raw `[CartItem]`.
struct CartResponse: Codable, Sendable {
    let items: [CartItem]
    let itemCount: Int
    let totalQuantity: Int
    let subtotal: Double
}

struct CartService: Sendable {
    private let client = APIClient.shared

    func fetchCart() async throws -> CartResponse {
        try await client.request("/cart")
    }

    func addToCart(productId: String, quantity: Int) async throws -> CartItem {
        try await client.request(
            "/cart",
            method: .post,
            parameters: ["productId": productId, "quantity": quantity]
        )
    }

    func updateCartItem(id: String, quantity: Int) async throws -> CartItem {
        try await client.request(
            "/cart/\(id)",
            method: .put,
            parameters: ["quantity": quantity]
        )
    }

    func removeCartItem(id: String) async throws -> [String: Bool] {
        try await client.request("/cart/\(id)", method: .delete)
    }
}
