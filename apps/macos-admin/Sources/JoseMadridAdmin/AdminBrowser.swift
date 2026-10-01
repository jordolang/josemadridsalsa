import AppKit
import SwiftUI
import WebKit
import UniformTypeIdentifiers

@MainActor
final class BrowserController: ObservableObject {
  enum ConnectionState {
    case connecting
    case connected
    case offline
  }

  @Published private(set) var canGoBack = false
  @Published private(set) var canGoForward = false
  @Published private(set) var isLoading = false
  @Published private(set) var currentURL: URL?
  @Published var errorMessage: String?
  @Published private(set) var connectionState = ConnectionState.connecting

  weak var webView: WKWebView?

  /// The endpoint the window is currently pointed at. Navigation policy is
  /// decided against this, so it is kept in step with the stored setting rather
  /// than re-read from defaults on every navigation.
  var endpoint: URL = AdminEndpoint.production

  init() {
    DesktopAttention.shared.register(self)
  }

  func load(_ url: URL) {
    errorMessage = nil
    connectionState = .connecting
    webView?.load(URLRequest(url: url))
  }

  func goBack() { webView?.goBack() }
  func goForward() { webView?.goForward() }
  func reload() { webView?.reload() }

  func navigate(to path: String) {
    guard let url = AdminEndpoint.sectionURL(path, endpoint: endpoint) else { return }
    load(url)
  }

  /// Print whatever the window is showing — invoices, packing slips, shipping
  /// labels and the daily reports all print straight from the admin pages.
  func print() {
    guard let webView else { return }
    let info = NSPrintInfo.shared
    info.horizontalPagination = .fit
    info.verticalPagination = .automatic
    let operation = webView.printOperation(with: info)
    operation.view?.frame = webView.bounds
    operation.runModal(for: webView.window ?? NSApp.mainWindow ?? NSWindow(),
                       delegate: nil,
                       didRun: nil,
                       contextInfo: nil)
  }

  func update(from webView: WKWebView) {
    canGoBack = webView.canGoBack
    canGoForward = webView.canGoForward
    isLoading = webView.isLoading
    currentURL = webView.url
  }

  func didConnect() {
    connectionState = .connected
  }

  func didDisconnect() {
    connectionState = .offline
  }
}

struct AdminBrowser: NSViewRepresentable {
  let initialURL: URL
  @ObservedObject var controller: BrowserController

  func makeCoordinator() -> Coordinator {
    Coordinator(controller: controller)
  }

  /// Tells the desktop shell which frame it is running inside, and gives it
  /// the two native calls it has: a notification and the dock badge.
  ///
  /// The window has no title bar of its own, so the real traffic lights float
  /// over the top-left of the page and the shell has to leave that corner clear
  /// rather than drawing its own. The calls post to `bridgeName`, and the
  /// coordinator only acts on messages from the admin origin's top frame.
  private static let bridgeName = "jmsDesktop"
  private static let frameMarker = """
  (function () {
    var post = function (message) { window.webkit.messageHandlers.jmsDesktop.postMessage(message); };
    Object.defineProperty(window, 'jmsDesktop', {
      value: Object.freeze({
        platform: 'darwin',
        chrome: 'traffic-lights',
        notify: function (alert) {
          alert = alert || {};
          post({ type: 'notify', title: String(alert.title || ''), body: String(alert.body || ''), path: String(alert.path || '') });
        },
        setBadge: function (count) { post({ type: 'badge', count: Number(count) || 0 }); },
        printLabel: function (url) { post({ type: 'printLabel', url: String(url || '') }); }
      }),
      writable: false, configurable: false
    });
  })();
  """

  func makeNSView(context: Context) -> WKWebView {
    let configuration = WKWebViewConfiguration()
    configuration.websiteDataStore = .default()
    configuration.preferences.isElementFullscreenEnabled = true
    // Google and GitHub refuse to serve sign-in to anything they detect as an
    // embedded webview, and WKWebView's default user agent omits the Safari
    // tokens they look for. Present as the Safari build underneath.
    configuration.applicationNameForUserAgent = "Version/18.0 Safari/605.1.15"
    configuration.userContentController.addUserScript(
      WKUserScript(source: Self.frameMarker, injectionTime: .atDocumentStart, forMainFrameOnly: true)
    )
    configuration.userContentController.add(context.coordinator, name: Self.bridgeName)
    // The shell polls its badge counts so a new order can be announced while
    // the window is hidden. WebKit would otherwise suspend a hidden page's
    // timers and the poll would stop with it.
    configuration.preferences.inactiveSchedulingPolicy = .none

    let webView = WKWebView(frame: .zero, configuration: configuration)
    // Matches the shell's window colour so a reload does not flash white.
    webView.underPageBackgroundColor = NSColor(
      name: nil,
      dynamicProvider: { appearance in
        appearance.bestMatch(from: [.darkAqua, .aqua]) == .darkAqua
          ? NSColor(srgbRed: 0.125, green: 0.114, blue: 0.106, alpha: 1)  // #201d1b
          : NSColor(srgbRed: 0.945, green: 0.929, blue: 0.914, alpha: 1)  // #f1ede9
      }
    )
    webView.navigationDelegate = context.coordinator
    webView.uiDelegate = context.coordinator
    webView.allowsMagnification = true
    webView.allowsBackForwardNavigationGestures = true
    controller.webView = webView
    controller.load(initialURL)
    return webView
  }

  func updateNSView(_ webView: WKWebView, context: Context) {
    controller.webView = webView
  }

  final class Coordinator: NSObject, WKNavigationDelegate, WKUIDelegate, WKDownloadDelegate, WKScriptMessageHandler {
    let controller: BrowserController

    init(controller: BrowserController) {
      self.controller = controller
    }

    // MARK: Page bridge

    /// A notification or a badge count from the admin page. Taken only from the
    /// top frame of the admin origin, so a sign-in provider's page cannot post
    /// one, and a click can only ever open a section of the shell.
    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
      let origin = message.frameInfo.securityOrigin
      guard message.frameInfo.isMainFrame,
            AdminEndpoint.isEndpointOrigin(
              scheme: origin.protocol, host: origin.host, port: origin.port, endpoint: controller.endpoint
            ),
            let body = message.body as? [String: Any],
            let type = body["type"] as? String
      else { return }

      switch type {
      case "notify":
        guard let title = body["title"] as? String, !title.isEmpty,
              let path = body["path"] as? String,
              let target = AdminEndpoint.notificationTarget(path, endpoint: controller.endpoint)
        else { return }
        DesktopAttention.shared.notify(title: title, body: body["body"] as? String ?? "", target: target)
      case "badge":
        guard let count = body["count"] as? Int, count >= 0 else { return }
        DesktopAttention.shared.setBadge(count)
      case "printLabel":
        guard let value = body["url"] as? String, let url = AdminEndpoint.labelURL(value) else { return }
        Task { await LabelPrinter.print(url, in: controller.webView?.window) }
      default:
        return
      }
    }

    // MARK: Navigation policy

    /// Keep the app on its own origin and its sign-in providers. Anything else
    /// opens in the default browser, so a Stripe dashboard link or a customer's
    /// site never inherits this window's session.
    func webView(
      _ webView: WKWebView,
      decidePolicyFor navigationAction: WKNavigationAction,
      decisionHandler: @escaping (WKNavigationActionPolicy) -> Void
    ) {
      guard let url = navigationAction.request.url else {
        decisionHandler(.allow)
        return
      }

      if AdminEndpoint.shouldOpenInApp(url, endpoint: controller.endpoint) {
        // A link marked `download` — the shell's CSV export — is saved, not
        // shown. WebKit leaves that decision to the app.
        decisionHandler(navigationAction.shouldPerformDownload ? .download : .allow)
        return
      }

      decisionHandler(.cancel)
      if AdminEndpoint.isSafeExternal(url) {
        NSWorkspace.shared.open(url)
      }
    }

    /// Anything the web view cannot display — ZIP archives, label files — or
    /// that the server sends as an attachment becomes a download rather than a
    /// blank page. The attachment check matters for CSV: WebKit can show
    /// `text/csv` as plain text, and would, in place of the admin.
    func webView(
      _ webView: WKWebView,
      decidePolicyFor navigationResponse: WKNavigationResponse,
      decisionHandler: @escaping (WKNavigationResponsePolicy) -> Void
    ) {
      let disposition = (navigationResponse.response as? HTTPURLResponse)?
        .value(forHTTPHeaderField: "Content-Disposition")?
        .lowercased() ?? ""
      let attachment = disposition.hasPrefix("attachment")
      decisionHandler(navigationResponse.canShowMIMEType && !attachment ? .allow : .download)
    }

    func webView(_ webView: WKWebView, navigationAction: WKNavigationAction, didBecome download: WKDownload) {
      download.delegate = self
    }

    func webView(_ webView: WKWebView, navigationResponse: WKNavigationResponse, didBecome download: WKDownload) {
      download.delegate = self
    }

    // MARK: Downloads

    func download(
      _ download: WKDownload,
      decideDestinationUsing response: URLResponse,
      suggestedFilename: String,
      completionHandler: @escaping (URL?) -> Void
    ) {
      let panel = NSSavePanel()
      panel.nameFieldStringValue = suggestedFilename
      panel.canCreateDirectories = true
      panel.isExtensionHidden = false

      let window = controller.webView?.window
      let handle: (NSApplication.ModalResponse) -> Void = { result in
        completionHandler(result == .OK ? panel.url : nil)
      }

      if let window {
        panel.beginSheetModal(for: window, completionHandler: handle)
      } else {
        handle(panel.runModal())
      }
    }

    func downloadDidFinish(_ download: WKDownload) {
      guard let url = download.progress.fileURL else { return }
      NSWorkspace.shared.activateFileViewerSelecting([url])
    }

    func download(_ download: WKDownload, didFailWithError error: Error, resumeData: Data?) {
      controller.errorMessage = error.localizedDescription
    }

    // MARK: Load lifecycle

    func webView(_ webView: WKWebView, didStartProvisionalNavigation navigation: WKNavigation?) {
      controller.update(from: webView)
    }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation?) {
      controller.errorMessage = nil
      controller.didConnect()
      controller.update(from: webView)
    }

    func webView(
      _ webView: WKWebView,
      didFailProvisionalNavigation navigation: WKNavigation?,
      withError error: Error
    ) {
      // A cancelled navigation is routine — it is what an external link handed
      // to the browser looks like from here, not a connection problem.
      if (error as NSError).code == NSURLErrorCancelled { return }
      controller.errorMessage = error.localizedDescription
      controller.didDisconnect()
      controller.update(from: webView)
    }

    func webView(
      _ webView: WKWebView,
      createWebViewWith configuration: WKWebViewConfiguration,
      for navigationAction: WKNavigationAction,
      windowFeatures: WKWindowFeatures
    ) -> WKWebView? {
      guard let url = navigationAction.request.url else { return nil }

      // A link the admin opens in a new tab opens a new admin window, sharing
      // this one's session. A sign-in provider's popup stays in this window.
      if AdminEndpoint.isInternal(url, endpoint: controller.endpoint) {
        DesktopAttention.shared.open(url)
      } else if AdminEndpoint.isAuthURL(url) {
        webView.load(URLRequest(url: url))
      } else if AdminEndpoint.isSafeExternal(url) {
        NSWorkspace.shared.open(url)
      }

      return nil
    }
  }
}
