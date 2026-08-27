import Foundation

/// The admin areas that get a menu entry and a keyboard shortcut.
///
/// This is navigation, not permission: the pages themselves enforce roles, so a
/// STAFF account choosing "Financials" lands on the same redirect it would get
/// in a browser. Kept in step with the Windows app's `src/shared/sections.ts`.
struct AdminSection: Identifiable, Hashable {
  let label: String
  let path: String
  /// Single character used with ⌘ as the menu shortcut, when the section has one.
  let shortcut: Character?

  var id: String { path }

  init(_ label: String, _ path: String, _ shortcut: Character? = nil) {
    self.label = label
    self.path = path
    self.shortcut = shortcut
  }
}

enum AdminSections {
  static let all: [AdminSection] = [
    AdminSection("Dashboard", "/admin", "1"),
    AdminSection("Orders", "/admin/orders", "2"),
    AdminSection("Products", "/admin/products", "3"),
    AdminSection("Inventory", "/admin/inventory", "4"),
    AdminSection("Customers", "/admin/customers", "5"),
    AdminSection("Financials", "/admin/financials", "6"),
    AdminSection("Fundraisers", "/admin/fundraisers", "7"),
    AdminSection("Events & Shows", "/admin/events", "8"),
    AdminSection("Email Marketing", "/admin/email-marketing", "9"),
    AdminSection("Analytics", "/admin/analytics"),
    AdminSection("Media & Documents", "/admin/media"),
    AdminSection("Social", "/admin/social"),
    AdminSection("Wholesale", "/admin/wholesale"),
    AdminSection("Messages", "/admin/messages"),
    AdminSection("Audit Logs", "/admin/audit-logs"),
    AdminSection("Settings", "/admin/settings"),
    AdminSection("Developer Console", "/admin/developer"),
    AdminSection("Database Console", "/admin/developer/database"),
  ]
}
