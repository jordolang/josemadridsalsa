import AppKit
import SwiftUI

@main
struct JoseMadridAdminApp: App {
  var body: some Scene {
    WindowGroup("Jose Madrid Salsa Admin") {
      AdminWorkspace()
        .frame(minWidth: 1100, minHeight: 720)
    }
    .windowStyle(.hiddenTitleBar)
    .windowToolbarStyle(.unifiedCompact)

    Settings {
      ConnectionSettings()
    }
  }
}

private struct AdminWorkspace: View {
  @AppStorage("adminEndpoint") private var endpoint = AdminEndpoint.production.absoluteString
  @StateObject private var browser = BrowserController()

  private var adminURL: URL {
    AdminEndpoint.validated(endpoint) ?? AdminEndpoint.production
  }

  var body: some View {
    AdminBrowser(initialURL: adminURL, controller: browser)
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
          Button("Command Center") { open("/admin") }
          Button("Operations") { open("/admin/orders") }
          Button("Growth & Field") { open("/admin/events") }
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

  private func open(_ path: String) {
    guard let origin = URL(string: "/", relativeTo: adminURL),
          let url = URL(string: path, relativeTo: origin)?.absoluteURL
    else { return }
    browser.load(url)
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
