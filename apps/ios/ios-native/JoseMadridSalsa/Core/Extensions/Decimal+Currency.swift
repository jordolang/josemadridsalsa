import Foundation

extension Double {
    private static let currencyFormatter: NumberFormatter = {
        let formatter = NumberFormatter()
        formatter.numberStyle = .currency
        formatter.locale = Locale(identifier: "en_US")
        return formatter
    }()

    var asCurrency: String {
        Self.currencyFormatter.string(from: NSNumber(value: self)) ?? "$0.00"
    }
}
