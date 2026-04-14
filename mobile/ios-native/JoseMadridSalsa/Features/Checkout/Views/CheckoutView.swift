import PassKit
import SwiftUI

struct CheckoutView: View {
    @ObservedObject var viewModel: PaymentViewModel
    @Environment(\.dismiss) private var dismiss
    @State private var showPaymentProcessing = false
    @State private var showOrderConfirmation = false

    var body: some View {
        ScrollView {
            VStack(spacing: 0) {
                headerSection
                VStack(spacing: 16) {
                    orderSummaryCard
                    shippingAddressCard
                    paymentMethodCard
                    orderTotalsCard
                    placeOrderSection
                }
            }
            .padding(.horizontal, 24)
            .padding(.vertical, 32)
        }
        .background(Color(.systemGroupedBackground))
        .navigationTitle("Checkout")
        .navigationBarTitleDisplayMode(.inline)
        .fullScreenCover(isPresented: $showPaymentProcessing) {
            PaymentProcessingView(viewModel: viewModel) {
                showPaymentProcessing = false
                if viewModel.paymentError == nil {
                    showOrderConfirmation = true
                }
            }
        }
        .navigationDestination(isPresented: $showOrderConfirmation) {
            OrderConfirmationView(viewModel: viewModel)
        }
        .task {
            await viewModel.loadSavedMethods()
        }
    }

    // MARK: - Header

    private var headerSection: some View {
        Text("Complete your order")
            .font(.system(size: 28, weight: .bold, design: .serif))
            .foregroundStyle(.primary)
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.bottom, 20)
    }

    // MARK: - Order Summary

    private var orderSummaryCard: some View {
        CheckoutCard(title: "Order Summary") {
            if let items = viewModel.orderItems, !items.isEmpty {
                ForEach(items) { item in
                    HStack(alignment: .top, spacing: 12) {
                        Text("\(item.quantity)x")
                            .font(.subheadline.weight(.semibold))
                            .foregroundStyle(.secondary)
                            .frame(width: 28, alignment: .leading)

                        VStack(alignment: .leading, spacing: 2) {
                            Text(item.product?.name ?? "Item")
                                .font(.subheadline)
                            if let product = item.product, product.isOnSale {
                                Text("On sale")
                                    .font(.caption2)
                                    .foregroundStyle(Color.salsaRed)
                            }
                        }

                        Spacer()

                        Text(item.lineTotal.asCurrency)
                            .font(.subheadline.weight(.medium))
                    }
                    .padding(.vertical, 4)
                }
            } else {
                Text("No items in cart")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            }
        }
    }

    // MARK: - Shipping Address

    private var shippingAddressCard: some View {
        CheckoutCard(title: "Shipping Address") {
            if let address = viewModel.shippingAddress {
                VStack(alignment: .leading, spacing: 4) {
                    Text(address.address1)
                        .font(.subheadline)
                    if let address2 = address.address2, !address2.isEmpty {
                        Text(address2)
                            .font(.subheadline)
                    }
                    Text("\(address.city), \(address.state) \(address.postalCode)")
                        .font(.subheadline)
                    Text(address.country)
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                }
            } else {
                Button {
                    // TODO: Navigate to address entry
                } label: {
                    Label("Add shipping address", systemImage: "plus.circle")
                        .font(.subheadline)
                        .foregroundStyle(Color.salsaRed)
                }
            }
        }
    }

    // MARK: - Payment Method

    private var paymentMethodCard: some View {
        CheckoutCard(title: "Payment Method") {
            PaymentMethodPicker(viewModel: viewModel)
        }
    }

    // MARK: - Totals

    private var orderTotalsCard: some View {
        CheckoutCard(title: "Order Total") {
            VStack(spacing: 8) {
                TotalRow(label: "Subtotal", value: viewModel.subtotal)
                TotalRow(label: "Shipping", value: viewModel.shippingCost)
                TotalRow(label: "Tax", value: viewModel.taxAmount)

                Divider()

                HStack {
                    Text("Total")
                        .font(.headline)
                    Spacer()
                    Text(viewModel.total.asCurrency)
                        .font(.headline)
                        .foregroundStyle(Color.salsaRed)
                }
            }
        }
    }

    // MARK: - Place Order

    private var placeOrderSection: some View {
        VStack(spacing: 12) {
            if viewModel.selectedMethod == .applePay {
                ApplePayButtonView {
                    showPaymentProcessing = true
                    Task { await viewModel.processPayment(orderId: viewModel.currentOrderId) }
                }
                .frame(height: 50)
                .disabled(viewModel.isProcessing || viewModel.shippingAddress == nil)
            } else {
                Button {
                    showPaymentProcessing = true
                    Task { await viewModel.processPayment(orderId: viewModel.currentOrderId) }
                } label: {
                    Group {
                        if viewModel.isProcessing {
                            ProgressView()
                                .tint(.white)
                        } else {
                            Text("Place Order")
                        }
                    }
                    .font(.headline)
                    .foregroundStyle(.white)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 14)
                    .background(
                        viewModel.shippingAddress != nil
                            ? Color.salsaRed
                            : Color.gray
                    )
                    .clipShape(RoundedRectangle(cornerRadius: 12))
                }
                .disabled(viewModel.isProcessing || viewModel.shippingAddress == nil)
            }

            Text("Your payment information is encrypted and secure.")
                .font(.caption2)
                .foregroundStyle(.tertiary)
                .multilineTextAlignment(.center)
        }
        .padding(.top, 8)
    }
}

// MARK: - Checkout Card Container

struct CheckoutCard<Content: View>: View {
    let title: String
    @ViewBuilder let content: Content

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text(title)
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(.secondary)
                .textCase(.uppercase)

            content
        }
        .padding(20)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color(.systemBackground))
        .clipShape(RoundedRectangle(cornerRadius: 16))
        .shadow(color: .black.opacity(0.06), radius: 8, y: 2)
    }
}

// MARK: - Total Row

struct TotalRow: View {
    let label: String
    let value: Double

    var body: some View {
        HStack {
            Text(label)
                .font(.subheadline)
                .foregroundStyle(.secondary)
            Spacer()
            Text(value.asCurrency)
                .font(.subheadline)
        }
    }
}

// MARK: - Apple Pay Button (UIKit wrapper)

struct ApplePayButtonView: UIViewRepresentable {
    let action: () -> Void

    func makeUIView(context: Context) -> PKPaymentButton {
        let button = PKPaymentButton(paymentButtonType: .buy, paymentButtonStyle: .black)
        button.addTarget(context.coordinator, action: #selector(Coordinator.tapped), for: .touchUpInside)
        button.cornerRadius = 12
        return button
    }

    func updateUIView(_ uiView: PKPaymentButton, context: Context) {}

    func makeCoordinator() -> Coordinator {
        Coordinator(action: action)
    }

    final class Coordinator: NSObject {
        let action: () -> Void
        init(action: @escaping () -> Void) { self.action = action }
        @objc func tapped() { action() }
    }
}

// MARK: - Placeholder types for @bob's PaymentViewModel

/// These types define the interface expected from PaymentViewModel.
/// They will be replaced by @bob's actual implementation.

struct CartLineItem: Identifiable {
    let id: String
    let quantity: Int
    let product: Product?

    var lineTotal: Double {
        guard let product else { return 0 }
        return product.price * Double(quantity)
    }
}

// Placeholder — remove once @bob's PaymentViewModel is available
#if false
@MainActor
final class PaymentViewModel: ObservableObject {
    @Published var selectedMethod: PaymentMethodType = .applePay
    @Published var savedMethods: [SavedPaymentMethod] = []
    @Published var isProcessing = false
    @Published var paymentError: String?
    @Published var orderItems: [CartLineItem]?
    @Published var shippingAddress: ShippingAddress?
    @Published var subtotal: Double = 0
    @Published var shippingCost: Double = 0
    @Published var taxAmount: Double = 0
    @Published var total: Double = 0
    @Published var currentOrderId: String = ""
    @Published var confirmedOrder: Order?

    func processPayment(orderId: String) async {}
    func loadSavedMethods() async {}
}
#endif
