import Foundation

/// Where the app is allowed to point, and which URLs stay inside its window.
///
/// The app is a hardened window onto the real admin panel, so the origin it
/// trusts is the most important thing it stores: navigation policy, external
/// link handling and the session cookies themselves are all scoped to it.
enum AdminEndpoint {
  /// The desktop shell — the admin data drawn as a native-feeling window rather
  /// than the web panel's page chrome. It lives outside `/admin` because that
  /// route group supplies a sidebar and top bar this window draws itself.
  static let desktopPath = "/admin-desktop"

  static let production = URL(string: "https://www.josemadrid.net\(desktopPath)")!

  /// What the default used to be, before the desktop shell existed.
  ///
  /// An install that predates the shell may have saved the old default in
  /// `@AppStorage` and would never see the new one. `migratingLegacyDefault`
  /// moves exactly that value forward and leaves anything else — a localhost
  /// server, a hand-picked admin page — alone.
  private static let legacyProduction = "https://www.josemadrid.net/admin"

  static func migratingLegacyDefault(_ endpoint: String) -> String {
    endpoint == legacyProduction ? production.absoluteString : endpoint
  }

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
      components.path = desktopPath
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

  /// Whether a frame's security origin is the admin server's. The page bridge
  /// (notifications, the dock badge) answers only to that origin, so a sign-in
  /// provider's page cannot use it. `port` 0 is WebKit's "default port".
  static func isEndpointOrigin(scheme: String, host: String, port: Int, endpoint: URL) -> Bool {
    guard var components = URLComponents(string: "\(scheme)://\(host)") else { return false }
    if port != 0 { components.port = port }
    guard let url = components.url else { return false }
    return isInternal(url, endpoint: endpoint)
  }

  /// Where clicking a notification takes the window. Only a path inside the
  /// desktop shell is accepted, resolved against the configured endpoint — a
  /// notification can never send the window to a URL of its own choosing.
  static func notificationTarget(_ path: String, endpoint: URL) -> URL? {
    guard path.hasPrefix("\(desktopPath)?") else { return nil }
    return sectionURL(path, endpoint: endpoint)
  }

  /// A shipping label the page asks to print. Labels live on the carrier's
  /// host, not the admin's, so the URL is held to https rather than to the
  /// admin origin — and it is only ever downloaded as an image.
  static func labelURL(_ value: String) -> URL? {
    guard value.count <= 2048, let url = URL(string: value), url.scheme == "https", url.host != nil else { return nil }
    return url
  }

  /// Resolve an admin path against the configured endpoint's origin.
  static func sectionURL(_ path: String, endpoint: URL) -> URL? {
    guard let origin = origin(of: endpoint), let base = URL(string: origin) else { return nil }
    return URL(string: path, relativeTo: base)?.absoluteURL
  }
}
