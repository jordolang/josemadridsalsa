import Foundation

struct ProductService: Sendable {
    private let client = APIClient.shared

    /// Fetch products with optional filtering. Backend returns a raw `[Product]` array
    /// and uses `skip`/`take` for pagination (not `page`/`limit`).
    func fetchProducts(
        skip: Int = 0,
        take: Int = 20,
        category: String? = nil,
        search: String? = nil,
        heatLevel: String? = nil
    ) async throws -> [Product] {
        var params: [String: Any] = [
            "skip": skip,
            "take": take,
        ]
        if let category { params["categories"] = category }
        if let search { params["search"] = search }
        if let heatLevel { params["heatLevel"] = heatLevel }

        return try await client.request("/products", parameters: params)
    }

    /// Fetch a single product by its CUID. Backend route is `/api/products/[id]`.
    /// Note: There is no public single-product route yet — only admin.
    /// This calls the list endpoint filtered by ID as a workaround until one is added.
    // TODO: Replace with dedicated /api/products/[id] route when available
    func fetchProduct(id: String) async throws -> Product {
        let products: [Product] = try await client.request(
            "/products", parameters: ["search": id, "take": 1]
        )
        guard let product = products.first else {
            throw APIError.notFound
        }
        return product
    }

    func fetchFeaturedProducts() async throws -> [Product] {
        try await client.request("/products/featured")
    }

    /// Fetch products from `/salsas` endpoint. Returns `[Product]`, not `[Category]`.
    func fetchSalsas(heatLevel: String? = nil) async throws -> [Product] {
        var params: [String: Any] = [:]
        if let heatLevel { params["heatLevel"] = heatLevel }
        return try await client.request("/salsas", parameters: params)
    }
}
