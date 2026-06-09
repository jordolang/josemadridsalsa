import Foundation

@MainActor
final class ProductDetailViewModel: ObservableObject {
    @Published private(set) var product: Product?
    @Published private(set) var isLoading = false
    @Published private(set) var errorMessage: String?
    @Published var selectedVariant: ProductVariant?
    @Published var quantity = 1

    private let productService = ProductService()
    private let cartService = CartService()

    func loadProduct(id: String) async {
        isLoading = true
        errorMessage = nil

        do {
            product = try await productService.fetchProduct(id: id)
        } catch {
            errorMessage = error.localizedDescription
        }

        isLoading = false
    }

    func addToCart() async -> Bool {
        guard let product else { return false }

        do {
            _ = try await cartService.addToCart(productId: product.id, quantity: quantity)
            return true
        } catch {
            errorMessage = error.localizedDescription
            return false
        }
    }
}
