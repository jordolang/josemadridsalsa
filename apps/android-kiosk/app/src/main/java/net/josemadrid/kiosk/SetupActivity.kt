package net.josemadrid.kiosk

import android.app.Activity
import android.graphics.Color
import android.graphics.drawable.GradientDrawable
import android.os.Bundle
import android.text.InputType
import android.view.Gravity
import android.view.View
import android.widget.Button
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView

/** Staff-only form for the kiosk URL, device token and staff PIN. */
class SetupActivity : Activity() {
    private lateinit var prefs: KioskPrefs

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        prefs = KioskPrefs(this)
        val dp = resources.displayMetrics.density

        val error = label("", 16f, Color.parseColor("#FF8A1F"))
        val url = field("Kiosk URL", InputType.TYPE_TEXT_VARIATION_URI).apply { setText(prefs.url) }
        val token = field(
            if (prefs.token.isEmpty()) "Kiosk device token" else "Kiosk device token (leave blank to keep)",
            InputType.TYPE_TEXT_VARIATION_PASSWORD,
        )
        val pin = field(
            if (prefs.pin.isEmpty()) "Staff PIN (4-8 digits)" else "Staff PIN (leave blank to keep)",
            InputType.TYPE_CLASS_NUMBER or InputType.TYPE_NUMBER_VARIATION_PASSWORD,
            base = InputType.TYPE_CLASS_NUMBER,
        )
        val save = Button(this).apply {
            text = "Save and start kiosk"
            setTextColor(Color.parseColor(INK))
            textSize = 20f
            background = GradientDrawable().apply { cornerRadius = 40 * dp; setColor(Color.parseColor(AMBER)) }
            setPadding((32 * dp).toInt(), (18 * dp).toInt(), (32 * dp).toInt(), (18 * dp).toInt())
            setOnClickListener {
                val u = url.text.toString().trim()
                val t = token.text.toString().trim().ifEmpty { prefs.token }
                val p = pin.text.toString().trim().ifEmpty { prefs.pin }
                val problem = validate(u, t, p)
                if (problem != null) {
                    error.text = problem
                } else {
                    prefs.save(u, t, p)
                    finish()
                }
            }
        }

        val form = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER_HORIZONTAL
            val pad = (48 * dp).toInt()
            setPadding(pad, pad, pad, pad)
            addView(label("Jose Madrid Kiosk", 34f, Color.parseColor(AMBER)))
            addView(label("Staff setup", 18f, Color.parseColor(CREAM)))
            listOf(url, token, pin, error, save).forEach { v ->
                addView(v, LinearLayout.LayoutParams((560 * dp).toInt(), LinearLayout.LayoutParams.WRAP_CONTENT).apply {
                    topMargin = (20 * dp).toInt()
                })
            }
        }
        setContentView(ScrollView(this).apply {
            setBackgroundColor(Color.parseColor(BG))
            isFillViewport = true
            addView(form)
        })
    }

    private fun validate(url: String, token: String, pin: String): String? {
        val origin = KioskPrefs.originOf(url)
        val local = origin.startsWith("http://localhost") || origin.startsWith("http://127.0.0.1")
        return when {
            !url.startsWith("https://") && !local -> "The kiosk URL must start with https://"
            token.isEmpty() -> "Enter the kiosk device token."
            !Regex("\\d{4,8}").matches(pin) -> "The staff PIN must be 4 to 8 digits."
            else -> null
        }
    }

    private fun label(text: String, size: Float, color: Int) = TextView(this).apply {
        this.text = text
        textSize = size
        setTextColor(color)
        gravity = Gravity.CENTER
    }

    private fun field(hint: String, variation: Int, base: Int = InputType.TYPE_CLASS_TEXT) = EditText(this).apply {
        this.hint = hint
        inputType = base or variation
        isSingleLine = true
        textSize = 20f
        setTextColor(Color.parseColor(CREAM))
        setHintTextColor(Color.parseColor("#9C8B78"))
        backgroundTintList = android.content.res.ColorStateList.valueOf(Color.parseColor(AMBER))
        textAlignment = View.TEXT_ALIGNMENT_VIEW_START
    }

    companion object {
        const val BG = "#0B0605"
        const val CREAM = "#FFF3E0"
        const val AMBER = "#F4A81D"
        const val INK = "#24130A"
    }
}
