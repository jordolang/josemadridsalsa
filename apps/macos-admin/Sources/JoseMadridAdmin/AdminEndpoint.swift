import Foundation

/// Where the app is allowed to point, and which URLs stay inside its window.
///
/// The app is a hardened window onto the real admin panel, so the origin it
/// trusts is the most important thing it stores: navigation policy, external
/// link handling and the session cookies themselves are all scoped to it.
enum AdminEndpoint {
  static let production = URL(string: "https://www.josemadrid.net/admin")!

  private static let localHosts: Set<String> = ["localhost", "127.0.0.1", "::1"]

  /// Identity providers NextAuth redirects through during sign-in.
  ///
  /// These have to render in the app window rather than the default browser: an
  /// OAuth round trip that finishes in Safari sets the session cookie there, and
  /// the app is left sitting on the sign-in page forever. Google's One Tap
  /// prompt starts this redirect on its own, so handling a deliberate click on
  /// "Continue with Google" is not enough.
  private static let authOrigins: Set<String> = [
    "https://accounts.google.com",
    "https://accounts.youtube.com",
    "https://oauth2.googleapis.com",
    "https://github.com",
    "https://facebook.com",
    "https://www.facebook.com",
    "https://m.facebook.com",
    "https://appleid.apple.com",
  ]

  /// Accept an HTTPS endpoint, or an HTTP one only when it is a developer's
  /// local server. Anything else is rejected rather than silently corrected.
  static func validated(_ value: String) -> URL? {
    guard var components = URLComponents(string: value.trimmingCharacters(in: .whitespacesAndNewlines)),
          let host = components.host,
          components.scheme == "https" || (components.scheme == "http" && localHosts.contains(host))
    else { return nil }

    if components.path.isEmpty || components.path == "/" {
      components.path = "/admin"
    }

    components.query = nil
    components.fragment = nil

    return components.url
  }

  /// Scheme + host + port, the unit that decides whether two URLs are the same site.
  static func origin(of url: URL) -> String? {
    guard var components = URLComponents(url: url, resolvingAgainstBaseURL: false),
          components.host != nil
    else { return nil }
    components.path = ""
    components.query = nil
    components.fragment = nil
    return components.url?.absoluteString
  }

  static func isAuthURL(_ url: URL) -> Bool {
    guard let origin = origin(of: url) else { return false }
    return authOrigins.contains(origin)
  }

  static func isInternal(_ url: URL, endpoint: URL) -> Bool {
    guard let target = origin(of: url), let home = origin(of: endpoint) else { return false }
    return target == home
  }

  /// Whether a URL should open inside the app window. The admin server and the
  /// sign-in providers stay in; everything else — Stripe, QuickBooks, Vercel, a
  /// customer's website — is handed to the default browser.
  static func shouldOpenInApp(_ url: URL, endpoint: URL) -> Bool {
    isInternal(url, endpoint: endpoint) || isAuthURL(url)
  }

  /// Only ever hand http(s) links to the OS — never file:, and never a custom scheme.
  static func isSafeExternal(_ url: URL) -> Bool {
    url.scheme == "https" || url.scheme == "http"
  }

  /// Resolve an admin path against the configured endpoint's origin.
  static func sectionURL(_ path: String, endpoint: URL) -> URL? {
    guard let origin = origin(of: endpoint), let base = URL(string: origin) else { return nil }
    return URL(string: path, relativeTo: base)?.absoluteURL
  }
}
