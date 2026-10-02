import SwiftUI

private extension Color {
    static let char = Color(Brand.char)
    static let cream = Color(Brand.cream)
    static let amber = Color(Brand.amber)
    static let chili = Color(Brand.red)
}

/// First-launch and staff settings: kiosk address, device token, staff PIN, paper and printer.
struct SetupView: View {
    @EnvironmentObject private var settings: KioskSettings
    @ObservedObject private var hub = PrinterHub.shared
    let done: () -> Void

    @State private var url = ""
    @State private var token = ""
    @State private var pin = ""
    @State private var kind = Kind.none
    @State private var host = ""
    @State private var port = "9100"
    @State private var message: String?
    @StateObject private var bluetooth = BluetoothScanner()
    @StateObject private var star = StarScanner()

    enum Kind: String, CaseIterable, Identifiable {
        case none = "None", network = "Network (Wi-Fi/Ethernet)", bluetooth = "Bluetooth LE", airPrint = "AirPrint", star = "Star Micronics"
        var id: Self { self }
    }

    var body: some View {
        NavigationStack {
            Form {
                Section("Kiosk") {
                    TextField("Kiosk address", text: $url)
                        .keyboardType(.URL).textInputAutocapitalization(.never).autocorrectionDisabled()
                    SecureField("Device token", text: $token)
                        .textInputAutocapitalization(.never).autocorrectionDisabled()
                    SecureField("Staff PIN (4-8 digits)", text: $pin).keyboardType(.numberPad)
                }

                Section("Receipt paper") {
                    Picker("Paper width", selection: $settings.columns) {
                        Text("80 mm").tag(48)
                        Text("58 mm").tag(32)
                    }
                    .pickerStyle(.segmented)
                }

                Section {
                    Picker("Printer type", selection: $kind) {
                        ForEach(Kind.allCases) { Text($0.rawValue).tag($0) }
                    }
                    printerOptions
                    HStack {
                        Circle().fill(hub.status.connected ? .green : .red).frame(width: 10, height: 10)
                        Text(settings.printer == .none ? "No printer chosen" : "\(settings.printer.label): \(hub.status.connected ? "ready" : "not reachable")")
                    }
                    Button("Print test receipt") { testPrint() }
                        .disabled(settings.printer == .none)
                } header: {
                    Text("Printer")
                } footer: {
                    Text("Ordinary USB printers can't be used with an iPad. For USB, use a Star Micronics printer with an MFi Lightning/USB-C connection.")
                }

                if let message {
                    Section { Text(message).foregroundStyle(Color.chili) }
                }
            }
            .navigationTitle("Kiosk setup")
            .toolbar {
                ToolbarItem(placement: .confirmationAction) { Button("Save", action: save) }
            }
        }
        .tint(.chili)
        .onAppear(perform: load)
    }

    @ViewBuilder private var printerOptions: some View {
        switch kind {
        case .none:
            EmptyView()
        case .network:
            TextField("Printer IP address", text: $host)
                .keyboardType(.numbersAndPunctuation).textInputAutocapitalization(.never).autocorrectionDisabled()
            TextField("Port", text: $port).keyboardType(.numberPad)
            Button("Use this printer") {
                guard !host.isEmpty, let p = UInt16(port) else { return message = "Enter the printer's IP address and port." }
                settings.printer = .network(host: host.trimmingCharacters(in: .whitespaces), port: p)
                message = nil
            }
        case .bluetooth:
            Button("Scan for Bluetooth printers") { bluetooth.scan() }
            if let note = bluetooth.stateMessage { Text(note).foregroundStyle(.secondary) }
            ForEach(bluetooth.devices) { device in
                Button { settings.printer = .bluetooth(id: device.id, name: device.name) } label: {
                    HStack {
                        Text(device.name)
                        Spacer()
                        Text("\(device.rssi) dBm").foregroundStyle(.secondary)
                        if case let .bluetooth(id, _) = settings.printer, id == device.id { Image(systemName: "checkmark") }
                    }
                }
            }
        case .airPrint:
            Button("Choose AirPrint printer") {
                AirPrintPicker.choose { printer in
                    guard let printer else { return }
                    settings.printer = .airPrint(url: printer.url, name: printer.displayName)
                }
            }
        case .star:
            Button(star.scanning ? "Searching..." : "Find Star printers") { star.scan() }.disabled(star.scanning)
            if let error = star.error { Text(error).foregroundStyle(Color.chili) }
            ForEach(star.devices) { device in
                Button { settings.printer = .star(interface: device.interface, identifier: device.identifier, name: device.name) } label: {
                    HStack {
                        Text(device.name)
                        Spacer()
                        Text(device.identifier).foregroundStyle(.secondary).lineLimit(1)
                        if case let .star(i, id, _) = settings.printer, i == device.interface, id == device.identifier { Image(systemName: "checkmark") }
                    }
                }
            }
        }
    }

    private func load() {
        url = settings.kioskURL
        token = settings.deviceToken
        pin = settings.staffPIN
        switch settings.printer {
        case .none: kind = .none
        case let .network(h, p): kind = .network; host = h; port = String(p)
        case .bluetooth: kind = .bluetooth
        case .airPrint: kind = .airPrint
        case .star: kind = .star
        }
    }

    private func save() {
        let trimmedURL = url.trimmingCharacters(in: .whitespaces)
        settings.kioskURL = trimmedURL
        guard settings.url != nil else { return message = "The kiosk address must start with https://" }
        guard token.trimmingCharacters(in: .whitespaces).count >= 24 else { return message = "The device token must be at least 24 characters." }
        guard KioskSettings.isValidPIN(pin) else { return message = "The staff PIN must be 4 to 8 digits." }
        if kind == .none { settings.printer = .none }
        settings.deviceToken = token.trimmingCharacters(in: .whitespaces)
        settings.staffPIN = pin
        message = nil
        done()
    }

    private func testPrint() {
        Task {
            do {
                try await hub.printTest()
                message = nil
            } catch {
                message = "Test print failed: \(error.localizedDescription)"
            }
        }
    }
}

/// Staff PIN prompt behind the corner gesture.
struct PinView: View {
    let expected: String
    let result: (Bool) -> Void
    @State private var entry = ""
    @State private var wrong = false

    var body: some View {
        VStack(spacing: 28) {
            Text("Staff PIN").font(.system(size: 40, weight: .black)).foregroundStyle(Color.cream)
            Text(String(repeating: "●", count: entry.count).padding(toLength: max(entry.count, 4), withPad: "○", startingAt: 0))
                .font(.system(size: 34)).foregroundStyle(wrong ? Color.chili : Color.amber)
            LazyVGrid(columns: Array(repeating: GridItem(.fixed(110), spacing: 18), count: 3), spacing: 18) {
                ForEach(["1", "2", "3", "4", "5", "6", "7", "8", "9", "Cancel", "0", "OK"], id: \.self) { key in
                    Button { tap(key) } label: {
                        Text(key)
                            .font(.system(size: key.count > 1 ? 22 : 36, weight: .bold))
                            .frame(width: 110, height: 90)
                            .background(key == "OK" ? Color.amber : Color.cream.opacity(0.12))
                            .foregroundStyle(key == "OK" ? Color.char : Color.cream)
                            .clipShape(RoundedRectangle(cornerRadius: 22))
                    }
                }
            }
        }
        .padding(48)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Color.char)
    }

    private func tap(_ key: String) {
        wrong = false
        switch key {
        case "Cancel": result(false)
        case "OK":
            if entry == expected { result(true) } else { wrong = true; entry = "" }
        default:
            if entry.count < 8 { entry += key }
        }
    }
}

/// What staff can do after the PIN: reload the page, test the printer, change settings.
struct StaffMenu: View {
    @ObservedObject private var hub = PrinterHub.shared
    let reload: () -> Void
    let settings: () -> Void
    let close: () -> Void
    @State private var message: String?

    var body: some View {
        VStack(spacing: 22) {
            Text("Staff menu").font(.system(size: 40, weight: .black)).foregroundStyle(Color.cream)
            Text(hub.status.name.isEmpty ? "No printer" : "\(hub.status.name): \(hub.status.connected ? "ready" : "not reachable")")
                .foregroundStyle(hub.status.connected ? Color.amber : Color.chili)
            menuButton("Reload kiosk", action: reload)
            menuButton("Printer test") {
                Task {
                    do { try await hub.printTest(); message = "Test receipt sent." } catch { message = error.localizedDescription }
                }
            }
            menuButton("Settings", action: settings)
            menuButton("Back to kiosk", action: close)
            if let message { Text(message).foregroundStyle(Color.cream) }
        }
        .padding(48)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Color.char)
    }

    private func menuButton(_ title: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Text(title)
                .font(.system(size: 26, weight: .bold))
                .frame(width: 380, height: 78)
                .background(Color.amber)
                .foregroundStyle(Color.char)
                .clipShape(Capsule())
        }
    }
}
