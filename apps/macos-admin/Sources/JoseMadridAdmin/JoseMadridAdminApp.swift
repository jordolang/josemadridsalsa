import AppKit
import SwiftUI

@main
struct JoseMadridAdminApp: App {
  @AppStorage("adminEndpoint") private var endpoint = AdminEndpoint.production.absoluteString
  @StateObject private var browser = BrowserController()

  private var adminURL: URL {
    AdminEndpoint.validated(endpoint) ?? AdminEndpoint.production
  }

  var body: some Scene {
    WindowGroup("Jose Madrid Salsa Admin") {
      AdminWorkspace(adminURL: adminURL, browser: browser)
        .frame(minWidth: 1100, minHeight: 720)
    }
    .windowStyle(.hiddenTitleBar)
    .windowToolbarStyle(.unifiedCompact)
    .commands {
      AdminCommands(browser: browser, adminURL: adminURL)
    }

    Settings {
      ConnectionSettings()
    }
  }
}

private let releasesURL = URL(string: "https://github.com/jordolang/josemadridsalsa/releases")!

/// Menu bar entries: printing, section navigation and the update check. The
/// section list is shared with the Windows app so both keep the same shortcuts.
private struct AdminCommands: Commands {
  @ObservedObject var browser: BrowserController
  let adminURL: URL

  var body: some Commands {
    CommandGroup(replacing: .printItem) {
      Button("Print…") { browser.print() }
        .keyboardShortcut("p", modifiers: .command)
    }

    CommandGroup(after: .toolbar) {
      Divider()
      Button("Reload") { browser.reload() }
        .keyboardShortcut("r", modifiers: .command)
      Button("Back") { browser.goBack() }
        .keyboardShortcut("[", modifiers: .command)
        .disabled(!browser.canGoBack)
      Button("Forward") { browser.goForward() }
        .keyboardShortcut("]", modifiers: .command)
        .disabled(!browser.canGoForward)
    }

    CommandMenu("Go") {
      ForEach(AdminSections.all) { section in
        let button = Button(section.label) { browser.navigate(to: section.path) }
        if let shortcut = section.shortcut {
          button.keyboardShortcut(KeyEquivalent(shortcut), modifiers: .command)
        } else {
          button
        }
      }

      Divider()

      Button("Open Current Page in Browser") {
        NSWorkspace.shared.open(browser.currentURL ?? adminURL)
      }
    }

    CommandGroup(replacing: .help) {
      Button("Jose Madrid Salsa Admin Help") {
        NSWorkspace.shared.open(URL(string: "https://github.com/jordolang/josemadridsalsa")!)
      }
      Button("Check for Updates…") {
        NSWorkspace.shared.open(releasesURL)
      }
    }
  }
}

private struct AdminWorkspace: View {
  let adminURL: URL
  @ObservedObject var browser: BrowserController

  var body: some View {
    AdminBrowser(initialURL: adminURL, controller: browser)
      .onAppear { browser.endpoint = adminURL }
      .onChange(of: adminURL) { _, newValue in
        browser.endpoint = newValue
        browser.load(newValue)
      }
      .overlay {
        if let error = browser.errorMessage {
          ContentUnavailableView {
            Label("Cannot reach Jose Madrid Salsa", systemImage: "wifi.exclamationmark")
          } description: {
            Text(error)
          } actions: {
            Button("Try Again") { browser.load(adminURL) }
          }
          .frame(maxWidth: .infinity, maxHeight: .infinity)
          .background(Color(nsColor: .windowBackgroundColor))
        }
      }
      .toolbar {
        ToolbarItemGroup(placement: .navigation) {
          Button(action: browser.goBack) { Label("Back", systemImage: "chevron.left") }
            .disabled(!browser.canGoBack)
          Button(action: browser.goForward) { Label("Forward", systemImage: "chevron.right") }
            .disabled(!browser.canGoForward)
          Button(action: browser.reload) { Label("Reload", systemImage: "arrow.clockwise") }
          Button("Command Center") { browser.navigate(to: "/admin") }
          Button("Operations") { browser.navigate(to: "/admin/orders") }
          Button("Growth & Field") { browser.navigate(to: "/admin/events") }
        }

        ToolbarItemGroup(placement: .primaryAction) {
          if browser.isLoading {
            ProgressView().controlSize(.small)
          }
          connectionLabel
          Button(action: openInBrowser) {
            Label("Open in Browser", systemImage: "safari")
          }
        }
      }
  }

  @ViewBuilder
  private var connectionLabel: some View {
    switch browser.connectionState {
    case .connecting:
      Label("Connecting", systemImage: "circle.dotted")
        .foregroundStyle(.secondary)
    case .connected:
      Label("Production Connected", systemImage: "circle.fill")
        .foregroundStyle(.green)
    case .offline:
      Label("Offline", systemImage: "exclamationmark.circle.fill")
        .foregroundStyle(.red)
    }
  }

  private func openInBrowser() {
    NSWorkspace.shared.open(browser.currentURL ?? adminURL)
  }
}

private struct ConnectionSettings: View {
  @AppStorage("adminEndpoint") private var endpoint = AdminEndpoint.production.absoluteString
  @State private var draft = ""
  @State private var validationMessage: String?

  var body: some View {
    Form {
      TextField("Admin URL", text: $draft)
        .textFieldStyle(.roundedBorder)
      Text("HTTPS is required except for localhost development.")
        .font(.caption)
        .foregroundStyle(.secondary)
      if let validationMessage {
        Text(validationMessage).foregroundStyle(.red)
      }
      HStack {
        Spacer()
        Button("Use Production") {
          draft = AdminEndpoint.production.absoluteString
          save()
        }
        Button("Save") { save() }
          .keyboardShortcut(.defaultAction)
      }
    }
    .padding(24)
    .frame(width: 500)
    .onAppear { draft = endpoint }
  }

  private func save() {
    guard let url = AdminEndpoint.validated(draft) else {
      validationMessage = "Enter an HTTPS URL or a localhost HTTP URL."
      return
    }
    endpoint = url.absoluteString
    draft = endpoint
    validationMessage = nil
  }
}
