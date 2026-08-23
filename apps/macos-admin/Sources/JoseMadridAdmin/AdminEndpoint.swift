import Foundation

enum AdminEndpoint {
  static let production = URL(string: "https://www.josemadrid.net/admin")!

  static func validated(_ value: String) -> URL? {
    guard var components = URLComponents(string: value.trimmingCharacters(in: .whitespacesAndNewlines)),
          let host = components.host,
          components.scheme == "https" || (components.scheme == "http" && ["localhost", "127.0.0.1"].contains(host))
    else { return nil }

    if components.path.isEmpty || components.path == "/" {
      components.path = "/admin"
    }

    return components.url
  }
}
