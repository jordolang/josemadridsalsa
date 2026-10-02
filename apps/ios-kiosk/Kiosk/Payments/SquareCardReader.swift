import Foundation
import SquareMobilePaymentsSDK
import UIKit
#if canImport(MockReaderUI)
import MockReaderUI
#endif

/// Card payments on a Square Reader paired with this iPad, through Square's Mobile Payments SDK.
///
/// The kiosk page asks for a payment through the `window.JMKiosk` bridge; this takes it on the
/// reader with Square's own payment screen and hands back the Square payment id. The website then
/// confirms that payment with Square itself before it marks the order paid, so nothing this app
/// reports is taken on trust.
///
/// Square only allows this SDK on an attended kiosk: a staff member is present for every sale.
///
/// The SDK signs in with an OAuth access token the website issues to this paired kiosk (its
/// device token proves which kiosk it is). The token never sits in this app's settings.
final class SquareCardReader: NSObject, ObservableObject {
    static let shared = SquareCardReader()

    enum State: Equatable {
        /// No Square application id in the build, or the SDK did not start.
        case unavailable
        case signedOut
        case signingIn
        case ready
        case failed(String)

        var label: String {
            switch self {
            case .unavailable: return "Card payments are not set up in this build"
            case .signedOut: return "Not signed in to Square"
            case .signingIn: return "Signing in to Square…"
            case .ready: return "Ready for cards"
            case let .failed(reason): return reason
            }
        }
    }

    enum PaymentResult {
        case paid(paymentID: String)
        case canceled
        case failed(String)

        /// What the kiosk page receives.
        var json: [String: Any] {
            switch self {
            case let .paid(id): return ["status": "paid", "paymentId": id]
            case .canceled: return ["status": "canceled"]
            case let .failed(reason): return ["status": "failed", "error": reason]
            }
        }
    }

    @Published private(set) var state: State = .unavailable

    private static var started = false
    private var paymentHandle: PaymentHandle?
    private var finishPayment: ((PaymentResult) -> Void)?
    #if canImport(MockReaderUI)
    private var mockReader: MockReaderUI?
    #endif

    /// Call once, from `application(_:didFinishLaunchingWithOptions:)`.
    static func start(launchOptions: [UIApplication.LaunchOptionsKey: Any]?) {
        guard !started,
              let appID = Bundle.main.object(forInfoDictionaryKey: "SquareApplicationID") as? String,
              !appID.isEmpty, !appID.hasPrefix("$(")
        else { return }
        MobilePaymentsSDK.initialize(applicationLaunchOptions: launchOptions, squareApplicationID: appID)
        started = true
        shared.state = .signedOut
    }

    var isSandbox: Bool { Self.started && MobilePaymentsSDK.shared.settingsManager.sdkSettings.environment == .sandbox }

    // MARK: Sign-in

    private struct Authorization: Decodable {
        let accessToken: String
        let locationId: String
    }

    /// Fetch this kiosk's Square token from the website and sign the SDK in with it.
    @MainActor
    func signIn() async {
        guard Self.started else { return }
        let settings = KioskSettings.shared
        guard let origin = settings.origin, let url = URL(string: "\(origin)/api/kiosk/square/authorization"),
              !settings.deviceToken.isEmpty
        else {
            state = .failed("Finish the kiosk setup first")
            return
        }

        state = .signingIn
        do {
            var request = URLRequest(url: url)
            request.setValue("Bearer \(settings.deviceToken)", forHTTPHeaderField: "Authorization")
            request.cachePolicy = .reloadIgnoringLocalCacheData
            let (data, response) = try await URLSession.shared.data(for: request)
            guard let http = response as? HTTPURLResponse else { throw ReaderError("No answer from the website") }
            guard http.statusCode == 200 else {
                let message = (try? JSONSerialization.jsonObject(with: data) as? [String: Any])?["error"] as? String
                throw ReaderError(message ?? "The website refused Square sign-in (\(http.statusCode))")
            }
            let auth = try JSONDecoder().decode(Authorization.self, from: data)

            let manager = MobilePaymentsSDK.shared.authorizationManager
            if manager.state == .authorized {
                // Signed in from a previous launch. A changed location means a fresh sign-in.
                if manager.location?.id == auth.locationId {
                    state = .ready
                    showMockReaderIfSandbox()
                    return
                }
                await withCheckedContinuation { done in manager.deauthorize { done.resume() } }
            }

            let error: Error? = await withCheckedContinuation { done in
                manager.authorize(withAccessToken: auth.accessToken, locationID: auth.locationId) { done.resume(returning: $0) }
            }
            if let error { throw ReaderError(error.localizedDescription) }
            state = .ready
            showMockReaderIfSandbox()
        } catch {
            state = .failed("Square sign-in failed: \(error.localizedDescription)")
        }
    }

    /// Square's floating "simulated reader" button, for testing against a sandbox account only.
    private func showMockReaderIfSandbox() {
        #if canImport(MockReaderUI)
        guard isSandbox, mockReader == nil else { return }
        mockReader = try? MockReaderUI(for: MobilePaymentsSDK.shared)
        try? mockReader?.present()
        #endif
    }

    // MARK: Reader pairing

    /// Square's own reader screen: pair a Square Reader over Bluetooth, see battery and status.
    @MainActor
    func presentReaderSettings(from viewController: UIViewController) async -> String? {
        guard Self.started else { return State.unavailable.label }
        if state != .ready { await signIn() }
        guard state == .ready else { return state.label }
        let error: Error? = await withCheckedContinuation { done in
            MobilePaymentsSDK.shared.settingsManager.presentSettings(with: viewController) { done.resume(returning: $0) }
        }
        return error?.localizedDescription
    }

    // MARK: Payments

    /// Take one card payment on the reader, using Square's payment screen over the kiosk.
    ///
    /// Online only: an offline payment could not be confirmed with Square before the receipt
    /// prints. `referenceID` is the website's order id, which the website checks the payment
    /// against.
    @MainActor
    func takePayment(amountCents: Int, referenceID: String, note: String, from viewController: UIViewController) async -> PaymentResult {
        guard Self.started else { return .failed(State.unavailable.label) }
        guard finishPayment == nil else { return .failed("A payment is already in progress") }
        guard amountCents > 0 else { return .failed("Nothing to charge") }
        if state != .ready { await signIn() }
        guard state == .ready else { return .failed(state.label) }

        let parameters = PaymentParameters(
            paymentAttemptID: UUID().uuidString,
            amountMoney: Money(amount: UInt(amountCents), currency: .USD),
            processingMode: .onlineOnly
        )
        parameters.referenceID = referenceID
        parameters.note = note
        // The kiosk takes cards only: no keyed entry, no cash.
        let prompt = PromptParameters(mode: .default, additionalMethods: AdditionalPaymentMethods())

        return await withCheckedContinuation { done in
            finishPayment = { result in done.resume(returning: result) }
            paymentHandle = MobilePaymentsSDK.shared.paymentManager.startPayment(
                parameters, promptParameters: prompt, from: viewController, delegate: self
            )
            if paymentHandle == nil { complete(.failed("Square could not start the payment")) }
        }
    }

    private func complete(_ result: PaymentResult) {
        let finish = finishPayment
        finishPayment = nil
        paymentHandle = nil
        finish?(result)
    }
}

extension SquareCardReader: PaymentManagerDelegate {
    func paymentManager(_ paymentManager: PaymentManager, didFinish payment: Payment) {
        // onlineOnly never produces an offline payment, but an id is required to confirm it.
        guard let id = payment.id, !id.isEmpty else {
            return complete(.failed("Square did not return a payment id. Check the Square dashboard before charging again."))
        }
        complete(.paid(paymentID: id))
    }

    func paymentManager(_ paymentManager: PaymentManager, didFail payment: Payment, withError error: Error) {
        complete(.failed(error.localizedDescription))
    }

    func paymentManager(_ paymentManager: PaymentManager, didCancel payment: Payment) {
        complete(.canceled)
    }
}

private struct ReaderError: LocalizedError {
    let message: String
    init(_ message: String) { self.message = message }
    var errorDescription: String? { message }
}

extension UIApplication {
    /// The view controller on top, for presenting Square's screens over SwiftUI sheets.
    var topViewController: UIViewController? {
        let root = connectedScenes
            .compactMap { ($0 as? UIWindowScene)?.keyWindow?.rootViewController }
            .first
        var top = root
        while let presented = top?.presentedViewController { top = presented }
        return top
    }
}
