import Foundation
import StarIO10

/// Star Micronics printers over LAN, Bluetooth, Bluetooth LE or USB (MFi Lightning/USB-C models),
/// through Star's StarXpand SDK (StarIO10). Receipts are built with StarXpand commands rather than
/// raw ESC/POS, so they print whether the printer runs StarPRNT or ESC/POS emulation.
@MainActor
final class StarReceiptPrinter: ReceiptPrinter {
    private let settings: StarConnectionSettings
    private let name: String
    private var probeTimer: Timer?
    private var busy = false

    private(set) var connected = false { didSet { if connected != oldValue { onStatusChange?() } } }
    var onStatusChange: (() -> Void)?
    var displayName: String { name }

    init(interface: Int, identifier: String, name: String) {
        settings = StarConnectionSettings(interfaceType: InterfaceType(rawValue: interface) ?? .lan, identifier: identifier)
        self.name = name
    }

    func start() {
        probe()
        probeTimer = Timer.scheduledTimer(withTimeInterval: 20, repeats: true) { [weak self] _ in
            Task { @MainActor in self?.probe() }
        }
    }

    func stop() {
        probeTimer?.invalidate()
        probeTimer = nil
    }

    private func probe() {
        guard !busy else { return }
        Task {
            busy = true
            defer { busy = false }
            let printer = StarPrinter(settings)
            do {
                try await printer.open()
                let status = try await printer.getStatus()
                connected = !status.hasError
            } catch {
                connected = false
            }
            await printer.close()
        }
    }

    func print(_ lines: [PrintLine]) async throws {
        let printerBuilder = StarXpandCommand.PrinterBuilder()
        for line in lines {
            let magnification: StarXpandCommand.MagnificationParameter = switch line.size {
            case .normal: .init(width: 1, height: 1)
            case .tall: .init(width: 1, height: 2)
            case .double: .init(width: 2, height: 2)
            }
            _ = printerBuilder
                .styleAlignment(line.align == .center ? .center : .left)
                .styleBold(line.bold)
                .styleMagnification(magnification)
                .actionPrintText(line.text + "\n")
        }
        _ = printerBuilder.actionCut(.partial)
        let command = StarXpandCommand.StarXpandCommandBuilder()
            .addDocument(StarXpandCommand.DocumentBuilder().addPrinter(printerBuilder))
            .getCommands()

        let printer = StarPrinter(settings)
        do {
            try await printer.open()
            try await printer.print(command: command)
            await printer.close()
            connected = true
        } catch {
            await printer.close()
            connected = false
            throw error
        }
    }
}

/// Finds Star printers on every interface for the settings screen.
@MainActor
final class StarScanner: NSObject, ObservableObject, StarDeviceDiscoveryManagerDelegate {
    struct Device: Identifiable {
        var id: String { "\(interface)-\(identifier)" }
        let interface: Int
        let identifier: String
        let name: String
    }

    @Published private(set) var devices: [Device] = []
    @Published private(set) var scanning = false
    @Published private(set) var error: String?
    private var manager: StarDeviceDiscoveryManager?

    func scan() {
        manager?.stopDiscovery()
        devices = []
        error = nil
        do {
            let m = try StarDeviceDiscoveryManagerFactory.create(interfaceTypes: [.lan, .bluetooth, .bluetoothLE, .usb])
            m.discoveryTime = 10_000
            m.delegate = self
            try m.startDiscovery()
            manager = m
            scanning = true
        } catch {
            self.error = error.localizedDescription
        }
    }

    nonisolated func manager(_ manager: any StarDeviceDiscoveryManager, didFind printer: StarPrinter) {
        let settings = printer.connectionSettings
        let interface = settings.interfaceType.rawValue
        let identifier = settings.identifier
        let model = printer.information.map { "\($0.model)" } ?? "Star printer"
        let label = "\(model) (\(settings.interfaceType))"
        Task { @MainActor in
            guard !devices.contains(where: { $0.interface == interface && $0.identifier == identifier }) else { return }
            devices.append(Device(interface: interface, identifier: identifier, name: label))
        }
    }

    nonisolated func managerDidFinishDiscovery(_ manager: any StarDeviceDiscoveryManager) {
        Task { @MainActor in scanning = false }
    }
}
