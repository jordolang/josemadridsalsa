import Foundation

enum AddressType: String, Codable, Sendable {
    case shipping = "SHIPPING"
    case billing = "BILLING"
    case both = "BOTH"
}

struct Address: Codable, Identifiable, Sendable {
    let id: String
    let type: AddressType
    let firstName: String
    let lastName: String
    let company: String?
    let street: String
    let city: String
    let state: String
    let zipCode: String
    let country: String
    let phone: String?
    let isDefault: Bool

    var fullName: String {
        "\(firstName) \(lastName)"
    }

    var formattedAddress: String {
        var lines = [street, "\(city), \(state) \(zipCode)"]
        if let company { lines.insert(company, at: 0) }
        return lines.joined(separator: "\n")
    }
}
