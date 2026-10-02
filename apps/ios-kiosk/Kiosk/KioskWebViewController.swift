import Combine
import UIKit
import WebKit

/// Full-screen web view showing the kiosk page, plus the `window.JMKiosk` bridge the page prints and
/// takes card payments through.
final class KioskWebViewController: UIViewController, WKNavigationDelegate, WKUIDelegate, WKScriptMessageHandler {
    private var webView: KioskWebView!
    private let offline = OfflineView()
    private var retryTimer: Timer?
    private var statusSub: AnyCancellable?
    private var readerSub: AnyCancellable?
    var onStaffGesture: (() -> Void)?

    private var settings: KioskSettings { .shared }

    override var prefersStatusBarHidden: Bool { true }
    override var prefersHomeIndicatorAutoHidden: Bool { true }
    override var canBecomeFirstResponder: Bool { true }

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = Brand.char

        let config = WKWebViewConfiguration()
        config.allowsInlineMediaPlayback = true
        config.mediaTypesRequiringUserActionForPlayback = []
        config.userContentController.add(WeakHandler(self), name: "jmkioskPrint")
        config.userContentController.add(WeakHandler(self), name: "jmkioskPay")

        webView = KioskWebView(frame: .zero, configuration: config)
        webView.navigationDelegate = self
        webView.uiDelegate = self
        webView.allowsLinkPreview = false
        webView.allowsBackForwardNavigationGestures = false
        webView.scrollView.bounces = false
        webView.scrollView.contentInsetAdjustmentBehavior = .never
        webView.scrollView.pinchGestureRecognizer?.isEnabled = false
        webView.isOpaque = false
        webView.backgroundColor = Brand.char
        webView.frame = view.bounds
        webView.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        view.addSubview(webView)

        offline.frame = view.bounds
        offline.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        offline.isHidden = true
        offline.onRetry = { [weak self] in self?.reload() }
        view.addSubview(offline)

        // Staff gesture: hold the top-right 120x120pt corner for 3 seconds.
        let corner = UIView()
        corner.backgroundColor = .clear
        corner.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(corner)
        NSLayoutConstraint.activate([
            corner.topAnchor.constraint(equalTo: view.topAnchor),
            corner.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            corner.widthAnchor.constraint(equalToConstant: 120),
            corner.heightAnchor.constraint(equalToConstant: 120),
        ])
        let hold = UILongPressGestureRecognizer(target: self, action: #selector(staffHold(_:)))
        hold.minimumPressDuration = 3
        corner.addGestureRecognizer(hold)

        statusSub = PrinterHub.shared.$status.sink { [weak self] _ in
            DispatchQueue.main.async { self?.pushStatus() }
        }
        readerSub = SquareCardReader.shared.$state.sink { [weak self] _ in
            DispatchQueue.main.async { self?.pushStatus() }
        }
        reload()
    }

    override func viewDidAppear(_ animated: Bool) {
        super.viewDidAppear(animated)
        focusWebView()
    }

    @objc private func staffHold(_ g: UILongPressGestureRecognizer) {
        if g.state == .began { onStaffGesture?() }
    }

    /// Reload with fresh settings (token, URL) baked into the bridge.
    func reload() {
        let ucc = webView.configuration.userContentController
        ucc.removeAllUserScripts()
        ucc.addUserScript(WKUserScript(source: bridgeScript(), injectionTime: .atDocumentStart, forMainFrameOnly: true))
        // No text selection or callouts; the page is a till, not a document.
        ucc.addUserScript(WKUserScript(source: """
            var s=document.createElement('style');s.textContent='*{-webkit-touch-callout:none;-webkit-user-select:none}';document.documentElement.appendChild(s);
            """, injectionTime: .atDocumentEnd, forMainFrameOnly: true))
        guard let url = settings.url else { return showOffline("The kiosk address in Settings isn't valid.") }
        webView.load(URLRequest(url: url, cachePolicy: .reloadIgnoringLocalCacheData))
    }

    /// A USB or Bluetooth barcode scanner types like a keyboard; keystrokes only reach the page
    /// while the web view is first responder. No input field is focused, so no soft keyboard shows.
    private func focusWebView() {
        webView.becomeFirstResponder()
    }

    // MARK: Bridge

    /// Defines window.JMKiosk only on the configured origin. WKWebView can't answer JS
    /// synchronously, so the token, version and printer status are baked in / pushed from native.
    private func bridgeScript() -> String {
        /// A JSON string literal, which is also a safe JS string literal.
        func js(_ s: String) -> String {
            (try? JSONSerialization.data(withJSONObject: s, options: .fragmentsAllowed)).flatMap { String(data: $0, encoding: .utf8) } ?? "\"\""
        }
        let version = Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? ""
        let status = PrinterHub.shared.status
        return """
        (function () {
          if (location.origin !== \(js(settings.origin ?? ""))) return;
          var status = { connected: \(status.connected), name: \(js(status.name)), permission: true };
          var reader = \(cardReaderJSON());
          window.JMKiosk = {
            getDeviceToken: function () { return \(js(settings.deviceToken)); },
            getAppVersion: function () { return \(js(version)); },
            printerStatus: function () { return JSON.stringify(status); },
            printReceipt: function (json) {
              if (!status.connected) return 'error: no printer connected';
              window.webkit.messageHandlers.jmkioskPrint.postMessage(String(json));
              return 'ok';
            },
            __setStatus: function (s) { status = s; },
            cardReaderStatus: function () { return JSON.stringify(reader); },
            takeCardPayment: function (json) {
              if (!reader.available) return 'error: card payments are not set up on this kiosk';
              window.webkit.messageHandlers.jmkioskPay.postMessage(String(json));
              return 'ok';
            },
            __setCardReader: function (r) { reader = r; },
            __cardResult: function (r) { window.dispatchEvent(new CustomEvent('jmkiosk:card-result', { detail: r })); }
          };
        })();
        """
    }

    private func pushStatus() {
        guard webView != nil else { return }
        let s = PrinterHub.shared.status
        let payload = (try? JSONSerialization.data(withJSONObject: ["connected": s.connected, "name": s.name, "permission": true]))
            .flatMap { String(data: $0, encoding: .utf8) } ?? "{}"
        webView.evaluateJavaScript("window.JMKiosk && window.JMKiosk.__setStatus(\(payload))")
        webView.evaluateJavaScript("window.JMKiosk && window.JMKiosk.__setCardReader(\(cardReaderJSON()))")
    }

    /// What the page sees of the card reader: whether it can take cards right now.
    private func cardReaderJSON() -> String {
        let reader = SquareCardReader.shared
        let object: [String: Any] = [
            "available": reader.state != .unavailable,
            "ready": reader.state == .ready,
            "sandbox": reader.isSandbox,
            "state": reader.state.label,
        ]
        return (try? JSONSerialization.data(withJSONObject: object)).flatMap { String(data: $0, encoding: .utf8) } ?? "{}"
    }

    /// A payment the page asked for: `{ amountCents, referenceId, note }`. The result goes back
    /// as a `jmkiosk:card-result` event carrying the same referenceId.
    private func takeCardPayment(_ json: String) {
        struct Request: Decodable {
            let amountCents: Int
            let referenceId: String
            let note: String?
        }
        guard let request = try? JSONDecoder().decode(Request.self, from: Data(json.utf8)) else {
            return sendCardResult(["status": "failed", "error": "Bad payment request"], referenceId: "")
        }
        Task { @MainActor in
            let result = await SquareCardReader.shared.takePayment(
                amountCents: request.amountCents,
                referenceID: request.referenceId,
                note: request.note ?? "",
                from: self
            )
            sendCardResult(result.json, referenceId: request.referenceId)
            focusWebView()
        }
    }

    private func sendCardResult(_ result: [String: Any], referenceId: String) {
        var payload = result
        payload["referenceId"] = referenceId
        let json = (try? JSONSerialization.data(withJSONObject: payload)).flatMap { String(data: $0, encoding: .utf8) } ?? "{}"
        webView.evaluateJavaScript("window.JMKiosk && window.JMKiosk.__cardResult(\(json))")
    }

    func userContentController(_ ucc: WKUserContentController, didReceive message: WKScriptMessage) {
        let origin = message.frameInfo.securityOrigin
        let messageOrigin = origin.port == 0 ? "\(origin.protocol)://\(origin.host)" : "\(origin.protocol)://\(origin.host):\(origin.port)"
        guard message.frameInfo.isMainFrame, messageOrigin == settings.origin, let json = message.body as? String else { return }
        if message.name == "jmkioskPay" { return takeCardPayment(json) }
        do {
            let receipt = try JSONDecoder().decode(Receipt.self, from: Data(json.utf8))
            Task { @MainActor in
                do { try await PrinterHub.shared.print(receipt) } catch { NSLog("[kiosk] Print failed: \(error.localizedDescription)") }
            }
        } catch {
            NSLog("[kiosk] Bad receipt: \(error)")
        }
    }

    // MARK: Navigation

    func webView(_ webView: WKWebView, decidePolicyFor action: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        guard let url = action.request.url, let origin = settings.origin else { return decisionHandler(.cancel) }
        let target = url.port.map { "\(url.scheme ?? "")://\(url.host ?? ""):\($0)" } ?? "\(url.scheme ?? "")://\(url.host ?? "")"
        // Subframes (e.g. about:blank) may load; the main frame never leaves the kiosk origin.
        let allowed = target == origin || action.targetFrame?.isMainFrame == false || url.scheme == "about"
        decisionHandler(allowed ? .allow : .cancel)
    }

    /// Links that try to open a new window are dropped rather than escaping the kiosk.
    func webView(_ webView: WKWebView, createWebViewWith configuration: WKWebViewConfiguration, for navigationAction: WKNavigationAction, windowFeatures: WKWindowFeatures) -> WKWebView? {
        nil
    }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        retryTimer?.invalidate()
        offline.isHidden = true
        pushStatus()
        focusWebView()
    }

    func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) { failed(error) }
    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) { failed(error) }
    func webViewWebContentProcessDidTerminate(_ webView: WKWebView) { reload() }

    private func failed(_ error: Error) {
        if (error as NSError).code == NSURLErrorCancelled { return }
        showOffline("The kiosk can't reach the internet right now.")
    }

    private func showOffline(_ message: String) {
        offline.message = message
        offline.isHidden = false
        retryTimer?.invalidate()
        retryTimer = Timer.scheduledTimer(withTimeInterval: 15, repeats: false) { [weak self] _ in self?.reload() }
    }
}

/// Keeps the user content controller from retaining the view controller.
private final class WeakHandler: NSObject, WKScriptMessageHandler {
    weak var target: WKScriptMessageHandler?
    init(_ target: WKScriptMessageHandler) { self.target = target }
    func userContentController(_ ucc: WKUserContentController, didReceive message: WKScriptMessage) {
        target?.userContentController(ucc, didReceive: message)
    }
}

/// Never shows the soft keyboard: the page has no text inputs, and scanners are hardware keyboards.
final class KioskWebView: WKWebView {
    override var inputAccessoryView: UIView? { nil }
}

private final class OfflineView: UIView {
    var onRetry: (() -> Void)?
    var message: String = "" { didSet { label.text = message } }
    private let label = UILabel()

    override init(frame: CGRect) {
        super.init(frame: frame)
        backgroundColor = Brand.char
        let title = UILabel()
        title.text = "Be right back"
        title.font = .systemFont(ofSize: 64, weight: .black)
        title.textColor = Brand.cream
        label.font = .systemFont(ofSize: 26, weight: .semibold)
        label.textColor = Brand.cream.withAlphaComponent(0.8)
        label.numberOfLines = 0
        label.textAlignment = .center
        let detail = UILabel()
        detail.text = "Retrying every 15 seconds"
        detail.font = .systemFont(ofSize: 18)
        detail.textColor = Brand.cream.withAlphaComponent(0.55)
        var config = UIButton.Configuration.filled()
        config.title = "Try again"
        config.baseBackgroundColor = Brand.amber
        config.baseForegroundColor = Brand.ink
        config.cornerStyle = .capsule
        config.contentInsets = .init(top: 18, leading: 40, bottom: 18, trailing: 40)
        let button = UIButton(configuration: config, primaryAction: UIAction { [weak self] _ in self?.onRetry?() })
        let stack = UIStackView(arrangedSubviews: [title, label, detail, button])
        stack.axis = .vertical
        stack.alignment = .center
        stack.spacing = 24
        stack.translatesAutoresizingMaskIntoConstraints = false
        addSubview(stack)
        NSLayoutConstraint.activate([
            stack.centerXAnchor.constraint(equalTo: centerXAnchor),
            stack.centerYAnchor.constraint(equalTo: centerYAnchor),
            stack.widthAnchor.constraint(lessThanOrEqualTo: widthAnchor, multiplier: 0.8),
        ])
    }

    required init?(coder: NSCoder) { fatalError("not used") }
}

enum Brand {
    static let char = UIColor(red: 0x0B / 255, green: 0x06 / 255, blue: 0x05 / 255, alpha: 1)
    static let cream = UIColor(red: 1, green: 0xF3 / 255, blue: 0xE0 / 255, alpha: 1)
    static let amber = UIColor(red: 0xF4 / 255, green: 0xA8 / 255, blue: 0x1D / 255, alpha: 1)
    static let red = UIColor(red: 0xD6 / 255, green: 0x28 / 255, blue: 0x28 / 255, alpha: 1)
    static let ink = UIColor(red: 0x24 / 255, green: 0x13 / 255, blue: 0x0A / 255, alpha: 1)
}
