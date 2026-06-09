import Foundation
import PassKit
@preconcurrency import StripePaymentSheet

protocol PaymentHandler: Sendable {
    func handle(
        response: CreatePaymentResponse,
        from viewController: UIViewController
    ) async throws
}

final class StripePaymentHandler: PaymentHandler {
    private let merchantDisplayName = "Jose Madrid Salsa"
    private let merchantId = "merchant.com.josemadridsalsa"

    func handle(
        response: CreatePaymentResponse,
        from viewController: UIViewController
    ) async throws {
        guard let clientSecret = response.clientSecret else {
            throw PaymentError.missingClientSecret
        }

        var configuration = PaymentSheet.Configuration()
        configuration.merchantDisplayName = merchantDisplayName
        configuration.allowsDelayedPaymentMethods = false

        // Apple Pay configuration
        configuration.applePay = .init(
            merchantId: merchantId,
            merchantCountryCode: "US"
        )

        let paymentSheet = PaymentSheet(
            paymentIntentClientSecret: clientSecret,
            configuration: configuration
        )

        let result = try await presentPaymentSheet(
            paymentSheet,
            from: viewController
        )

        switch result {
        case .completed:
            return
        case .canceled:
            throw PaymentError.cancelled
        case .failed(let error):
            throw PaymentError.confirmationFailed(error.localizedDescription)
        }
    }

    /// Presents the Stripe PaymentSheet and returns the result.
    @MainActor
    private func presentPaymentSheet(
        _ paymentSheet: PaymentSheet,
        from viewController: UIViewController
    ) async throws -> PaymentSheetResult {
        try await withCheckedThrowingContinuation { continuation in
            paymentSheet.present(from: viewController) { result in
                continuation.resume(returning: result)
            }
        }
    }
}
