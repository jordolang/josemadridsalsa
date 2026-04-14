import Foundation

actor PaymentService {
    static let shared = PaymentService()

    private let client = APIClient.shared

    // MARK: - Payment Creation

    func createPayment(
        orderId: String,
        methodType: PaymentMethodType
    ) async throws -> CreatePaymentResponse {
        let request = CreatePaymentRequest(
            orderId: orderId,
            provider: methodType.provider,
            methodType: methodType,
            channel: .mobile
        )

        let params: [String: Any] = [
            "orderId": request.orderId,
            "provider": request.provider.rawValue,
            "methodType": request.methodType.rawValue,
            "channel": request.channel.rawValue,
        ]

        let response: CreatePaymentResponse = try await client.request(
            "/payments/create",
            method: .post,
            parameters: params
        )

        guard response.success else {
            throw PaymentError.creationFailed(response.status)
        }

        return response
    }

    // MARK: - Payment Confirmation

    func confirmPayment(providerPaymentId: String) async throws -> CreatePaymentResponse {
        let response: CreatePaymentResponse = try await client.request(
            "/payments/confirm",
            method: .post,
            parameters: ["providerPaymentId": providerPaymentId]
        )

        guard response.success else {
            throw PaymentError.confirmationFailed(response.status)
        }

        return response
    }

    // MARK: - Saved Payment Methods

    func listSavedPaymentMethods() async throws -> [SavedPaymentMethod] {
        try await client.request("/payments/methods")
    }

    func deleteSavedPaymentMethod(id: String) async throws {
        let _: [String: Bool] = try await client.request(
            "/payments/methods/\(id)",
            method: .delete
        )
    }

    // MARK: - PayPal-Specific Endpoints

    func createPayPalOrder(orderId: String) async throws -> String {
        struct PayPalOrderResponse: Codable, Sendable {
            let approvalUrl: String
        }
        let response: PayPalOrderResponse = try await client.request(
            "/checkout/paypal/create-order",
            method: .post,
            parameters: ["orderId": orderId]
        )
        return response.approvalUrl
    }

    func capturePayPalOrder(paypalOrderId: String) async throws {
        let _: [String: Bool] = try await client.request(
            "/checkout/paypal/capture-order",
            method: .post,
            parameters: ["paypalOrderId": paypalOrderId]
        )
    }

    // MARK: - Square-Specific Endpoints

    func createSquareOrder(orderId: String) async throws -> String {
        struct SquareOrderResponse: Codable, Sendable {
            let squareOrderId: String
        }
        let response: SquareOrderResponse = try await client.request(
            "/checkout/square/create-order",
            method: .post,
            parameters: ["orderId": orderId]
        )
        return response.squareOrderId
    }

    func processSquarePayment(
        squareOrderId: String,
        sourceId: String
    ) async throws {
        let _: [String: Bool] = try await client.request(
            "/checkout/square/process-payment",
            method: .post,
            parameters: [
                "squareOrderId": squareOrderId,
                "sourceId": sourceId,
            ]
        )
    }
}
