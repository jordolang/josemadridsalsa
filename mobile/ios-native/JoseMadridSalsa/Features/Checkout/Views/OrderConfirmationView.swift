import SwiftUI

struct OrderConfirmationView: View {
    @ObservedObject var viewModel: PaymentViewModel
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        ScrollView {
            VStack(spacing: 0) {
                headerSection
                VStack(spacing: 16) {
                    confirmationCard
                    paymentDetailCard
                    orderItemsCard
                    deliveryCard
                    continueShoppingButton
                }
            }
            .padding(.horizontal, 24)
            .padding(.vertical, 32)
        }
        .background(Color(.systemGroupedBackground))
        .navigationBarBackButtonHidden(true)
    }

    // MARK: - Header

    private var headerSection: some View {
        VStack(spacing: 16) {
            Image(systemName: "checkmark.seal.fill")
                .font(.system(size: 56))
                .foregroundStyle(Color.salsaRed)

            Text("Order Confirmed!")
                .font(.system(size: 28, weight: .bold, design: .serif))
                .foregroundStyle(.primary)

            Text("Thank you for your order. We'll send you a confirmation email shortly.")
                .font(.subheadline)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
        }
        .padding(.bottom, 24)
    }

    // MARK: - Confirmation Card

    private var confirmationCard: some View {
        CheckoutCard(title: "Order Details") {
            VStack(spacing: 10) {
                if let order = viewModel.confirmedOrder {
                    DetailRow(
                        label: "Order Number",
                        value: order.orderNumber ?? order.id.prefix(8).uppercased().description
                    )
                    DetailRow(label: "Status", value: order.status.rawValue.capitalized)
                    DetailRow(label: "Date", value: formattedDate(order.createdAt))
                }
            }
        }
    }

    // MARK: - Payment Detail

    private var paymentDetailCard: some View {
        CheckoutCard(title: "Payment") {
            VStack(spacing: 10) {
                DetailRow(label: "Method", value: viewModel.selectedMethod.displayName)

                if let order = viewModel.confirmedOrder {
                    DetailRow(label: "Subtotal", value: order.subtotal.asCurrency)
                    DetailRow(label: "Shipping", value: order.shipping.asCurrency)
                    DetailRow(label: "Tax", value: order.tax.asCurrency)

                    Divider()

                    HStack {
                        Text("Total Paid")
                            .font(.subheadline.weight(.semibold))
                        Spacer()
                        Text(order.total.asCurrency)
                            .font(.subheadline.weight(.bold))
                            .foregroundStyle(Color.salsaRed)
                    }
                }
            }
        }
    }

    // MARK: - Order Items

    private var orderItemsCard: some View {
        CheckoutCard(title: "Items Ordered") {
            if let items = viewModel.confirmedOrder?.items, !items.isEmpty {
                ForEach(items) { item in
                    HStack(spacing: 12) {
                        Text("\(item.quantity)x")
                            .font(.subheadline.weight(.semibold))
                            .foregroundStyle(.secondary)
                            .frame(width: 28, alignment: .leading)

                        Text(item.product?.name ?? "Item")
                            .font(.subheadline)

                        Spacer()

                        Text((item.price * Double(item.quantity)).asCurrency)
                            .font(.subheadline.weight(.medium))
                    }
                    .padding(.vertical, 2)
                }
            }
        }
    }

    // MARK: - Delivery

    private var deliveryCard: some View {
        CheckoutCard(title: "Estimated Delivery") {
            HStack(spacing: 12) {
                Image(systemName: "shippingbox.fill")
                    .font(.title3)
                    .foregroundStyle(Color.salsaRed)

                VStack(alignment: .leading, spacing: 4) {
                    Text(estimatedDeliveryRange)
                        .font(.subheadline.weight(.medium))
                    Text("You'll receive tracking info via email once shipped.")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }
        }
    }

    // MARK: - Continue Shopping

    private var continueShoppingButton: some View {
        Button {
            dismiss()
        } label: {
            Text("Continue Shopping")
                .font(.headline)
                .foregroundStyle(.white)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 14)
                .background(Color.salsaRed)
                .clipShape(RoundedRectangle(cornerRadius: 12))
        }
        .padding(.top, 8)
    }

    // MARK: - Helpers

    private var estimatedDeliveryRange: String {
        let formatter = DateFormatter()
        formatter.dateStyle = .medium
        let start = Calendar.current.date(byAdding: .day, value: 5, to: .now) ?? .now
        let end = Calendar.current.date(byAdding: .day, value: 8, to: .now) ?? .now
        return "\(formatter.string(from: start)) - \(formatter.string(from: end))"
    }

    private func formattedDate(_ isoString: String) -> String {
        let isoFormatter = ISO8601DateFormatter()
        isoFormatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        guard let date = isoFormatter.date(from: isoString) else {
            // Try without fractional seconds
            isoFormatter.formatOptions = [.withInternetDateTime]
            guard let date = isoFormatter.date(from: isoString) else {
                return isoString
            }
            return DateFormatter.localizedString(from: date, dateStyle: .medium, timeStyle: .short)
        }
        return DateFormatter.localizedString(from: date, dateStyle: .medium, timeStyle: .short)
    }
}

// MARK: - Detail Row

struct DetailRow: View {
    let label: String
    let value: String

    var body: some View {
        HStack {
            Text(label)
                .font(.subheadline)
                .foregroundStyle(.secondary)
            Spacer()
            Text(value)
                .font(.subheadline.weight(.medium))
        }
    }
}
