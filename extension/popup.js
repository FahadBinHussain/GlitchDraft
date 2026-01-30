document.addEventListener("DOMContentLoaded", async () => {
    const configInput = document.getElementById("configInput");
    const saveConfigBtn = document.getElementById("saveConfigBtn");
    const resetPositionBtn = document.getElementById("resetPositionBtn");
    const status = document.getElementById("status");

    // Load supported sites from manifest
    loadSupportedSites();

    const data = await chrome.storage.local.get(["firebaseConfig"]);
    if (data.firebaseConfig) {
        // Mask API key for security
        const maskedConfig = { ...data.firebaseConfig };
        maskedConfig.apiKey = "***" + maskedConfig.apiKey.slice(-4);
        configInput.value = JSON.stringify(maskedConfig, null, 2);
        configInput.dataset.hasSavedConfig = "true";
        showStatus("Configuration loaded (API key hidden)", "success");
    }

    saveConfigBtn.addEventListener("click", async () => {
        try {
            const text = configInput.value;
            let config;
            
            // Try parsing as JSON first (for when user loads saved config)
            try {
                config = JSON.parse(text);
            } catch (e) {
                // Extract fields using regex (for Firebase script paste)
                const apiKey = text.match(/apiKey[:\s]+"([^"]+)"|apiKey[:\s]+'([^']+)'/);
                const authDomain = text.match(/authDomain[:\s]+"([^"]+)"|authDomain[:\s]+'([^']+)'/);
                const projectId = text.match(/projectId[:\s]+"([^"]+)"|projectId[:\s]+'([^']+)'/);
                const storageBucket = text.match(/storageBucket[:\s]+"([^"]+)"|storageBucket[:\s]+'([^']+)'/);
                const messagingSenderId = text.match(/messagingSenderId[:\s]+"([^"]+)"|messagingSenderId[:\s]+'([^']+)'/);
                const appId = text.match(/appId[:\s]+"([^"]+)"|appId[:\s]+'([^']+)'/);
                
                if (!apiKey || !authDomain || !projectId) {
                    throw new Error("Missing required fields");
                }
                
                config = {
                    apiKey: apiKey[1] || apiKey[2],
                    authDomain: authDomain[1] || authDomain[2],
                    projectId: projectId[1] || projectId[2],
                    storageBucket: storageBucket ? (storageBucket[1] || storageBucket[2]) : "",
                    messagingSenderId: messagingSenderId ? (messagingSenderId[1] || messagingSenderId[2]) : "",
                    appId: appId ? (appId[1] || appId[2]) : ""
                };
            }
            
            // Validate
            if (!config.apiKey || !config.authDomain || !config.projectId) {
                throw new Error("Missing required fields");
            }
            
            await chrome.storage.local.set({ firebaseConfig: config });
            showStatus("Config saved!", "success");
        } catch (error) {
            showStatus("Error: " + error.message, "error");
        }
    });

    resetPositionBtn.addEventListener("click", async () => {
        try {
            // Send message to content script to randomize position
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            chrome.tabs.sendMessage(tab.id, { action: "resetPosition" });
            showStatus("UI position randomized!", "success");
        } catch (error) {
            showStatus("Error: Make sure you're on a supported site", "error");
        }
    });

    function showStatus(message, type) {
        status.textContent = message;
        status.className = "status " + type;
    }

    async function loadSupportedSites() {
        try {
            const manifestUrl = chrome.runtime.getURL('manifest.json');
            const response = await fetch(manifestUrl);
            const manifest = await response.json();
            
            // Extract unique domains from content_scripts matches
            const domains = new Set();
            manifest.content_scripts?.forEach(script => {
                script.matches?.forEach(match => {
                    // Extract domain from patterns like "*://*.messenger.com/*" or "*://messenger.com/*"
                    const domainMatch = match.match(/\*:\/\/(?:\*\.)?([^\/]+)\//);
                    if (domainMatch) {
                        domains.add(domainMatch[1]);
                    }
                });
            });
            
            const sitesList = Array.from(domains).sort().join(', ');
            document.getElementById('supportedSites').textContent = sitesList || 'None configured';
        } catch (error) {
            console.error('Failed to load supported sites:', error);
            document.getElementById('supportedSites').textContent = 'Error loading sites';
        }
    }
});