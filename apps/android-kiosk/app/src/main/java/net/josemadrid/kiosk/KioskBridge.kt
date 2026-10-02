package net.josemadrid.kiosk

import android.webkit.JavascriptInterface
import org.json.JSONArray
import org.json.JSONObject

/**
 * `window.JMKiosk`. Every call answers only while the main frame is on the kiosk origin.
 * ponytail: the interface is also visible to iframes; the kiosk page has none. Move to
 * WebViewCompat.addWebMessageListener (origin-scoped) if the page ever embeds third-party frames.
 */
class KioskBridge(
    private val prefs: KioskPrefs,
    private val printer: UsbPrinter,
    private val currentOrigin: () -> String,
) {
    private fun trusted() = currentOrigin() == prefs.origin

    @JavascriptInterface
    fun getDeviceToken(): String = if (trusted()) prefs.token else ""

    @JavascriptInterface
    fun getAppVersion(): String = BuildConfig.VERSION_NAME

    @JavascriptInterface
    fun printerStatus(): String =
        if (trusted()) printer.statusJson() else """{"connected":false,"name":"","permission":false}"""

    @JavascriptInterface
    fun printReceipt(json: String): String {
        if (!trusted()) return "error: untrusted page"
        val receipt = try {
            parse(JSONObject(json))
        } catch (e: Exception) {
            return "error: bad receipt (${e.message})"
        }
        return printer.print(EscPosReceipt.receipt(receipt))?.let { "error: $it" } ?: "ok"
    }

    private fun parse(o: JSONObject) = Receipt(
        orderNumber = o.getString("orderNumber"),
        dateText = o.optString("dateText"),
        lines = o.getJSONArray("lines").objects().map {
            ReceiptLine(it.getString("name"), it.getInt("qty"), it.getString("total"))
        },
        subtotal = o.optString("subtotal"),
        adjustments = (o.optJSONArray("adjustments") ?: JSONArray()).objects().map {
            ReceiptAdjustment(it.getString("label"), it.getString("amount"))
        },
        tax = o.optString("tax"),
        total = o.getString("total"),
        payment = o.optString("payment"),
        footer = (o.optJSONArray("footer") ?: JSONArray()).let { a -> (0 until a.length()).map { a.getString(it) } },
    )

    private fun JSONArray.objects() = (0 until length()).map { getJSONObject(it) }
}
