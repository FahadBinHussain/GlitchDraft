// Import not needed - will load FirestoreService as global
// Create instance after class is loaded
self.importScripts('firestoreService.js');
const firestoreService = new FirestoreService();
let syncInProgress = false;

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log('[BACKGROUND] Message received:', request.action);
    if (request.action === "sync") {
        handleSync().then(sendResponse);
        return true;
    }
    if (request.action === "saveDraft") {
        console.log('[BACKGROUND] Saving draft for chatId:', request.chatId, 'messages:', request.messages?.length, 'contactName:', request.contactName);
        handleUpload(request.chatId, request.messages, request.contactName).then(sendResponse);
        return true;
    }
    if (request.action === "getDraft") {
        console.log('[BACKGROUND] Getting draft for chatId:', request.chatId);
        handleGet(request.chatId).then(sendResponse);
        return true;
    }
    if (request.action === "getAllDrafts") {
        handleGetAllDrafts().then(sendResponse);
        return true;
    }
    if (request.action === "deleteDraft") {
        handleDelete(request.chatId).then(sendResponse);
        return true;
    }
    if (request.action === "getSyncStatus") {
        handleGetStatus().then(sendResponse);
        return true;
    }
    if (request.action === "saveSettings") {
        handleSaveSettings(request.settings).then(sendResponse);
        return true;
    }
    if (request.action === "renameDraft") {
        firestoreService.renameDraft(request.fromId, request.toId, request.messages, request.contactName).then(() => sendResponse({ success: true })).catch(e => sendResponse({ success: false, message: e.message }));
        return true;
    }
    if (request.action === "getSettings") {
        handleGetSettings().then(sendResponse);
        return true;
    }
});

async function handleGetStatus() {
    try {
        const data = await chrome.storage.local.get(["firebaseConfig", "lastSyncTime"]);
        return {
            success: true,
            authenticated: !!data.firebaseConfig,
            message: data.firebaseConfig ? "Configured" : "Not configured",
            lastSyncTime: data.lastSyncTime || null
        };
    } catch (error) {
        return { success: false, authenticated: false, message: error.message };
    }
}

async function handleSaveSettings(settings) {
    try {
        await firestoreService.saveSettings(settings);
        return { success: true };
    } catch (error) {
        return { success: false, message: error.message };
    }
}

async function handleGetSettings() {
    try {
        const settings = await firestoreService.getSettings();
        return { success: true, settings };
    } catch (error) {
        return { success: false, message: error.message };
    }
}

async function handleSync() {
    console.log('[BACKGROUND] Sync requested');
    return { success: true, message: "Using cloud storage only" };
}

async function handleGet(chatId) {
    try {
        const result = await firestoreService.getDraft(chatId);
        await chrome.storage.local.set({ lastSyncTime: Date.now() });
        return {
            success: true,
            messages: result.messages,
            contactName: result.contactName,
            exists: result.exists,
            needsRename: result.needsRename || false,
            renameFrom: result.renameFrom || null,
            renameTo: result.renameTo || null
        };
    } catch (error) {
        return { success: false, message: error.message };
    }
}

async function handleUpload(chatId, messages, contactName) {
    console.log('[BACKGROUND] handleUpload called, chatId:', chatId, 'messages:', messages?.length, 'contactName:', contactName);
    try {
        // If chatId is a bare numeric ID (legacy export format), try to find the matching
        // messenger_web_ID_slug document in Firestore and import to that instead.
        let resolvedId = chatId;
        if (/^\d+$/.test(chatId)) {
            const existing = await firestoreService.findDocByNumericId(chatId);
            if (existing) {
                resolvedId = existing;
                console.log('[BACKGROUND] Resolved bare numeric ID', chatId, '→', resolvedId);
            } else {
                // No existing doc — prefix as messenger_web_{id} so it at least has the right prefix
                resolvedId = `messenger_web_${chatId}`;
                console.log('[BACKGROUND] No match found, using:', resolvedId);
            }
        }
        await firestoreService.saveDraft(resolvedId, messages, contactName);
        await chrome.storage.local.set({ lastSyncTime: Date.now() });
        console.log('[BACKGROUND] Save successful');
        return { success: true };
    } catch (error) {
        console.error('[BACKGROUND] Save error:', error);
        return { success: false, message: error.message };
    }
}

async function handleGetAllDrafts() {
    try {
        const drafts = await firestoreService.getAllDrafts();
        return { success: true, drafts };
    } catch (error) {
        return { success: false, message: error.message };
    }
}

async function handleDelete(chatId) {
    try {
        await firestoreService.deleteDraft(chatId);
        return { success: true };
    } catch (error) {
        return { success: false, message: error.message };
    }
}