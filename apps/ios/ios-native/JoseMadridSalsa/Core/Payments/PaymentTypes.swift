import Foundation

enum PaymentProvider: String, Codable, Sendable {
    case stripe = "STRIPE"
    case square = "SQUARE"
    case paypal = "PAYPAL"
}

enum PaymentMethodType: String, Codable, Sendable {
    case card = "CARD"
    case applePay = "APPLE_PAY"
    case googlePay = "GOOGLE_PAY"
    case paypal = "PAYPAL"
    case venmo = "VENMO"
    case cashApp = "CASH_APP"
    case squareTerminal = "SQUARE_TERMINAL"

    var provider: PaymentProvider {
        switch self {
        case .card, .applePay, .googlePay, .cashApp:
            return .stripe
        case .paypal, .venmo:
            return .paypal
        case .squareTerminal:
            return .square
        }
    }

    var displayName: String {
        switch self {
        case .card: "Credit / Debit Card"
        case .applePay: "Apple Pay"
        case .googlePay: "Google Pay"
        case .paypal: "PayPal"
        case .venmo: "Venmo"
        case .cashApp: "Cash App"
        case .squareTerminal: "Square Terminal"
        }
    }

    var iconName: String {
        switch self {
        case .card: "creditcard.fill"
        case .applePay: "apple.logo"
        case .googlePay: "g.circle.fill"
        case .paypal: "p.circle.fill"
        case .venmo: "v.circle.fill"
        case .cashApp: "dollarsign.circle.fill"
        case .squareTerminal: "square.fill"
        }
    }

    /// Payment methods available on iOS.
    static let availableOnIOS: [PaymentMethodType] = [
        .card, .applePay, .paypal, .venmo, .cashApp,
    ]
}

enum PaymentChannel: String, Codable, Sendable {
    case mobile = "MOBILE"
    case web = "WEB"
    case pos = "POS"
}

struct CreatePaymentRequest: Codable, Sendable {
    let orderId: String
    let provider: PaymentProvider
    let methodType: PaymentMethodType
    let channel: PaymentChannel
}

struct CreatePaymentResponse: Codable, Sendable {
    let success: Bool
    let provider: PaymentProvider
    let providerPaymentId: String
    let clientSecret: String?
    let approvalUrl: String?
    let status: String
}

struct SavedPaymentMethod: Codable, Identifiable, Sendable {
    let id: String
    let type: PaymentMethodType
    let last4: String?
    let brand: String?
    let expiryMonth: Int?
    let expiryYear: Int?
    let isDefault: Bool
}

enum PaymentError: Error, LocalizedError {
    case creationFailed(String)
    case confirmationFailed(String)
    case cancelled
    case invalidResponse
    case providerNotAvailable(PaymentProvider)
    case missingClientSecret
    case missingApprovalURL
    case squareNotConfigured

    var errorDescription: String? {
        switch self {
        case .creationFailed(let message): "Payment failed: \(message)"
        case .confirmationFailed(let message): "Could not confirm payment: \(message)"
        case .cancelled: "Payment was cancelled."
        case .invalidResponse: "Invalid response from payment server."
        case .providerNotAvailable(let provider): "\(provider.rawValue) is not available."
        case .missingClientSecret: "Missing payment session. Please try again."
        case .missingApprovalURL: "Could not get approval URL. Please try again."
        case .squareNotConfigured: "Square payments are not configured."
        }
    }
}
