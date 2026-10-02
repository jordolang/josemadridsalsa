package net.josemadrid.kiosk

import java.io.ByteArrayOutputStream
import java.text.Normalizer

data class ReceiptLine(val name: String, val qty: Int, val total: String)

data class ReceiptAdjustment(val label: String, val amount: String)

data class Receipt(
    val orderNumber: String,
    val dateText: String,
    val lines: List<ReceiptLine>,
    val subtotal: String,
    val adjustments: List<ReceiptAdjustment>,
    val tax: String,
    val total: String,
    val payment: String,
    val footer: List<String>,
)

/** Pure ESC/POS byte builder for an 80mm printer (Font A, 48 columns). No Android APIs. */
object EscPosReceipt {
    const val WIDTH = 48

    internal val INIT = byteArrayOf(0x1B, 0x40)
    internal val CUT = byteArrayOf(0x1D, 0x56, 0x42, 0x00)
    private val ALIGN_LEFT = byteArrayOf(0x1B, 0x61, 0x00)
    private val ALIGN_CENTER = byteArrayOf(0x1B, 0x61, 0x01)
    private val BOLD_ON = byteArrayOf(0x1B, 0x45, 0x01)
    private val BOLD_OFF = byteArrayOf(0x1B, 0x45, 0x00)
    private val SIZE_NORMAL = byteArrayOf(0x1D, 0x21, 0x00)
    private val SIZE_TALL = byteArrayOf(0x1D, 0x21, 0x01)
    private val SIZE_DOUBLE = byteArrayOf(0x1D, 0x21, 0x11)
    private val FEED_4 = byteArrayOf(0x1B, 0x64, 0x04)

    private val RULE = "-".repeat(WIDTH)

    fun receipt(r: Receipt): ByteArray = build {
        header()
        text(row("Order", r.orderNumber))
        text(r.dateText)
        text(RULE)
        r.lines.forEach { line -> text(row("${line.qty} x ${line.name}", line.total, indent = 4)) }
        text(RULE)
        text(row("Subtotal", r.subtotal))
        r.adjustments.forEach { text(row(it.label, it.amount)) }
        text(row("Tax", r.tax))
        bytes(BOLD_ON, SIZE_DOUBLE)
        // Double-width characters halve the line to 24 columns.
        text(row("TOTAL", r.total, width = WIDTH / 2))
        bytes(SIZE_NORMAL, BOLD_OFF)
        text(r.payment)
        text(RULE)
        bytes(ALIGN_CENTER)
        r.footer.forEach { text(it) }
        bytes(ALIGN_LEFT)
    }

    fun testPage(): ByteArray = build {
        header()
        bytes(ALIGN_CENTER)
        text("Printer test")
        text("If you can read this, the kiosk")
        text("can print receipts.")
        bytes(ALIGN_LEFT)
        text(RULE)
        text(row("Left", "Right"))
        text("1234567890".repeat(5).take(WIDTH))
    }

    private fun build(body: Builder.() -> Unit): ByteArray {
        val b = Builder()
        b.bytes(INIT)
        b.body()
        b.bytes(FEED_4, CUT)
        return b.out.toByteArray()
    }

    private class Builder {
        val out = ByteArrayOutputStream()
        fun bytes(vararg chunks: ByteArray) = chunks.forEach { out.write(it) }
        fun text(line: String) {
            out.write(sanitize(line).toByteArray(Charsets.US_ASCII))
            out.write('\n'.code)
        }
        fun text(lines: List<String>) = lines.forEach { text(it) }

        fun header() {
            bytes(ALIGN_CENTER, BOLD_ON, SIZE_TALL)
            text("JOSE MADRID SALSA")
            bytes(SIZE_NORMAL, BOLD_OFF)
            text("Salsa Kings · Zanesville, Ohio")
            bytes(ALIGN_LEFT)
            text(RULE)
        }
    }

    /**
     * Left text with [right] flush to the edge of a [width]-column line. Left text that does not
     * fit wraps onto following lines, indented by [indent]; the right text stays on the first line.
     */
    internal fun row(left: String, right: String, width: Int = WIDTH, indent: Int = 0): List<String> {
        val l = sanitize(left)
        val r = sanitize(right).take(width)
        val avail = (width - r.length - 1).coerceAtLeast(1)
        val first = wrap(l, avail)
        val head = first.first()
        val rest = wrap(first.drop(1).joinToString(" "), (avail - indent).coerceAtLeast(1))
            .filter { it.isNotEmpty() }
            .map { " ".repeat(indent) + it }
        return listOf(head.padEnd(width - r.length) + r) + rest
    }

    internal fun wrap(text: String, width: Int): List<String> {
        val lines = mutableListOf<String>()
        var current = ""
        for (word in text.split(' ').filter { it.isNotEmpty() }) {
            var w = word
            while (w.length > width) {
                if (current.isNotEmpty()) { lines += current; current = "" }
                lines += w.take(width)
                w = w.drop(width)
            }
            current = when {
                current.isEmpty() -> w
                current.length + 1 + w.length <= width -> "$current $w"
                else -> { lines += current; w }
            }
        }
        lines += current
        return lines
    }

    private val REPLACEMENTS = mapOf(
        '·' to "-", '•' to "*", '×' to "x", '¡' to "!", '¿' to "?",
        '–' to "-", '—' to "-", '‘' to "'", '’' to "'", '“' to "\"", '”' to "\"",
        '…' to "...", '−' to "-",
    )

    /** Printers default to CP437; send plain ASCII so nothing prints as garbage. */
    internal fun sanitize(s: String): String {
        val replaced = buildString { s.forEach { append(REPLACEMENTS[it] ?: it) } }
        val stripped = Normalizer.normalize(replaced, Normalizer.Form.NFD).replace(Regex("\\p{M}+"), "")
        return stripped.codePoints().toArray().joinToString("") { if (it in 0x20..0x7E) it.toChar().toString() else "?" }
    }
}
