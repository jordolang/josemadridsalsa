import Foundation

@MainActor
final class OrderListViewModel: ObservableObject {
    @Published private(set) var orders: [Order] = []
    @Published private(set) var isLoading = false
    @Published private(set) var errorMessage: String?

    private let orderService = OrderService()

    func loadOrders() async {
        isLoading = true
        errorMessage = nil

        do {
            orders = try await orderService.fetchOrders()
        } catch {
            errorMessage = error.localizedDescription
        }

        isLoading = false
    }
}
