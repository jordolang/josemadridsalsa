package net.josemadrid.kiosk

import android.content.Context
import android.net.Uri
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKeys

/** Kiosk URL, device token and staff PIN, encrypted at rest. */
class KioskPrefs(context: Context) {
    private val prefs = EncryptedSharedPreferences.create(
        "kiosk",
        MasterKeys.getOrCreate(MasterKeys.AES256_GCM_SPEC),
        context,
        EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
        EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM,
    )

    val url: String get() = prefs.getString(KEY_URL, null) ?: DEFAULT_URL
    val token: String get() = prefs.getString(KEY_TOKEN, null).orEmpty()
    val pin: String get() = prefs.getString(KEY_PIN, null).orEmpty()

    val isConfigured: Boolean get() = token.isNotEmpty() && pin.isNotEmpty()

    /** scheme://host[:port] of the kiosk URL; the only origin the WebView may visit. */
    val origin: String get() = originOf(url)

    fun save(url: String, token: String, pin: String) {
        prefs.edit().putString(KEY_URL, url).putString(KEY_TOKEN, token).putString(KEY_PIN, pin).apply()
    }

    companion object {
        const val DEFAULT_URL = "https://www.josemadridsalsa.com/kiosk"
        private const val KEY_URL = "url"
        private const val KEY_TOKEN = "token"
        private const val KEY_PIN = "pin"

        fun originOf(url: String?): String {
            val uri = Uri.parse(url ?: return "")
            val port = if (uri.port == -1) "" else ":${uri.port}"
            return "${uri.scheme}://${uri.host}$port".lowercase()
        }
    }
}
