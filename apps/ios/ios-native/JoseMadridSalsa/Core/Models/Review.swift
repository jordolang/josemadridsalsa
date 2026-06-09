import Foundation

struct Review: Codable, Identifiable, Sendable {
    let id: String
    let productId: String
    let userId: String
    let rating: Int
    let title: String?
    let body: String?
    let isVerified: Bool
    let createdAt: String
}
