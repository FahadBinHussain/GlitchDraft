(function() {
    'use strict';

    // Configuration options
    const config = {
        debugMode: false
    };

    // Load initial config from storage
    chrome.storage.local.get('config', (result) => {
        if (result.config) {
            Object.assign(config, result.config);
        }
        // Re-initialize UI elements that depend on config if needed
        const debugToggleButton = document.querySelector('button[title="Toggle debug mode"]');
        if (debugToggleButton) {
            debugToggleButton.textContent = config.debugMode ? '🐞 On' : '🐞 Off';
        }
    });

    // Save debug mode setting
    function saveConfig() {
        chrome.storage.local.set({ config: config });
    }

    // Add complete CSS with theme system
    const completeCSS = `
    :root {
        /* Light theme variables (default) */
        --bg-primary: #ffffff;
        --bg-secondary: #f0f2f5;
        --bg-tertiary: #e4e6ea;
        --text-primary: #1c1e21;
        --text-secondary: #65676b;
        --border: #dddfe2;
        --accent: #0084ff;
        --accent-hover: #0066cc;
        --success: #42b883;
        --danger: #e74c3c;
    }

    [data-theme="dark"] {
        /* Dark theme variables */
        --bg-primary: #18191a;
        --bg-secondary: #242526;
        --bg-tertiary: #3a3b3c;
        --text-primary: #e4e6ea;
        --text-secondary: #b0b3b8;
        --border: #3e4042;
        --accent: #0084ff;
        --accent-hover: #1877f2;
        --success: #42b883;
        --danger: #e74c3c;
    }

    .saved-messages-container {
        position: fixed;
        bottom: 20px;
        right: 20px;
        width: 350px;
        height: 500px;
        background-color: var(--bg-primary);
        border: 1px solid var(--border);
        border-radius: 12px;
        box-shadow: 0 8px 30px rgba(0, 0, 0, 0.12);
        z-index: 10000;
        display: flex;
        flex-direction: column;
        font-family: system-ui, -apple-system, sans-serif;
        color: var(--text-primary);
        resize: both;
        overflow: hidden;
        min-width: 300px;
        min-height: 400px;
        max-width: 600px;
        max-height: 700px;
        transition: all 0.3s ease;
    }

    .saved-messages-toggle {
        position: fixed;
        bottom: 20px;
        right: 20px;
        width: 60px;
        height: 60px;
        background-color: var(--accent);
        color: white;
        border: none;
        border-radius: 50%;
        cursor: pointer;
        font-size: 20px;
        font-weight: bold;
        box-shadow: 0 4px 20px rgba(0, 132, 255, 0.3);
        z-index: 9999;
        transition: all 0.3s ease;
        display: flex;
        align-items: center;
        justify-content: center;
    }

    .saved-messages-toggle:hover {
        background-color: var(--accent-hover);
        transform: scale(1.05);
    }

    .saved-messages-header {
        padding: 12px;
        background-color: var(--accent);
        color: white;
        font-weight: bold;
        display: flex;
        justify-content: space-between;
        align-items: center;
        cursor: move;
    }

    .saved-messages-close {
        cursor: pointer;
        font-size: 18px;
    }

    .saved-messages-body {
        padding: 12px;
        overflow-y: auto;
        flex-grow: 1;
        background-color: var(--bg-primary);
    }

    .saved-messages-item {
        margin-bottom: 10px;
        padding: 8px;
        background-color: var(--bg-secondary);
        border-radius: 8px;
        position: relative;
        border: 1px solid var(--border);
    }

    .saved-messages-timestamp {
        font-size: 10px;
        color: var(--text-secondary);
        margin-top: 4px;
    }

    .saved-messages-actions {
        display: flex;
        gap: 8px;
        margin-top: 5px;
    }

    .saved-messages-actions button {
        padding: 4px 8px;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        font-size: 12px;
        transition: background-color 0.2s ease;
    }

    .saved-message-use {
        background-color: var(--accent);
        color: white;
    }

    .saved-message-use:hover {
        background-color: var(--accent-hover);
    }

    .saved-message-copy {
        background-color: var(--bg-tertiary);
        color: var(--text-primary);
    }

    .saved-message-copy:hover {
        background-color: var(--border);
    }

    .saved-message-delete {
        background-color: var(--danger);
        color: white;
    }

    .saved-message-delete:hover {
        opacity: 0.8;
    }

    .saved-messages-input {
        padding: 12px;
        display: flex;
        gap: 8px;
        border-top: 1px solid var(--border);
        background-color: var(--bg-primary);
    }

    .saved-messages-input textarea,
    .message-input-div {
        flex-grow: 1;
        border: 1px solid var(--border);
        border-radius: 8px;
        padding: 8px;
        font-family: inherit;
        resize: vertical;
        min-height: 60px;
        max-height: 150px;
        background-color: var(--bg-primary);
        color: var(--text-primary);
    }

    .saved-messages-input button {
        background-color: var(--accent);
        color: white;
        border: none;
        border-radius: 8px;
        padding: 8px 12px;
        cursor: pointer;
        font-size: 18px;
        font-weight: bold;
        width: 50px;
        height: 50px;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: background-color 0.2s ease;
    }

    .saved-messages-input button:hover {
        background-color: var(--accent-hover);
    }

    .keyboard-shortcut {
        display: inline-block;
        margin-left: 8px;
        background-color: var(--bg-secondary);
        padding: 2px 6px;
        border-radius: 4px;
        font-size: 10px;
        color: var(--text-secondary);
    }

    .saved-messages-menu {
        display: flex;
        justify-content: space-between;
        padding: 8px 12px;
        background-color: var(--bg-secondary);
        border-bottom: 1px solid var(--border);
    }

    .saved-messages-menu button {
        border: none;
        background-color: transparent;
        color: var(--text-primary);
        cursor: pointer;
        font-size: 12px;
        padding: 4px 8px;
        border-radius: 4px;
        transition: background-color 0.2s ease;
    }

    .saved-messages-menu button:hover {
        background-color: var(--bg-tertiary);
    }

    .saved-messages-sync-status {
        padding: 8px 12px;
        background-color: var(--bg-secondary);
        border-bottom: 1px solid var(--border);
        font-size: 12px;
    }

    .status {
        color: var(--text-secondary);
    }

    .status.success {
        color: var(--success);
    }

    .status.error {
        color: var(--danger);
    }

    .status.warning {
        color: #ff9800;
    }

    .sync-info {
        margin-top: 4px;
        font-size: 11px;
        color: var(--text-secondary);
        line-height: 1.3;
    }

    .sync-progress-container {
        margin-top: 8px;
        height: 4px;
        background-color: var(--bg-tertiary);
        border-radius: 2px;
        overflow: hidden;
    }

    .sync-progress-bar {
        height: 100%;
        background-color: var(--accent);
        transition: width 0.3s ease;
        border-radius: 2px;
    }

    .auth-button {
        background-color: #34a853;
        color: white;
        border: none;
        padding: 6px 12px;
        border-radius: 4px;
        cursor: pointer;
        font-size: 11px;
        margin-top: 4px;
        transition: background-color 0.2s ease;
    }

    .auth-button:hover {
        background-color: #2d8a46;
    }

    .auth-button:disabled {
        background-color: var(--bg-tertiary);
        cursor: not-allowed;
    }

    .hidden {
        display: none;
    }

    .file-input-hidden {
        display: none;
    }

    .saved-messages-notification {
        position: fixed;
        top: 20px;
        right: 20px;
        background-color: var(--bg-primary);
        color: var(--text-primary);
        padding: 12px 16px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        z-index: 10001;
        border: 1px solid var(--border);
        opacity: 0;
        transform: translateX(100%);
        transition: all 0.3s ease;
    }

    .saved-messages-notification.visible {
        opacity: 1;
        transform: translateX(0);
    }
    `;

    // Add complete CSS to document
    const style = document.createElement('style');
    style.textContent = completeCSS;
    document.head.appendChild(style);

    // Theme detection and management
    function detectSystemTheme() {
        return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }

    function applyTheme(theme) {
        const container = document.querySelector('.saved-messages-container');
        const toggleButton = document.querySelector('.saved-messages-toggle');

        if (container) {
            container.setAttribute('data-theme', theme);
        }
        if (toggleButton) {
            toggleButton.setAttribute('data-theme', theme);
        }

        // Update config
        config.theme = theme;
        saveConfig();
    }

    function initializeTheme() {
        const systemTheme = detectSystemTheme();
        const savedTheme = config.theme || systemTheme;
        applyTheme(savedTheme);

        // Listen for system theme changes
        if (window.matchMedia) {
            const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
            mediaQuery.addListener((e) => {
                if (!config.manualTheme) {
                    applyTheme(e.matches ? 'dark' : 'light');
                }
            });
        }
    }

    // Add custom styles
    // GM_addStyle(`
    //     .saved-messages-container {
    //         position: fixed;
    //         right: 20px;
    //         bottom: 100px;
    //         width: 300px;
    //         background-color: #ffffff;
    //         border-radius: 8px;
    //         box-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
    //         z-index: 9999;
    //         overflow: hidden;
    //         display: flex;
    //         flex-direction: column;
    //         max-height: 400px;
    //         border: 1px solid #e4e6eb;
    //     }

    //     .saved-messages-header {
    //         padding: 12px;
    //         background-color: #0084ff;
    //         color: white;
    //         font-weight: bold;
    //         display: flex;
    //         justify-content: space-between;
    //         align-items: center;
    //         cursor: move;
    //     }

    //     .saved-messages-close {
    //         cursor: pointer;
    //         font-size: 18px;
    //     }

    //     .saved-messages-body {
    //         padding: 12px;
    //         overflow-y: auto;
    //         flex-grow: 1;
    //     }

    //     .saved-messages-item {
    //         margin-bottom: 10px;
    //         padding: 8px;
    //         background-color: #f0f2f5;
    //         border-radius: 8px;
    //         position: relative;
    //     }

    //     .saved-messages-timestamp {
    //         font-size: 10px;
    //         color: #65676B;
    //         margin-top: 4px;
    //     }

    //     .saved-messages-actions {
    //         display: flex;
    //         gap: 8px;
    //         margin-top: 5px;
    //     }

    //     .saved-messages-actions button {
    //         padding: 4px 8px;
    //         border: none;
    //         border-radius: 4px;
    //         cursor: pointer;
    //         font-size: 12px;
    //     }

    //     .saved-message-use {
    //         background-color: #0084ff;
    //         color: white;
    //     }

    //     .saved-message-delete {
    //         background-color: #f44336;
    //         color: white;
    //     }

    //     .saved-messages-input {
    //         padding: 12px;
    //         display: flex;
    //         gap: 8px;
    //         border-top: 1px solid #e4e6eb;
    //     }

    //     .saved-messages-input textarea {
    //         flex-grow: 1;
    //         border: 1px solid #e4e6eb;
    //         border-radius: 20px;
    //         padding: 8px 12px;
    //         resize: none;
    //     }

    //     .saved-messages-input .message-input-div {
    //         flex-grow: 1;
    //         border: 1px solid #e4e6eb;
    //         border-radius: 20px;
    //         padding: 8px 12px;
    //         min-height: 36px;
    //         max-height: 220px;
    //         overflow-y: auto;
    //         background-color: white;
    //         user-select: text;
    //         white-space: pre-wrap;
    //         word-break: break-word;
    //     }
    //     .message-input-div:empty:before {
    //         content: attr(data-placeholder);
    //         color: #999;
    //         pointer-events: none;
    //     }

    //     .saved-messages-input .message-input-div img,
    //     .saved-messages-item img {
    //         max-width: 100%;
    //         max-height: 180px;
    //         display: block;
    //         border-radius: 6px;
    //         margin: 4px 0;
    //         object-fit: contain;
    //     }

    //     .saved-messages-input button {
    //         background-color: #0084ff;
    //         color: white;
    //         border: none;
    //         border-radius: 50%;
    //         width: 36px;
    //         height: 36px;
    //         display: flex;
    //         align-items: center;
    //         justify-content: center;
    //         cursor: pointer;
    //     }

    //     .saved-messages-toggle {
    //         position: fixed;
    //         bottom: 20px;
    //         right: 20px;
    //         width: 50px;
    //         height: 50px;
    //         background-color: #0084ff;
    //         border-radius: 50%;
    //         display: flex;
    //         align-items: center;
    //         justify-content: center;
    //         color: white;
    //         font-size: 24px;
    //         cursor: pointer;
    //         box-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
    //         z-index: 9999;
    //     }

    //     .saved-messages-category {

    //         bottom: 20px;
    //         left: 50%;
    //         transform: translateX(-50%);
    //         background-color: #333;
    //         color: white;
    //         padding: 10px 20px;
    //         border-radius: 5px;
    //         z-index: 10000;
    //         opacity: 0;
    //         transition: opacity 0.5s, visibility 0.5s;
    //         visibility: hidden;
    //     }

    //     .saved-messages-notification.visible {
    //         opacity: 1;
    //         visibility: visible;
    //     }
    // `);

    let isContainerVisible = false;
    let currentChatUrl = '';
    let dragOffset = { x: 0, y: 0 };
    let isDragging = false;
    let fileInput = null;

    // Function to get the current chat URL/ID
    function getCurrentChatId() {
        const url = window.location.href;
        
        // Try to match Facebook Messenger chat pattern
        const fbMatch = url.match(/\/t\/(\d+)/);
        if (fbMatch) {
            return fbMatch[1];
        }
        
        // For other sites, use a sanitized version of the URL as the ID
        // Remove protocol and hash, replace special characters with underscores
        const sanitizedUrl = url
            .replace(/^https?:\/\//, '')  // Remove protocol
            .replace(/#.*$/, '')           // Remove hash
            .replace(/[^a-zA-Z0-9]/g, '_') // Replace special chars with underscore
            .substring(0, 200);            // Limit length
        
        return sanitizedUrl || 'default_page';
    }

    // Function to create UI elements
    function createUI() {
        // Create toggle button
        const toggleButton = document.createElement('div');
        toggleButton.className = 'saved-messages-toggle';
        toggleButton.dataset.savedMessageUiElement = 'true';
        toggleButton.textContent = '📝';
        toggleButton.title = 'GlitchDraft (Alt+M)';
        document.body.appendChild(toggleButton);

        // Create container
        const container = document.createElement('div');
        container.className = 'saved-messages-container hidden';
        container.dataset.savedMessageUiElement = 'true';

        // Create header
        const header = document.createElement('div');
        header.className = 'saved-messages-header';
        header.textContent = 'GlitchDraft';
        header.innerHTML += '<span class="keyboard-shortcut">Alt+M</span>';
        header.dataset.savedMessageUiElement = 'true';

        // Create close button
        const closeButton = document.createElement('span');
        closeButton.className = 'saved-messages-close';
        closeButton.textContent = '×';
        closeButton.dataset.savedMessageUiElement = 'true';
        header.appendChild(closeButton);

        // Create menu
        const menu = document.createElement('div');
        menu.className = 'saved-messages-menu';
        menu.dataset.savedMessageUiElement = 'true';

        const exportButton = document.createElement('button');
        exportButton.textContent = 'Export All';
        exportButton.dataset.savedMessageUiElement = 'true';
        exportButton.onclick = exportSavedMessages;

        const importButton = document.createElement('button');
        importButton.textContent = 'Import';
        importButton.dataset.savedMessageUiElement = 'true';
        importButton.onclick = triggerImportDialog;

        // Add sync button
        const syncButton = document.createElement('button');
        syncButton.textContent = 'Sync Now';
        syncButton.dataset.savedMessageUiElement = 'true';
        syncButton.onclick = syncWithCloud;

        // Add theme toggle button
        const themeButton = document.createElement('button');
        themeButton.textContent = '🌙';
        themeButton.title = 'Toggle theme';
        themeButton.dataset.savedMessageUiElement = 'true';
        themeButton.onclick = toggleTheme;

        const debugButton = document.createElement('button');
        debugButton.textContent = 'Debug';
        debugButton.title = 'Find input field selectors';
        debugButton.style.marginLeft = 'auto';
        debugButton.dataset.savedMessageUiElement = 'true';
        debugButton.onclick = debugInputFields;

        const debugToggleButton = document.createElement('button');
        debugToggleButton.textContent = config.debugMode ? '🐞 On' : '🐞 Off';
        debugToggleButton.title = 'Toggle debug mode';
        debugToggleButton.style.marginLeft = '5px';
        debugToggleButton.dataset.savedMessageUiElement = 'true';
        debugToggleButton.onclick = toggleDebugMode;

        menu.appendChild(exportButton);
        menu.appendChild(importButton);
        menu.appendChild(syncButton);
        menu.appendChild(themeButton);
        menu.appendChild(debugToggleButton);

        if (config.debugMode) {
            menu.appendChild(debugButton);
        }

        // Hidden file input for import
        fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.accept = '.json';
        fileInput.className = 'file-input-hidden';
        fileInput.dataset.savedMessageUiElement = 'true';
        fileInput.onchange = importSavedMessages;
        document.body.appendChild(fileInput);

        // Create sync status section
        const syncStatusSection = document.createElement('div');
        syncStatusSection.className = 'saved-messages-sync-status';
        syncStatusSection.dataset.savedMessageUiElement = 'true';

        const syncStatusText = document.createElement('div');
        syncStatusText.id = 'syncStatus';
        syncStatusText.className = 'status';
        syncStatusText.dataset.savedMessageUiElement = 'true';

        const syncInfoText = document.createElement('div');
        syncInfoText.id = 'syncInfo';
        syncInfoText.className = 'sync-info';
        syncInfoText.dataset.savedMessageUiElement = 'true';

        syncStatusSection.appendChild(syncStatusText);
        syncStatusSection.appendChild(syncInfoText);

        // Create body
        const body = document.createElement('div');
        body.className = 'saved-messages-body';
        body.dataset.savedMessageUiElement = 'true';

        // Create input area
        const inputArea = document.createElement('div');
        inputArea.className = 'saved-messages-input';
        inputArea.dataset.savedMessageUiElement = 'true';

        const textarea = document.createElement('div');
        textarea.className = 'message-input-div';
        textarea.contentEditable = 'true';
        textarea.setAttribute('role', 'textbox');
        textarea.dataset.placeholder = 'Type message or paste image... (Alt+S to save)';
        textarea.dataset.savedMessageUiElement = 'true';

        const saveButton = document.createElement('button');
        saveButton.textContent = '+';
        saveButton.title = 'Save Message (Alt+S)';
        saveButton.dataset.savedMessageUiElement = 'true';

        inputArea.appendChild(textarea);
        inputArea.appendChild(saveButton);

        // Append all elements
        container.appendChild(header);
        container.appendChild(menu);
        container.appendChild(syncStatusSection);
        container.appendChild(body);
        container.appendChild(inputArea);
        document.body.appendChild(container);

        // Add event listeners
        toggleButton.addEventListener('click', toggleContainer);
        closeButton.addEventListener('click', toggleContainer);
        saveButton.addEventListener('click', saveMessage);

        // Add keyboard shortcut for saving message
        textarea.addEventListener('keydown', (e) => {
            if (e.altKey && e.key === 's') {
                e.preventDefault();
                saveMessage();
            }
        });

        // Add paste event listener to capture GIFs
        textarea.addEventListener('paste', handlePaste);

        // Add drag functionality
        header.addEventListener('mousedown', startDragging);
        document.addEventListener('mousemove', drag);
        document.addEventListener('mouseup', stopDragging);

        // Make the toggle button draggable as well
        toggleButton.addEventListener('mousedown', startDraggingToggle);
        document.addEventListener('mousemove', dragToggle);
        document.addEventListener('mouseup', stopDraggingToggle);

        // Load saved positions
        loadPositions();

        // Initialize theme
        initializeTheme();

        return {
            container,
            body,
            textarea,
            toggleButton
        };
    }

    // Create UI elements
    const ui = createUI();

    // Register global keyboard shortcut (Alt+M)
    document.addEventListener('keydown', (e) => {
        if (e.altKey && e.key === 'm') {
            e.preventDefault();
            toggleContainer();
        }
    });

    // Listen for messages from background script
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        if (request.action === 'toggleUI') {
            toggleContainer();
            sendResponse({ success: true });
        } else if (request.action === 'remoteUpdate') {
            // Handle remote update notification
            console.log('Remote update detected, refreshing data...');
            // Show notification
            showNotification('Remote changes detected', 'Your saved messages have been updated from another device.', 'info');
            // Reload saved messages
            loadSavedMessages();
            // Update sync info
            updateSyncInfo();
            // Send response if needed
            if (sendResponse) sendResponse({ success: true });
        }
        return true;
    });

    // Register in Tampermonkey menu
    // GM_registerMenuCommand("Toggle Saved Messages", toggleContainer); // TODO: Replace with chrome.storage
    // GM_registerMenuCommand("Export All Saved Messages", exportSavedMessages); // TODO: Replace with chrome.storage
    // GM_registerMenuCommand("Toggle Debug Mode", toggleDebugMode); // TODO: Replace with chrome.storage
    if (config.debugMode) {
        // GM_registerMenuCommand("Debug Input Fields", debugInputFields); // TODO: Replace with chrome.storage
    }

    // Check sync status when UI is opened
    function checkSyncStatus() {
        try {
            chrome.runtime.sendMessage({ action: 'getSyncStatus' }, (response) => {
                if (chrome.runtime.lastError) {
                    console.error('Failed to check sync status:', chrome.runtime.lastError);
                    return;
                }

                if (response && response.success) {
                    updateSyncInfo(response);
                }
            });
        } catch (error) {
            console.error('Failed to check sync status:', error);
        }
    }

    // Update sync information display
    function updateSyncInfo(statusData = null) {
        const syncStatusText = document.getElementById('syncStatus');
        const syncInfoText = document.getElementById('syncInfo');
        const syncStatusSection = document.querySelector('.saved-messages-sync-status');

        if (!syncStatusText || !syncInfoText || !syncStatusSection) return;

        if (!statusData) {
            // Get status from background
            chrome.runtime.sendMessage({ action: 'getSyncStatus' }, (response) => {
                if (chrome.runtime.lastError) {
                    console.error('Failed to get sync status:', chrome.runtime.lastError);
                    return;
                }

                if (response && response.success) {
                    updateSyncInfo(response);
                }
            });
            return;
        }

        // Clear any existing auth button
        const existingAuthButton = syncStatusSection.querySelector('.auth-button');
        if (existingAuthButton) {
            existingAuthButton.remove();
        }

        // Clear any existing progress bar
        const existingProgressBar = syncStatusSection.querySelector('.sync-progress-container');
        if (existingProgressBar) {
            existingProgressBar.remove();
        }

        // Update authentication status
        if (statusData.authenticated) {
            syncStatusText.textContent = 'Connected to Google Drive';
            syncStatusText.className = 'status success';
        } else {
            syncStatusText.textContent = 'Not connected to Google Drive';
            syncStatusText.className = 'status warning';

            // Add auth button if not authenticated
            const authButton = document.createElement('button');
            authButton.className = 'auth-button';
            authButton.textContent = 'Sign in with Google';
            authButton.dataset.savedMessageUiElement = 'true';
            authButton.onclick = authenticateWithGoogle;
            syncStatusSection.appendChild(authButton);
        }

        // Update sync info
        let infoText = '';

        if (statusData.lastSyncTime) {
            const lastSync = new Date(statusData.lastSyncTime);
            const timeAgo = getTimeAgo(lastSync);
            infoText = `Last sync: ${timeAgo}`;
        } else {
            infoText = 'No sync history';
        }

        if (statusData.syncInProgress) {
            infoText += ' (Sync in progress...)';

            // Add progress bar for sync in progress
            const progressContainer = document.createElement('div');
            progressContainer.className = 'sync-progress-container';
            progressContainer.dataset.savedMessageUiElement = 'true';

            const progressBar = document.createElement('div');
            progressBar.className = 'sync-progress-bar';
            progressBar.dataset.savedMessageUiElement = 'true';

            // Animate the progress bar
            let progress = 0;
            const progressInterval = setInterval(() => {
                // Slow down as we approach 90% to simulate waiting for server
                if (progress < 90) {
                    progress += (90 - progress) / 10;
                }
                progressBar.style.width = `${progress}%`;

                // Check if sync is still in progress
                chrome.runtime.sendMessage({ action: 'getSyncStatus' }, (response) => {
                    if (response && response.success && !response.syncInProgress) {
                        // Sync completed, fill the bar and remove it
                        clearInterval(progressInterval);
                        progressBar.style.width = '100%';
                        setTimeout(() => {
                            if (progressContainer.parentNode) {
                                progressContainer.parentNode.removeChild(progressContainer);
                            }
                            updateSyncInfo(response);
                        }, 500);
                    }
                });
            }, 300);

            progressContainer.appendChild(progressBar);
            syncStatusSection.appendChild(progressContainer);
        }

        syncInfoText.textContent = infoText;
    }

    // Helper function to get time ago
    function getTimeAgo(date) {
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins} minutes ago`;
        if (diffHours < 24) return `${diffHours} hours ago`;
        if (diffDays < 7) return `${diffDays} days ago`;
        return date.toLocaleDateString();
    }

    // Function to authenticate with Google
    async function authenticateWithGoogle() {
        const syncStatusText = document.getElementById('syncStatus');
        const authButton = document.querySelector('.auth-button');

        if (syncStatusText) {
            syncStatusText.textContent = 'Signing in...';
            syncStatusText.className = 'status';
        }

        if (authButton) {
            authButton.disabled = true;
            authButton.textContent = 'Signing in...';
        }

        try {
            // Check current status first
            const statusResponse = await new Promise((resolve, reject) => {
                chrome.runtime.sendMessage({ action: 'getSyncStatus' }, (response) => {
                    if (chrome.runtime.lastError) {
                        reject(new Error(chrome.runtime.lastError.message));
                    } else {
                        resolve(response);
                    }
                });
            });

            if (statusResponse && statusResponse.success && statusResponse.authenticated) {
                if (syncStatusText) {
                    syncStatusText.textContent = 'Already authenticated!';
                    syncStatusText.className = 'status success';
                }
                updateSyncInfo(statusResponse);
                return;
            }

            // Trigger authentication by requesting a sync
            const response = await new Promise((resolve, reject) => {
                chrome.runtime.sendMessage({ action: 'sync' }, (response) => {
                    if (chrome.runtime.lastError) {
                        reject(new Error(chrome.runtime.lastError.message));
                    } else {
                        resolve(response);
                    }
                });
            });

            if (response && response.success) {
                if (syncStatusText) {
                    syncStatusText.textContent = 'Authentication successful!';
                    syncStatusText.className = 'status success';
                }
                updateSyncInfo();
            } else {
                if (syncStatusText) {
                    syncStatusText.textContent = response ? response.message : 'Authentication failed. Please try again.';
                    syncStatusText.className = 'status error';
                }
            }
        } catch (error) {
            if (syncStatusText) {
                syncStatusText.textContent = 'Authentication failed: ' + error.message;
                syncStatusText.className = 'status error';
            }
            console.error('Error authenticating with Google:', error);
        } finally {
            if (authButton) {
                authButton.disabled = false;
                authButton.textContent = 'Sign in with Google';
            }
        }
    }

    // Function to sync with cloud
    async function syncWithCloud() {
        console.log('DEBUG: syncWithCloud() called');
        const syncStatusText = document.getElementById('syncStatus');
        if (syncStatusText) {
            syncStatusText.textContent = 'Starting sync...';
            syncStatusText.className = 'status';
        }

        // Update sync info to show progress bar
        const statusData = {
            authenticated: true,  // Assume authenticated since we're syncing
            syncInProgress: true,
            lastSyncTime: Date.now()
        };
        updateSyncInfo(statusData);

        try {
            console.log('DEBUG: Sending sync message to background script');
            const response = await new Promise((resolve, reject) => {
                chrome.runtime.sendMessage({ action: 'sync' }, (response) => {
                    if (chrome.runtime.lastError) {
                        console.log('DEBUG: Chrome runtime error:', chrome.runtime.lastError.message);
                        reject(new Error(chrome.runtime.lastError.message));
                    } else {
                        console.log('DEBUG: Received response from background:', response);
                        resolve(response);
                    }
                });
            });

            if (response && response.success) {
                if (syncStatusText) {
                    syncStatusText.textContent = response.message || 'Synced successfully!';
                    syncStatusText.className = 'status success';
                }
                // Refresh the messages list
                loadSavedMessages();
                // Update sync info
                updateSyncInfo();
            } else {
                if (syncStatusText) {
                    syncStatusText.textContent = response ? response.message : 'Sync failed. Please try again.';
                    syncStatusText.className = 'status error';
                }
                // Update sync info to remove progress bar
                updateSyncInfo();
            }
        } catch (error) {
            if (syncStatusText) {
                syncStatusText.textContent = 'Sync failed: ' + error.message;
                syncStatusText.className = 'status error';
            }
            console.error('Error syncing with cloud:', error);
            // Update sync info to remove progress bar
            updateSyncInfo();
        }
    }

    // Load saved messages when URL changes
    function checkUrlChange() {
        const chatId = getCurrentChatId();
        if (chatId && chatId !== currentChatUrl) {
            currentChatUrl = chatId;
            loadSavedMessages();
        }
    }

    // Function to toggle container visibility
    function toggleContainer() {
        isContainerVisible = !isContainerVisible;
        if (isContainerVisible) {
            ui.container.classList.remove('hidden');
            loadSavedMessages();
            // Check sync status when panel is opened
            checkSyncStatus();
            // Focus the textarea when panel is opened
            setTimeout(() => ui.textarea.focus(), 100);
        } else {
            ui.container.classList.add('hidden');
        }
    }

    // Format timestamp
    function formatTimestamp(timestamp) {
        const date = new Date(timestamp);
        const now = new Date();

        // If today, show time only
        if (date.toDateString() === now.toDateString()) {
            return 'Today at ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        }

        // If yesterday
        const yesterday = new Date(now);
        yesterday.setDate(now.getDate() - 1);
        if (date.toDateString() === yesterday.toDateString()) {
            return 'Yesterday at ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        }

        // Otherwise show full date
        return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }

    // Functions for drag functionality
    function startDragging(e) {
        isDragging = true;
        const containerRect = ui.container.getBoundingClientRect();
        dragOffset.x = e.clientX - containerRect.left;
        dragOffset.y = e.clientY - containerRect.top;
        ui.container.style.cursor = 'grabbing';
    }

    function drag(e) {
        if (isDragging) {
            ui.container.style.left = (e.clientX - dragOffset.x) + 'px';
            ui.container.style.top = (e.clientY - dragOffset.y) + 'px';
            ui.container.style.right = 'auto';
            ui.container.style.bottom = 'auto';
        }
    }

    function stopDragging() {
        if (isDragging) {
            isDragging = false;
            ui.container.style.cursor = 'default';
            const containerRect = ui.container.getBoundingClientRect();
            chrome.storage.local.set({
                containerPosition: {
                    left: containerRect.left,
                    top: containerRect.top
                }
            });
        }
    }

    // --- Toggle button dragging functions ---
    let isDraggingToggle = false;
    let toggleDragOffset = { x: 0, y: 0 };

    function startDraggingToggle(e) {
        // Prevent event from bubbling up to header drag
        if (e.target === ui.toggleButton) {
            isDraggingToggle = true;
            const toggleRect = ui.toggleButton.getBoundingClientRect();
            toggleDragOffset.x = e.clientX - toggleRect.left;
            toggleDragOffset.y = e.clientY - toggleRect.top;
            ui.toggleButton.style.cursor = 'grabbing';
            e.stopPropagation();
        }
    }

    function dragToggle(e) {
        if (isDraggingToggle) {
            ui.toggleButton.style.left = (e.clientX - toggleDragOffset.x) + 'px';
            ui.toggleButton.style.top = (e.clientY - toggleDragOffset.y) + 'px';
            ui.toggleButton.style.right = 'auto';
            ui.toggleButton.style.bottom = 'auto';
        }
    }

    function stopDraggingToggle() {
        if (isDraggingToggle) {
            isDraggingToggle = false;
            ui.toggleButton.style.cursor = 'pointer';
            const toggleRect = ui.toggleButton.getBoundingClientRect();
            chrome.storage.local.set({
                togglePosition: {
                    left: toggleRect.left,
                    top: toggleRect.top
                }
            });
        }
    }

    function loadPositions() {
        chrome.storage.local.get(['containerPosition', 'togglePosition'], (result) => {
            if (result.containerPosition) {
                ui.container.style.left = result.containerPosition.left + 'px';
                ui.container.style.top = result.containerPosition.top + 'px';
                ui.container.style.right = 'auto';
                ui.container.style.bottom = 'auto';
            }
            if (result.togglePosition) {
                ui.toggleButton.style.left = result.togglePosition.left + 'px';
                ui.toggleButton.style.top = result.togglePosition.top + 'px';
                ui.toggleButton.style.right = 'auto';
                ui.toggleButton.style.bottom = 'auto';
            }
        });
    }

    function showNotification(message) {
        let notification = document.querySelector('.saved-messages-notification');
        if (!notification) {
            notification = document.createElement('div');
            notification.className = 'saved-messages-notification';
            document.body.appendChild(notification);
        }

        notification.textContent = message;
        notification.classList.add('visible');

        setTimeout(() => {
            notification.classList.remove('visible');
        }, 3000);
    }

    // Function to save a message
    async function saveMessage() {
        console.log('DEBUG: saveMessage() called');
        const messageInput = ui.textarea;
        const messageHtml = messageInput.innerHTML.trim();

        if (!messageHtml) {
            console.log('DEBUG: saveMessage() - no message content, returning');
            return;
        }

        // Create a temporary div to process the HTML
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = messageHtml;

        // Find all images and convert blob sources to data URLs
        const images = Array.from(tempDiv.querySelectorAll('img'));
        const conversionPromises = images.map(async (img) => {
            if (img.src.startsWith('blob:')) {
                try {
                    const response = await fetch(img.src);
                    const blob = await response.blob();
                    const dataUrl = await new Promise((resolve, reject) => {
                        const reader = new FileReader();
                        reader.onloadend = () => resolve(reader.result);
                        reader.onerror = reject;
                        reader.readAsDataURL(blob);
                    });
                    img.src = dataUrl;
                } catch (error) {
                    console.error('Error converting blob to data URL:', error);
                    // Optionally remove the image if conversion fails
                    img.remove();
                }
            }
        });

        await Promise.all(conversionPromises);

        const finalHtml = tempDiv.innerHTML;

        const chatId = getCurrentChatId();
        if (!chatId) {
            alert('Cannot save message: No chat detected');
            return;
        }

        // Extract text content and image files for cloud sync
        const textContent = tempDiv.textContent || tempDiv.innerText || '';
        const imageFiles = [];

        // Extract images as files for cloud sync
        const imageElements = tempDiv.querySelectorAll('img');
        for (const img of imageElements) {
            if (img.src.startsWith('data:')) {
                try {
                    const response = await fetch(img.src);
                    const blob = await response.blob();
                    const file = new File([blob], 'image.jpg', { type: blob.type });
                    imageFiles.push(file);
                } catch (error) {
                    console.error('Error converting image to file:', error);
                }
            }
        }

        chrome.storage.local.get(chatId, (result) => {
            const savedMessages = result[chatId] || [];

            // Add the new message at the beginning of the array (newest first)
            savedMessages.unshift({
                html: finalHtml,
                timestamp: Date.now()
            });

            chrome.storage.local.set({ [chatId]: savedMessages }, () => {
                console.log('DEBUG: Message saved to local storage, chatId:', chatId);
                messageInput.innerHTML = '';
                loadSavedMessages();

                // Trigger sync to upload the new message to Drive
                // Use a small delay to ensure local storage write is complete
                console.log('DEBUG: About to trigger syncWithCloud in 100ms');
                setTimeout(() => {
                    console.log('DEBUG: Calling syncWithCloud after save');
                    syncWithCloud();
                }, 100);
            });
        });
    }

    // Function to sync draft to Google Drive
    async function syncDraftToCloud(textContent, imageFile) {
        try {
            const response = await new Promise((resolve, reject) => {
                chrome.runtime.sendMessage({
                    action: 'uploadDraft',
                    data: {
                        textContent: textContent,
                        imageFile: imageFile
                    }
                }, (response) => {
                    if (chrome.runtime.lastError) {
                        reject(new Error(chrome.runtime.lastError.message));
                    } else {
                        resolve(response);
                    }
                });
            });

            if (response && response.success) {
                console.log('Draft synced to Google Drive successfully');
            } else {
                console.log('Cloud sync failed:', response ? response.message : 'Unknown error');
            }
        } catch (error) {
            console.error('Error syncing to cloud:', error);
        }
    }

    // Function to load saved messages for current chat
    function loadSavedMessages() {
        const chatId = getCurrentChatId();
        if (!chatId) {
            ui.body.innerHTML = '<p>Open a chat to see saved messages</p>';
            return;
        }

        chrome.storage.local.get(chatId, (result) => {
            const savedMessages = result[chatId] || [];

            if (savedMessages.length === 0) {
                ui.body.innerHTML = '<p>No saved messages for this chat</p>';
                return;
            }

            ui.body.innerHTML = '';

            // Sort messages by timestamp (newest first)
            savedMessages.sort((a, b) => b.timestamp - a.timestamp);

            // Render all messages
            savedMessages.forEach((message, index) => {
                const messageElement = document.createElement('div');
                messageElement.className = 'saved-messages-item';
                messageElement.dataset.savedMessageUiElement = 'true';

                const messageText = document.createElement('div');
                messageText.innerHTML = message.html;
                messageText.dataset.savedMessageUiElement = 'true';

                const timestampDiv = document.createElement('div');
                timestampDiv.className = 'saved-messages-timestamp';
                timestampDiv.textContent = formatTimestamp(message.timestamp);
                timestampDiv.dataset.savedMessageUiElement = 'true';

                const actionsDiv = document.createElement('div');
                actionsDiv.className = 'saved-messages-actions';
                actionsDiv.dataset.savedMessageUiElement = 'true';

                const useButton = document.createElement('button');
                useButton.className = 'saved-message-use';
                useButton.textContent = 'Use';
                useButton.dataset.savedMessageUiElement = 'true';
                useButton.onclick = () => useMessage(message.html);

                const copyButton = document.createElement('button');
                copyButton.className = 'saved-message-copy';
                copyButton.textContent = 'Copy';
                copyButton.style.backgroundColor = '#4CAF50';
                copyButton.style.color = 'white';
                copyButton.title = 'Copy to clipboard';
                copyButton.dataset.savedMessageUiElement = 'true';
                copyButton.onclick = () => copyToClipboard(message.html, 'Message copied to clipboard! You can now paste it.');

                const deleteButton = document.createElement('button');
                deleteButton.className = 'saved-message-delete';
                deleteButton.textContent = 'Delete';
                deleteButton.dataset.savedMessageUiElement = 'true';
                deleteButton.onclick = () => deleteMessage(message.timestamp);

                actionsDiv.appendChild(useButton);
                actionsDiv.appendChild(copyButton);
                actionsDiv.appendChild(deleteButton);

                messageElement.appendChild(messageText);
                messageElement.appendChild(timestampDiv);
                messageElement.appendChild(actionsDiv);

                ui.body.appendChild(messageElement);
            });
        });
    }

    async function copyImageNatively(imageUrl, callback) {
        try {
            // The ClipboardItem API is the modern and correct way to do this.
            // It should be available in an extension context with clipboardWrite permission.
            if (typeof ClipboardItem === 'undefined') {
                throw new Error('ClipboardItem API is not available in this context. Cannot copy image.');
            }

            // We must fetch the data URL to convert it into a blob.
            const response = await fetch(imageUrl);
            const blob = await response.blob();

            // Create a clipboard item with the blob.
            await navigator.clipboard.write([
                new ClipboardItem({
                    [blob.type]: blob
                })
            ]);

            showNotification('Image copied to clipboard! Press Ctrl+V to paste.');
            callback(true);

        } catch (error) {
            console.error('Failed to copy image using ClipboardItem API:', error);
            // If this fails, there's no better fallback for native image copy.
            callback(false);
        }
    }

    // Add this function to simulate file drop for GIFs
    function simulateFileDrop(file, targetElement) {
        const dataTransfer = new DataTransfer();
        dataTransfer.items.add(file);

        ['dragenter', 'dragover', 'drop'].forEach(eventType => {
            const event = new DragEvent(eventType, {
                bubbles: true,
                cancelable: true,
                dataTransfer
            });
            targetElement.dispatchEvent(event);
        });
    }

    // Function to use a saved message with retry mechanism
    function useMessage(html) {
        // Create a temporary div to manipulate the content
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = html;

        // Find all links and ensure they're properly preserved
        const links = tempDiv.querySelectorAll('a');
        links.forEach(link => {
            // Replace the link element with its href as plain text
            const href = link.href;
            const textNode = document.createTextNode(href);
            link.parentNode.replaceChild(textNode, link);
        });

        // Find all images
        const images = Array.from(tempDiv.querySelectorAll('img'));

        // Get the HTML of the first image for the clipboard
        const firstImageSrc = images.length > 0 ? images[0].src : null;

        // Remove images from the div to get the text-only HTML
        images.forEach(img => img.remove());
        const htmlToInsert = tempDiv.innerHTML.trim();

        // Blur our own textarea and hide the panel
        if (document.activeElement === ui.textarea) {
            ui.textarea.blur();
        }
        toggleContainer();

        setTimeout(() => {
            // If there's text, insert it.
            if (htmlToInsert) {
                const attemptInsert = (remainingTries = 3) => {
                    const result = insertMessageIntoInputField(htmlToInsert);
                    if (!result && remainingTries > 0) {
                        setTimeout(() => attemptInsert(remainingTries - 1), 300);
                    }
                };
                attemptInsert();
            }

            // If there was an image, use the simulateFileDrop method
            if (firstImageSrc) {
                (async () => {
                    try {
                        // Fetch the image data
                        const response = await fetch(firstImageSrc);
                        const blob = await response.blob();

                        // Create a File object with the appropriate MIME type
                        const mimeType = blob.type || 'image/png'; // Default to PNG if type is not available
                        const fileName = mimeType.includes('gif') ? "saved.gif" : "saved.png";
                        const file = new File([blob], fileName, { type: mimeType });

                        // Find the messenger input field
                        const inputField = findMessengerInputField();
                        if (inputField) {
                            // Simulate file drop for better image handling
                            simulateFileDrop(file, inputField);
                        } else {
                            showNotification('Could not find message field to add image');

                            // Fallback to copying to clipboard
                            try {
                                await navigator.clipboard.write([
                                    new ClipboardItem({
                                        [mimeType]: blob
                                    })
                                ]);
                                showNotification('Image copied to clipboard! Press Ctrl+V to paste.');
                            } catch (clipboardError) {
                                console.error('Failed to copy image to clipboard:', clipboardError);
                                const imageHtml = `<img src="${firstImageSrc}">`;
                                copyToClipboard(imageHtml, 'Failed to add image directly. Copied as HTML instead.');
                            }
                        }
                    } catch (error) {
                        console.error('Error using image:', error);
                        showNotification('Error adding image. Try copying it manually.');
                    }
                })();
            }
        }, 50);
    }

    function findMessengerInputField() {
        // This is the list of selectors used to find the input box.
        // It's duplicated from insertMessageIntoInputField for now.
        const possibleSelectors = [
            'div[aria-label="Message"][contenteditable="true"][data-lexical-editor="true"]',
            '.xzsf02u.notranslate[contenteditable="true"][role="textbox"]',
            '.notranslate[contenteditable="true"][data-lexical-editor="true"]',
            '[aria-label="Message"][contenteditable="true"]',
            '[contenteditable="true"][role="textbox"]',
            '[contenteditable="true"][data-lexical-editor="true"]',
            '.xzsf02u[role="textbox"]',
            '[aria-label="Message"]',
            '[placeholder="Aa"]',
            '.notranslate[contenteditable="true"]',
            'div[role="textbox"][spellcheck="true"]',
            'form [contenteditable="true"]',
            '[contenteditable="true"]'
        ];

        for (const selector of possibleSelectors) {
            const elements = document.querySelectorAll(selector);
            if (elements.length > 0) {
                if (elements.length > 1) {
                    let maxBottom = 0;
                    let bestElement = null;
                    for (const el of elements) {
                        if (isOurUIElement(el)) continue;
                        const rect = el.getBoundingClientRect();
                        if (rect.bottom > maxBottom && rect.width > 50) {
                            maxBottom = rect.bottom;
                            bestElement = el;
                        }
                    }
                    if (bestElement) return bestElement;
                } else if (!isOurUIElement(elements[0])) {
                    return elements[0];
                }
            }
        }
        return null;
    }

    // Helper function to check if element belongs to our UI
    function isOurUIElement(element) {
        if (!element) return false;

        // Check if the element itself has our marker
        if (element.dataset && element.dataset.savedMessageUiElement === 'true') {
            return true;
        }

        // Check if it's within our UI container
        if (ui.container && ui.container.contains(element)) {
            return true;
        }

        // Check if it's our toggle button
        if (ui.toggleButton && ui.toggleButton.contains(element)) {
            return true;
        }

        // Check if it's part of the file input
        if (fileInput && fileInput.contains(element)) {
            return true;
        }

        return false;
    }

    // Helper function to actually insert the message
    function insertMessageIntoInputField(html) {
        // Find the message input field - try multiple possible selectors
        let inputField = null;
        let matchedSelector = '';

        // Try different selectors that might match the Messenger input field
        const possibleSelectors = [
            // Add the exact selector from the user's console output first (highest priority)
            'div[aria-label="Message"][contenteditable="true"][data-lexical-editor="true"]',
            '.xzsf02u.notranslate[contenteditable="true"][role="textbox"]',
            '.notranslate[contenteditable="true"][data-lexical-editor="true"]',
            '[aria-label="Message"][contenteditable="true"]',
            // Previous selectors as fallback
            '[contenteditable="true"][role="textbox"]',
            '[contenteditable="true"][data-lexical-editor="true"]',
            '.xzsf02u[role="textbox"]',
            '[aria-label="Message"]',
            '[placeholder="Aa"]',
            '.notranslate[contenteditable="true"]',
            'div[role="textbox"][spellcheck="true"]',
            // Try to find the bottom-most contenteditable element (likely to be the input)
            'form [contenteditable="true"]',
            '[contenteditable="true"]'
        ];

        // First try direct match with the console output
        const specificSelector = 'div.xzsf02u.x1a2a7pz.x1n2onr6.x14wi4xw.x1iyjqo2.x1gh3ibb.xisnujt.xeuugli.x1odjw0f.notranslate[contenteditable="true"][role="textbox"][spellcheck="true"][data-lexical-editor="true"]';
        const specificElement = document.querySelector(specificSelector);

        if (specificElement && !isOurUIElement(specificElement)) {
            inputField = specificElement;
            matchedSelector = specificSelector;
        } else {
            // Try the other selectors if specific one failed
            for (const selector of possibleSelectors) {
                const elements = document.querySelectorAll(selector);
                if (elements.length > 0) {
                    // If multiple elements match, prefer the one closer to the bottom of the page
                    // and ensure it's not part of our own UI
                    if (elements.length > 1) {
                        let maxBottom = 0;
                        for (const el of elements) {
                            if (isOurUIElement(el)) continue; // Skip our own UI elements

                            const rect = el.getBoundingClientRect();
                            if (rect.bottom > maxBottom && rect.width > 50) { // Ensure it's not a tiny element
                                maxBottom = rect.bottom;
                                inputField = el;
                            }
                        }
                    } else if (!isOurUIElement(elements[0])) {
                        inputField = elements[0];
                    }

                    if (inputField) {
                        matchedSelector = selector;
                        break;
                    }
                }
            }
        }

        if (config.debugMode) {
            console.log('Input field search results:', {
                found: !!inputField,
                matchedSelector,
                element: inputField,
                isOurElement: inputField ? isOurUIElement(inputField) : false
            });
        }

        if (inputField && !isOurUIElement(inputField)) {
            try {
                // First, focus the element. This is important for many paste handlers.
                inputField.focus();

                // Method 1: The most robust method is simulating a paste event.
                // This should trigger all of Facebook's listeners.
                simulatePaste(inputField, html);

                // Give it a moment to process the event, then check and fallback
                setTimeout(() => {
                    if (!checkTextInserted(inputField, html)) {
                        if (config.debugMode) {
                            console.log('Paste simulation failed, trying direct insertion as fallback.');
                        }
                        // Method 2: Fallback to direct insertion.
                        insertTextDirectly(inputField, html);
                    }

                    // Final check and focus adjustment
                    setTimeout(() => {
                        if (checkTextInserted(inputField, html)) {
                            if (config.debugMode) {
                                console.log('Message insertion successful using selector:', matchedSelector);
                            }
                            positionCursorAtEnd(inputField);

                            // If there's a "send" button visible, we could optionally focus that too
                            const sendButton = document.querySelector('button[aria-label="Send"]');
                            if (sendButton) {
                                setTimeout(() => sendButton.focus(), 50);
                            }
                        } else {
                            if (config.debugMode) {
                                console.log('All insertion methods failed.');
                            }
                        }
                    }, 100);

                }, 50);

                return true; // We attempted insertion.
            } catch (error) {
                console.error('Error inserting message:', error);
                if (config.debugMode) {
                    alert('Error inserting message: ' + error.message);
                }
                return false;
            }
        } else {
            console.error('Could not find suitable message input field (that is not part of our own UI)');
            alert('Could not find message input field. Please make sure you are in a Messenger chat.\n\nIf this error persists, please set debugMode to true in the script and use the Debug button to find working selectors, or use the "Copy" button instead.');
            return false;
        }
    }

    // Position cursor at the end of content
    function positionCursorAtEnd(element) {
        try {
            // Create range at end of content
            const range = document.createRange();
            range.selectNodeContents(element);
            range.collapse(false); // collapse to end

            // Apply the selection
            const selection = window.getSelection();
            selection.removeAllRanges();
            selection.addRange(range);
        } catch (e) {
            if (config.debugMode) {
                console.log('Could not position cursor at end:', e);
            }
        }
    }

    // Insert text directly into the element
    function insertTextDirectly(element, html) {
        // Additional safety check to ensure we're not affecting our own UI
        if (isOurUIElement(element)) {
            console.error('Attempted to modify our own UI element');
            return false;
        }

        try {
            // First clear the field
            element.innerHTML = '';

            // Setting innerHTML is the most direct way for HTML content
            element.innerHTML = html;

            // Dispatch events to notify React/Facebook
            ['input', 'change'].forEach(eventType => {
                try {
                    const event = new Event(eventType, { bubbles: true });
                    element.dispatchEvent(event);
                } catch (e) {
                    if (config.debugMode) {
                        console.log(`Failed to dispatch ${eventType} event:`, e);
                    }
                }
            });

            return true;
        } catch (e) {
            console.log('Direct HTML insertion failed:', e);
            return false;
        }
    }

    function simulatePaste(element, html) {
        if (isOurUIElement(element)) {
            console.error('Attempted to paste into our own UI element');
            return false;
        }
        try {
            const pasteEvent = new ClipboardEvent('paste', {
                bubbles: true,
                cancelable: true,
                clipboardData: new DataTransfer()
            });

            // Add both HTML and plain text versions for compatibility
            pasteEvent.clipboardData.setData('text/html', html);
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = html.replace(/<br\s*\/?>/gi, '\n'); // Convert <br> to newlines for text
            pasteEvent.clipboardData.setData('text/plain', tempDiv.textContent || '');

            element.dispatchEvent(pasteEvent);
            return true;
        } catch (e) {
            if (config.debugMode) {
                console.error('Simulating paste event failed:', e);
            }
            return false;
        }
    }

    // Helper function to check if text was successfully inserted
    function checkTextInserted(element, expectedHtml) {
        if (!element || !expectedHtml) return false;

        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = expectedHtml;
        const expectedText = tempDiv.textContent.trim();
        const expectedImgCount = tempDiv.querySelectorAll('img').length;

        const actualText = element.textContent.trim();
        const actualImgCount = element.querySelectorAll('img').length;

        // If the target is empty, insertion definitely failed.
        if (!element.innerHTML.trim()) {
            return false;
        }

        // If we expect images, we must have at least that many images.
        if (expectedImgCount > 0 && actualImgCount < expectedImgCount) {
            return false;
        }

        // If we expect text, it must be present.
        if (expectedText && !actualText.includes(expectedText)) {
            return false;
        }

        // If we expect only an image and text is empty, but we have an image, it's a success.
        if (expectedImgCount > 0 && !expectedText) {
            return actualImgCount > 0;
        }

        return true;
    }

    // Function to delete a saved message
    function deleteMessage(timestamp) {
        console.log('DEBUG: deleteMessage() called, timestamp:', timestamp);
        const chatId = getCurrentChatId();
        if (!chatId) {
            console.log('DEBUG: deleteMessage() - no chatId, returning');
            return;
        }

        chrome.storage.local.get(chatId, (result) => {
            const savedMessages = result[chatId] || [];

            // Find the message by timestamp instead of using index
            const messageIndex = savedMessages.findIndex(msg => msg.timestamp === timestamp);
            if (messageIndex === -1) {
                console.log('DEBUG: Message not found with timestamp:', timestamp);
                return;
            }

            const deletedMessage = savedMessages[messageIndex];
            console.log('DEBUG: Deleting message:', deletedMessage);
            savedMessages.splice(messageIndex, 1);

            chrome.storage.local.set({ [chatId]: savedMessages }, () => {
                console.log('DEBUG: Message deleted from local storage, chatId:', chatId);
                loadSavedMessages();

                // Perform a full sync to ensure everything is up to date
                // This will upload all local changes including the deletion
                console.log('DEBUG: Calling syncWithCloud after delete');
                syncWithCloud();
            });
        });
    }

    // Helper function to send messages to background script
    function sendMessage(message) {
        return new Promise((resolve, reject) => {
            chrome.runtime.sendMessage(message, (response) => {
                if (chrome.runtime.lastError) {
                    reject(new Error(chrome.runtime.lastError.message));
                } else {
                    resolve(response);
                }
            });
        });
    }

    // Function to sync deletion to Google Drive
    async function syncDeletionToCloud(jsonFileId, imageFileId) {
        try {
            const response = await new Promise((resolve, reject) => {
                chrome.runtime.sendMessage({
                    action: 'deleteDraft',
                    draftId: jsonFileId,
                    imageFileId: imageFileId
                }, (response) => {
                    if (chrome.runtime.lastError) {
                        reject(new Error(chrome.runtime.lastError.message));
                    } else {
                        resolve(response);
                    }
                });
            });

            if (response && response.success) {
                console.log('Draft deletion synced to Google Drive successfully');
            } else {
                console.log('Cloud deletion failed:', response ? response.message : 'Unknown error');
            }
        } catch (error) {
            console.error('Error syncing deletion to cloud:', error);
        }
    }

    // Function to trigger the import dialog
    function triggerImportDialog() {
        fileInput.click();
    }

    // Function to import saved messages from a file
    function importSavedMessages(event) {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = function(e) {
            try {
                const data = JSON.parse(e.target.result);

                if (typeof data !== 'object' || data === null) throw new Error('Invalid data format: not an object');

                // The data to be set in storage
                let importData = {};
                let messageCount = 0;
                let chatCount = 0;

                // Separate settings from message data
                if (data.config) {
                    importData.config = data.config;
                }
                if (data.containerPosition) {
                    importData.containerPosition = data.containerPosition;
                }
                if (data.togglePosition) {
                    importData.togglePosition = data.togglePosition;
                }

                // Import message data
                for (const key in data) {
                    if (key !== 'config' && key !== 'containerPosition' && key !== 'togglePosition') {
                        if (Array.isArray(data[key])) {
                            importData[key] = data[key]; // This is a chat's message array
                            messageCount += data[key].length;
                            chatCount++;
                        }
                    }
                }

                chrome.storage.local.set(importData, () => {
                    alert(`Successfully imported ${messageCount} messages for ${chatCount} chats, along with UI settings.`);

                    // Apply imported settings immediately
                    if (importData.config) {
                        Object.assign(config, importData.config);
                        // Force UI updates based on new config if needed
                        const debugToggleButton = document.querySelector('button[title="Toggle debug mode"]');
                        if (debugToggleButton) {
                            debugToggleButton.textContent = config.debugMode ? '🐞 On' : '🐞 Off';
                        }
                    }
                    if (importData.containerPosition || importData.togglePosition) {
                        loadPositions();
                    }

                    // Refresh current message view if needed
                    const currentChatId = getCurrentChatId();
                    if (currentChatId && importData[currentChatId]) {
                        loadSavedMessages();
                    }
                });

            } catch (error) {
                alert('Error importing messages: ' + error.message);
            }
        };
        reader.readAsText(file);
        event.target.value = '';
    }

    // Function to export all saved messages
    function exportSavedMessages() {
        // chrome.storage.local.get(null) gets all items
        chrome.storage.local.get(null, async (allData) => {
            if (Object.keys(allData).length === 0) {
                alert('No data found to export.');
                return;
            }

            // Trigger a sync before exporting to ensure latest data
            try {
                await chrome.runtime.sendMessage({ action: 'sync' });
                console.log('Sync completed before export');
            } catch (error) {
                console.warn('Sync before export failed:', error);
                // Continue with export even if sync fails
            }

            // Get fresh data after sync
            chrome.storage.local.get(null, (syncedData) => {
                // All data including messages and settings will be exported
                downloadJSON(syncedData, 'messenger_saved_messages_and_settings.json');
            });
        });
    }

    // Helper function to trigger download
    function downloadJSON(data, filename) {
        const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(data, null, 2));
        const downloadAnchorNode = document.createElement('a');
        downloadAnchorNode.setAttribute('href', dataStr);
        downloadAnchorNode.setAttribute('download', filename);
        document.body.appendChild(downloadAnchorNode);
        downloadAnchorNode.click();
        downloadAnchorNode.remove();
    }

    // Debug function to find input field selectors
    function debugInputFields() {
        const selectors = [
            '[contenteditable="true"]',
            '[role="textbox"]',
            '[contenteditable="true"][role="textbox"]',
            '[contenteditable="true"][data-lexical-editor="true"]',
            '.xzsf02u',
            '.notranslate',
            '[aria-label="Message"]',
            '[aria-label*="essage"]',
            '[placeholder="Aa"]',
            '.notranslate[contenteditable="true"]',
            'div[role="textbox"]',
            'div[contenteditable="true"]'
        ];

        const results = selectors.map(selector => {
            const elements = document.querySelectorAll(selector);
            return {
                selector,
                count: elements.length,
                elements: Array.from(elements).map(el => ({
                    tagName: el.tagName,
                    classes: el.className,
                    attributes: {
                        role: el.getAttribute('role'),
                        contenteditable: el.getAttribute('contenteditable'),
                        'data-lexical-editor': el.getAttribute('data-lexical-editor'),
                        'aria-label': el.getAttribute('aria-label'),
                        spellcheck: el.getAttribute('spellcheck')
                    },
                    text: el.textContent.substring(0, 20) + (el.textContent.length > 20 ? '...' : ''),
                    rect: el.getBoundingClientRect()
                }))
            };
        });

        // Find closest to bottom of page (likely the input field)
        let maxBottom = 0;
        let bottomElement = null;
        document.querySelectorAll('[contenteditable="true"]').forEach(el => {
            const rect = el.getBoundingClientRect();
            if (rect.bottom > maxBottom) {
                maxBottom = rect.bottom;
                bottomElement = el;
            }
        });

        console.log('Potential Input Field Selectors:', results);
        console.log('Likely input field (bottom-most contenteditable):', bottomElement);

        if (bottomElement) {
            console.log('Bottom element classes:', bottomElement.className);
            console.log('Bottom element attributes:', {
                role: bottomElement.getAttribute('role'),
                contenteditable: bottomElement.getAttribute('contenteditable'),
                'data-lexical-editor': bottomElement.getAttribute('data-lexical-editor'),
                'aria-label': bottomElement.getAttribute('aria-label'),
                spellcheck: bottomElement.getAttribute('spellcheck')
            });

            // Create accurate CSS selector for this element
            let accurateSelector = bottomElement.tagName.toLowerCase();
            if (bottomElement.className) {
                accurateSelector += '.' + bottomElement.className.trim().replace(/\s+/g, '.');
            }
            ['role', 'contenteditable', 'data-lexical-editor', 'aria-label', 'spellcheck'].forEach(attr => {
                const value = bottomElement.getAttribute(attr);
                if (value) {
                    accurateSelector += `[${attr}="${value}"]`;
                }
            });

            console.log('Accurate selector for bottom element:', accurateSelector);
            alert('Check your browser console for detailed results. The most likely input field has been identified with selector: ' + accurateSelector);

            // Test with a temp message
            const origContent = bottomElement.innerHTML;
            try {
                bottomElement.innerHTML = '<p>⚠️ Test message - will be removed in 2 seconds ⚠️</p>';
                setTimeout(() => {
                    bottomElement.innerHTML = origContent;
                }, 2000);
            } catch (e) {
                console.error('Error setting test message:', e);
            }
        }

        // Show alert with summary
        const matchingSelectorsList = results
            .filter(r => r.count > 0)
            .map(r => `${r.selector}: ${r.count} element(s)`)
            .join('\n');

        alert(`Potential input field selectors found:\n${matchingSelectorsList}\n\nCheck browser console for details.`);
    }

    // Function to toggle debug mode
    function toggleDebugMode() {
        config.debugMode = !config.debugMode;
        saveConfig();

        // Update UI to reflect debug mode
        const debugToggleButton = document.querySelector('button[title="Toggle debug mode"]');
        if (debugToggleButton) {
            debugToggleButton.textContent = config.debugMode ? '🐞 On' : '🐞 Off';
        }

        // Add or remove debug button based on debug mode
        const menu = document.querySelector('.saved-messages-menu');
        const existingDebugButton = menu.querySelector('button[title="Find input field selectors"]');

        if (config.debugMode && !existingDebugButton) {
            const debugButton = document.createElement('button');
            debugButton.textContent = 'Debug';
            debugButton.title = 'Find input field selectors';
            debugButton.style.marginLeft = 'auto';
            debugButton.onclick = debugInputFields;
            menu.appendChild(debugButton);
        } else if (!config.debugMode && existingDebugButton) {
            existingDebugButton.remove();
        }

        alert(`Debug mode ${config.debugMode ? 'enabled' : 'disabled'}. ${config.debugMode ? 'Additional debug options are now available.' : ''}`);
    }

    // Function to copy text to clipboard
    function copyToClipboard(html, message) {
        // Set a default message if one isn't provided.
        const notificationMessage = message || 'Message copied to clipboard! You can now paste it.';

        function listener(e) {
            e.clipboardData.setData('text/html', html);
            // Also set a plain text fallback
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = html;
            e.clipboardData.setData('text/plain', tempDiv.textContent || '');
            e.preventDefault();
        }
        document.addEventListener('copy', listener);
        document.execCommand('copy');
        document.removeEventListener('copy', listener);

        showNotification(notificationMessage);
    }

    // Add this new function to handle paste events
    async function handlePaste(e) {
        // Check if the clipboard contains a GIF
        if (e.clipboardData && e.clipboardData.items) {
            const items = e.clipboardData.items;

            for (let i = 0; i < items.length; i++) {
                // Check for any image type
                if (items[i].type.indexOf('image/') !== -1) {
                    // We found an image, let's handle it
                    e.preventDefault(); // Prevent default paste behavior

                    const blob = items[i].getAsFile();
                    const isGif = items[i].type === 'image/gif';

                    if (isGif) {
                        // For GIFs, use the simulateFileDrop approach for better compatibility
                        const file = new File([blob], "pasted.gif", { type: "image/gif" });

                        // First add to our textarea for saving
                        const dataUrl = await new Promise((resolve, reject) => {
                            const reader = new FileReader();
                            reader.onloadend = () => resolve(reader.result);
                            reader.onerror = reject;
                            reader.readAsDataURL(blob);
                        });

                        // Create an img element with the GIF data for our saved messages
                        const imgElement = document.createElement('img');
                        imgElement.src = dataUrl;
                        ui.textarea.appendChild(imgElement);

                        // Position cursor after the image
                        positionCursorAtEnd(ui.textarea);

                        return;
                    } else {
                        // For other images, convert to data URL as before
                        const dataUrl = await new Promise((resolve, reject) => {
                            const reader = new FileReader();
                            reader.onloadend = () => resolve(reader.result);
                            reader.onerror = reject;
                            reader.readAsDataURL(blob);
                        });

                        // Create an img element with the image data
                        const imgElement = document.createElement('img');
                        imgElement.src = dataUrl;
                        ui.textarea.appendChild(imgElement);

                        // Position cursor after the image
                        positionCursorAtEnd(ui.textarea);

                        return;
                    }
                }
            }

            // Check for URLs that might be GIFs
            const text = e.clipboardData.getData('text');
            if (text && (text.endsWith('.gif') || text.includes('.gif?'))) {
                e.preventDefault(); // Prevent default paste behavior

                try {
                    // Fetch the GIF
                    const response = await fetch(text);
                    const blob = await response.blob();

                    if (blob.type === 'image/gif') {
                        // Create a File object for the GIF
                        const file = new File([blob], "pasted.gif", { type: "image/gif" });

                        // Convert to data URL for our saved messages
                        const dataUrl = await new Promise((resolve, reject) => {
                            const reader = new FileReader();
                            reader.onloadend = () => resolve(reader.result);
                            reader.onerror = reject;
                            reader.readAsDataURL(blob);
                        });

                        // Create an img element with the GIF data
                        const imgElement = document.createElement('img');
                        imgElement.src = dataUrl;
                        ui.textarea.appendChild(imgElement);

                        // Position cursor after the image
                        positionCursorAtEnd(ui.textarea);

                        return;
                    }
                } catch (error) {
                    console.error('Error adding GIF from URL:', error);
                    // Let the default paste behavior happen
                }
            }
        }

        // If no image was found, let the default paste behavior happen
    }

    // Initialize
    function init() {
        // Check for URL changes every second
        setInterval(checkUrlChange, 1000);

        // Initial URL check
        checkUrlChange();

        // Set up MutationObserver to detect dynamically loaded elements
        setupMutationObserver();
    }

    // Set up MutationObserver to detect when Messenger dynamically adds or removes elements
    function setupMutationObserver() {
        // Options for the observer (which mutations to observe)
        const config = {
            childList: true,
            subtree: true,
            attributes: false,
            characterData: false
        };

        // Create an observer instance linked to the callback function
        const observer = new MutationObserver((mutationsList, observer) => {
            // Check if the input field is now available
            if (document.querySelector('[contenteditable="true"][role="textbox"]')) {
                // Input field detected, no need to do anything special
                return;
            }

            // If URL has changed, check if we're in a new chat
            const chatId = getCurrentChatId();
            if (chatId && chatId !== currentChatUrl) {
                currentChatUrl = chatId;
                loadSavedMessages();
            }
        });

        // Start observing the target node for configured mutations
        observer.observe(document.body, config);
    }

    // Theme toggle function
    function toggleTheme() {
        const currentTheme = config.theme || detectSystemTheme();
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';

        config.manualTheme = true; // Mark as manually set
        applyTheme(newTheme);

        // Update theme button
        const themeButton = document.querySelector('button[title="Toggle theme"]');
        if (themeButton) {
            themeButton.textContent = newTheme === 'dark' ? '☀️' : '🌙';
        }
    }

    // Start after page load
    window.addEventListener('load', init);
})();
