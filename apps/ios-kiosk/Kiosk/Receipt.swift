import Foundation

/// The receipt the kiosk page sends through `window.JMKiosk.printReceipt(json)`.
struct Receipt: Decodable {
    struct Line: Decodable { let name: String; let qty: Int; let total: String }
    struct Adjustment: Decodable { let label: String; let amount: String }

    let orderNumber: String
    var dateText: String = ""
    let lines: [Line]
    var subtotal: String = ""
    var adjustments: [Adjustment] = []
    var tax: String = ""
    let total: String
    var payment: String = ""
    var footer: [String] = []

    private enum CodingKeys: String, CodingKey {
        case orderNumber, dateText, lines, subtotal, adjustments, tax, total, payment, footer
    }

    init(orderNumber: String, dateText: String, lines: [Line], subtotal: String, adjustments: [Adjustment],
         tax: String, total: String, payment: String, footer: [String]) {
        self.orderNumber = orderNumber
        self.dateText = dateText
        self.lines = lines
        self.subtotal = subtotal
        self.adjustments = adjustments
        self.tax = tax
        self.total = total
        self.payment = payment
        self.footer = footer
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        orderNumber = try c.decode(String.self, forKey: .orderNumber)
        dateText = try c.decodeIfPresent(String.self, forKey: .dateText) ?? ""
        lines = try c.decode([Line].self, forKey: .lines)
        subtotal = try c.decodeIfPresent(String.self, forKey: .subtotal) ?? ""
        adjustments = try c.decodeIfPresent([Adjustment].self, forKey: .adjustments) ?? []
        tax = try c.decodeIfPresent(String.self, forKey: .tax) ?? ""
        total = try c.decode(String.self, forKey: .total)
        payment = try c.decodeIfPresent(String.self, forKey: .payment) ?? ""
        footer = try c.decodeIfPresent([String].self, forKey: .footer) ?? []
    }
}

/// One printed line, already laid out to the paper width and reduced to plain ASCII.
/// Every printer backend renders these: ESC/POS bytes, StarXpand commands, or AirPrint HTML.
struct PrintLine: Equatable {
    enum Align { case left, center }
    enum Size { case normal, tall, double }

    var text: String
    var align: Align = .left
    var bold = false
    var size: Size = .normal
}

/// Receipt layout, mirroring apps/android-kiosk EscPosReceipt.kt so both kiosks print the same slip.
enum ReceiptLayout {
    /// 80mm paper fits 48 Font-A columns; 58mm fits 32.
    static func receipt(_ r: Receipt, columns: Int = 48) -> [PrintLine] {
        let rule = PrintLine(text: String(repeating: "-", count: columns))
        var out = header(columns: columns)
        out += row("Order", r.orderNumber, width: columns).map { PrintLine(text: $0) }
        out.append(PrintLine(text: sanitize(r.dateText)))
        out.append(rule)
        for line in r.lines {
            out += row("\(line.qty) x \(line.name)", line.total, width: columns, indent: 4).map { PrintLine(text: $0) }
        }
        out.append(rule)
        out += row("Subtotal", r.subtotal, width: columns).map { PrintLine(text: $0) }
        for adj in r.adjustments { out += row(adj.label, adj.amount, width: columns).map { PrintLine(text: $0) } }
        out += row("Tax", r.tax, width: columns).map { PrintLine(text: $0) }
        // Double-width characters halve the line.
        out += row("TOTAL", r.total, width: columns / 2).map { PrintLine(text: $0, bold: true, size: .double) }
        out.append(PrintLine(text: sanitize(r.payment)))
        out.append(rule)
        out += r.footer.map { PrintLine(text: sanitize($0), align: .center) }
        return out
    }

    static func testPage(columns: Int = 48) -> [PrintLine] {
        var out = header(columns: columns)
        out += ["Printer test", "If you can read this, the kiosk", "can print receipts."].map { PrintLine(text: $0, align: .center) }
        out.append(PrintLine(text: String(repeating: "-", count: columns)))
        out += row("Left", "Right", width: columns).map { PrintLine(text: $0) }
        out.append(PrintLine(text: String(String(repeating: "1234567890", count: 7).prefix(columns))))
        return out
    }

    private static func header(columns: Int) -> [PrintLine] {
        [
            PrintLine(text: "JOSE MADRID SALSA", align: .center, bold: true, size: .tall),
            PrintLine(text: sanitize("Salsa Kings · Zanesville, Ohio"), align: .center),
            PrintLine(text: String(repeating: "-", count: columns)),
        ]
    }

    /// Left text with `right` flush to the edge of a `width`-column line. Left text that does not
    /// fit wraps onto following lines, indented by `indent`; the right text stays on the first line.
    static func row(_ left: String, _ right: String, width: Int = 48, indent: Int = 0) -> [String] {
        let l = sanitize(left)
        let r = String(sanitize(right).prefix(width))
        let avail = max(width - r.count - 1, 1)
        let first = wrap(l, width: avail)
        let head = first[0]
        let rest = wrap(first.dropFirst().joined(separator: " "), width: max(avail - indent, 1))
            .filter { !$0.isEmpty }
            .map { String(repeating: " ", count: indent) + $0 }
        return [head.padding(toLength: width - r.count, withPad: " ", startingAt: 0) + r] + rest
    }

    static func wrap(_ text: String, width: Int) -> [String] {
        var lines: [String] = []
        var current = ""
        for word in text.split(separator: " ").map(String.init) {
            var w = word
            while w.count > width {
                if !current.isEmpty { lines.append(current); current = "" }
                lines.append(String(w.prefix(width)))
                w = String(w.dropFirst(width))
            }
            if current.isEmpty {
                current = w
            } else if current.count + 1 + w.count <= width {
                current += " " + w
            } else {
                lines.append(current)
                current = w
            }
        }
        lines.append(current)
        return lines
    }

    private static let replacements: [Character: String] = [
        "·": "-", "•": "*", "×": "x", "¡": "!", "¿": "?",
        "–": "-", "—": "-", "‘": "'", "’": "'", "“": "\"", "”": "\"",
        "…": "...", "−": "-",
    ]

    /// Printers default to CP437; send plain ASCII so nothing prints as garbage.
    static func sanitize(_ s: String) -> String {
        let replaced = s.map { replacements[$0] ?? String($0) }.joined()
        let marks: Set<Unicode.GeneralCategory> = [.nonspacingMark, .spacingMark, .enclosingMark]
        var out = ""
        for scalar in replaced.decomposedStringWithCanonicalMapping.unicodeScalars where !marks.contains(scalar.properties.generalCategory) {
            out += (0x20...0x7E).contains(scalar.value) ? String(Character(scalar)) : "?"
        }
        return out
    }
}

/// ESC/POS encoding for network and Bluetooth printers.
enum EscPos {
    static let initialize: [UInt8] = [0x1B, 0x40]
    static let cut: [UInt8] = [0x1D, 0x56, 0x42, 0x00]
    private static let feed4: [UInt8] = [0x1B, 0x64, 0x04]

    static func encode(_ lines: [PrintLine]) -> Data {
        var bytes = initialize
        for line in lines {
            bytes += [0x1B, 0x61, line.align == .center ? 0x01 : 0x00]
            bytes += [0x1B, 0x45, line.bold ? 0x01 : 0x00]
            switch line.size {
            case .normal: bytes += [0x1D, 0x21, 0x00]
            case .tall: bytes += [0x1D, 0x21, 0x01]
            case .double: bytes += [0x1D, 0x21, 0x11]
            }
            bytes += Array(line.text.utf8) + [0x0A]
        }
        bytes += [0x1B, 0x61, 0x00, 0x1B, 0x45, 0x00, 0x1D, 0x21, 0x00]
        bytes += feed4 + cut
        return Data(bytes)
    }
}
