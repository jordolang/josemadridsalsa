import Foundation

@MainActor
final class ProductListViewModel: ObservableObject {
    @Published private(set) var products: [Product] = []
    @Published private(set) var isLoading = false
    @Published private(set) var errorMessage: String?
    @Published var selectedCategory: String?
    @Published var searchQuery = ""

    private let productService = ProductService()
    private let pageSize = 20
    private var hasMorePages = true

    func loadProducts() async {
        guard !isLoading else { return }
        isLoading = true
        errorMessage = nil

        do {
            let results = try await productService.fetchProducts(
                skip: 0,
                take: pageSize,
                category: selectedCategory,
                search: searchQuery.isEmpty ? nil : searchQuery
            )
            products = results
            hasMorePages = results.count >= pageSize
        } catch {
            errorMessage = error.localizedDescription
        }

        isLoading = false
    }

    func loadMoreProducts() async {
        guard !isLoading, hasMorePages else { return }
        isLoading = true

        do {
            let results = try await productService.fetchProducts(
                skip: products.count,
                take: pageSize,
                category: selectedCategory,
                search: searchQuery.isEmpty ? nil : searchQuery
            )
            products.append(contentsOf: results)
            hasMorePages = results.count >= pageSize
        } catch {
            errorMessage = error.localizedDescription
        }

        isLoading = false
    }
}
