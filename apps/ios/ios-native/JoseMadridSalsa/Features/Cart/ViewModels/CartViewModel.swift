import Foundation

@MainActor
final class CartViewModel: ObservableObject {
    @Published private(set) var items: [CartItem] = []
    @Published private(set) var isLoading = false
    @Published private(set) var errorMessage: String?

    private let cartService = CartService()

    var itemCount: Int {
        items.reduce(0) { $0 + $1.quantity }
    }

    var subtotal: Double {
        items.reduce(0) { $0 + $1.lineTotal }
    }

    func loadCart() async {
        isLoading = true
        errorMessage = nil

        do {
            let response = try await cartService.fetchCart()
            items = response.items
        } catch {
            errorMessage = error.localizedDescription
        }

        isLoading = false
    }

    func addItem(productId: String, quantity: Int = 1) async {
        do {
            let newItem = try await cartService.addToCart(productId: productId, quantity: quantity)
            if let index = items.firstIndex(where: { $0.productId == productId }) {
                items[index] = newItem
            } else {
                items.append(newItem)
            }
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func updateQuantity(itemId: String, quantity: Int) async {
        guard quantity > 0 else {
            await removeItem(itemId: itemId)
            return
        }

        do {
            let updated = try await cartService.updateCartItem(id: itemId, quantity: quantity)
            if let index = items.firstIndex(where: { $0.id == itemId }) {
                items[index] = updated
            }
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func removeItem(itemId: String) async {
        do {
            _ = try await cartService.removeCartItem(id: itemId)
            items.removeAll { $0.id == itemId }
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}
