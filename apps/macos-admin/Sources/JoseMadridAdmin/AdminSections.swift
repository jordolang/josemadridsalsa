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
///
/// Each path opens the shell at that section rather than the web admin page
/// behind it, so a menu choice stays in the window the operator is already in.
/// Developer Console opens the Developer page inside the Database section, and
/// Battle Arena Codes the game-codes page inside the Fundraisers section.
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
      AdminSection("Orders", "/admin-desktop?section=orders", "2"),
      AdminSection("Products", "/admin-desktop?section=products", "3"),
      AdminSection("Inventory", "/admin-desktop?section=inventory", "4"),
      AdminSection("Customers", "/admin-desktop?section=customers", "5"),
      AdminSection("Purchase Orders", "/admin-desktop?section=purchase"),
      AdminSection("Invoices", "/admin-desktop?section=invoices"),
    ]),
    AdminSectionGroup("Programs", [
      AdminSection("Fundraisers", "/admin-desktop?section=fundraisers", "7"),
      AdminSection("Battle Arena Codes", "/admin-desktop?section=fundraisers&page=fundraisers.codes"),
      AdminSection("Events & Shows", "/admin-desktop?section=events", "8"),
      AdminSection("Wholesale", "/admin-desktop?section=wholesale"),
    ]),
    AdminSectionGroup("Money", [
      AdminSection("Financials", "/admin-desktop?section=ledger", "6"),
    ]),
    AdminSectionGroup("Marketing", [
      AdminSection("Email Marketing", "/admin-desktop?section=email", "9"),
      AdminSection("Social", "/admin-desktop?section=social"),
      AdminSection("Content & Blog", "/admin-desktop?section=content"),
      AdminSection("Lead Generation", "/admin-desktop?section=leads"),
      AdminSection("Reviews", "/admin-desktop?section=reviews"),
    ]),
    AdminSectionGroup("System", [
      AdminSection("Analytics", "/admin-desktop?section=analytics"),
      AdminSection("Media & Documents", "/admin-desktop?section=media"),
      AdminSection("Messages", "/admin-desktop?section=messages"),
      AdminSection("Users & Roles", "/admin-desktop?section=users"),
      AdminSection("Audit Logs", "/admin-desktop?section=audit"),
      AdminSection("Settings", "/admin-desktop?section=settings"),
      AdminSection("Developer Console", "/admin-desktop?section=database&page=database.developer"),
      AdminSection("Database Console", "/admin-desktop?section=database"),
    ]),
  ]

  static let all: [AdminSection] = groups.flatMap(\.sections)
}
