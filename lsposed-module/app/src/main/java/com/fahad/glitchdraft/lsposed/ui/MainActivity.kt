package com.fahad.glitchdraft.lsposed.ui

import android.os.Bundle
import android.widget.Button
import android.widget.EditText
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import com.fahad.glitchdraft.lsposed.R
import org.json.JSONException
import org.json.JSONObject

/**
 * Module launcher activity.
 *
 * The user pastes their full Firebase config JSON (same format as the
 * browser extension popup accepts).  The projectId and apiKey are extracted
 * and stored in SharedPreferences for use by DraftRepository.
 *
 * Example input:
 * {
 *   "apiKey": "AIza...",
 *   "authDomain": "...",
 *   "projectId": "glitchdraftt",
 *   ...
 * }
 */
class MainActivity : AppCompatActivity() {

    companion object {
        private const val PREFS_NAME   = "glitchdraft_module_prefs"
        private const val KEY_PROJECT_ID = "firebase_project_id"
        private const val KEY_API_KEY    = "firebase_api_key"
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        // Store in regular (credential-protected) SharedPreferences with MODE_PRIVATE.
        // XSharedPreferences in DraftRepository reads from the same path cross-process.
        val prefs = getSharedPreferences(PREFS_NAME, MODE_PRIVATE)

        val tvStatus   = findViewById<TextView>(R.id.tv_status)
        val etConfig   = findViewById<EditText>(R.id.et_firebase_config)
        val btnSave    = findViewById<Button>(R.id.btn_save)

        // Show current status
        val savedProject = prefs.getString(KEY_PROJECT_ID, null)
        updateStatus(tvStatus, savedProject)

        btnSave?.setOnClickListener {
            val raw = etConfig?.text?.toString()?.trim() ?: ""
            if (raw.isEmpty()) {
                Toast.makeText(this, "Paste your Firebase config JSON first", Toast.LENGTH_SHORT).show()
                return@setOnClickListener
            }

            try {
                val json = JSONObject(raw)
                val projectId = json.getString("projectId")
                val apiKey    = json.getString("apiKey")

                prefs.edit()
                    .putString(KEY_PROJECT_ID, projectId)
                    .putString(KEY_API_KEY, apiKey)
                    .commit()   // commit() (synchronous) so the file is on disk immediately

                updateStatus(tvStatus, projectId)
                etConfig.setText("")
                Toast.makeText(
                    this,
                    "Saved! Force-stop the target apps to apply.",
                    Toast.LENGTH_LONG
                ).show()

            } catch (e: JSONException) {
                Toast.makeText(this, "Invalid JSON: ${e.message}", Toast.LENGTH_LONG).show()
            }
        }
    }

    private fun updateStatus(tv: TextView?, projectId: String?) {
        tv ?: return
        if (!projectId.isNullOrBlank()) {
            tv.text = "✅ Configured — Firebase project: $projectId"
            tv.setTextColor(0xFF2E7D32.toInt())
        } else {
            tv.text = "⚠️ Not configured — paste your Firebase config JSON below"
            tv.setTextColor(0xFFE65100.toInt())
        }
    }
}
