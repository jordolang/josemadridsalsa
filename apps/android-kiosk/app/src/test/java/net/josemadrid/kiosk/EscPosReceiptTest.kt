package net.josemadrid.kiosk

import org.junit.Assert.assertArrayEquals
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class EscPosReceiptTest {
    private val receipt = Receipt(
        orderNumber = "POS-20261001-1234",
        dateText = "Oct 1, 2026 3:14 PM",
        lines = listOf(
            ReceiptLine("Mango Habanero", 2, "$20.00"),
            ReceiptLine("Roasted Pineapple Habanero Hot with an unusually long name for wrapping", 1, "$10.00"),
        ),
        subtotal = "$30.00",
        adjustments = listOf(ReceiptAdjustment("3-jar deal", "-$5.00"), ReceiptAdjustment("Bag of chips", "FREE")),
        tax = "$0.00",
        total = "$25.00",
        payment = "Card · Square Terminal",
        footer = listOf("¡Gracias!", "josemadridsalsa.com"),
    )

    @Test fun startsWithInitAndEndsWithCut() {
        val bytes = EscPosReceipt.receipt(receipt)
        assertArrayEquals(EscPosReceipt.INIT, bytes.copyOfRange(0, 2))
        assertArrayEquals(EscPosReceipt.CUT, bytes.copyOfRange(bytes.size - 4, bytes.size))
    }

    @Test fun rowPutsPriceFlushRightIn48Columns() {
        val line = EscPosReceipt.row("2 x Mango Habanero", "$20.00").single()
        assertEquals(48, line.length)
        assertTrue(line.startsWith("2 x Mango Habanero "))
        assertTrue(line.endsWith("$20.00"))
    }

    @Test fun longNamesWrapWithPriceOnFirstLine() {
        val lines = EscPosReceipt.row("1 x " + receipt.lines[1].name, "$10.00", indent = 4)
        assertTrue(lines.size > 1)
        assertTrue(lines.all { it.length <= 48 })
        assertTrue(lines.first().endsWith("$10.00"))
        assertTrue(lines.drop(1).all { it.startsWith("    ") && !it.contains("$10.00") })
        val words = lines.joinToString(" ") { it.removeSuffix("$10.00") }.split(" ").filter { it.isNotEmpty() }
        assertEquals("1 x ${receipt.lines[1].name}".split(" "), words)
    }

    @Test fun overlongWordsAreHardSplit() {
        val lines = EscPosReceipt.wrap("x".repeat(100), 48)
        assertEquals(listOf(48, 48, 4), lines.map { it.length })
    }

    @Test fun textIsAsciiOnly() {
        assertEquals("Card - Square Terminal", EscPosReceipt.sanitize("Card · Square Terminal"))
        assertEquals("!Gracias!", EscPosReceipt.sanitize("¡Gracias!"))
        assertEquals("Jalapeno 2 x 3", EscPosReceipt.sanitize("Jalapeño 2 × 3"))
        assertEquals("?", EscPosReceipt.sanitize("🌶"))
        val bytes = EscPosReceipt.receipt(receipt)
        assertTrue(bytes.all { (it.toInt() and 0xFF) < 0x80 })
    }

    @Test fun totalUsesHalfWidthForDoubleSizeText() {
        val line = EscPosReceipt.row("TOTAL", "$25.00", width = 24).single()
        assertEquals(24, line.length)
    }
}
