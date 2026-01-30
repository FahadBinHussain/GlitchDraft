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
        console.log('[BACKGROUND] Saving draft for chatId:', request.chatId, 'messages:', request.messages?.length);
        handleUpload(request.chatId, request.messages).then(sendResponse);
        return true;
    }
    if (request.action === "getDraft") {
        console.log('[BACKGROUND] Getting draft for chatId:', request.chatId);
        handleGet(request.chatId).then(sendResponse);
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
});

async function handleGetStatus() {
    try {
        const data = await chrome.storage.local.get(["firebaseConfig"]);
        return {
            success: true,
            authenticated: !!data.firebaseConfig,
            message: data.firebaseConfig ? "Configured" : "Not configured"
        };
    } catch (error) {
        return { success: false, authenticated: false, message: error.message };
    }
}

async function handleSync() {
    console.log('[BACKGROUND] Sync requested');
    return { success: true, message: "Using cloud storage only" };
}

async function handleGet(chatId) {
    try {
        const messages = await firestoreService.getDraft(chatId);
        return { success: true, messages: messages };
    } catch (error) {
        return { success: false, message: error.message };
    }
}

async function handleUpload(chatId, messages) {
    console.log('[BACKGROUND] handleUpload called, chatId:', chatId, 'messages:', messages);
    try {
        await firestoreService.saveDraft(chatId, messages);
        console.log('[BACKGROUND] Save successful');
        return { success: true };
    } catch (error) {
        console.error('[BACKGROUND] Save error:', error);
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