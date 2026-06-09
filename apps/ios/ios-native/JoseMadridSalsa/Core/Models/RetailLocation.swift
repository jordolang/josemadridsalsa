import Foundation
import CoreLocation

struct RetailLocation: Codable, Identifiable, Sendable {
    let id: String
    let name: String
    let address: String
    let city: String
    let state: String
    let zipCode: String
    let latitude: Double
    let longitude: Double
    let phone: String?
    let hours: String?
    let isActive: Bool

    var coordinate: CLLocationCoordinate2D {
        CLLocationCoordinate2D(latitude: latitude, longitude: longitude)
    }
}
