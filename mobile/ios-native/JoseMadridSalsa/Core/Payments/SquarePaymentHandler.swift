import Foundation

final class SquarePaymentHandler: PaymentHandler {
    private let paymentService = PaymentService.shared

    func handle(
        response: CreatePaymentResponse,
        from viewController: UIViewController
    ) async throws {
        // Square Mobile Payments SDK requires merchant configuration.
        // The SDK handles card entry UI natively.
        // For now, create the Square order via our API and process via web fallback.
        // Full native integration requires Square Mobile Payments SDK setup
        // with a Square application ID and location ID.

        guard let providerPaymentId = response.clientSecret else {
            // Use providerPaymentId to create Square order
            let squareOrderId = try await paymentService.createSquareOrder(
                orderId: response.providerPaymentId
            )

            // In a full implementation, the Square Mobile Payments SDK
            // would present its card entry form here and return a sourceId (nonce).
            // For now, throw an error indicating Square needs SDK configuration.
            throw PaymentError.squareNotConfigured
        }

        // If we received a clientSecret, Square order was pre-created server-side
        let squareOrderId = try await paymentService.createSquareOrder(
            orderId: response.providerPaymentId
        )

        // Placeholder: Square SDK would provide the nonce from card entry
        throw PaymentError.squareNotConfigured
    }
}
