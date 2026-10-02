import UIKit

/// Any AirPrint printer, chosen once with the system picker and then printed to silently.
@MainActor
final class AirPrintPrinter: NSObject, ReceiptPrinter, UIPrintInteractionControllerDelegate {
    private let printer: UIPrinter
    private let name: String
    private var probeTimer: Timer?
    private var lineCount = 0

    private(set) var connected = false { didSet { if connected != oldValue { onStatusChange?() } } }
    var onStatusChange: (() -> Void)?
    var displayName: String { name }

    init(url: URL, name: String) {
        printer = UIPrinter(url: url)
        self.name = name
        super.init()
    }

    func start() {
        probe()
        probeTimer = Timer.scheduledTimer(withTimeInterval: 30, repeats: true) { [weak self] _ in
            Task { @MainActor in self?.probe() }
        }
    }

    func stop() {
        probeTimer?.invalidate()
        probeTimer = nil
    }

    private func probe() {
        printer.contactPrinter { [weak self] available in
            Task { @MainActor in self?.connected = available }
        }
    }

    func print(_ lines: [PrintLine]) async throws {
        let controller = UIPrintInteractionController.shared
        let info = UIPrintInfo(dictionary: nil)
        info.outputType = .grayscale
        info.jobName = "Jose Madrid receipt"
        controller.printInfo = info
        controller.printFormatter = UIMarkupTextPrintFormatter(markupText: Self.html(lines))
        controller.delegate = self
        lineCount = lines.count

        let (completed, error): (Bool, Error?) = await withCheckedContinuation { cont in
            controller.print(to: printer) { _, completed, error in cont.resume(returning: (completed, error)) }
        }
        if let error { throw error }
        if !completed { throw PrinterError("AirPrint job did not complete") }
    }

    // MARK: Receipt-roll sizing

    private var rollWidth: CGFloat { KioskSettings.shared.columns == 32 ? 164 : 226 } // 58mm / 80mm in points

    func printInteractionController(_ controller: UIPrintInteractionController, choosePaper paperList: [UIPrintPaper]) -> UIPrintPaper {
        UIPrintPaper.bestPaper(forPageSize: CGSize(width: rollWidth, height: cutLength), withPapersFrom: paperList)
    }

    func printInteractionController(_ controller: UIPrintInteractionController, cutLengthFor paper: UIPrintPaper) -> CGFloat {
        cutLength
    }

    /// 7pt monospace lines at ~10pt leading, plus margins; roll printers cut here instead of a page length.
    private var cutLength: CGFloat { CGFloat(lineCount) * 11 + 72 }

    static func html(_ lines: [PrintLine]) -> String {
        let body = lines.map { line -> String in
            let size: Int = switch line.size { case .normal: 7; case .tall: 10; case .double: 14 }
            let text = line.text
                .replacingOccurrences(of: "&", with: "&amp;")
                .replacingOccurrences(of: "<", with: "&lt;")
                .replacingOccurrences(of: ">", with: "&gt;")
            return "<div style=\"font-size:\(size)pt;font-weight:\(line.bold ? 700 : 400);text-align:\(line.align == .center ? "center" : "left")\">\(text.isEmpty ? "&nbsp;" : text)</div>"
        }.joined()
        return "<html><body style=\"margin:0;font-family:Menlo,Courier,monospace;white-space:pre;line-height:1.35\">\(body)</body></html>"
    }
}

/// Shows the system AirPrint picker from the key window.
@MainActor
enum AirPrintPicker {
    static func choose(completion: @escaping (UIPrinter?) -> Void) {
        let picker = UIPrinterPickerController(initiallySelectedPrinter: nil)
        let root = UIApplication.shared.connectedScenes
            .compactMap { ($0 as? UIWindowScene)?.keyWindow?.rootViewController }
            .first
        guard let root, let view = topmost(root).view else { return completion(nil) }
        let anchor = CGRect(x: view.bounds.midX, y: view.bounds.midY, width: 1, height: 1)
        picker.present(from: anchor, in: view, animated: true) { controller, selected, _ in
            completion(selected ? controller.selectedPrinter : nil)
        }
    }

    private static func topmost(_ vc: UIViewController) -> UIViewController {
        vc.presentedViewController.map(topmost) ?? vc
    }
}
