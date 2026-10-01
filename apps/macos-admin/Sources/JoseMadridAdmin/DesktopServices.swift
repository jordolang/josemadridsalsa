import AppKit
import SwiftUI
import UserNotifications

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

    let content = UNMutableNotificationContent()
    content.title = String(title.prefix(120))
    content.body = String(body.prefix(240))
    content.sound = .default
    content.userInfo = ["target": target.absoluteString]
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
/// with none, or one no longer installed, the print panel opens.
@MainActor
enum LabelPrinter {
  /// 4×6 inches in points.
  private static let page = NSSize(width: 288, height: 432)

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

    let view = NSImageView(frame: NSRect(origin: .zero, size: page))
    view.image = image
    view.imageScaling = .scaleProportionallyUpOrDown

    let info = NSPrintInfo()
    info.paperSize = page
    info.topMargin = 0
    info.bottomMargin = 0
    info.leftMargin = 0
    info.rightMargin = 0
    info.horizontalPagination = .fit
    info.verticalPagination = .fit
    info.isHorizontallyCentered = true
    info.isVerticallyCentered = true

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
