/**
 * GlitchDraft LSPosed – WebView Chrome API Shim
 * -----------------------------------------------
 * content.js was written for a Chrome/Firefox extension and uses several
 * chrome.* APIs that don't exist in a plain WebView context.
 *
 * This shim polyfills the subset used by content.js:
 *
 *   chrome.storage.local  – backed by localStorage so data persists per-origin
 *   chrome.runtime        – message passing replaced by in-page fetch calls
 *                           (background.js functions are re-implemented inline)
 *
 * The Firestore REST API is called directly from the WebView's JavaScript
 * context using fetch(), which works as long as the hooked app's WebView
 * allows network access (all the targeted apps do).
 *
 * FirebaseConfig is stored in localStorage under key "glitchdraft_firebase_cfg"
 * and can be set via the module settings activity or by the user through the
 * GlitchDraft UI's existing config form.
 */

(function (window) {
    'use strict';

    // -------------------------------------------------------------------------
    // Guard: only install once
    // -------------------------------------------------------------------------
    if (window.__glitchdraft_shim_installed__) return;
    window.__glitchdraft_shim_installed__ = true;

    // -------------------------------------------------------------------------
    // Utility: localStorage-backed async store (mirrors chrome.storage.local)
    // -------------------------------------------------------------------------
    const LS_PREFIX = '__glitchdraft_store__';

    function lsGet(keys, callback) {
        const result = {};
        const keyList = Array.isArray(keys)
            ? keys
            : (typeof keys === 'string' ? [keys] : Object.keys(keys));
        keyList.forEach(k => {
            const raw = localStorage.getItem(LS_PREFIX + k);
            if (raw !== null) {
                try { result[k] = JSON.parse(raw); } catch (_) { result[k] = raw; }
            } else if (typeof keys === 'object' && !Array.isArray(keys) && k in keys) {
                result[k] = keys[k]; // default value
            }
        });
        Promise.resolve().then(() => callback(result));
    }

    function lsSet(items, callback) {
        Object.entries(items).forEach(([k, v]) => {
            localStorage.setItem(LS_PREFIX + k, JSON.stringify(v));
        });
        Promise.resolve().then(() => callback && callback());
    }

    function lsRemove(keys, callback) {
        const keyList = Array.isArray(keys) ? keys : [keys];
        keyList.forEach(k => localStorage.removeItem(LS_PREFIX + k));
        Promise.resolve().then(() => callback && callback());
    }

    // -------------------------------------------------------------------------
    // Firestore REST helpers (replaces background.js / firestoreService.js)
    // -------------------------------------------------------------------------

    async function getFirebaseConfig() {
        return new Promise(resolve => {
            lsGet(['firebaseConfig'], result => resolve(result.firebaseConfig || null));
        });
    }

    function firestoreUrl(config, path) {
        return `https://firestore.googleapis.com/v1/projects/${config.projectId}/databases/(default)/documents/${path}?key=${config.apiKey}`;
    }

    async function fsGet(path) {
        const config = await getFirebaseConfig();
        if (!config) throw new Error('Firebase config not set');
        const res = await fetch(firestoreUrl(config, path));
        if (res.status === 404) return null;
        if (!res.ok) throw new Error('Firestore GET failed: ' + res.status);
        return res.json();
    }

    async function fsPatch(path, body) {
        const config = await getFirebaseConfig();
        if (!config) throw new Error('Firebase config not set');
        const res = await fetch(firestoreUrl(config, path), {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
        if (!res.ok) throw new Error('Firestore PATCH failed: ' + res.status);
        return res.json();
    }

    async function fsDelete(path) {
        const config = await getFirebaseConfig();
        if (!config) throw new Error('Firebase config not set');
        const res = await fetch(firestoreUrl(config, path), { method: 'DELETE' });
        if (!res.ok) throw new Error('Firestore DELETE failed: ' + res.status);
    }

    // -------------------------------------------------------------------------
    // Background handler functions (inline replacement for background.js)
    // -------------------------------------------------------------------------

    async function handleSaveDraft(chatId, messages) {
        const msgsArray = messages.map(m => ({
            mapValue: {
                fields: {
                    html: { stringValue: m.html || '' },
                    timestamp: { integerValue: String(m.timestamp || Date.now()) }
                }
            }
        }));
        await fsPatch(`drafts/${chatId}`, {
            fields: {
                messages: { arrayValue: { values: msgsArray } },
                lastModified: { integerValue: String(Date.now()) }
            }
        });
        lsSet({ lastSyncTime: Date.now() }, null);
        return { success: true };
    }

    async function handleGetDraft(chatId) {
        const doc = await fsGet(`drafts/${chatId}`);
        if (!doc) return { success: true, messages: [] };
        const messages = (doc.fields?.messages?.arrayValue?.values || []).map(v => ({
            html: v.mapValue?.fields?.html?.stringValue || '',
            timestamp: parseInt(v.mapValue?.fields?.timestamp?.integerValue || '0')
        }));
        lsSet({ lastSyncTime: Date.now() }, null);
        return { success: true, messages };
    }

    async function handleDeleteDraft(chatId) {
        await fsDelete(`drafts/${chatId}`);
        return { success: true };
    }

    async function handleSaveSettings(settings) {
        await fsPatch('settings/user', {
            fields: {
                uiPositions: { stringValue: JSON.stringify(settings.uiPositions || {}) }
            }
        });
        return { success: true };
    }

    async function handleGetSettings() {
        const doc = await fsGet('settings/user');
        if (!doc) return { success: true, settings: { uiPositions: {} } };
        const uiPositions = JSON.parse(doc.fields?.uiPositions?.stringValue || '{}');
        return { success: true, settings: { uiPositions } };
    }

    async function handleGetSyncStatus() {
        const config = await getFirebaseConfig();
        return new Promise(resolve => {
            lsGet(['lastSyncTime'], result => {
                resolve({
                    success: true,
                    authenticated: !!config,
                    message: config ? 'Configured' : 'Not configured',
                    lastSyncTime: result.lastSyncTime || null
                });
            });
        });
    }

    // -------------------------------------------------------------------------
    // chrome.runtime.sendMessage  (dispatches to inline handlers above)
    // -------------------------------------------------------------------------

    const messageHandlers = {
        saveDraft:    req => handleSaveDraft(req.chatId, req.messages),
        getDraft:     req => handleGetDraft(req.chatId),
        deleteDraft:  req => handleDeleteDraft(req.chatId),
        saveSettings: req => handleSaveSettings(req.settings),
        getSettings:  () => handleGetSettings(),
        getSyncStatus: () => handleGetSyncStatus(),
        sync:         () => Promise.resolve({ success: true, message: 'Using cloud storage only' })
    };

    // -------------------------------------------------------------------------
    // chrome namespace polyfill
    // -------------------------------------------------------------------------

    window.chrome = window.chrome || {};

    // -- chrome.storage.local --
    window.chrome.storage = window.chrome.storage || {};
    window.chrome.storage.local = {
        get: lsGet,
        set: lsSet,
        remove: lsRemove
    };

    // -- chrome.runtime --
    window.chrome.runtime = window.chrome.runtime || {};
    window.chrome.runtime.lastError = null;

    window.chrome.runtime.sendMessage = function (message, callback) {
        const action = message && message.action;
        const handler = action && messageHandlers[action];

        if (!handler) {
            console.warn('[GlitchDraft shim] Unknown action:', action);
            if (callback) callback({ success: false, message: 'Unknown action: ' + action });
            return;
        }

        handler(message)
            .then(result => {
                window.chrome.runtime.lastError = null;
                if (callback) callback(result);
            })
            .catch(err => {
                console.error('[GlitchDraft shim] Handler error for', action, err);
                window.chrome.runtime.lastError = { message: err.message };
                if (callback) callback({ success: false, message: err.message });
            });
    };

    // -- chrome.runtime.onMessage (stub, not needed in this context) --
    window.chrome.runtime.onMessage = {
        addListener: function () { /* no-op in WebView */ }
    };

    // -------------------------------------------------------------------------
    // Expose a config-setter for the module settings activity to call via
    // WebView.evaluateJavascript() after the user enters their Firebase creds.
    // -------------------------------------------------------------------------
    window.GlitchDraftSetConfig = function (projectId, apiKey) {
        lsSet({
            firebaseConfig: { projectId, apiKey }
        }, () => {
            console.log('[GlitchDraft shim] Firebase config saved');
        });
    };

    console.log('[GlitchDraft shim] Chrome API polyfill installed');

})(window);
