document.addEventListener("DOMContentLoaded", async () => {
    const configInput = document.getElementById("configInput");
    const saveConfigBtn = document.getElementById("saveConfigBtn");
    const status = document.getElementById("status");

    const data = await chrome.storage.local.get(["firebaseConfig"]);
    if (data.firebaseConfig) {
        configInput.value = JSON.stringify(data.firebaseConfig, null, 2);
        showStatus("Configuration loaded", "success");
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

    function showStatus(message, type) {
        status.textContent = message;
        status.className = "status " + type;
    }
});