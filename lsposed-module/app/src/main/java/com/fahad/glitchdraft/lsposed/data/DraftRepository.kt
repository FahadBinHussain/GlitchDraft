package com.fahad.glitchdraft.lsposed.data

import android.content.Context
import android.net.Uri
import com.fahad.glitchdraft.lsposed.provider.ConfigProvider
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject
import java.io.OutputStreamWriter
import java.net.HttpURLConnection
import java.net.URL

/**
 * DraftRepository
 *
 * Kotlin port of firestoreService.js + background.js.
 * Used by OverlayController to read/write Firestore drafts from the
 * native overlay panel.
 *
 * Firebase credentials are fetched via ConfigProvider — a ContentProvider
 * in the module APK that serves the config cross-process.
 */
class DraftRepository(private val context: Context) {

    data class Draft(val html: String, val timestamp: Long)

    companion object {
        private const val FS_BASE = "https://firestore.googleapis.com/v1/projects"
    }

    /**
     * Fetches Firebase credentials from the module's ContentProvider.
     * Works cross-process (e.g. when called from inside Messenger's process).
     */
    private data class FirebaseConfig(val projectId: String, val apiKey: String)

    private fun readConfig(): FirebaseConfig? {
        return try {
            val cursor = context.contentResolver.query(
                ConfigProvider.CONTENT_URI, null, null, null, null
            ) ?: return null

            cursor.use {
                if (!it.moveToFirst()) return null
                val pid = it.getString(it.getColumnIndexOrThrow(ConfigProvider.COL_PROJECT_ID))
                val key = it.getString(it.getColumnIndexOrThrow(ConfigProvider.COL_API_KEY))
                if (pid.isNullOrBlank() || key.isNullOrBlank()) null
                else FirebaseConfig(pid, key)
            }
        } catch (_: Throwable) {
            null
        }
    }

    private fun docUrl(path: String): String {
        val cfg = readConfig() ?: throw IllegalStateException("Firebase config not set — open GlitchDraft app and paste your Firebase JSON")
        return "$FS_BASE/${cfg.projectId}/databases/(default)/documents/$path?key=${cfg.apiKey}"
    }

    // -------------------------------------------------------------------------
    // GET draft
    // -------------------------------------------------------------------------

    suspend fun getDraft(chatId: String): List<Draft> = withContext(Dispatchers.IO) {
        val url = URL(docUrl("drafts/$chatId"))
        val conn = url.openConnection() as HttpURLConnection
        conn.requestMethod = "GET"
        conn.connectTimeout = 8000
        conn.readTimeout = 8000

        if (conn.responseCode == 404) return@withContext emptyList()
        if (conn.responseCode != 200) return@withContext emptyList()

        val body = conn.inputStream.bufferedReader().readText()
        val doc = JSONObject(body)
        val values = doc.optJSONObject("fields")
            ?.optJSONObject("messages")
            ?.optJSONObject("arrayValue")
            ?.optJSONArray("values") ?: return@withContext emptyList()

        val list = mutableListOf<Draft>()
        for (i in 0 until values.length()) {
            val fields = values.getJSONObject(i)
                .optJSONObject("mapValue")?.optJSONObject("fields") ?: continue
            val html = fields.optJSONObject("html")?.optString("stringValue", "") ?: ""
            val ts = fields.optJSONObject("timestamp")?.optString("integerValue", "0")?.toLongOrNull() ?: 0L
            list.add(Draft(html = html, timestamp = ts))
        }
        list
    }

    // -------------------------------------------------------------------------
    // SAVE draft
    // -------------------------------------------------------------------------

    suspend fun saveDraft(chatId: String, messages: List<Draft>) = withContext(Dispatchers.IO) {
        val url = URL(docUrl("drafts/$chatId"))
        val conn = url.openConnection() as HttpURLConnection
        conn.requestMethod = "PATCH"
        conn.setRequestProperty("Content-Type", "application/json")
        conn.doOutput = true
        conn.connectTimeout = 8000
        conn.readTimeout = 8000

        val msgsArray = JSONArray()
        messages.forEach { m ->
            msgsArray.put(JSONObject().apply {
                put("mapValue", JSONObject().apply {
                    put("fields", JSONObject().apply {
                        put("html", JSONObject().put("stringValue", m.html))
                        put("timestamp", JSONObject().put("integerValue", m.timestamp.toString()))
                    })
                })
            })
        }

        val body = JSONObject().apply {
            put("fields", JSONObject().apply {
                put("messages", JSONObject().apply {
                    put("arrayValue", JSONObject().apply {
                        put("values", msgsArray)
                    })
                })
                put("lastModified", JSONObject().put("integerValue", System.currentTimeMillis().toString()))
            })
        }

        OutputStreamWriter(conn.outputStream).use { it.write(body.toString()) }
        conn.responseCode // trigger the request
    }

    // -------------------------------------------------------------------------
    // DELETE draft
    // -------------------------------------------------------------------------

    suspend fun deleteDraft(chatId: String) = withContext(Dispatchers.IO) {
        val url = URL(docUrl("drafts/$chatId"))
        val conn = url.openConnection() as HttpURLConnection
        conn.requestMethod = "DELETE"
        conn.connectTimeout = 8000
        conn.readTimeout = 8000
        conn.responseCode
    }

    // -------------------------------------------------------------------------
    // GET / SAVE settings (UI positions)
    // -------------------------------------------------------------------------

    suspend fun getSettings(): JSONObject = withContext(Dispatchers.IO) {
        val url = URL(docUrl("settings/user"))
        val conn = url.openConnection() as HttpURLConnection
        conn.requestMethod = "GET"
        conn.connectTimeout = 8000
        conn.readTimeout = 8000

        if (conn.responseCode == 404) return@withContext JSONObject()
        if (conn.responseCode != 200) return@withContext JSONObject()

        val body = conn.inputStream.bufferedReader().readText()
        val doc = JSONObject(body)
        val raw = doc.optJSONObject("fields")
            ?.optJSONObject("uiPositions")
            ?.optString("stringValue", "{}") ?: "{}"
        JSONObject(raw)
    }

    suspend fun saveSettings(uiPositions: JSONObject) = withContext(Dispatchers.IO) {
        val url = URL(docUrl("settings/user"))
        val conn = url.openConnection() as HttpURLConnection
        conn.requestMethod = "PATCH"
        conn.setRequestProperty("Content-Type", "application/json")
        conn.doOutput = true
        conn.connectTimeout = 8000
        conn.readTimeout = 8000

        val body = JSONObject().apply {
            put("fields", JSONObject().apply {
                put("uiPositions", JSONObject().put("stringValue", uiPositions.toString()))
            })
        }
        OutputStreamWriter(conn.outputStream).use { it.write(body.toString()) }
        conn.responseCode
    }
}
