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
import java.util.concurrent.Executors

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

    /** Queues [bytes] for the printer. Returns null once queued, or why it can't print. */
    fun print(bytes: ByteArray): String? {
        val t = find() ?: return "no printer connected"
        if (!hasPermission(t)) {
            requestPermission(t)
            return "printer permission needed"
        }
        queue.execute {
            val conn = usb.openDevice(t.device)
            if (conn == null) {
                Log.e(TAG, "could not open printer")
                return@execute
            }
            try {
                conn.claimInterface(t.iface, true)
                var offset = 0
                while (offset < bytes.size) {
                    val len = minOf(CHUNK, bytes.size - offset)
                    val sent = conn.bulkTransfer(t.out, bytes, offset, len, TIMEOUT_MS)
                    if (sent < 0) {
                        Log.e(TAG, "bulk transfer failed at byte $offset")
                        break
                    }
                    offset += sent
                }
            } finally {
                conn.releaseInterface(t.iface)
                conn.close()
            }
        }
        return null
    }

    companion object {
        private const val TAG = "UsbPrinter"
        private const val ACTION_PERMISSION = "net.josemadrid.kiosk.USB_PERMISSION"
        private const val CHUNK = 4096
        private const val TIMEOUT_MS = 5000
    }
}
