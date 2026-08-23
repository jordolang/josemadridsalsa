import AppKit
import SwiftUI
import WebKit

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

  func load(_ url: URL) {
    errorMessage = nil
    connectionState = .connecting
    webView?.load(URLRequest(url: url))
  }

  func goBack() { webView?.goBack() }
  func goForward() { webView?.goForward() }
  func reload() { webView?.reload() }

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

    let webView = WKWebView(frame: .zero, configuration: configuration)
    webView.navigationDelegate = context.coordinator
    webView.uiDelegate = context.coordinator
    webView.allowsMagnification = true
    controller.webView = webView
    controller.load(initialURL)
    return webView
  }

  func updateNSView(_ webView: WKWebView, context: Context) {
    controller.webView = webView
  }

  final class Coordinator: NSObject, WKNavigationDelegate, WKUIDelegate {
    let controller: BrowserController

    init(controller: BrowserController) {
      self.controller = controller
    }

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
      if let url = navigationAction.request.url {
        webView.load(URLRequest(url: url))
      }
      return nil
    }
  }
}
