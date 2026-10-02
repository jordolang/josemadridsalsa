import CoreBluetooth
import Foundation

/// Service UUIDs common on Bluetooth LE ESC/POS printers; tried first, then any writable characteristic.
private let knownPrinterServices: [CBUUID] = [
    "FF00", "FFE0", "18F0", "E7810A71-73AE-499D-8C15-FAA9AEF0C3F2", "49535343-FE7D-4AE5-8FA9-9FAFD205E455",
].map { CBUUID(string: $0) }

/// Calibration knob: many cheap BLE printers drop data when a write exceeds ~180 bytes even
/// though they advertise a larger MTU. Raise it if a printer handles more.
private let maxChunk = 180

/// A Bluetooth LE ESC/POS printer, chosen once in settings and reconnected by identifier.
@MainActor
final class BluetoothPrinter: NSObject, ReceiptPrinter {
    private let id: UUID
    private let name: String
    private var central: CBCentralManager!
    private var peripheral: CBPeripheral?
    private var characteristic: CBCharacteristic?
    private var pending: [Data] = []
    private var writeDone: ((Error?) -> Void)?

    private(set) var connected = false { didSet { if connected != oldValue { onStatusChange?() } } }
    var onStatusChange: (() -> Void)?
    var displayName: String { name }

    init(id: UUID, name: String) {
        self.id = id
        self.name = name
        super.init()
    }

    func start() {
        central = CBCentralManager(delegate: self, queue: .main, options: [CBCentralManagerOptionShowPowerAlertKey: false])
    }

    func stop() {
        if let peripheral { central?.cancelPeripheralConnection(peripheral) }
        central = nil
    }

    func print(_ lines: [PrintLine]) async throws {
        guard let peripheral, let characteristic, connected else { throw PrinterError("Bluetooth printer \(name) is not connected") }
        guard writeDone == nil else { throw PrinterError("Printer is busy") }
        let type: CBCharacteristicWriteType = characteristic.properties.contains(.writeWithoutResponse) ? .withoutResponse : .withResponse
        let size = max(1, min(peripheral.maximumWriteValueLength(for: type), maxChunk))
        let data = EscPos.encode(lines)
        pending = stride(from: 0, to: data.count, by: size).map { data.subdata(in: $0..<min($0 + size, data.count)) }
        try await withCheckedThrowingContinuation { (cont: CheckedContinuation<Void, Error>) in
            writeDone = { error in
                if let error { cont.resume(throwing: error) } else { cont.resume() }
            }
            pump()
        }
    }

    /// Sends queued chunks: without-response writes go as fast as the peripheral accepts them,
    /// with-response writes one at a time from `didWriteValueFor`.
    private func pump() {
        guard let peripheral, let characteristic else { return finish(PrinterError("Printer disconnected while printing")) }
        let withoutResponse = characteristic.properties.contains(.writeWithoutResponse)
        while let chunk = pending.first {
            if withoutResponse {
                guard peripheral.canSendWriteWithoutResponse else { return }
                pending.removeFirst()
                peripheral.writeValue(chunk, for: characteristic, type: .withoutResponse)
            } else {
                pending.removeFirst()
                peripheral.writeValue(chunk, for: characteristic, type: .withResponse)
                return
            }
        }
        if withoutResponse { finish(nil) }
    }

    private func finish(_ error: Error?) {
        pending = []
        let done = writeDone
        writeDone = nil
        done?(error)
    }

    private func connect() {
        guard let central, central.state == .poweredOn else { return }
        guard let known = central.retrievePeripherals(withIdentifiers: [id]).first else { return }
        peripheral = known
        known.delegate = self
        central.connect(known)
    }
}

extension BluetoothPrinter: CBCentralManagerDelegate, CBPeripheralDelegate {
    nonisolated func centralManagerDidUpdateState(_ central: CBCentralManager) {
        MainActor.assumeIsolated {
            if central.state == .poweredOn { connect() } else { connected = false }
        }
    }

    nonisolated func centralManager(_ central: CBCentralManager, didConnect peripheral: CBPeripheral) {
        peripheral.discoverServices(nil)
    }

    nonisolated func centralManager(_ central: CBCentralManager, didFailToConnect peripheral: CBPeripheral, error: Error?) {
        MainActor.assumeIsolated { retryLater() }
    }

    nonisolated func centralManager(_ central: CBCentralManager, didDisconnectPeripheral peripheral: CBPeripheral, error: Error?) {
        MainActor.assumeIsolated {
            connected = false
            characteristic = nil
            finish(PrinterError("Printer disconnected"))
            retryLater()
        }
    }

    nonisolated func peripheral(_ peripheral: CBPeripheral, didDiscoverServices error: Error?) {
        for service in peripheral.services ?? [] { peripheral.discoverCharacteristics(nil, for: service) }
    }

    nonisolated func peripheral(_ peripheral: CBPeripheral, didDiscoverCharacteristicsFor service: CBService, error: Error?) {
        MainActor.assumeIsolated {
            let writable = (peripheral.services ?? [])
                .sorted { knownPrinterServices.contains($0.uuid) && !knownPrinterServices.contains($1.uuid) }
                .flatMap { $0.characteristics ?? [] }
                .first { $0.properties.contains(.write) || $0.properties.contains(.writeWithoutResponse) }
            // Services report one by one; keep the best found so far.
            if let writable, characteristic == nil || knownPrinterServices.contains(writable.service?.uuid ?? CBUUID()) {
                characteristic = writable
                connected = true
            }
        }
    }

    nonisolated func peripheral(_ peripheral: CBPeripheral, didWriteValueFor characteristic: CBCharacteristic, error: Error?) {
        MainActor.assumeIsolated {
            if let error { return finish(error) }
            if pending.isEmpty { finish(nil) } else { pump() }
        }
    }

    nonisolated func peripheralIsReady(toSendWriteWithoutResponse peripheral: CBPeripheral) {
        MainActor.assumeIsolated { pump() }
    }

    private func retryLater() {
        DispatchQueue.main.asyncAfter(deadline: .now() + 10) { [weak self] in
            MainActor.assumeIsolated { self?.connect() }
        }
    }
}

/// Lists nearby Bluetooth LE devices for the settings screen.
@MainActor
final class BluetoothScanner: NSObject, ObservableObject, CBCentralManagerDelegate {
    struct Device: Identifiable { let id: UUID; let name: String; var rssi: Int }

    @Published private(set) var devices: [Device] = []
    @Published private(set) var stateMessage: String?
    private var central: CBCentralManager?

    func scan() {
        devices = []
        if let central, central.state == .poweredOn {
            central.scanForPeripherals(withServices: nil, options: [CBCentralManagerScanOptionAllowDuplicatesKey: false])
        } else {
            central = CBCentralManager(delegate: self, queue: .main)
        }
        DispatchQueue.main.asyncAfter(deadline: .now() + 15) { [weak self] in
            MainActor.assumeIsolated { self?.central?.stopScan() }
        }
    }

    nonisolated func centralManagerDidUpdateState(_ central: CBCentralManager) {
        MainActor.assumeIsolated {
            switch central.state {
            case .poweredOn:
                stateMessage = nil
                central.scanForPeripherals(withServices: nil, options: nil)
            case .unauthorized: stateMessage = "Allow Bluetooth for Jose Madrid Kiosk in Settings."
            case .poweredOff: stateMessage = "Turn Bluetooth on to find printers."
            default: stateMessage = "Bluetooth is unavailable."
            }
        }
    }

    nonisolated func centralManager(_ central: CBCentralManager, didDiscover peripheral: CBPeripheral, advertisementData: [String: Any], rssi RSSI: NSNumber) {
        let name = peripheral.name ?? (advertisementData[CBAdvertisementDataLocalNameKey] as? String)
        let id = peripheral.identifier
        MainActor.assumeIsolated {
            guard let name else { return }
            if let i = devices.firstIndex(where: { $0.id == id }) {
                devices[i].rssi = RSSI.intValue
            } else {
                devices.append(Device(id: id, name: name, rssi: RSSI.intValue))
                devices.sort { $0.rssi > $1.rssi }
            }
        }
    }
}
