package net.josemadrid.kiosk

import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.hardware.usb.UsbConstants
import android.hardware.usb.UsbDevice
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

    data class Target(val device: UsbDevice, val iface: UsbInterface, val out: UsbEndpoint)

    /** Prefer a printer-class interface; fall back to anything with a bulk OUT endpoint. */
    fun find(): Target? {
        val candidates = usb.deviceList.values.flatMap { d ->
            (0 until d.interfaceCount).map { d.getInterface(it) }.mapNotNull { i ->
                val out = (0 until i.endpointCount).map { i.getEndpoint(it) }.firstOrNull {
                    it.type == UsbConstants.USB_ENDPOINT_XFER_BULK && it.direction == UsbConstants.USB_DIR_OUT
                }
                out?.let { Target(d, i, it) }
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
            var offset = 0
            while (offset < bytes.size) {
                val len = minOf(CHUNK, bytes.size - offset)
                val sent = conn.bulkTransfer(t.out, bytes, offset, len, TIMEOUT_MS)
                if (sent < 0) return "printer stopped at byte $offset".also { Log.e(TAG, it) }
                offset += sent
            }
            return null
        } finally {
            conn.releaseInterface(t.iface)
            conn.close()
        }
    }

    companion object {
        private const val TAG = "UsbPrinter"
        private const val ACTION_PERMISSION = "net.josemadrid.kiosk.USB_PERMISSION"
        private const val CHUNK = 4096
        private const val TIMEOUT_MS = 5000
        private const val PRINT_WAIT_SECONDS = 20L
    }
}
