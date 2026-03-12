package com.fahad.glitchdraft.lsposed.hook

import android.app.Activity
import android.content.res.AssetManager
import android.os.Handler
import android.os.Looper
import android.webkit.WebView
import com.fahad.glitchdraft.lsposed.overlay.OverlayController
import de.robv.android.xposed.IXposedHookLoadPackage
import de.robv.android.xposed.XC_MethodHook
import de.robv.android.xposed.XposedBridge
import de.robv.android.xposed.XposedHelpers
import de.robv.android.xposed.callbacks.XC_LoadPackage
import java.io.InputStream

/**
 * GlitchDraftHook
 *
 * LSPosed / Xposed module entry point.
 *
 * Strategy
 * --------
 * GlitchDraft's browser extension injects content.js + styles.css into web pages
 * through the Chrome/Firefox extension APIs.  On Android there is no extension
 * API, so we hook WebView's page-lifecycle methods instead:
 *
 *   - WebViewClient.onPageFinished()   → inject CSS then JS after every navigation
 *   - WebView.loadUrl()                → detect when a supported URL is being loaded
 *
 * The injected JavaScript is the exact same content.js that the browser extension
 * uses (bundled inside assets/), adapted via a tiny shim (glitchdraft_shim.js)
 * that polyfills the chrome.* APIs using Android-to-WebView message bridges.
 *
 * Supported packages (scope set in LSPosed Manager):
 *   com.facebook.orca          – Messenger
 *   com.facebook.katana        – Facebook (web view)
 *   com.discord                – Discord
 *   com.whatsapp               – WhatsApp
 *   com.android.chrome         – Chrome (general WebView hook)
 *   org.mozilla.firefox        – Firefox for Android
 *   com.microsoft.emmx         – Microsoft Edge
 *   com.opera.browser          – Opera
 *   com.brave.browser          – Brave
 */
class GlitchDraftHook : IXposedHookLoadPackage {

    companion object {
        private const val TAG = "GlitchDraft-LSPosed"

        /** Packages whose WebViews we want to target */
        private val TARGET_PACKAGES = setOf(
            "com.facebook.orca",
            "com.facebook.katana",
            "com.discord",
            "com.whatsapp",
            "com.android.chrome",
            "com.chrome.beta",
            "com.chrome.dev",
            "com.chrome.canary",
            "org.mozilla.firefox",
            "org.mozilla.fenix",
            "com.microsoft.emmx",
            "com.opera.browser",
            "com.opera.mini.native",
            "com.brave.browser",
            "com.kiwibrowser.browser"
        )

        /** URL substrings that trigger injection (mirrors manifest.json host_permissions) */
        private val TARGET_URLS = listOf(
            "messenger.com",
            "facebook.com/messages",
            "discord.com/channels",
            "web.whatsapp.com",
            "hostseba.com/register.php"
        )
    }

    // -------------------------------------------------------------------------
    // IXposedHookLoadPackage
    // -------------------------------------------------------------------------

    override fun handleLoadPackage(lpparam: XC_LoadPackage.LoadPackageParam) {
        if (lpparam.packageName !in TARGET_PACKAGES) return

        XposedBridge.log("$TAG: Hooking package ${lpparam.packageName}")

        hookWebViewClient(lpparam)
        hookWebViewLoadUrl(lpparam)
        hookActivityForOverlay(lpparam)
        hookMessengerThreadNavigation(lpparam)
    }

    // -------------------------------------------------------------------------
    // Hook Activity.onResume → attach in-process overlay (native UI coverage)
    // -------------------------------------------------------------------------

    private fun hookActivityForOverlay(lpparam: XC_LoadPackage.LoadPackageParam) {
        try {
            val activityClass = XposedHelpers.findClass("android.app.Activity", lpparam.classLoader)

            XposedHelpers.findAndHookMethod(
                activityClass,
                "onResume",
                object : XC_MethodHook() {
                    override fun afterHookedMethod(param: MethodHookParam) {
                        val activity = param.thisObject as? Activity ?: return
                        val activityName = activity.javaClass.simpleName

                        Handler(Looper.getMainLooper()).post {
                            try {
                                if (!OverlayController.isAttached()) {
                                    XposedBridge.log("$TAG: Attaching overlay for $activityName in ${lpparam.packageName}")
                                    OverlayController.attach(activity, lpparam.packageName)
                                }
                                // Try to extract a chat ID from the Activity's intent
                                // each time it resumes (covers navigation between conversations)
                                val chatId = extractChatIdFromActivity(activity, lpparam.packageName)
                                XposedBridge.log("$TAG: onResume [$activityName] intent=${activity.intent?.data} extras=${activity.intent?.extras?.keySet()} → chatId=$chatId")
                                if (chatId != null) {
                                    OverlayController.setChatId(chatId)
                                }
                            } catch (e: Throwable) {
                                XposedBridge.log("$TAG: OverlayController.attach failed: $e")
                            }
                        }
                    }
                }
            )
        } catch (e: Throwable) {
            XposedBridge.log("$TAG: Failed to hook Activity.onResume: $e")
        }
    }

    /**
     * Extracts a stable chat identifier from the Activity's Intent.
     *
     * Messenger deep-links look like:
     *   fb://messaging/{thread_id}
     *   https://www.messenger.com/t/{thread_key}
     *
     * WhatsApp:
     *   intent with extras: jid, phone
     *
     * Discord:
     *   discord://discord.com/channels/{guild}/{channel}
     */
    private fun extractChatIdFromActivity(activity: Activity, pkg: String): String? {
        return try {
            val intent = activity.intent ?: run {
                XposedBridge.log("$TAG: extractChatId — no intent")
                return null
            }
            val data = intent.data
            XposedBridge.log("$TAG: extractChatId — pkg=$pkg data=$data action=${intent.action}")

            // Dump all intent extras for debug
            intent.extras?.keySet()?.forEach { key ->
                XposedBridge.log("$TAG: extractChatId — extra[$key]=${intent.extras?.get(key)}")
            }

            val result = when {
                pkg.contains("facebook") || pkg.contains("orca") -> {
                    data?.let { uri ->
                        val path = uri.path ?: ""
                        val segments = uri.pathSegments
                        XposedBridge.log("$TAG: extractChatId — FB uri=$uri path=$path segments=$segments")
                        when {
                            uri.scheme == "fb" && path.startsWith("/messaging/") -> {
                                val last = segments.lastOrNull() ?: return@let null
                                normalizeToFirestoreId(last, "messenger")
                            }
                            path.contains("/t/") -> {
                                val idx = segments.indexOf("t")
                                if (idx >= 0 && idx + 1 < segments.size) segments[idx + 1] else null
                            }
                            else -> null
                        }
                    } ?: run {
                        val threadKey = intent.getStringExtra("thread_key")
                            ?: intent.getLongExtra("thread_id", -1L).takeIf { it != -1L }?.toString()
                        XposedBridge.log("$TAG: extractChatId — FB extras fallback threadKey=$threadKey")
                        threadKey?.let { normalizeToFirestoreId(it, "messenger") }
                    }
                }
                pkg.contains("whatsapp") -> {
                    val jid = intent.getStringExtra("jid")
                        ?: intent.getStringExtra("phone_number")
                        ?: data?.getQueryParameter("phone")
                    XposedBridge.log("$TAG: extractChatId — WA jid=$jid")
                    jid?.let { normalizeToFirestoreId(it, "whatsapp") }
                }
                pkg.contains("discord") -> {
                    data?.let { uri ->
                        val segments = uri.pathSegments
                        val idx = segments.indexOf("channels")
                        val id = if (idx >= 0 && idx + 2 < segments.size) "discord_${segments[idx + 2]}" else null
                        XposedBridge.log("$TAG: extractChatId — Discord segments=$segments id=$id")
                        id
                    }
                }
                else -> null
            }
            XposedBridge.log("$TAG: extractChatId → result=$result")
            result
        } catch (e: Throwable) {
            XposedBridge.log("$TAG: extractChatIdFromActivity failed: $e")
            null
        }
    }

    // -------------------------------------------------------------------------
    // Hook Messenger's Fragment navigation to detect thread changes
    // -------------------------------------------------------------------------

    /**
     * Messenger uses internal Fragments (not separate Activities) for each
     * conversation.  Their class names are obfuscated so we can't reference them
     * directly.  Instead we hook Fragment.onResume() and scan arguments /
     * fields for any value that looks like a thread ID (long number or string).
     *
     * The Fragment's arguments Bundle is checked for common key patterns.
     * We also scan the Fragment's own fields for anything named like *thread*,
     * *conversation*, *chat*, *key*.
     *
     * For WhatsApp: hook Fragment.onResume and look for "jid" or "contact_jid".
     */
    private fun hookMessengerThreadNavigation(lpparam: XC_LoadPackage.LoadPackageParam) {
        val pkg = lpparam.packageName
        if (!pkg.contains("facebook") && !pkg.contains("orca") &&
            !pkg.contains("whatsapp") && !pkg.contains("discord")) return

        try {
            val fragmentClass = try {
                // AndroidX Fragment
                XposedHelpers.findClass("androidx.fragment.app.Fragment", lpparam.classLoader)
            } catch (_: Throwable) {
                // Support Fragment fallback
                XposedHelpers.findClass("android.support.v4.app.Fragment", lpparam.classLoader)
            }

            XposedHelpers.findAndHookMethod(
                fragmentClass,
                "onResume",
                object : XC_MethodHook() {
                    override fun afterHookedMethod(param: MethodHookParam) {
                        val fragment = param.thisObject ?: return
                        val fragName = fragment.javaClass.simpleName

                        // Only process fragments whose class name hints at conversations
                        val isConvoFragment = fragName.contains("Conversation", ignoreCase = true)
                            || fragName.contains("Thread", ignoreCase = true)
                            || fragName.contains("Chat", ignoreCase = true)
                            || fragName.contains("Message", ignoreCase = true)
                            || fragName.contains("Inbox", ignoreCase = true)

                        // Try to get args Bundle via getArguments()
                        val args = try {
                            val m = fragment.javaClass.getMethod("getArguments")
                            m.invoke(fragment) as? android.os.Bundle
                        } catch (_: Throwable) { null }

                        // Dump all args for debug (only for interesting fragments)
                        if (args != null) {
                            args.keySet()?.forEach { key ->
                                XposedBridge.log("$TAG: Fragment[$fragName] arg[$key]=${args.get(key)}")
                            }
                        }

                        // Scan fields of the fragment for thread/conversation IDs
                        val chatId = extractFromFragmentArgs(args, pkg, fragName)
                            ?: scanFragmentFields(fragment, fragName, pkg)

                        if (chatId != null) {
                            XposedBridge.log("$TAG: Fragment[$fragName] → chatId=$chatId")
                            Handler(Looper.getMainLooper()).post {
                                OverlayController.setChatId(chatId)
                            }
                        }
                    }
                }
            )
            XposedBridge.log("$TAG: Hooked Fragment.onResume for $pkg")
        } catch (e: Throwable) {
            XposedBridge.log("$TAG: hookMessengerThreadNavigation failed: $e")
        }
    }

    private fun extractFromFragmentArgs(args: android.os.Bundle?, pkg: String, fragName: String): String? {
        if (args == null || args.isEmpty) return null
        val prefix = when {
            pkg.contains("whatsapp") -> "whatsapp"
            pkg.contains("discord") -> "discord"
            else -> "messenger"
        }

        // Key patterns to try
        val patterns = listOf(
            "thread_id", "thread_key", "threadId", "threadKey",
            "conversation_id", "conversationId",
            "jid", "contact_jid", "target_jid",
            "channel_id", "channelId",
            "chat_id", "chatId"
        )
        for (key in patterns) {
            val v = args.get(key)
            if (v != null && v.toString().isNotBlank()) {
                XposedBridge.log("$TAG: Fragment[$fragName] found key=$key value=$v")
                return normalizeToFirestoreId(v.toString(), prefix)
            }
        }
        // Also try any key that contains "thread", "chat", "conversation", "jid"
        args.keySet()?.forEach { key ->
            val lower = key.lowercase()
            if (lower.contains("thread") || lower.contains("chat") ||
                lower.contains("conversation") || lower.contains("jid") ||
                lower.contains("channel")) {
                val v = args.get(key)
                if (v != null && v.toString().isNotBlank()) {
                    XposedBridge.log("$TAG: Fragment[$fragName] heuristic key=$key value=$v")
                    return normalizeToFirestoreId(v.toString(), prefix)
                }
            }
        }
        return null
    }

    /**
     * Converts a raw thread key to a Firestore document ID that matches
     * what the browser extension uses.
     *
     * Messenger: "ADVANCED_CRYPTO_ONE_TO_ONE:410625012" → "410625012"
     *            (extension reads /t/(\d+) from URL → just the number)
     * WhatsApp:  "1234567890@s.whatsapp.net" → "1234567890"
     *            (extension uses jid without domain)
     * Discord:   "1234567" → "discord_GUILD_1234567"
     *            (extension uses discord_{guild}_{channel})
     */
    private fun normalizeToFirestoreId(raw: String, prefix: String): String {
        return when (prefix) {
            "messenger" -> {
                // "TYPE:numeric_id" → "numeric_id" (matches extension's /t/(\d+))
                val colonIdx = raw.lastIndexOf(':')
                if (colonIdx >= 0) raw.substring(colonIdx + 1) else raw
            }
            "whatsapp" -> {
                // "1234567890@s.whatsapp.net" → "1234567890"
                raw.substringBefore("@")
            }
            else -> "${prefix}_$raw"
        }
    }

    private fun scanFragmentFields(fragment: Any, fragName: String, pkg: String): String? {
        val prefix = when {
            pkg.contains("whatsapp") -> "whatsapp"
            pkg.contains("discord") -> "discord"
            else -> "messenger"
        }
        return try {
            var cls: Class<*>? = fragment.javaClass
            while (cls != null && cls.name != "java.lang.Object") {
                for (field in cls.declaredFields) {
                    val name = field.name.lowercase()
                    if (name.contains("thread") || name.contains("chat") ||
                        name.contains("conversation") || name.contains("jid") ||
                        name.contains("channel")) {
                        field.isAccessible = true
                        val v = field.get(fragment)
                        if (v != null && v.toString().isNotBlank() &&
                            v.toString() != "null") {
                            XposedBridge.log("$TAG: Fragment[$fragName] field[${field.name}]=$v")
                            return normalizeToFirestoreId(v.toString(), prefix)
                        }
                    }
                }
                cls = cls.superclass
            }
            null
        } catch (_: Throwable) { null }
    }

    // -------------------------------------------------------------------------
    // Hook WebViewClient.onPageFinished
    // -------------------------------------------------------------------------

    private fun hookWebViewClient(lpparam: XC_LoadPackage.LoadPackageParam) {
        try {
            val webViewClientClass = XposedHelpers.findClass(
                "android.webkit.WebViewClient",
                lpparam.classLoader
            )

            XposedHelpers.findAndHookMethod(
                webViewClientClass,
                "onPageFinished",
                WebView::class.java,
                String::class.java,
                object : XC_MethodHook() {
                    override fun afterHookedMethod(param: MethodHookParam) {
                        val webView = param.args[0] as? WebView ?: return
                        val url = param.args[1] as? String ?: return

                        if (!isTargetUrl(url)) return

                        // Keep the overlay panel's chat-ID in sync
                        extractChatId(url)?.let { OverlayController.setChatId(it) }

                        XposedBridge.log("$TAG: onPageFinished triggered for $url")
                        injectGlitchDraft(webView, lpparam)
                    }
                }
            )
        } catch (e: Throwable) {
            XposedBridge.log("$TAG: Failed to hook WebViewClient.onPageFinished: $e")
        }
    }

    // -------------------------------------------------------------------------
    // Hook WebView.loadUrl (catches SPA navigations that don't fire onPageFinished)
    // -------------------------------------------------------------------------

    private fun hookWebViewLoadUrl(lpparam: XC_LoadPackage.LoadPackageParam) {
        try {
            val webViewClass = XposedHelpers.findClass(
                "android.webkit.WebView",
                lpparam.classLoader
            )

            // loadUrl(String)
            XposedHelpers.findAndHookMethod(
                webViewClass,
                "loadUrl",
                String::class.java,
                object : XC_MethodHook() {
                    override fun afterHookedMethod(param: MethodHookParam) {
                        val webView = param.thisObject as? WebView ?: return
                        val url = param.args[0] as? String ?: return

                        if (!isTargetUrl(url)) return

                        // Keep the overlay panel's chat-ID in sync
                        extractChatId(url)?.let { OverlayController.setChatId(it) }

                        // Delay slightly so the page has a chance to start loading
                        Handler(Looper.getMainLooper()).postDelayed({
                            injectGlitchDraft(webView, lpparam)
                        }, 1500)
                    }
                }
            )
        } catch (e: Throwable) {
            XposedBridge.log("$TAG: Failed to hook WebView.loadUrl: $e")
        }
    }

    // -------------------------------------------------------------------------
    // Injection logic
    // -------------------------------------------------------------------------

    private fun injectGlitchDraft(webView: WebView, lpparam: XC_LoadPackage.LoadPackageParam) {
        // Must run on the main thread
        Handler(Looper.getMainLooper()).post {
            try {
                // Enable JavaScript (required for injection)
                webView.settings.javaScriptEnabled = true

                // Load assets from module APK (not from the hooked app)
                val assetManager = getModuleAssetManager(lpparam) ?: run {
                    XposedBridge.log("$TAG: Could not obtain module AssetManager")
                    return@post
                }

                val css = readAsset(assetManager, "glitchdraft/styles.css")
                val shim = readAsset(assetManager, "glitchdraft/glitchdraft_shim.js")
                val contentJs = readAsset(assetManager, "glitchdraft/content.js")

                if (css == null || shim == null || contentJs == null) {
                    XposedBridge.log("$TAG: One or more assets could not be read, aborting injection")
                    return@post
                }

                // 1. Inject CSS
                val escapedCss = css
                    .replace("\\", "\\\\")
                    .replace("`", "\\`")
                val cssInjection = """
                    (function() {
                        if (document.getElementById('__glitchdraft_css__')) return;
                        const style = document.createElement('style');
                        style.id = '__glitchdraft_css__';
                        style.textContent = `$escapedCss`;
                        document.head.appendChild(style);
                    })();
                """.trimIndent()

                webView.evaluateJavascript(cssInjection, null)

                // 2. Inject shim (must come before content.js)
                val guardedShim = """
                    (function() {
                        if (window.__glitchdraft_shim_loaded__) return;
                        window.__glitchdraft_shim_loaded__ = true;
                        $shim
                    })();
                """.trimIndent()

                webView.evaluateJavascript(guardedShim) {
                    // 3. Inject content.js only after shim is ready
                    val guardedContent = """
                        (function() {
                            if (window.__glitchdraft_loaded__) return;
                            window.__glitchdraft_loaded__ = true;
                            $contentJs
                        })();
                    """.trimIndent()

                    webView.evaluateJavascript(guardedContent) { result ->
                        XposedBridge.log("$TAG: Injection complete, result=$result")
                    }
                }

            } catch (e: Throwable) {
                XposedBridge.log("$TAG: Injection error: $e")
            }
        }
    }

    // -------------------------------------------------------------------------
    // Helpers
    // -------------------------------------------------------------------------

    private fun isTargetUrl(url: String): Boolean =
        TARGET_URLS.any { url.contains(it, ignoreCase = true) }

    /**
     * Extract a stable chat ID from the URL so the overlay panel can scope
     * drafts to the current conversation.
     * e.g. "https://www.messenger.com/t/123456" → "messenger_123456"
     */
    private fun extractChatId(url: String): String? {
        return try {
            val uri = android.net.Uri.parse(url)
            when {
                url.contains("messenger.com/t/") -> {
                    val segments = uri.pathSegments
                    val idx = segments.indexOf("t")
                    if (idx >= 0 && idx + 1 < segments.size) "messenger_${segments[idx + 1]}" else null
                }
                url.contains("discord.com/channels/") -> {
                    val segments = uri.pathSegments
                    // /channels/{guild}/{channel}
                    val idx = segments.indexOf("channels")
                    if (idx >= 0 && idx + 2 < segments.size) "discord_${segments[idx + 2]}" else null
                }
                url.contains("web.whatsapp.com") -> null  // WhatsApp uses in-page JS for chat ID
                else -> null
            }
        } catch (_: Throwable) { null }
    }

    /**
     * Obtain the AssetManager of the **module** APK (not the hooked app).
     * We use the module's own Resources object, which LSPosed attaches to the
     * LoadPackageParam via the module path.
     */
    private fun getModuleAssetManager(lpparam: XC_LoadPackage.LoadPackageParam): AssetManager? {
        return try {
            val modulePath = XposedBridge::class.java
                .getMethod("getXposedVersion")
                .let { lpparam.classLoader }
                .let { _ ->
                    // Retrieve module APK path from XposedBridge context
                    XposedHelpers.getObjectField(
                        XposedBridge::class.java.getDeclaredField("moduleContext").also {
                            it.isAccessible = true
                        }.get(null),
                        "assets"
                    ) as? AssetManager
                }
            modulePath
        } catch (_: Throwable) {
            // Fallback: attempt to open the module APK directly via ActivityThread
            try {
                val activityThreadClass = XposedHelpers.findClass(
                    "android.app.ActivityThread",
                    lpparam.classLoader
                )
                val currentApp = XposedHelpers.callStaticMethod(
                    activityThreadClass, "currentApplication"
                ) as? android.app.Application

                // Walk the loaded apk list to find ours
                val packageManager = currentApp?.packageManager ?: return null
                val moduleApkPath = packageManager
                    .getApplicationInfo("com.fahad.glitchdraft.lsposed", 0)
                    .sourceDir

                val assetManager = AssetManager::class.java.newInstance()
                XposedHelpers.callMethod(assetManager, "addAssetPath", moduleApkPath)
                assetManager
            } catch (e2: Throwable) {
                XposedBridge.log("$TAG: getModuleAssetManager fallback failed: $e2")
                null
            }
        }
    }

    private fun readAsset(assetManager: AssetManager, path: String): String? {
        return try {
            val inputStream: InputStream = assetManager.open(path)
            inputStream.bufferedReader(Charsets.UTF_8).use { it.readText() }
        } catch (e: Throwable) {
            XposedBridge.log("$TAG: Could not read asset $path: $e")
            null
        }
    }
}
