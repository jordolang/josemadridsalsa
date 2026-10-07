import Foundation
import Security

/// Which printer the kiosk prints to. Persisted as JSON in UserDefaults.
enum PrinterConfig: Codable, Equatable {
    case none
    case network(host: String, port: UInt16)
    case bluetooth(id: UUID, name: String)
    case airPrint(url: URL, name: String)
    /// `interface` is StarIO10.InterfaceType.rawValue.
    case star(interface: Int, identifier: String, name: String)

    var label: String {
        switch self {
        case .none: return "No printer"
        case let .network(host, port): return "Network \(host):\(port)"
        case let .bluetooth(_, name): return "Bluetooth \(name)"
        case let .airPrint(_, name): return "AirPrint \(name)"
        case let .star(_, _, name): return "Star \(name)"
        }
    }
}

/// Kiosk configuration. The device token and staff PIN live in the Keychain; the rest in UserDefaults.
final class KioskSettings: ObservableObject {
    static let shared = KioskSettings()
    static let defaultURL = "https://www.josemadridsalsa.com/kiosk"

    private let defaults = UserDefaults.standard

    @Published var kioskURL: String { didSet { defaults.set(kioskURL, forKey: "kioskURL") } }
    /// 48 columns for 80mm paper, 32 for 58mm.
    @Published var columns: Int { didSet { defaults.set(columns, forKey: "columns") } }
    @Published var printer: PrinterConfig {
        didSet { defaults.set(try? JSONEncoder().encode(printer), forKey: "printer") }
    }
    @Published var deviceToken: String { didSet { Keychain.set(deviceToken, for: "deviceToken") } }
    @Published var staffPIN: String { didSet { Keychain.set(staffPIN, for: "staffPIN") } }

    private init() {
        kioskURL = defaults.string(forKey: "kioskURL") ?? Self.defaultURL
        let savedColumns = defaults.integer(forKey: "columns")
        columns = savedColumns == 32 ? 32 : 48
        printer = (defaults.data(forKey: "printer")).flatMap { try? JSONDecoder().decode(PrinterConfig.self, from: $0) } ?? .none
        deviceToken = Keychain.get("deviceToken") ?? ""
        staffPIN = Keychain.get("staffPIN") ?? ""
        #if DEBUG
        // Forgotten PIN: `xcrun devicectl device process launch … net.josemadrid.kiosk -resetStaffPIN 1234`
        // from a Mac the iPad trusts. Debug builds only.
        let args = ProcessInfo.processInfo.arguments
        if let i = args.firstIndex(of: "-resetStaffPIN"), i + 1 < args.count, Self.isValidPIN(args[i + 1]) {
            staffPIN = args[i + 1]
            Keychain.set(staffPIN, for: "staffPIN")
        }
        #endif
    }

    var isConfigured: Bool { url != nil && !deviceToken.isEmpty && Self.isValidPIN(staffPIN) }

    /// https only, except plain http to this device for local testing.
    var url: URL? {
        guard let u = URL(string: kioskURL.trimmingCharacters(in: .whitespaces)), let host = u.host else { return nil }
        if u.scheme == "https" { return u }
        if u.scheme == "http", host == "localhost" || host == "127.0.0.1" { return u }
        return nil
    }

    /// scheme://host[:port], the only origin the bridge and navigation allow.
    var origin: String? {
        guard let u = url, let scheme = u.scheme, let host = u.host else { return nil }
        return u.port.map { "\(scheme)://\(host):\($0)" } ?? "\(scheme)://\(host)"
    }

    static func isValidPIN(_ pin: String) -> Bool {
        (4...8).contains(pin.count) && pin.allSatisfy(\.isNumber)
    }
}

enum Keychain {
    private static let service = "net.josemadrid.kiosk"

    static func get(_ key: String) -> String? {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: key,
            kSecReturnData as String: true,
        ]
        var item: CFTypeRef?
        guard SecItemCopyMatching(query as CFDictionary, &item) == errSecSuccess, let data = item as? Data else { return nil }
        return String(data: data, encoding: .utf8)
    }

    static func set(_ value: String, for key: String) {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: key,
        ]
        SecItemDelete(query as CFDictionary)
        guard !value.isEmpty else { return }
        var add = query
        add[kSecValueData as String] = Data(value.utf8)
        add[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly
        SecItemAdd(add as CFDictionary, nil)
    }
}
