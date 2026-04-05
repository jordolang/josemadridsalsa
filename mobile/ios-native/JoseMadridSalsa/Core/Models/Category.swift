import Foundation

struct Category: Codable, Identifiable, Sendable {
    let id: String
    let name: String
    let slug: String
    let description: String?
    let image: String?
    let isActive: Bool
    let sortOrder: Int
}
