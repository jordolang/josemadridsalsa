import Foundation

/// Account API service.
/// NOTE: `/api/account` and `/api/account/addresses` do not exist yet on the backend.
/// These methods are stubbed for when the endpoints are built. Currently only
/// `/api/account/payment-methods` exists.
struct AccountService: Sendable {
    private let client = APIClient.shared

    // TODO: Backend endpoint /api/account does not exist yet — implement server-side first
    func fetchProfile() async throws -> User {
        try await client.request("/account")
    }

    // TODO: Backend endpoint /api/account (PUT) does not exist yet
    func updateProfile(name: String?, phone: String?) async throws -> User {
        var params: [String: Any] = [:]
        if let name { params["name"] = name }
        if let phone { params["phone"] = phone }
        return try await client.request("/account", method: .put, parameters: params)
    }

    // TODO: Backend endpoint /api/account/addresses does not exist yet
    func fetchAddresses() async throws -> [Address] {
        try await client.request("/account/addresses")
    }

    // TODO: Backend endpoint /api/account/addresses (POST) does not exist yet
    func addAddress(_ address: [String: Any]) async throws -> Address {
        try await client.request("/account/addresses", method: .post, parameters: address)
    }
}
