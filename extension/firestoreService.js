class FirestoreService {
    constructor() {
        this.config = null;
    }
    async getConfig() {
        if (!this.config) {
            const data = await chrome.storage.local.get(["firebaseConfig"]);
            if (!data.firebaseConfig) throw new Error("Config not set");
            this.config = data.firebaseConfig;
        }
        return this.config;
    }
    async saveDraft(threadId, messages) {
        const config = await this.getConfig();
        const url = "https://firestore.googleapis.com/v1/projects/" + config.projectId + "/databases/(default)/documents/drafts/" + threadId + "?key=" + config.apiKey;
        const msgsArray = messages.map(m => ({
            mapValue: { fields: { html: { stringValue: m.html || "" }, timestamp: { integerValue: String(m.timestamp || Date.now()) } } }
        }));
        const response = await fetch(url, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ fields: { messages: { arrayValue: { values: msgsArray } }, lastModified: { integerValue: String(Date.now()) } } }) });
        if (!response.ok) throw new Error("Save failed: " + response.status);
        return await response.json();
    }
    async getDraft(threadId) {
        const config = await this.getConfig();
        const url = "https://firestore.googleapis.com/v1/projects/" + config.projectId + "/databases/(default)/documents/drafts/" + threadId + "?key=" + config.apiKey;
        const response = await fetch(url);
        if (response.status === 404) return [];
        if (!response.ok) throw new Error("Get failed: " + response.status);
        const doc = await response.json();
        const messages = (doc.fields?.messages?.arrayValue?.values || []).map(v => ({ html: v.mapValue?.fields?.html?.stringValue || "", timestamp: parseInt(v.mapValue?.fields?.timestamp?.integerValue || "0") }));
        return messages;
    }
    async deleteDraft(threadId) {
        const config = await this.getConfig();
        const url = "https://firestore.googleapis.com/v1/projects/" + config.projectId + "/databases/(default)/documents/drafts/" + threadId + "?key=" + config.apiKey;
        const response = await fetch(url, { method: "DELETE" });
        if (!response.ok) throw new Error("Delete failed: " + response.status);
    }
    async saveSettings(settings) {
        const config = await this.getConfig();
        const url = "https://firestore.googleapis.com/v1/projects/" + config.projectId + "/databases/(default)/documents/settings/user?key=" + config.apiKey;
        const response = await fetch(url, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ fields: { uiPositions: { stringValue: JSON.stringify(settings.uiPositions || {}) } } }) });
        if (!response.ok) throw new Error("Save settings failed: " + response.status);
        return await response.json();
    }
    async getSettings() {
        const config = await this.getConfig();
        const url = "https://firestore.googleapis.com/v1/projects/" + config.projectId + "/databases/(default)/documents/settings/user?key=" + config.apiKey;
        const response = await fetch(url);
        if (response.status === 404) return { uiPositions: {} };
        if (!response.ok) throw new Error("Get settings failed: " + response.status);
        const doc = await response.json();
        const uiPositions = JSON.parse(doc.fields?.uiPositions?.stringValue || "{}");
        return { uiPositions };
    }
}