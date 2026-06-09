import Foundation

struct LoyaltyAccount: Codable, Identifiable, Sendable {
    let id: String
    let userId: String
    let points: Int
    let tier: String
    let lifetimePoints: Int
}
