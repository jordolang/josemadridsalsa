import Foundation

/// Reading the update feed the Desktop Apps workflow publishes.
///
/// One feed serves both apps: `latest.yml` is electron-updater's file for the
/// Windows installer, and the macOS disk image is published beside it under the
/// same version, because both are built from the same commit by the same run.
/// The feed sits behind the storefront rather than on GitHub, because the
/// repository is private and its release assets answer 404 to an app with no
/// GitHub session.
enum UpdateFeed {
  static let base = URL(string: "https://www.josemadrid.net/api/desktop/updates/")!

  static var manifest: URL { base.appendingPathComponent("latest.yml") }

  static func diskImage(for version: String) -> URL {
    base.appendingPathComponent("JoseMadridSalsaAdmin-\(version).dmg")
  }

  /// The `version:` line of `latest.yml`, or nil if there is none.
  static func version(inManifest text: String) -> String? {
    for line in text.split(whereSeparator: \.isNewline) {
      let trimmed = line.trimmingCharacters(in: .whitespaces)
      guard trimmed.hasPrefix("version:") else { continue }
      let value = trimmed.dropFirst("version:".count)
        .trimmingCharacters(in: CharacterSet(charactersIn: " '\""))
      return value.isEmpty ? nil : value
    }
    return nil
  }

  /// Whether `candidate` is a later release than `current`, comparing dotted
  /// numbers left to right (`2.10.0` is after `2.9.0`; missing parts count as 0).
  static func isNewer(_ candidate: String, than current: String) -> Bool {
    let parts = { (value: String) in value.split(separator: ".").map { Int($0.prefix { $0.isNumber }) ?? 0 } }
    let a = parts(candidate)
    let b = parts(current)
    for index in 0..<max(a.count, b.count) {
      let x = index < a.count ? a[index] : 0
      let y = index < b.count ? b[index] : 0
      if x != y { return x > y }
    }
    return false
  }
}
