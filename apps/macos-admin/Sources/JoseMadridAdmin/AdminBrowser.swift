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

  func makeNSView(context: Context) -> WKWebView {
    let configuration = WKWebViewConfiguration()
    configuration.websiteDataStore = .default()
    configuration.preferences.isElementFullscreenEnabled = true
    // Google and GitHub refuse to serve sign-in to anything they detect as an
    // embedded webview, and WKWebView's default user agent omits the Safari
    // tokens they look for. Present as the Safari build underneath.
    configuration.applicationNameForUserAgent = "Version/18.0 Safari/605.1.15"

    let webView = WKWebView(frame: .zero, configuration: configuration)
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

  final class Coordinator: NSObject, WKNavigationDelegate, WKUIDelegate, WKDownloadDelegate {
    let controller: BrowserController

    init(controller: BrowserController) {
      self.controller = controller
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
        decisionHandler(.allow)
        return
      }

      decisionHandler(.cancel)
      if AdminEndpoint.isSafeExternal(url) {
        NSWorkspace.shared.open(url)
      }
    }

    /// Anything the web view cannot display — CSV exports, ZIP archives, label
    /// files — becomes a download rather than a blank page.
    func webView(
      _ webView: WKWebView,
      decidePolicyFor navigationResponse: WKNavigationResponse,
      decisionHandler: @escaping (WKNavigationResponsePolicy) -> Void
    ) {
      decisionHandler(navigationResponse.canShowMIMEType ? .allow : .download)
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

      if AdminEndpoint.shouldOpenInApp(url, endpoint: controller.endpoint) {
        webView.load(URLRequest(url: url))
      } else if AdminEndpoint.isSafeExternal(url) {
        NSWorkspace.shared.open(url)
      }

      return nil
    }
  }
}
