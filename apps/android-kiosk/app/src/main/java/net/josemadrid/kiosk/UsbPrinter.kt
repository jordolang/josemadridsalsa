package net.josemadrid.kiosk

import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.hardware.usb.UsbConstants
import android.hardware.usb.UsbDevice
import android.hardware.usb.UsbDeviceConnection
import android.hardware.usb.UsbEndpoint
import android.hardware.usb.UsbInterface
import android.hardware.usb.UsbManager
import android.os.Build
import android.util.Log
import org.json.JSONObject
import java.util.concurrent.Callable
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit
import java.util.concurrent.TimeoutException

/** First USB ESC/POS printer on the bus, written to with bulk transfers. */
class UsbPrinter(private val context: Context) {
    private val usb = context.getSystemService(Context.USB_SERVICE) as UsbManager
    private val queue = Executors.newSingleThreadExecutor()

    /** [inp] is the printer's status channel, when it has one. */
    data class Target(val device: UsbDevice, val iface: UsbInterface, val out: UsbEndpoint, val inp: UsbEndpoint?)

    /** Prefer a printer-class interface; fall back to anything with a bulk OUT endpoint. */
    fun find(): Target? {
        val candidates = usb.deviceList.values.flatMap { d ->
            (0 until d.interfaceCount).map { d.getInterface(it) }.mapNotNull { i ->
                val bulk = (0 until i.endpointCount).map { i.getEndpoint(it) }.filter { it.type == UsbConstants.USB_ENDPOINT_XFER_BULK }
                val out = bulk.firstOrNull { it.direction == UsbConstants.USB_DIR_OUT }
                out?.let { Target(d, i, it, bulk.firstOrNull { e -> e.direction == UsbConstants.USB_DIR_IN }) }
            }
        }
        return candidates.firstOrNull { it.iface.interfaceClass == UsbConstants.USB_CLASS_PRINTER }
            ?: candidates.firstOrNull()
    }

    fun hasPermission(t: Target) = usb.hasPermission(t.device)

    /**
     * Asks the user to allow the printer. Plugging it in with the app open offers
     * "always open with Jose Madrid Kiosk", which makes the grant permanent.
     */
    fun requestPermission(t: Target) {
        val flags = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) PendingIntent.FLAG_MUTABLE else 0
        val intent = Intent(ACTION_PERMISSION).setPackage(context.packageName)
        usb.requestPermission(t.device, PendingIntent.getBroadcast(context, 0, intent, flags))
    }

    fun statusJson(): String {
        val t = find()
        return JSONObject()
            .put("connected", t != null)
            .put("name", t?.device?.productName.orEmpty())
            .put("permission", t != null && hasPermission(t))
            .toString()
    }

    /**
     * Sends [bytes] to the printer and waits for the transfer, so the kiosk can tell the
     * customer when a receipt didn't print. Returns null when printed, or why it failed.
     * Called from the WebView's bridge thread, never the UI thread.
     */
    fun print(bytes: ByteArray): String? {
        val t = find() ?: return "no printer connected"
        if (!hasPermission(t)) {
            requestPermission(t)
            return "printer permission needed"
        }
        val job = queue.submit(Callable { send(t, bytes) })
        return try {
            job.get(PRINT_WAIT_SECONDS, TimeUnit.SECONDS)
        } catch (e: TimeoutException) {
            "printer did not respond"
        } catch (e: Exception) {
            "print failed (${e.message})"
        }
    }

    private fun send(t: Target, bytes: ByteArray): String? {
        val conn = usb.openDevice(t.device) ?: return "could not open printer".also { Log.e(TAG, it) }
        try {
            if (!conn.claimInterface(t.iface, true)) return "printer is busy".also { Log.e(TAG, it) }
            problem(conn, t)?.let { return it.also { Log.e(TAG, it) } }
            var offset = 0
            while (offset < bytes.size) {
                val len = minOf(CHUNK, bytes.size - offset)
                val sent = conn.bulkTransfer(t.out, bytes, offset, len, TIMEOUT_MS)
                if (sent < 0) return "printer stopped at byte $offset".also { Log.e(TAG, it) }
                offset += sent
            }
            // A finished transfer only means the bytes arrived; check the paper ran out mid-receipt.
            return problem(conn, t)?.also { Log.e(TAG, it) }
        } finally {
            conn.releaseInterface(t.iface)
            conn.close()
        }
    }

    /**
     * Asks the printer for its state with ESC/POS real-time status (DLE EOT). Returns a
     * reason it can't print, or null when it reports ready. A printer with no status
     * channel, or one that doesn't answer, can't be checked and is assumed ready.
     */
    private fun problem(conn: UsbDeviceConnection, t: Target): String? {
        val inp = t.inp ?: return null
        fun status(n: Int): Int? {
            if (conn.bulkTransfer(t.out, byteArrayOf(0x10, 0x04, n.toByte()), 3, STATUS_TIMEOUT_MS) < 0) return null
            val reply = ByteArray(inp.maxPacketSize.coerceAtLeast(1))
            val read = conn.bulkTransfer(inp, reply, reply.size, STATUS_TIMEOUT_MS)
            return if (read > 0) reply[read - 1].toInt() and 0xFF else null
        }
        status(4)?.let { if (it and 0x60 == 0x60) return "printer is out of paper" }
        status(2)?.let {
            if (it and 0x04 != 0) return "printer cover is open"
            if (it and 0x40 != 0) return "printer has an error"
        }
        return null
    }

    companion object {
        private const val TAG = "UsbPrinter"
        private const val ACTION_PERMISSION = "net.josemadrid.kiosk.USB_PERMISSION"
        private const val CHUNK = 4096
        private const val TIMEOUT_MS = 5000
        private const val PRINT_WAIT_SECONDS = 20L
        private const val STATUS_TIMEOUT_MS = 500
    }
}
