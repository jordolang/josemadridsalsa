import Foundation

struct OrderService: Sendable {
    private let client = APIClient.shared

    func fetchOrders() async throws -> [Order] {
        try await client.request("/orders")
    }

    func fetchOrder(id: String) async throws -> Order {
        try await client.request("/orders/\(id)")
    }
}
