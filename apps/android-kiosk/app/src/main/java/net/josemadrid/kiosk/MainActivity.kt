package net.josemadrid.kiosk

/*
 * Jose Madrid self-order kiosk: a locked, full-screen WebView around the /kiosk page, plus the
 * native bits a browser can't do (USB receipt printer, kiosk lock, staff exit).
 *
 * Provisioning a tablet (factory-reset, no Google account added yet):
 *   adb install app-debug.apk
 *   adb shell dpm set-device-owner net.josemadrid.kiosk/.KioskDeviceAdminReceiver
 *   Launch the app, enter the kiosk URL, device token and staff PIN, then choose
 *   Jose Madrid Kiosk as the Home app ("Always").
 * As device owner the app locks itself in with no prompt. Without it, Android asks once to pin
 * the screen. A USB barcode scanner types like a keyboard; its keystrokes go straight to the page.
 *
 * Staff: hold the top-right corner for 3 seconds, enter the PIN, then Reload / Printer test /
 * Settings / Exit kiosk.
 */

import android.annotation.SuppressLint
import android.app.Activity
import android.app.ActivityManager
import android.app.AlertDialog
import android.app.admin.DevicePolicyManager
import android.content.ComponentName
import android.content.Intent
import android.graphics.Color
import android.graphics.drawable.GradientDrawable
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.text.InputType
import android.view.Gravity
import android.view.KeyEvent
import android.view.MotionEvent
import android.view.View
import android.view.WindowManager
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Button
import android.widget.EditText
import android.widget.FrameLayout
import android.widget.LinearLayout
import android.widget.TextView
import android.widget.Toast
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat

class MainActivity : Activity() {
    private lateinit var prefs: KioskPrefs
    private lateinit var printer: UsbPrinter
    private lateinit var web: WebView
    private lateinit var offline: View
    private val handler = Handler(Looper.getMainLooper())

    @Volatile private var mainFrameOrigin = ""
    private var loadedUrl: String? = null
    private var loadFailed = false
    private var exiting = false

    private val retry = Runnable { load(force = true) }
    private val staffHold = Runnable { askPin() }
    private var holdX = 0f
    private var holdY = 0f

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        prefs = KioskPrefs(this)
        printer = UsbPrinter(this)
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)

        web = WebView(this).apply {
            settings.javaScriptEnabled = true
            settings.domStorageEnabled = true
            settings.mediaPlaybackRequiresUserGesture = false
            settings.setSupportZoom(false)
            settings.builtInZoomControls = false
            settings.displayZoomControls = false
            settings.textZoom = 100
            settings.useWideViewPort = true
            settings.loadWithOverviewMode = true
            isFocusable = true
            isFocusableInTouchMode = true
            isHapticFeedbackEnabled = false
            // No long-press text selection or "copy / share" callouts on a public screen.
            setOnLongClickListener { true }
            setBackgroundColor(Color.parseColor(SetupActivity.BG))
            webViewClient = KioskClient()
            addJavascriptInterface(KioskBridge(prefs, printer) { mainFrameOrigin }, "JMKiosk")
        }
        offline = offlineScreen()
        setContentView(FrameLayout(this).apply {
            addView(web)
            addView(offline)
        })
    }

    override fun onResume() {
        super.onResume()
        if (!prefs.isConfigured) {
            startActivity(Intent(this, SetupActivity::class.java))
            return
        }
        hideSystemBars()
        lockIn()
        load(force = false)
        printer.find()?.let { if (!printer.hasPermission(it)) printer.requestPermission(it) }
        web.requestFocus()
    }

    override fun onWindowFocusChanged(hasFocus: Boolean) {
        super.onWindowFocusChanged(hasFocus)
        if (hasFocus) hideSystemBars()
    }

    override fun onDestroy() {
        handler.removeCallbacksAndMessages(null)
        web.destroy()
        super.onDestroy()
    }

    /** Key events (including a USB barcode scanner's "typing") go to the page; Back does nothing. */
    override fun dispatchKeyEvent(event: KeyEvent): Boolean {
        if (event.keyCode == KeyEvent.KEYCODE_BACK) return true
        if (!web.hasFocus()) web.requestFocus()
        return super.dispatchKeyEvent(event)
    }

    @Deprecated("Back is disabled in the kiosk")
    override fun onBackPressed() = Unit

    /** Watches for the 3-second staff hold in the top-right corner without stealing the touch. */
    override fun dispatchTouchEvent(ev: MotionEvent): Boolean {
        val corner = STAFF_CORNER_DP * resources.displayMetrics.density
        when (ev.actionMasked) {
            MotionEvent.ACTION_DOWN -> if (ev.x > web.width - corner && ev.y < corner) {
                holdX = ev.x
                holdY = ev.y
                handler.postDelayed(staffHold, STAFF_HOLD_MS)
            }
            MotionEvent.ACTION_MOVE -> if (Math.hypot((ev.x - holdX).toDouble(), (ev.y - holdY).toDouble()) > corner / 4) {
                handler.removeCallbacks(staffHold)
            }
            MotionEvent.ACTION_UP, MotionEvent.ACTION_CANCEL, MotionEvent.ACTION_POINTER_DOWN ->
                handler.removeCallbacks(staffHold)
        }
        return super.dispatchTouchEvent(ev)
    }

    private fun load(force: Boolean) {
        val url = prefs.url
        if (!force && url == loadedUrl && !loadFailed) return
        handler.removeCallbacks(retry)
        loadedUrl = url
        web.loadUrl(url)
    }

    private fun lockIn() {
        if (exiting) return
        val dpm = getSystemService(DevicePolicyManager::class.java)
        if (dpm.isDeviceOwnerApp(packageName)) {
            dpm.setLockTaskPackages(ComponentName(this, KioskDeviceAdminReceiver::class.java), arrayOf(packageName))
        }
        val am = getSystemService(ActivityManager::class.java)
        if (am.lockTaskModeState == ActivityManager.LOCK_TASK_MODE_NONE) {
            try {
                startLockTask()
            } catch (e: IllegalStateException) {
                // Not permitted on this device; the kiosk still runs, just not pinned.
            }
        }
    }

    private fun hideSystemBars() {
        WindowCompat.setDecorFitsSystemWindows(window, false)
        WindowCompat.getInsetsController(window, window.decorView).apply {
            hide(WindowInsetsCompat.Type.systemBars())
            systemBarsBehavior = WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
        }
    }

    private fun askPin() {
        val input = EditText(this).apply {
            inputType = InputType.TYPE_CLASS_NUMBER or InputType.TYPE_NUMBER_VARIATION_PASSWORD
            hint = "Staff PIN"
        }
        AlertDialog.Builder(this)
            .setTitle("Staff menu")
            .setView(input)
            .setPositiveButton("Unlock") { _, _ ->
                if (input.text.toString() == prefs.pin) staffMenu()
                else Toast.makeText(this, "Wrong PIN", Toast.LENGTH_SHORT).show()
            }
            .setNegativeButton("Cancel", null)
            .setOnDismissListener { hideSystemBars() }
            .show()
    }

    private fun staffMenu() {
        val items = arrayOf("Reload", "Printer test", "Settings", "Exit kiosk")
        AlertDialog.Builder(this)
            .setTitle("Staff menu")
            .setItems(items) { _, which ->
                when (which) {
                    0 -> load(force = true)
                    1 -> {
                        val problem = printer.print(EscPosReceipt.testPage())
                        Toast.makeText(this, problem ?: "Test page sent", Toast.LENGTH_LONG).show()
                    }
                    2 -> {
                        loadedUrl = null // reload with the new settings when setup closes
                        startActivity(Intent(this, SetupActivity::class.java))
                    }
                    3 -> exitKiosk()
                }
            }
            .setOnDismissListener { hideSystemBars() }
            .show()
    }

    private fun exitKiosk() {
        exiting = true
        try {
            stopLockTask()
        } catch (e: IllegalStateException) {
            // Was not locked.
        }
        finishAndRemoveTask()
    }

    private fun offlineScreen(): View {
        val dp = resources.displayMetrics.density
        return LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER
            setBackgroundColor(Color.parseColor(SetupActivity.BG))
            visibility = View.GONE
            isClickable = true
            addView(TextView(context).apply {
                text = "Warming up the salsa..."
                textSize = 40f
                setTextColor(Color.parseColor(SetupActivity.AMBER))
                gravity = Gravity.CENTER
            })
            addView(TextView(context).apply {
                text = "The kiosk can't reach the internet right now. Retrying every 15 seconds."
                textSize = 20f
                setTextColor(Color.parseColor(SetupActivity.CREAM))
                gravity = Gravity.CENTER
                setPadding(0, (16 * dp).toInt(), 0, (32 * dp).toInt())
            })
            addView(Button(context).apply {
                text = "Try again"
                textSize = 22f
                setTextColor(Color.parseColor(SetupActivity.INK))
                background = GradientDrawable().apply {
                    cornerRadius = 40 * dp
                    setColor(Color.parseColor(SetupActivity.AMBER))
                }
                setPadding((40 * dp).toInt(), (18 * dp).toInt(), (40 * dp).toInt(), (18 * dp).toInt())
                setOnClickListener { load(force = true) }
            })
        }
    }

    private fun showOffline() {
        loadFailed = true
        offline.visibility = View.VISIBLE
        handler.removeCallbacks(retry)
        handler.postDelayed(retry, RETRY_MS)
    }

    private inner class KioskClient : WebViewClient() {
        override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean =
            KioskPrefs.originOf(request.url.toString()) != prefs.origin

        override fun onPageStarted(view: WebView, url: String, favicon: android.graphics.Bitmap?) {
            mainFrameOrigin = KioskPrefs.originOf(url)
            loadFailed = false
        }

        override fun doUpdateVisitedHistory(view: WebView, url: String, isReload: Boolean) {
            mainFrameOrigin = KioskPrefs.originOf(url)
        }

        override fun onPageFinished(view: WebView, url: String) {
            if (!loadFailed) {
                offline.visibility = View.GONE
                web.requestFocus()
            }
        }

        override fun onReceivedError(view: WebView, request: WebResourceRequest, error: WebResourceError) {
            if (request.isForMainFrame) showOffline()
        }

        override fun onReceivedHttpError(view: WebView, request: WebResourceRequest, response: WebResourceResponse) {
            if (request.isForMainFrame && response.statusCode >= 500) showOffline()
        }
    }

    private companion object {
        const val STAFF_CORNER_DP = 120
        const val STAFF_HOLD_MS = 3000L
        const val RETRY_MS = 15_000L
    }
}
