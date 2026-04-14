import Foundation
import UIKit

@MainActor
final class PaymentViewModel: ObservableObject {
    @Published private(set) var isProcessing = false
    @Published private(set) var savedMethods: [SavedPaymentMethod] = []
    @Published private(set) var paymentComplete = false
    @Published var selectedMethod: PaymentMethodType = .card
    @Published var paymentError: String?

    // Checkout state — set by the checkout flow before presenting payment
    @Published var currentOrderId: String = ""
    @Published var orderItems: [CartLineItem]?
    @Published var shippingAddress: ShippingAddress?
    @Published var subtotal: Double = 0
    @Published var shippingCost: Double = 0
    @Published var taxAmount: Double = 0
    @Published var total: Double = 0
    @Published private(set) var confirmedOrder: Order?

    private let paymentService = PaymentService.shared
    private let stripeHandler = StripePaymentHandler()
    private let paypalHandler = PayPalPaymentHandler()
    private let squareHandler = SquarePaymentHandler()

    // MARK: - Available Methods

    var availableMethods: [PaymentMethodType] {
        PaymentMethodType.availableOnIOS
    }

    // MARK: - Load Saved Methods

    func loadSavedMethods() async {
        do {
            savedMethods = try await paymentService.listSavedPaymentMethods()
        } catch {
            savedMethods = []
        }
    }

    // MARK: - Process Payment

    func processPayment(orderId: String) async {
        guard !isProcessing else { return }
        isProcessing = true
        paymentError = nil
        paymentComplete = false

        do {
            let response = try await paymentService.createPayment(
                orderId: orderId,
                methodType: selectedMethod
            )

            let handler = handler(for: selectedMethod)
            let viewController = try topViewController()

            try await handler.handle(response: response, from: viewController)

            paymentComplete = true
        } catch let error as PaymentError {
            if case .cancelled = error {
                // User cancelled — not an error to show
            } else {
                paymentError = error.localizedDescription
            }
        } catch {
            paymentError = error.localizedDescription
        }

        isProcessing = false
    }

    // MARK: - Delete Saved Method

    func deleteSavedMethod(_ method: SavedPaymentMethod) async {
        do {
            try await paymentService.deleteSavedPaymentMethod(id: method.id)
            savedMethods = savedMethods.filter { $0.id != method.id }
        } catch {
            paymentError = error.localizedDescription
        }
    }

    // MARK: - Handler Routing

    private func handler(for methodType: PaymentMethodType) -> PaymentHandler {
        switch methodType.provider {
        case .stripe:
            return stripeHandler
        case .paypal:
            return paypalHandler
        case .square:
            return squareHandler
        }
    }

    // MARK: - View Controller Access

    private func topViewController() throws -> UIViewController {
        guard let scene = UIApplication.shared.connectedScenes
            .compactMap({ $0 as? UIWindowScene })
            .first(where: { $0.activationState == .foregroundActive }),
              let rootVC = scene.windows.first(where: { $0.isKeyWindow })?.rootViewController else {
            throw PaymentError.invalidResponse
        }

        var top = rootVC
        while let presented = top.presentedViewController {
            top = presented
        }
        return top
    }
}
