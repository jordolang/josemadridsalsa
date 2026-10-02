import Foundation

/// A receipt printer backend. iPadOS cannot drive generic USB printers (there is no USB host
/// API for third-party apps), so USB printing is only possible through Star's MFi printers.
@MainActor
protocol ReceiptPrinter: AnyObject {
    var displayName: String { get }
    /// Last known reachability; backends call `onStatusChange` when it flips.
    var connected: Bool { get }
    var onStatusChange: (() -> Void)? { get set }
    func start()
    func stop()
    func print(_ lines: [PrintLine]) async throws
}

struct PrinterError: LocalizedError {
    let errorDescription: String?
    init(_ message: String) { errorDescription = message }
}

/// Owns the active printer, built from settings, and reports its status to the web page.
@MainActor
final class PrinterHub: ObservableObject {
    static let shared = PrinterHub()

    @Published private(set) var status = (connected: false, name: "")
    private var printer: ReceiptPrinter?
    private var config: PrinterConfig = .none

    /// Rebuild the backend when the configuration changes.
    func apply(_ newConfig: PrinterConfig) {
        guard newConfig != config || printer == nil else { return }
        printer?.stop()
        config = newConfig
        printer = Self.make(newConfig)
        printer?.onStatusChange = { [weak self] in self?.publish() }
        printer?.start()
        publish()
    }

    func print(_ receipt: Receipt) async throws {
        try await print(ReceiptLayout.receipt(receipt, columns: KioskSettings.shared.columns))
    }

    func printTest() async throws {
        try await print(ReceiptLayout.testPage(columns: KioskSettings.shared.columns))
    }

    private func print(_ lines: [PrintLine]) async throws {
        guard let printer else { throw PrinterError("No printer is set up") }
        try await printer.print(lines)
    }

    private func publish() {
        status = (printer?.connected ?? false, printer?.displayName ?? "")
    }

    private static func make(_ config: PrinterConfig) -> ReceiptPrinter? {
        switch config {
        case .none: return nil
        case let .network(host, port): return NetworkPrinter(host: host, port: port)
        case let .bluetooth(id, name): return BluetoothPrinter(id: id, name: name)
        case let .airPrint(url, name): return AirPrintPrinter(url: url, name: name)
        case let .star(interface, identifier, name): return StarReceiptPrinter(interface: interface, identifier: identifier, name: name)
        }
    }
}
