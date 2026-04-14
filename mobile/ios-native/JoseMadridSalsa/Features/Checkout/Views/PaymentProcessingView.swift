import SwiftUI

struct PaymentProcessingView: View {
    @ObservedObject var viewModel: PaymentViewModel
    let onDismiss: () -> Void

    @State private var dotCount = 0
    private let timer = Timer.publish(every: 0.5, on: .main, in: .common).autoconnect()

    var body: some View {
        ZStack {
            Color.black.opacity(0.6)
                .ignoresSafeArea()

            VStack(spacing: 24) {
                if let error = viewModel.paymentError {
                    failureContent(error)
                } else if !viewModel.isProcessing {
                    successContent
                } else {
                    processingContent
                }
            }
            .padding(32)
            .frame(maxWidth: 320)
            .background(Color(.systemBackground))
            .clipShape(RoundedRectangle(cornerRadius: 24))
            .shadow(color: .black.opacity(0.2), radius: 24, y: 8)
        }
    }

    // MARK: - Processing

    private var processingContent: some View {
        VStack(spacing: 20) {
            ProgressView()
                .scaleEffect(1.5)
                .tint(Color.salsaRed)

            Text(processingMessage)
                .font(.headline)
                .multilineTextAlignment(.center)

            Text(animatedDots)
                .font(.subheadline)
                .foregroundStyle(.secondary)
                .onReceive(timer) { _ in
                    dotCount = (dotCount + 1) % 4
                }
        }
        .padding(.vertical, 8)
    }

    private var processingMessage: String {
        switch viewModel.selectedMethod {
        case .applePay: "Processing with Apple Pay"
        case .card: "Processing card payment"
        case .cashApp: "Connecting to Cash App"
        case .venmo: "Redirecting to Venmo"
        case .paypal: "Redirecting to PayPal"
        case .squareTerminal: "Processing with Square"
        case .googlePay: "Processing with Google Pay"
        }
    }

    private var animatedDots: String {
        "Please wait" + String(repeating: ".", count: dotCount)
    }

    // MARK: - Success

    private var successContent: some View {
        VStack(spacing: 16) {
            Image(systemName: "checkmark.circle.fill")
                .font(.system(size: 56))
                .foregroundStyle(.green)

            Text("Payment Successful")
                .font(.headline)

            Text("Your order has been placed.")
                .font(.subheadline)
                .foregroundStyle(.secondary)

            Button {
                onDismiss()
            } label: {
                Text("Continue")
                    .font(.headline)
                    .foregroundStyle(.white)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 14)
                    .background(Color.salsaRed)
                    .clipShape(RoundedRectangle(cornerRadius: 12))
            }
        }
    }

    // MARK: - Failure

    private func failureContent(_ error: String) -> some View {
        VStack(spacing: 16) {
            Image(systemName: "xmark.circle.fill")
                .font(.system(size: 56))
                .foregroundStyle(.red)

            Text("Payment Failed")
                .font(.headline)

            Text(error)
                .font(.subheadline)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)

            VStack(spacing: 10) {
                Button {
                    Task {
                        await viewModel.processPayment(orderId: viewModel.currentOrderId)
                    }
                } label: {
                    Text("Try Again")
                        .font(.headline)
                        .foregroundStyle(.white)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 14)
                        .background(Color.salsaRed)
                        .clipShape(RoundedRectangle(cornerRadius: 12))
                }

                Button("Cancel") {
                    onDismiss()
                }
                .font(.subheadline)
                .foregroundStyle(.secondary)
            }
        }
    }
}
