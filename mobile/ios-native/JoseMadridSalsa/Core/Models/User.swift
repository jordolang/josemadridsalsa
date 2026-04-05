import Foundation

enum UserRole: String, Codable, Sendable {
    case customer = "CUSTOMER"
    case admin = "ADMIN"
    case developer = "DEVELOPER"
    case staff = "STAFF"
    case wholesale = "WHOLESALE"
    case fundraiser = "FUNDRAISER"
}

struct User: Codable, Identifiable, Sendable {
    let id: String
    let email: String
    let name: String?
    let phone: String?
    let role: UserRole
    let image: String?
    let fundraiserId: String?
}
