import AppKit
import Network
import SwiftUI
import UserNotifications
import WebKit

/// The app-wide side of the page bridge: notifications, the dock badge, and
/// opening another window.
///
/// The admin page in each window polls its badge counts and calls
/// `jmsDesktop.notify` / `setBadge` when work arrives. Those calls land here,
/// already checked against the admin origin by the window that received them.
/// One instance serves every window, which is what lets two windows that both
/// saw the same new order announce it once.
@MainActor
final class DesktopAttention: NSObject, UNUserNotificationCenterDelegate {
  static let shared = DesktopAttention()

  /// Set by the first window to appear. SwiftUI hands out `openWindow` only to
  /// views, and the web view's coordinator — which is where a page asking for a
  /// new window arrives — is not one.
  var openWindow: OpenWindowAction?

  /// Every open window's controller, so a notification click can reuse one.
  private var controllers: [WeakController] = []
  private var shown: [String: Date] = [:]
  private var authorised = false

  private struct WeakController {
    weak var value: BrowserController?
  }

  private override init() {
    super.init()
    UNUserNotificationCenter.current().delegate = self
  }

  func register(_ controller: BrowserController) {
    controllers.removeAll { $0.value == nil || $0.value === controller }
    controllers.append(WeakController(value: controller))
  }

  /// Open a new admin window at `url`.
  func open(_ url: URL) {
    openWindow?(value: url)
  }

  /// The dock icon's red badge: the total still waiting, or nothing at zero.
  func setBadge(_ count: Int) {
    NSApp.dockTile.badgeLabel = count > 0 ? String(min(count, 9999)) : nil
  }

  func notify(title: String, body: String, target: URL) {
    // Every window polls the same counts; show each alert once.
    let now = Date()
    shown = shown.filter { now.timeIntervalSince($0.value) < 90 }
    let key = "\(title)\u{0}\(body)"
    guard shown[key] == nil else { return }
    shown[key] = now

    post(title: title, body: body, target: target)
  }

  /// A notification about the app itself — a printer that did not print —
  /// with nowhere for a click to go.
  func alert(title: String, body: String) {
    post(title: title, body: body, target: nil)
  }

  private func post(title: String, body: String, target: URL?) {
    let content = UNMutableNotificationContent()
    content.title = String(title.prefix(120))
    content.body = String(body.prefix(240))
    content.sound = .default
    if let target { content.userInfo = ["target": target.absoluteString] }
    let request = UNNotificationRequest(identifier: UUID().uuidString, content: content, trigger: nil)

    let post = { UNUserNotificationCenter.current().add(request) }
    if authorised {
      post()
      return
    }
    // Asked on the first alert rather than at launch, so the system prompt
    // appears when there is something to show and says why.
    UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .sound, .badge]) { granted, _ in
      guard granted else { return }
      Task { @MainActor in
        self.authorised = true
        post()
      }
    }
    NSApp.requestUserAttention(.informationalRequest)
  }

  // MARK: UNUserNotificationCenterDelegate

  /// Show the banner even while the app is in front — the window may be on
  /// another section, or on another screen.
  nonisolated func userNotificationCenter(
    _ center: UNUserNotificationCenter,
    willPresent notification: UNNotification,
    withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void
  ) {
    completionHandler([.banner, .sound])
  }

  nonisolated func userNotificationCenter(
    _ center: UNUserNotificationCenter,
    didReceive response: UNNotificationResponse,
    withCompletionHandler completionHandler: @escaping () -> Void
  ) {
    let target = (response.notification.request.content.userInfo["target"] as? String).flatMap(URL.init(string:))
    Task { @MainActor in
      defer { completionHandler() }
      guard let target else { return }
      NSApp.activate()
      if let controller = self.controllers.lazy.compactMap(\.value).first {
        controller.webView?.window?.makeKeyAndOrderFront(nil)
        controller.load(target)
      } else {
        self.open(target)
      }
    }
  }
}

/// Checks the update feed and offers the new disk image.
///
/// The app is ad-hoc signed until a Developer ID certificate is configured, and
/// macOS will not let an ad-hoc app replace itself quietly — so this offers the
/// download rather than installing it. The Windows app installs its own updates
/// from the same feed.
@MainActor
final class UpdateChecker {
  static let shared = UpdateChecker()

  private var timer: Timer?
  private var offered: String?

  private var currentVersion: String {
    Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String ?? "0"
  }

  /// Check now and every six hours after, staying quiet unless there is news.
  func start() {
    guard timer == nil else { return }
    Task { await check(interactive: false) }
    timer = Timer.scheduledTimer(withTimeInterval: 6 * 60 * 60, repeats: true) { _ in
      Task { @MainActor in await UpdateChecker.shared.check(interactive: false) }
    }
  }

  /// `interactive` is the menu item: it also says when there is nothing new,
  /// or that the feed could not be reached.
  func check(interactive: Bool) async {
    var request = URLRequest(url: UpdateFeed.manifest)
    request.cachePolicy = .reloadIgnoringLocalCacheData

    let latest: String?
    do {
      let (data, response) = try await URLSession.shared.data(for: request)
      let ok = (response as? HTTPURLResponse).map { (200..<300).contains($0.statusCode) } ?? false
      latest = ok ? UpdateFeed.version(inManifest: String(decoding: data, as: UTF8.self)) : nil
    } catch {
      latest = nil
    }

    guard let latest else {
      if interactive {
        alert("Could not check for updates", "The update server could not be reached. Try again later.")
      }
      return
    }

    guard UpdateFeed.isNewer(latest, than: currentVersion) else {
      if interactive { alert("You are up to date", "Version \(currentVersion) is the latest.") }
      return
    }

    // A background check offers each version once, not every six hours.
    if !interactive && offered == latest { return }
    offered = latest

    let panel = NSAlert()
    panel.messageText = "Version \(latest) is available"
    panel.informativeText =
      "You have \(currentVersion). Download the new disk image, quit this app, and drag the new one into Applications."
    panel.addButton(withTitle: "Download")
    panel.addButton(withTitle: "Later")
    if panel.runModal() == .alertFirstButtonReturn {
      NSWorkspace.shared.open(UpdateFeed.diskImage(for: latest))
    }
  }

  private func alert(_ title: String, _ text: String) {
    let panel = NSAlert()
    panel.messageText = title
    panel.informativeText = text
    panel.runModal()
  }
}

/// Prints a 4×6 shipping label on the printer chosen in Settings.
///
/// The label is an image on the carrier's host. It is downloaded and drawn in
/// a view of its own — never loaded in the admin window — so that host gets no
/// session and no bridge. With a printer chosen the job goes straight to it;
/// with none, or one no longer installed, the print panel opens. On letter
/// paper the label is drawn at 4×6 in the top-left corner, to cut out.
@MainActor
enum LabelPrinter {
  /// 4×6 inches in points.
  private static let label = NSSize(width: 288, height: 432)
  /// US letter in points.
  private static let letter = NSSize(width: 612, height: 792)

  static func print(_ url: URL, in window: NSWindow?) async {
    let image: NSImage
    do {
      let (data, response) = try await URLSession.shared.data(from: url)
      guard (response as? HTTPURLResponse).map({ (200..<300).contains($0.statusCode) }) ?? false,
            let decoded = NSImage(data: data)
      else { throw URLError(.cannotDecodeContentData) }
      image = decoded
    } catch {
      fail("The label image could not be downloaded.", in: window)
      return
    }

    let onLetter = UserDefaults.standard.string(forKey: "labelPaper") != "4x6"
    let page = onLetter ? letter : label
    let imageView = NSImageView(frame: NSRect(origin: .zero, size: label))
    imageView.image = image
    imageView.imageScaling = .scaleProportionallyUpOrDown

    let view: NSView
    if onLetter {
      // Not flipped: the label's origin is its bottom-left, a quarter inch below the top.
      view = NSView(frame: NSRect(origin: .zero, size: page))
      imageView.frame.origin = NSPoint(x: 18, y: page.height - 18 - label.height)
      view.addSubview(imageView)
    } else {
      view = imageView
    }

    let info = NSPrintInfo()
    info.paperSize = page
    info.topMargin = 0
    info.bottomMargin = 0
    info.leftMargin = 0
    info.rightMargin = 0
    info.horizontalPagination = .fit
    info.verticalPagination = .fit
    info.isHorizontallyCentered = !onLetter
    info.isVerticallyCentered = !onLetter

    let chosen = UserDefaults.standard.string(forKey: "labelPrinter") ?? ""
    let printer = chosen.isEmpty ? nil : NSPrinter(name: chosen)
    if let printer { info.printer = printer }

    let operation = NSPrintOperation(view: view, printInfo: info)
    operation.showsPrintPanel = printer == nil
    operation.showsProgressPanel = false
    operation.jobTitle = "Shipping label"
    if !operation.run(), printer != nil {
      fail("\(chosen) did not take the job.", in: window)
    }
  }

  private static func fail(_ text: String, in window: NSWindow?) {
    let alert = NSAlert()
    alert.messageText = "Label not printed"
    alert.informativeText = text
    if let window { alert.beginSheetModal(for: window) } else { alert.runModal() }
  }
}

/// Prints a self-contained HTML page — the packing slip — on the document printer.
///
/// Like the label it is drawn away from the admin window: a web view of its
/// own, with scripts off and a non-persistent data store, so it has no session
/// and no bridge and can only be the page it says it is. WebKit prints a web
/// view only from inside a window, so it sits in one that is never shown.
@MainActor
final class DocumentPrinter: NSObject, WKNavigationDelegate {
  private static var active: [DocumentPrinter] = []

  private let window: NSWindow
  private let webView: WKWebView

  static func print(html: String) {
    let printer = DocumentPrinter()
    active.append(printer)
    printer.webView.loadHTMLString(html, baseURL: nil)
  }

  private override init() {
    let configuration = WKWebViewConfiguration()
    configuration.websiteDataStore = .nonPersistent()
    configuration.defaultWebpagePreferences.allowsContentJavaScript = false
    let frame = NSRect(x: 0, y: 0, width: 816, height: 1056)
    webView = WKWebView(frame: frame, configuration: configuration)
    window = NSWindow(contentRect: frame, styleMask: [.borderless], backing: .buffered, defer: false)
    window.isReleasedWhenClosed = false
    window.contentView = webView
    super.init()
    webView.navigationDelegate = self
  }

  func webView(_ webView: WKWebView, didFinish navigation: WKNavigation?) {
    let info = NSPrintInfo()
    info.paperSize = NSSize(width: 612, height: 792)
    info.horizontalPagination = .fit
    info.verticalPagination = .automatic
    let chosen = UserDefaults.standard.string(forKey: "documentPrinter") ?? ""
    let printer = chosen.isEmpty ? nil : NSPrinter(name: chosen)
    if let printer { info.printer = printer }

    let operation = webView.printOperation(with: info)
    operation.view?.frame = webView.bounds
    operation.showsPrintPanel = printer == nil
    operation.showsProgressPanel = false
    operation.jobTitle = "Packing slip"
    operation.runModal(for: window, delegate: self, didRun: #selector(printed), contextInfo: nil)
  }

  func webView(_ webView: WKWebView, didFail navigation: WKNavigation?, withError error: Error) {
    finish()
  }

  @objc private func printed(_ operation: NSPrintOperation, success: Bool, contextInfo: UnsafeMutableRawPointer?) {
    finish()
  }

  private func finish() {
    window.close()
    Self.active.removeAll { $0 === self }
  }
}

/// Delivers order tickets to the receipt printer, once per order.
///
/// Over Ethernet that is a raw TCP connection to the printer's port. Over USB
/// it is the printer installed in System Settings with the manufacturer's
/// driver, sent the bytes as a raw CUPS job (`lp -o raw`) so the driver passes
/// them straight through.
@MainActor
enum ReceiptPrinter {
  /// The stored setting. Read on every ticket, so a change in Settings applies at once.
  static var connection: ReceiptConnection {
    let defaults = UserDefaults.standard
    let parsed = ReceiptConnection.parse(
      mode: defaults.string(forKey: "receiptMode") ?? "off",
      host: defaults.string(forKey: "receiptHost") ?? "",
      port: defaults.string(forKey: "receiptPort") ?? "9100",
      printer: defaults.string(forKey: "receiptPrinter") ?? ""
    )
    if case .success(let connection) = parsed { return connection }
    return .off
  }

  /// A printer that is off or out of paper gets this many more tries, a minute apart.
  private static let retries = 10

  /// Print a ticket from the page, unless it printed already. The order is
  /// recorded first, so a second window polling at the same moment cannot
  /// print it too. A printer that fails is tried again every minute for ten
  /// minutes; after that the order is taken off the list and the operator told
  /// to reprint it from the order.
  static func print(_ job: ReceiptJob) {
    guard connection != .off else { return }
    let defaults = UserDefaults.standard
    let printed = defaults.stringArray(forKey: "printedReceipts") ?? []
    let enabledAt = Date(timeIntervalSince1970: defaults.double(forKey: "receiptsEnabledAt"))
    guard ReceiptLog.shouldPrint(job, printed: printed, enabledAt: enabledAt) else { return }
    defaults.set(ReceiptLog.remember(printed, job.orderId), forKey: "printedReceipts")
    Task { await deliver(job, attempt: 0) }
  }

  private static func deliver(_ job: ReceiptJob, attempt: Int) async {
    // Read again on a retry: the printer may have been switched off in Settings meanwhile.
    let target = connection
    guard target != .off, let failure = await send(job.bytes, to: target) else { return }

    let order = job.orderNumber ?? "an order"
    if attempt == 0 {
      DesktopAttention.shared.alert(title: "Receipt not printed", body: "\(order): \(failure) Trying again for ten minutes.")
    }
    if attempt < retries {
      try? await Task.sleep(nanoseconds: 60 * 1_000_000_000)
      await deliver(job, attempt: attempt + 1)
      return
    }
    if !job.reprint {
      let defaults = UserDefaults.standard
      let now = defaults.stringArray(forKey: "printedReceipts") ?? []
      defaults.set(now.filter { $0 != job.orderId }, forKey: "printedReceipts")
    }
    DesktopAttention.shared.alert(
      title: "Receipt not printed",
      body: "Gave up on \(order). Use Print receipt on the order once the printer is back."
    )
  }

  /// Send bytes to a printer. Nil on success, or what went wrong.
  static func send(_ bytes: Data, to target: ReceiptConnection) async -> String? {
    switch target {
    case .off:
      return nil
    case .network(let host, let port):
      return await sendOverNetwork(bytes, host: host, port: port)
    case .printer(let name):
      return await sendToSystemPrinter(bytes, name: name)
    }
  }

  private static func sendOverNetwork(_ bytes: Data, host: String, port: Int) async -> String? {
    guard let endpointPort = NWEndpoint.Port(rawValue: UInt16(port)) else { return "\(port) is not a port." }
    let connection = NWConnection(host: NWEndpoint.Host(host), port: endpointPort, using: .tcp)
    return await withCheckedContinuation { continuation in
      // The state handler, the send and the timeout race on different queues; the first one wins.
      let once = Once()
      let finish: @Sendable (String?) -> Void = { result in
        guard once.claim() else { return }
        connection.cancel()
        continuation.resume(returning: result)
      }
      connection.stateUpdateHandler = { state in
        switch state {
        case .ready:
          connection.send(content: bytes, completion: .contentProcessed { error in
            finish(error.map { "\(host): \($0.localizedDescription)" })
          })
        case .failed(let error), .waiting(let error):
          finish("\(host) did not answer: \(error.localizedDescription)")
        default:
          break
        }
      }
      connection.start(queue: .global(qos: .userInitiated))
      DispatchQueue.global().asyncAfter(deadline: .now() + 8) { finish("\(host) did not answer.") }
    }
  }

  private static func sendToSystemPrinter(_ bytes: Data, name: String) async -> String? {
    let file = FileManager.default.temporaryDirectory.appendingPathComponent("jms-receipt-\(UUID().uuidString).bin")
    do {
      try bytes.write(to: file)
    } catch {
      return "The ticket could not be written: \(error.localizedDescription)"
    }
    defer { try? FileManager.default.removeItem(at: file) }

    let process = Process()
    process.executableURL = URL(fileURLWithPath: "/usr/bin/lp")
    process.arguments = ["-d", name, "-o", "raw", file.path]
    let errors = Pipe()
    process.standardError = errors
    process.standardOutput = Pipe()
    return await withCheckedContinuation { continuation in
      process.terminationHandler = { finished in
        let message = String(decoding: errors.fileHandleForReading.readDataToEndOfFile(), as: UTF8.self)
          .trimmingCharacters(in: .whitespacesAndNewlines)
        continuation.resume(returning: finished.terminationStatus == 0 ? nil : (message.isEmpty ? "\(name) refused the job." : message))
      }
      do {
        try process.run()
      } catch {
        process.terminationHandler = nil
        continuation.resume(returning: "Could not run lp: \(error.localizedDescription)")
      }
    }
  }
}

/// True for the first caller only, from any thread.
private final class Once: @unchecked Sendable {
  private let lock = NSLock()
  private var claimed = false

  func claim() -> Bool {
    lock.lock()
    defer { lock.unlock() }
    if claimed { return false }
    claimed = true
    return true
  }
}
