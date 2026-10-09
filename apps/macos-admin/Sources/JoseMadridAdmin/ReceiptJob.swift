import Foundation

/// The receipt printer: an 80mm ESC/POS thermal printer that prints a ticket
/// for every order that comes in.
///
/// The admin page builds the ticket's bytes on the server and hands them over;
/// this checks them and decides whether the order has already printed.
/// Foundation only, so build-app.sh can check it before building the app —
/// the same rules as the Windows app's `src/shared/receipts.ts`.

/// Where the tickets go. `network` is the printer's Ethernet port (raw TCP,
/// 9100 on nearly every ESC/POS printer). `printer` is a printer installed in
/// the system — the USB connection, through the manufacturer's driver — sent
/// the bytes raw so the driver does not lay them out as a page.
enum ReceiptConnection: Equatable {
  case off
  case network(host: String, port: Int)
  case printer(name: String)

  /// From the three stored settings, or an error to show in Settings.
  static func parse(mode: String, host: String, port: String, printer: String) -> Result<ReceiptConnection, ReceiptSettingError> {
    switch mode {
    case "network":
      let trimmed = host.trimmingCharacters(in: .whitespaces)
      let allowed = CharacterSet(charactersIn: "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789.-:")
      guard !trimmed.isEmpty, trimmed.count <= 253, trimmed.unicodeScalars.allSatisfy(allowed.contains) else {
        return .failure(ReceiptSettingError("Enter the receipt printer's IP address, like 192.168.1.87."))
      }
      let portText = port.trimmingCharacters(in: .whitespaces)
      guard let number = portText.isEmpty ? 9100 : Int(portText), (1...65535).contains(number) else {
        return .failure(ReceiptSettingError("The port is a number from 1 to 65535, usually 9100."))
      }
      return .success(.network(host: trimmed, port: number))
    case "printer":
      let trimmed = printer.trimmingCharacters(in: .whitespaces)
      guard !trimmed.isEmpty else { return .failure(ReceiptSettingError("Choose the receipt printer from the list.")) }
      return .success(.printer(name: String(trimmed.prefix(200))))
    default:
      return .success(.off)
    }
  }
}

struct ReceiptSettingError: Error {
  let message: String
  init(_ message: String) { self.message = message }
}

struct ReceiptJob {
  let orderId: String
  /// For telling the operator which ticket did not print.
  let orderNumber: String?
  /// When the order was placed.
  let createdAt: Date
  let bytes: Data
  /// A reprint asked for by hand: printed even if it was printed before.
  let reprint: Bool

  /// A ticket is a few hundred bytes; anything near this is not a ticket.
  static let maxBytes = 64 * 1024

  /// A ticket from the page bridge's message body, or nil if anything about it is off.
  static func parse(_ body: [String: Any]) -> ReceiptJob? {
    guard let orderId = body["orderId"] as? String,
          (1...64).contains(orderId.count),
          orderId.unicodeScalars.allSatisfy({ CharacterSet.alphanumerics.contains($0) || $0 == "_" || $0 == "-" }),
          orderId.allSatisfy(\.isASCII),
          let placedText = body["createdAt"] as? String,
          let createdAt = parseDate(placedText),
          let data = body["data"] as? String,
          data.count <= maxBytes * 4 / 3 + 4,
          let bytes = Data(base64Encoded: data),
          !bytes.isEmpty, bytes.count <= maxBytes
    else { return nil }
    let number = (body["orderNumber"] as? String).map { String($0.filter { $0.isASCII && !$0.isNewline }.prefix(40)) }
    return ReceiptJob(
      orderId: orderId,
      orderNumber: number,
      createdAt: createdAt,
      bytes: bytes,
      reprint: body["reprint"] as? Bool ?? false
    )
  }

  private static func parseDate(_ text: String) -> Date? {
    let withFraction = ISO8601DateFormatter()
    withFraction.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
    return withFraction.date(from: text) ?? ISO8601DateFormatter().date(from: text)
  }
}

/// Which orders have printed, so each prints once.
enum ReceiptLog {
  /// Far more than a day's orders, small enough to keep in the defaults.
  static let memory = 500

  /// An order placed before receipts were switched on is the backlog; one
  /// already printed would be a duplicate. A hand reprint skips both checks.
  static func shouldPrint(_ job: ReceiptJob, printed: [String], enabledAt: Date) -> Bool {
    job.reprint || (job.createdAt >= enabledAt && !printed.contains(job.orderId))
  }

  static func remember(_ printed: [String], _ orderId: String) -> [String] {
    Array((printed.filter { $0 != orderId } + [orderId]).suffix(memory))
  }

  /// The settings page's test ticket: a few lines and a cut.
  static func testTicket(at date: Date) -> Data {
    let formatter = DateFormatter()
    formatter.dateStyle = .medium
    formatter.timeStyle = .short
    let text = "Jose Madrid Salsa\nReceipt printer test\n\(formatter.string(from: date))\n\nNew orders will print here.\n"
    return Data([0x1B, 0x40, 0x1B, 0x61, 1]) + Data(text.utf8) + Data([0x1D, 0x56, 66, 4])
  }
}
