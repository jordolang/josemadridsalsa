import XCTest
@testable import JoseMadridKiosk

/// Mirrors apps/android-kiosk EscPosReceiptTest.kt so both kiosks are held to the same slip.
final class ReceiptTests: XCTestCase {
    private let receipt = Receipt(
        orderNumber: "POS-20261001-1234",
        dateText: "Oct 1, 2026 3:14 PM",
        lines: [
            .init(name: "Mango Habanero", qty: 2, total: "$20.00"),
            .init(name: "Roasted Pineapple Habanero Hot with an unusually long name for wrapping", qty: 1, total: "$10.00"),
        ],
        subtotal: "$30.00",
        adjustments: [.init(label: "3-jar deal", amount: "-$5.00"), .init(label: "Bag of chips", amount: "FREE")],
        tax: "$0.00",
        total: "$25.00",
        payment: "Card · Square Terminal",
        footer: ["¡Gracias!", "josemadrid.net"]
    )

    func testStartsWithInitAndEndsWithCut() {
        let bytes = [UInt8](EscPos.encode(ReceiptLayout.receipt(receipt)))
        XCTAssertEqual(Array(bytes.prefix(2)), EscPos.initialize)
        XCTAssertEqual(Array(bytes.suffix(4)), EscPos.cut)
    }

    func testRowPutsPriceFlushRightIn48Columns() {
        let lines = ReceiptLayout.row("2 x Mango Habanero", "$20.00")
        XCTAssertEqual(lines.count, 1)
        XCTAssertEqual(lines[0].count, 48)
        XCTAssertTrue(lines[0].hasPrefix("2 x Mango Habanero "))
        XCTAssertTrue(lines[0].hasSuffix("$20.00"))
    }

    func testLongNamesWrapWithPriceOnFirstLine() {
        let name = receipt.lines[1].name
        let lines = ReceiptLayout.row("1 x " + name, "$10.00", indent: 4)
        XCTAssertGreaterThan(lines.count, 1)
        XCTAssertTrue(lines.allSatisfy { $0.count <= 48 })
        XCTAssertTrue(lines[0].hasSuffix("$10.00"))
        XCTAssertTrue(lines.dropFirst().allSatisfy { $0.hasPrefix("    ") && !$0.contains("$10.00") })
        let words = lines.map { $0.replacingOccurrences(of: "$10.00", with: "") }
            .joined(separator: " ").split(separator: " ").map(String.init)
        XCTAssertEqual(words, ("1 x " + name).split(separator: " ").map(String.init))
    }

    func testOverlongWordsAreHardSplit() {
        XCTAssertEqual(ReceiptLayout.wrap(String(repeating: "x", count: 100), width: 48).map(\.count), [48, 48, 4])
    }

    func testTextIsAsciiOnly() {
        XCTAssertEqual(ReceiptLayout.sanitize("Card · Square Terminal"), "Card - Square Terminal")
        XCTAssertEqual(ReceiptLayout.sanitize("¡Gracias!"), "!Gracias!")
        XCTAssertEqual(ReceiptLayout.sanitize("Jalapeño 2 × 3"), "Jalapeno 2 x 3")
        XCTAssertEqual(ReceiptLayout.sanitize("🌶"), "?")
        XCTAssertTrue(EscPos.encode(ReceiptLayout.receipt(receipt)).allSatisfy { $0 < 0x80 })
    }

    func testTotalUsesHalfWidthForDoubleSizeText() {
        let total = ReceiptLayout.receipt(receipt).first { $0.size == .double }
        XCTAssertEqual(total?.text.count, 24)
    }

    func testNarrowPaperUses32Columns() {
        let lines = ReceiptLayout.receipt(receipt, columns: 32)
        XCTAssertTrue(lines.filter { $0.size == .normal }.allSatisfy { $0.text.count <= 32 })
        XCTAssertEqual(lines.first { $0.size == .double }?.text.count, 16)
    }

    func testDecodesTheKioskPagePayload() throws {
        let json = #"{"orderNumber":"KIOSK-1","dateText":"Oct 1","lines":[{"name":"Mild","qty":1,"total":"$10.00"}],"subtotal":"$10.00","adjustments":[],"tax":"$0.00","total":"$10.00","payment":"Card","footer":["Gracias"]}"#
        let r = try JSONDecoder().decode(Receipt.self, from: Data(json.utf8))
        XCTAssertEqual(r.lines.first?.qty, 1)
        XCTAssertEqual(r.footer, ["Gracias"])
    }
}
