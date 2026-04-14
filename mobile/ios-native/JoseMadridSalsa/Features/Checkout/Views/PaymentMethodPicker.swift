import PassKit
import SwiftUI

// MARK: - Brand Color Extension

extension PaymentMethodType {
    var brandColor: Color {
        switch self {
        case .applePay: .primary
        case .card: Color(.systemGray)
        case .cashApp: Color(red: 0, green: 0.84, blue: 0.2)
        case .venmo: Color(red: 0, green: 0.55, blue: 1)
        case .paypal: Color(red: 0, green: 0.19, blue: 0.53)
        case .googlePay: Color(.systemGray)
        case .squareTerminal: .primary
        }
    }
}

extension SavedPaymentMethod {
    var displayLabel: String {
        "\(brand ?? "Card") ****\(last4 ?? "----")"
    }

    var expiryLabel: String {
        guard let month = expiryMonth, let year = expiryYear else { return "--/--" }
        return String(format: "%02d/%02d", month, year % 100)
    }
}

// MARK: - Payment Method Picker

struct PaymentMethodPicker: View {
    @ObservedObject var viewModel: PaymentViewModel

    var body: some View {
        VStack(spacing: 0) {
            // Apple Pay — prominent placement
            applePayRow

            Divider().padding(.leading, 48)

            // Other methods
            let otherMethods = PaymentMethodType.availableOnIOS.filter { $0 != .applePay }
            ForEach(otherMethods, id: \.rawValue) { method in
                paymentMethodRow(method)

                if method != otherMethods.last {
                    Divider().padding(.leading, 48)
                }
            }

            // Saved cards section
            if !viewModel.savedMethods.isEmpty {
                Divider().padding(.vertical, 4)

                VStack(alignment: .leading, spacing: 8) {
                    Text("Saved Cards")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                        .textCase(.uppercase)
                        .padding(.leading, 4)

                    ForEach(viewModel.savedMethods) { saved in
                        savedCardRow(saved)
                    }
                }
            }
        }
    }

    // MARK: - Apple Pay Row

    private var applePayRow: some View {
        Button {
            viewModel.selectedMethod = .applePay
        } label: {
            HStack(spacing: 12) {
                Image(systemName: "apple.logo")
                    .font(.title3)
                    .frame(width: 36)

                VStack(alignment: .leading, spacing: 2) {
                    Text("Apple Pay")
                        .font(.subheadline.weight(.semibold))
                    Text("Pay instantly")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }

                Spacer()

                selectionIndicator(isSelected: viewModel.selectedMethod == .applePay)
            }
            .padding(.vertical, 12)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }

    // MARK: - Payment Method Row

    private func paymentMethodRow(_ method: PaymentMethodType) -> some View {
        Button {
            viewModel.selectedMethod = method
        } label: {
            HStack(spacing: 12) {
                Image(systemName: method.iconName)
                    .font(.title3)
                    .foregroundStyle(method.brandColor)
                    .frame(width: 36)

                Text(method.displayName)
                    .font(.subheadline.weight(.medium))

                Spacer()

                selectionIndicator(isSelected: viewModel.selectedMethod == method)
            }
            .padding(.vertical, 12)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }

    // MARK: - Saved Card Row

    private func savedCardRow(_ saved: SavedPaymentMethod) -> some View {
        Button {
            viewModel.selectedMethod = .card
            // TODO: Wire up saved card selection on viewModel
        } label: {
            HStack(spacing: 12) {
                Image(systemName: "creditcard")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                    .frame(width: 36)

                VStack(alignment: .leading, spacing: 2) {
                    Text(saved.displayLabel)
                        .font(.subheadline)
                    Text("Expires \(saved.expiryLabel)")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }

                Spacer()
            }
            .padding(.vertical, 8)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }

    // MARK: - Selection Indicator

    private func selectionIndicator(isSelected: Bool) -> some View {
        Image(systemName: isSelected ? "checkmark.circle.fill" : "circle")
            .font(.title3)
            .foregroundStyle(isSelected ? Color.salsaRed : Color(.tertiaryLabel))
    }
}
