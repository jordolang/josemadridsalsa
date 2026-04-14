import AuthenticationServices
import Foundation

final class PayPalPaymentHandler: PaymentHandler {
    private let paymentService = PaymentService.shared

    func handle(
        response: CreatePaymentResponse,
        from viewController: UIViewController
    ) async throws {
        guard let approvalURLString = response.approvalUrl,
              let approvalURL = URL(string: approvalURLString) else {
            throw PaymentError.missingApprovalURL
        }

        let callbackURL = try await openApprovalFlow(
            url: approvalURL,
            from: viewController
        )

        let paypalOrderId = try extractPayPalOrderId(from: callbackURL)

        try await paymentService.capturePayPalOrder(paypalOrderId: paypalOrderId)
    }

    // MARK: - Web Authentication

    @MainActor
    private func openApprovalFlow(
        url: URL,
        from viewController: UIViewController
    ) async throws -> URL {
        try await withCheckedThrowingContinuation { continuation in
            let session = ASWebAuthenticationSession(
                url: url,
                callback: .customScheme("josemadridsalsa-paypal")
            ) { callbackURL, error in
                if let error {
                    let nsError = error as NSError
                    if nsError.code == ASWebAuthenticationSessionError.canceledLogin.rawValue {
                        continuation.resume(throwing: PaymentError.cancelled)
                    } else {
                        continuation.resume(
                            throwing: PaymentError.confirmationFailed(error.localizedDescription)
                        )
                    }
                    return
                }
                guard let callbackURL else {
                    continuation.resume(throwing: PaymentError.invalidResponse)
                    return
                }
                continuation.resume(returning: callbackURL)
            }
            session.prefersEphemeralWebBrowserSession = true
            session.presentationContextProvider = viewController as? ASWebAuthenticationPresentationContextProviding
            session.start()
        }
    }

    // MARK: - URL Parsing

    private func extractPayPalOrderId(from url: URL) throws -> String {
        guard let components = URLComponents(url: url, resolvingAgainstBaseURL: false),
              let token = components.queryItems?.first(where: { $0.name == "token" })?.value else {
            throw PaymentError.invalidResponse
        }
        return token
    }
}
