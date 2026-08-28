import Foundation

/// The admin areas that get a menu entry and a keyboard shortcut.
///
/// This is navigation, not permission: the pages themselves enforce roles, so a
/// STAFF account choosing "Financials" lands on the same redirect it would get
/// in a browser.
///
/// The grouping and the shortcuts match the desktop shell's own sidebar
/// (`apps/storefront/lib/admin-desktop/sections.ts`) and the Windows app's
/// `src/shared/sections.ts`, so ⌘4 means Inventory in the window, in the menu
/// bar, and on both platforms.
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

struct AdminSectionGroup: Identifiable, Hashable {
  let label: String
  let sections: [AdminSection]

  var id: String { label }

  init(_ label: String, _ sections: [AdminSection]) {
    self.label = label
    self.sections = sections
  }
}

enum AdminSections {
  static let groups: [AdminSectionGroup] = [
    AdminSectionGroup("Operations", [
      AdminSection("Dashboard", AdminEndpoint.desktopPath, "1"),
      AdminSection("Orders", "/admin/orders", "2"),
      AdminSection("Products", "/admin/products", "3"),
      AdminSection("Inventory", "/admin/inventory", "4"),
      AdminSection("Customers", "/admin/customers", "5"),
      AdminSection("Purchase Orders", "/admin/purchase-orders"),
      AdminSection("Invoices", "/admin/invoices"),
    ]),
    AdminSectionGroup("Programs", [
      AdminSection("Fundraisers", "/admin/fundraisers", "7"),
      AdminSection("Events & Shows", "/admin/events", "8"),
      AdminSection("Wholesale", "/admin/wholesale"),
    ]),
    AdminSectionGroup("Money", [
      AdminSection("Financials", "/admin/financials/ledger", "6"),
    ]),
    AdminSectionGroup("Marketing", [
      AdminSection("Email Marketing", "/admin/email-marketing", "9"),
      AdminSection("Social", "/admin/social"),
      AdminSection("Content & Blog", "/admin/content"),
      AdminSection("Lead Generation", "/admin/lead-generation"),
      AdminSection("Reviews", "/admin/reviews"),
    ]),
    AdminSectionGroup("System", [
      AdminSection("Analytics", "/admin/analytics"),
      AdminSection("Media & Documents", "/admin/media"),
      AdminSection("Messages", "/admin/messages"),
      AdminSection("Users & Roles", "/admin/users"),
      AdminSection("Audit Logs", "/admin/audit-logs"),
      AdminSection("Settings", "/admin/settings"),
      AdminSection("Developer Console", "/admin/developer"),
      AdminSection("Database Console", "/admin/developer/database"),
    ]),
  ]

  static let all: [AdminSection] = groups.flatMap(\.sections)
}
