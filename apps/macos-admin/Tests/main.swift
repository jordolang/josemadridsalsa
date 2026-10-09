import Foundation

// Compiled and run by build-app.sh before the app itself is built, so a change
// that loosens where the app may point, or what it lets out to the browser,
// fails the build rather than shipping.

// MARK: validated

precondition(
  AdminEndpoint.validated("https://www.josemadridsalsa.com")?.absoluteString ==
    "https://www.josemadridsalsa.com/admin-desktop",
  "a bare origin should resolve to the desktop shell"
)
precondition(
  AdminEndpoint.validated("https://www.josemadridsalsa.com/admin/orders")?.absoluteString ==
    "https://www.josemadridsalsa.com/admin/orders",
  "a deeper admin path should be kept"
)
precondition(
  AdminEndpoint.validated("http://localhost:3000")?.absoluteString ==
    "http://localhost:3000/admin-desktop",
  "http should be allowed for a local development server"
)
precondition(
  AdminEndpoint.validated("https://www.josemadridsalsa.com/admin?tab=1#top")?.absoluteString ==
    "https://www.josemadridsalsa.com/admin",
  "query and fragment should be dropped"
)
precondition(AdminEndpoint.validated("http://example.com/admin") == nil, "plain http to a remote host")
precondition(AdminEndpoint.validated("javascript:alert(1)") == nil, "non-web scheme")
precondition(AdminEndpoint.validated("file:///etc/passwd") == nil, "file scheme")
precondition(AdminEndpoint.validated("   ") == nil, "blank input")

// MARK: legacy default migration

// The app may have the pre-shell default saved in @AppStorage, which would
// otherwise pin it to the old web panel forever.
precondition(
  AdminEndpoint.migratingLegacyDefault("https://www.josemadridsalsa.com/admin") ==
    AdminEndpoint.production.absoluteString,
  "an install that predates the shell should move onto the new default"
)
precondition(
  AdminEndpoint.migratingLegacyDefault("http://localhost:3000/admin") == "http://localhost:3000/admin",
  "a local development endpoint should be left alone"
)
precondition(
  AdminEndpoint.migratingLegacyDefault("https://www.josemadridsalsa.com/admin/orders") ==
    "https://www.josemadridsalsa.com/admin/orders",
  "a deliberately chosen admin page should be left alone"
)
precondition(
  AdminEndpoint.migratingLegacyDefault(AdminEndpoint.production.absoluteString) ==
    AdminEndpoint.production.absoluteString,
  "migrating twice should change nothing"
)

// MARK: navigation policy

let home = AdminEndpoint.production

precondition(
  AdminEndpoint.isInternal(URL(string: "https://www.josemadridsalsa.com/admin/orders")!, endpoint: home),
  "same origin is internal"
)
precondition(
  !AdminEndpoint.isInternal(URL(string: "https://josemadridsalsa.com/admin")!, endpoint: home),
  "a sibling host is a different origin"
)
precondition(
  !AdminEndpoint.isInternal(URL(string: "https://dashboard.stripe.com")!, endpoint: home),
  "a third-party dashboard is external"
)

// An OAuth round trip that finishes in Safari sets the session cookie there and
// leaves the app stuck on the sign-in page, so identity providers stay in-window.
for provider in [
  "https://accounts.google.com/o/oauth2/v2/auth?client_id=x",
  "https://github.com/login/oauth/authorize",
  "https://www.facebook.com/v18.0/dialog/oauth",
  "https://appleid.apple.com/auth/authorize",
] {
  precondition(AdminEndpoint.isAuthURL(URL(string: provider)!), "\(provider) should be an auth URL")
  precondition(
    AdminEndpoint.shouldOpenInApp(URL(string: provider)!, endpoint: home),
    "\(provider) should open in the app"
  )
}

precondition(
  !AdminEndpoint.isAuthURL(URL(string: "https://www.google.com/search?q=salsa")!),
  "not every Google page is a sign-in flow"
)
precondition(
  !AdminEndpoint.isAuthURL(URL(string: "https://accounts.google.com.evil.example/auth")!),
  "a lookalike host is not a sign-in flow"
)
precondition(
  !AdminEndpoint.shouldOpenInApp(URL(string: "https://quickbooks.intuit.com")!, endpoint: home),
  "ordinary external links go to the browser"
)

precondition(AdminEndpoint.isSafeExternal(URL(string: "https://dashboard.stripe.com")!))
precondition(!AdminEndpoint.isSafeExternal(URL(string: "file:///Users")!), "never hand file: to the OS")

// MARK: section URLs

precondition(
  AdminEndpoint.sectionURL("/admin/financials", endpoint: URL(string: "https://www.josemadridsalsa.com/admin/orders")!)?
    .absoluteString == "https://www.josemadridsalsa.com/admin/financials",
  "sections resolve against the origin, not the current path"
)
precondition(
  AdminEndpoint.sectionURL("/admin/events", endpoint: URL(string: "http://localhost:3000/admin")!)?
    .absoluteString == "http://localhost:3000/admin/events",
  "sections follow a local endpoint"
)

var seenPaths = Set<String>()
var seenShortcuts = Set<Character>()
for section in AdminSections.all {
  precondition(section.path.hasPrefix("/admin"), "\(section.label) should be an admin path")
  precondition(seenPaths.insert(section.path).inserted, "duplicate section path \(section.path)")
  if let shortcut = section.shortcut {
    precondition(seenShortcuts.insert(shortcut).inserted, "duplicate shortcut \(shortcut)")
  }
  precondition(
    AdminEndpoint.sectionURL(section.path, endpoint: home).map {
      AdminEndpoint.isInternal($0, endpoint: home)
    } == true,
    "\(section.label) should resolve to the admin origin"
  )
}

// MARK: page bridge

precondition(
  AdminEndpoint.isEndpointOrigin(scheme: "https", host: "www.josemadridsalsa.com", port: 0, endpoint: home),
  "the admin page itself may use the bridge"
)
precondition(
  !AdminEndpoint.isEndpointOrigin(scheme: "https", host: "accounts.google.com", port: 0, endpoint: home),
  "a sign-in provider's page may not"
)
precondition(
  AdminEndpoint.isEndpointOrigin(
    scheme: "http", host: "localhost", port: 3000,
    endpoint: URL(string: "http://localhost:3000/admin-desktop")!
  ),
  "a local development server's own port should match"
)
precondition(
  AdminEndpoint.notificationTarget("/admin-desktop?section=orders", endpoint: home)?.absoluteString ==
    "https://www.josemadridsalsa.com/admin-desktop?section=orders",
  "a notification opens its section in the shell"
)
for path in ["https://evil.example/admin-desktop?x", "//evil.example/admin-desktop?x", "/admin/users", "/admin-desktop"] {
  precondition(AdminEndpoint.notificationTarget(path, endpoint: home) == nil, "a notification may not open \(path)")
}

// MARK: label printing

precondition(
  AdminEndpoint.labelURL("https://easypost-files.s3.amazonaws.com/files/postage_label/x.png") != nil,
  "an https label on the carrier's host should print"
)
for value in ["http://example.com/x.png", "file:///etc/hosts", "javascript:alert(1)", "not a url"] {
  precondition(AdminEndpoint.labelURL(value) == nil, "\(value) should not print")
}

// MARK: update feed

precondition(
  UpdateFeed.version(inManifest: "version: 2.1.0\nfiles:\n  - url: JoseMadridSalsaAdmin-Setup-2.1.0.exe\n") == "2.1.0",
  "the version line of latest.yml should be read"
)
precondition(UpdateFeed.version(inManifest: "version: '2.2.0'") == "2.2.0", "a quoted version should be read")
precondition(UpdateFeed.version(inManifest: "files: []") == nil, "no version line means no version")
precondition(UpdateFeed.isNewer("2.10.0", than: "2.9.0"), "versions compare numerically, not as text")
precondition(UpdateFeed.isNewer("2.2", than: "2.1.9"), "a missing part counts as zero")
precondition(!UpdateFeed.isNewer("2.1.0", than: "2.1.0"), "the same version is not an update")
precondition(!UpdateFeed.isNewer("2.0.9", than: "2.1.0"), "an older feed is not an update")
precondition(
  UpdateFeed.diskImage(for: "2.2.0").absoluteString ==
    "https://www.josemadridsalsa.com/api/desktop/updates/JoseMadridSalsaAdmin-2.2.0.dmg",
  "the disk image sits beside the manifest"
)

// MARK: receipt printer

if case .success(let connection) = ReceiptConnection.parse(mode: "network", host: " 192.168.1.87 ", port: "", printer: "") {
  precondition(connection == .network(host: "192.168.1.87", port: 9100), "a network printer defaults to port 9100")
} else {
  preconditionFailure("a plain IP address should be accepted")
}
if case .success = ReceiptConnection.parse(mode: "network", host: "printer; rm -rf /", port: "9100", printer: "") {
  preconditionFailure("a host with shell characters should be refused")
}
if case .success = ReceiptConnection.parse(mode: "network", host: "10.0.0.5", port: "70000", printer: "") {
  preconditionFailure("a port past 65535 should be refused")
}
if case .success(let connection) = ReceiptConnection.parse(mode: "anything", host: "", port: "", printer: "") {
  precondition(connection == .off, "an unknown mode is off")
}

let ticket = Data([0x1B, 0x40, 0x41, 0x0A]).base64EncodedString()
let job: [String: Any] = ["orderId": "cmabc123", "orderNumber": "JMS-1", "createdAt": "2026-10-09T03:00:00.000Z", "data": ticket]
precondition(ReceiptJob.parse(job)?.bytes == Data([0x1B, 0x40, 0x41, 0x0A]), "a ticket from the page should parse")
precondition(ReceiptJob.parse(job.merging(["orderId": "../../x"]) { $1 }) == nil, "an odd order id should be refused")
precondition(ReceiptJob.parse(job.merging(["createdAt": "yesterday"]) { $1 }) == nil, "a bad date should be refused")
precondition(ReceiptJob.parse(job.merging(["data": "not base64!"]) { $1 }) == nil, "bad base64 should be refused")

let enabledAt = Date(timeIntervalSince1970: 1_791_500_000)
let fresh = ReceiptJob(orderId: "o1", orderNumber: nil, createdAt: enabledAt.addingTimeInterval(60), bytes: Data([1]), reprint: false)
precondition(ReceiptLog.shouldPrint(fresh, printed: [], enabledAt: enabledAt), "a new order prints")
precondition(!ReceiptLog.shouldPrint(fresh, printed: ["o1"], enabledAt: enabledAt), "an order prints once")
let backlog = ReceiptJob(orderId: "o2", orderNumber: nil, createdAt: enabledAt.addingTimeInterval(-60), bytes: Data([1]), reprint: false)
precondition(!ReceiptLog.shouldPrint(backlog, printed: [], enabledAt: enabledAt), "the backlog does not print")
let reprint = ReceiptJob(orderId: "o1", orderNumber: nil, createdAt: .distantPast, bytes: Data([1]), reprint: true)
precondition(ReceiptLog.shouldPrint(reprint, printed: ["o1"], enabledAt: enabledAt), "a reprint always prints")
let remembered = ReceiptLog.remember((0..<ReceiptLog.memory).map { "o\($0)" }, "new")
precondition(remembered.count == ReceiptLog.memory && remembered.last == "new", "the printed list keeps the newest")

print("AdminEndpoint checks passed (\(AdminSections.all.count) sections)")
