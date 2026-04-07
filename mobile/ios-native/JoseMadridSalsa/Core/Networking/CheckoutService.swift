import Foundation

struct CheckoutItem: Codable, Sendable {
    let productId: String
    let quantity: Int
    let price: Double?
    let weight: Double?
}

struct ShippingAddress: Codable, Sendable {
    let address1: String
    let address2: String?
    let city: String
    let state: String
    let postalCode: String
    let country: String
}

struct CheckoutCustomer: Codable, Sendable {
    let email: String
    let firstName: String
    let lastName: String
    let phone: String?
}

struct CheckoutService: Sendable {
    private let client = APIClient.shared

    /// POST /api/checkout/calculate-shipping
    func calculateShipping(
        items: [CheckoutItem],
        address: ShippingAddress
    ) async throws -> [String: Any] {
        let params: [String: Any] = [
            "items": items.map { ["productId": $0.productId, "quantity": $0.quantity] },
            "shippingAddress": [
                "city": address.city,
                "state": address.state,
                "postalCode": address.postalCode,
            ],
        ]
        return try await client.request(
            "/checkout/calculate-shipping",
            method: .post,
            parameters: params
        )
    }

    /// POST /api/checkout/calculate-tax
    func calculateTax(
        items: [CheckoutItem],
        address: ShippingAddress
    ) async throws -> [String: Any] {
        let params: [String: Any] = [
            "items": items.map {
                var item: [String: Any] = [
                    "productId": $0.productId,
                    "quantity": $0.quantity,
                ]
                if let price = $0.price { item["price"] = price }
                if let weight = $0.weight { item["weight"] = weight }
                return item
            },
            "shippingAddress": [
                "address1": address.address1,
                "city": address.city,
                "state": address.state,
                "postalCode": address.postalCode,
                "country": address.country,
            ],
        ]
        return try await client.request(
            "/checkout/calculate-tax",
            method: .post,
            parameters: params
        )
    }

    /// POST /api/checkout — creates the order
    func checkout(
        items: [CheckoutItem],
        customer: CheckoutCustomer,
        shipping: ShippingAddress,
        shippingMethod: String? = nil,
        discountCode: String? = nil,
        notes: String? = nil,
        referralCode: String? = nil
    ) async throws -> Order {
        var params: [String: Any] = [
            "items": items.map { ["productId": $0.productId, "quantity": $0.quantity] },
            "customer": [
                "email": customer.email,
                "firstName": customer.firstName,
                "lastName": customer.lastName,
            ],
            "shipping": [
                "address1": shipping.address1,
                "city": shipping.city,
                "state": shipping.state,
                "postalCode": shipping.postalCode,
            ],
        ]
        if let shippingMethod { params["shippingMethod"] = shippingMethod }
        if let discountCode { params["discountCode"] = discountCode }
        if let notes { params["notes"] = notes }
        if let referralCode { params["referralCode"] = referralCode }

        return try await client.request("/checkout", method: .post, parameters: params)
    }
}
