import AppKit
import SwiftUI

@main
struct JoseMadridAdminApp: App {
  @AppStorage("adminEndpoint") private var endpoint = AdminEndpoint.production.absoluteString

  private var adminURL: URL {
    AdminEndpoint.validated(AdminEndpoint.migratingLegacyDefault(endpoint)) ?? AdminEndpoint.production
  }

  var body: some Scene {
    // Each window is opened at a URL — nil for the endpoint's own start page —
    // and gets its own browser, so orders can sit on one screen and inventory
    // on another. They share one cookie store, so signing in once is enough.
    WindowGroup("Jose Madrid Salsa Admin", id: "admin", for: URL.self) { $url in
      AdminWorkspace(adminURL: adminURL, startURL: url)
        .frame(minWidth: 1100, minHeight: 720)
    }
    // The shell paints its own 44px title bar, so the window keeps only the
    // traffic lights and lets the page run to the top edge.
    .windowStyle(.hiddenTitleBar)
    .commands {
      AdminCommands(adminURL: adminURL)
    }

    Settings {
      ConnectionSettings()
    }
  }
}

/// Menu bar entries: new windows, printing, section navigation and the update
/// check. Everything that acts on a page acts on the window in front. The
/// section list is shared with the Windows app so both keep the same shortcuts.
private struct AdminCommands: Commands {
  @FocusedObject private var browser: BrowserController?
  @Environment(\.openWindow) private var openWindow
  let adminURL: URL

  var body: some Commands {
    // Not ⌘N: the shell's inspector already binds that to a section jump, and
    // SwiftUI's own New Window item would take it first.
    CommandGroup(replacing: .newItem) {
      Button("New Window") { openWindow(id: "admin") }
        .keyboardShortcut("n", modifiers: [.command, .shift])
    }

    CommandGroup(replacing: .printItem) {
      Button("Print…") { browser?.print() }
        .keyboardShortcut("p", modifiers: .command)
        .disabled(browser == nil)
    }

    CommandGroup(after: .toolbar) {
      Divider()
      Button("Reload") { browser?.reload() }
        .keyboardShortcut("r", modifiers: .command)
        .disabled(browser == nil)
      Button("Back") { browser?.goBack() }
        .keyboardShortcut("[", modifiers: .command)
        .disabled(browser?.canGoBack != true)
      Button("Forward") { browser?.goForward() }
        .keyboardShortcut("]", modifiers: .command)
        .disabled(browser?.canGoForward != true)
    }

    CommandMenu("Go") {
      ForEach(AdminSections.groups) { group in
        Section(group.label) {
          ForEach(group.sections) { section in
            let button = Button(section.label) { go(to: section.path) }
            if let shortcut = section.shortcut {
              button.keyboardShortcut(KeyEquivalent(shortcut), modifiers: .command)
            } else {
              button
            }
          }
        }
      }

      Divider()

      Button("Open Current Page in Browser") {
        NSWorkspace.shared.open(browser?.currentURL ?? adminURL)
      }
    }

    CommandGroup(replacing: .help) {
      Button("Jose Madrid Salsa Admin Help") {
        NSWorkspace.shared.open(URL(string: "https://salsadocs.vercel.app/docs/guides/desktop-apps")!)
      }
      Button("Check for Updates…") {
        Task { await UpdateChecker.shared.check(interactive: true) }
      }
    }
  }

  /// Move the window in front, or open one if every window is closed.
  private func go(to path: String) {
    if let browser {
      browser.navigate(to: path)
    } else if let url = AdminEndpoint.sectionURL(path, endpoint: adminURL) {
      openWindow(id: "admin", value: url)
    }
  }
}

private struct AdminWorkspace: View {
  let adminURL: URL
  /// Where this window opens, when it was opened at a particular page.
  let startURL: URL?
  @StateObject private var browser = BrowserController()
  @Environment(\.openWindow) private var openWindow

  /// A window restored or opened at a page on a server the app no longer points
  /// at starts on the endpoint instead.
  private var initialURL: URL {
    guard let startURL, AdminEndpoint.isInternal(startURL, endpoint: adminURL) else { return adminURL }
    return startURL
  }

  var body: some View {
    AdminBrowser(initialURL: initialURL, controller: browser)
      .onAppear {
        browser.endpoint = adminURL
        DesktopAttention.shared.openWindow = openWindow
        UpdateChecker.shared.start()
      }
      .onChange(of: adminURL) { _, newValue in
        browser.endpoint = newValue
        browser.load(newValue)
      }
      .focusedSceneObject(browser)
      .overlay {
        if let error = browser.errorMessage {
          ContentUnavailableView {
            Label("Cannot reach Jose Madrid Salsa", systemImage: "wifi.exclamationmark")
          } description: {
            Text(error)
          } actions: {
            Button("Try Again") { browser.load(initialURL) }
          }
          .frame(maxWidth: .infinity, maxHeight: .infinity)
          .background(Color(nsColor: .windowBackgroundColor))
        }
      }
      // The shell runs edge to edge; the traffic lights float over its own bar.
      .ignoresSafeArea()
  }
}

/// Editable copy of the stored endpoint. `@State` would be its natural home,
/// but `State` is a macro in the current SDK and its plugin ships only with a
/// full Xcode install, so view-local state lives in an `ObservableObject` and
/// the shell keeps building against the standalone Command Line Tools.
private final class ConnectionDraft: ObservableObject {
  @Published var url = ""
  @Published var validationMessage: String?
  @Published var receiptMessage: String?
}

private struct ConnectionSettings: View {
  @AppStorage("adminEndpoint") private var endpoint = AdminEndpoint.production.absoluteString
  /// Where shipping labels print without a panel. Empty means ask each time.
  @AppStorage("labelPrinter") private var labelPrinter = ""
  /// `letter` draws the 4×6 label on a letter sheet, to cut out; `4x6` is label stock.
  @AppStorage("labelPaper") private var labelPaper = "letter"
  /// Where packing slips print without a panel. Empty means ask each time.
  @AppStorage("documentPrinter") private var documentPrinter = ""
  /// The receipt printer: `off`, `network` (host and port) or `printer` (installed, sent raw).
  @AppStorage("receiptMode") private var receiptMode = "off"
  @AppStorage("receiptHost") private var receiptHost = ""
  @AppStorage("receiptPort") private var receiptPort = "9100"
  @AppStorage("receiptPrinter") private var receiptPrinter = ""
  /// When receipts were switched on. Orders placed before it are not printed.
  @AppStorage("receiptsEnabledAt") private var receiptsEnabledAt = 0.0
  @StateObject private var draft = ConnectionDraft()

  var body: some View {
    Form {
      TextField("Admin URL", text: $draft.url)
        .textFieldStyle(.roundedBorder)
      Text("HTTPS is required except for localhost development.")
        .font(.caption)
        .foregroundStyle(.secondary)
      if let validationMessage = draft.validationMessage {
        Text(validationMessage).foregroundStyle(.red)
      }
      Picker("Label printer", selection: $labelPrinter) {
        Text("Ask each time").tag("")
        ForEach(NSPrinter.printerNames, id: \.self) { name in
          Text(name).tag(name)
        }
        // A saved printer that is no longer installed still shows, so it is
        // clear why labels have started asking.
        if !labelPrinter.isEmpty && !NSPrinter.printerNames.contains(labelPrinter) {
          Text("\(labelPrinter) (not found)").tag(labelPrinter)
        }
      }
      Text("Shipping labels print here without a dialog.")
        .font(.caption)
        .foregroundStyle(.secondary)
      Picker("Label paper", selection: $labelPaper) {
        Text("Letter sheet (label printed 4×6 to cut out)").tag("letter")
        Text("4×6 label stock").tag("4x6")
      }
      printerPicker("Packing slip printer", selection: $documentPrinter, empty: "Ask each time")

      Divider()
      Picker("Receipt printer", selection: $receiptMode) {
        Text("Off").tag("off")
        Text("Network (Ethernet)").tag("network")
        Text("Installed printer (USB)").tag("printer")
      }
      .onChange(of: receiptMode) { previous, current in
        // Switching receipts on starts the clock: orders already in are not printed.
        if previous == "off" && current != "off" { receiptsEnabledAt = Date().timeIntervalSince1970 }
      }
      if receiptMode == "network" {
        HStack {
          TextField("IP address", text: $receiptHost, prompt: Text("192.168.1.87"))
          TextField("Port", text: $receiptPort).frame(width: 70)
        }
        .textFieldStyle(.roundedBorder)
      }
      if receiptMode == "printer" {
        printerPicker("Printer", selection: $receiptPrinter, empty: "Choose…")
      }
      Text("Every new order prints a ticket here (80mm ESC/POS). Orders already in when you switch it on are not printed.")
        .font(.caption)
        .foregroundStyle(.secondary)
      HStack {
        Button("Print a Test Ticket") { testReceipt() }
          .disabled(receiptMode == "off")
        if let receiptMessage = draft.receiptMessage {
          Text(receiptMessage).font(.caption).foregroundStyle(.secondary)
        }
      }

      HStack {
        Spacer()
        Button("Use Production") {
          draft.url = AdminEndpoint.production.absoluteString
          save()
        }
        Button("Save") { save() }
          .keyboardShortcut(.defaultAction)
      }
    }
    .padding(24)
    .frame(width: 500)
    // Show what the app is actually pointed at, which may have been migrated
    // forward from the pre-shell default.
    .onAppear { draft.url = AdminEndpoint.migratingLegacyDefault(endpoint) }
  }

  /// Every installed printer, plus a saved one that is no longer installed so it is clear why printing asks.
  private func printerPicker(_ title: String, selection: Binding<String>, empty: String) -> some View {
    Picker(title, selection: selection) {
      Text(empty).tag("")
      ForEach(NSPrinter.printerNames, id: \.self) { name in
        Text(name).tag(name)
      }
      if !selection.wrappedValue.isEmpty && !NSPrinter.printerNames.contains(selection.wrappedValue) {
        Text("\(selection.wrappedValue) (not found)").tag(selection.wrappedValue)
      }
    }
  }

  private func testReceipt() {
    let parsed = ReceiptConnection.parse(mode: receiptMode, host: receiptHost, port: receiptPort, printer: receiptPrinter)
    switch parsed {
    case .failure(let error):
      draft.receiptMessage = error.message
    case .success(let connection):
      draft.receiptMessage = "Sending…"
      Task { @MainActor in
        let failure = await ReceiptPrinter.send(ReceiptLog.testTicket(at: Date()), to: connection)
        draft.receiptMessage = failure ?? "Sent. If nothing printed, check the connection."
      }
    }
  }

  private func save() {
    guard let url = AdminEndpoint.validated(draft.url) else {
      draft.validationMessage = "Enter an HTTPS URL or a localhost HTTP URL."
      return
    }
    endpoint = url.absoluteString
    draft.url = endpoint
    draft.validationMessage = nil
  }
}
