// background.js - GlitchDraft Extension Background Service Worker

// Import driveService
import { driveService } from './driveService.js';
import { isSupportedSite } from './config.js';

let syncInProgress = false;
let periodicSyncTimer = null;
let tokenRefreshTimer = null;

// Initialize on extension startup
chrome.runtime.onStartup.addListener(async () => {
    console.log('Extension started');
    // Ensure authentication on startup
    await ensureAuthentication();
    startPeriodicSync();
    startTokenRefreshTimer();
});

chrome.runtime.onInstalled.addListener(async () => {
    console.log('Extension installed/updated');
    // Ensure authentication on installation
    await ensureAuthentication();
    startPeriodicSync();
    startTokenRefreshTimer();
});

// Ensure user is authenticated
async function ensureAuthentication() {
    try {
        const isAuth = await driveService.isAuthenticated();
        if (!isAuth) {
            console.log('Not authenticated on startup, attempting silent auth...');
            // Try to get token non-interactively first
            try {
                await driveService.getAuthToken(false);
            } catch (error) {
                console.log('Silent auth failed, user will need to sign in manually');
            }
        } else {
            console.log('Already authenticated');
        }
    } catch (error) {
        console.error('Error checking authentication on startup:', error);
    }
}

// Start token refresh timer - checks every 10 minutes and refreshes if token expires in less than 15 minutes
function startTokenRefreshTimer() {
    // Clear any existing timer
    if (tokenRefreshTimer) {
        clearInterval(tokenRefreshTimer);
    }

    // Check every 10 minutes
    tokenRefreshTimer = setInterval(async () => {
        try {
            const data = await chrome.storage.local.get(['tokenExpiry']);
            if (data.tokenExpiry) {
                const timeUntilExpiry = data.tokenExpiry - Date.now();
                const fifteenMinutes = 15 * 60 * 1000;
                
                // If token expires in less than 15 minutes, refresh it
                if (timeUntilExpiry < fifteenMinutes && timeUntilExpiry > 0) {
                    console.log('Token expiring soon, refreshing proactively...');
                    try {
                        await driveService.refreshAccessToken();
                        console.log('Token refreshed successfully');
                    } catch (error) {
                        console.error('Proactive token refresh failed:', error);
                    }
                }
            }
        } catch (error) {
            console.error('Error in token refresh timer:', error);
        }
    }, 10 * 60 * 1000); // 10 minutes

    console.log('Token refresh timer started');
}

// Start periodic sync check every 10 seconds
function startPeriodicSync() {
    // Clear any existing timer
    if (periodicSyncTimer) {
        clearInterval(periodicSyncTimer);
    }

    // Set up 10-second interval
    periodicSyncTimer = setInterval(() => {
        checkForRemoteChanges();
    }, 5000); // 5 seconds

    console.log('Periodic sync started (5-second interval)');
}

// Check for remote changes and sync if needed
async function checkForRemoteChanges() {
    if (syncInProgress) {
        return; // Skip if sync already in progress
    }

    try {
        // Only check if authenticated
        const isAuth = await driveService.isAuthenticated();
        if (!isAuth) {
            return;
        }

        // Get local and remote timestamps
        const localData = await chrome.storage.local.get(['lastSyncTime']);
        const localTimestamp = localData.lastSyncTime || 0;
        const remoteTimestamp = await getRemoteTimestamp();

        if (remoteTimestamp && remoteTimestamp > localTimestamp) {
            console.log('Remote changes detected, downloading...');
            await downloadRemoteData();

            // Notify content scripts about update
            const tabs = await chrome.tabs.query({});
            for (const tab of tabs) {
                try {
                    await chrome.tabs.sendMessage(tab.id, { action: 'remoteUpdate' });
                } catch (error) {
                    // Ignore errors for tabs without content script
                }
            }
        }
    } catch (error) {
        console.error('Periodic sync check failed:', error);
    }
}

// Listen for messages from content script and popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log('Message received:', request.action);

    switch (request.action) {
        case 'sync':
            handleSync(sendResponse);
            return true; // Indicate async response

        case 'uploadDraft':
            handleUploadDraft(request.data, sendResponse);
            return true;

        case 'deleteDraft':
            handleDeleteDraft(request.draftId, sendResponse);
            return true;

        case 'getSyncStatus':
            handleGetSyncStatus(sendResponse);
            return true;

        case 'toggleUI':
            handleToggleUI(sender.tab.id, sendResponse);
            return true;

        default:
            sendResponse({ success: true });
            return true;
    }
});

// Handle browser action click
chrome.action.onClicked.addListener((tab) => {
    // Check if current tab is a supported site
    if (isSupportedSite(tab.url)) {
        handleToggleUI(tab.id);
    }
});

// Function to toggle UI visibility
async function handleToggleUI(tabId, sendResponse = null) {
    try {
        await chrome.tabs.sendMessage(tabId, { action: 'toggleUI' });
        if (sendResponse) sendResponse({ success: true });
    } catch (error) {
        console.error('Error toggling UI:', error);
        if (sendResponse) sendResponse({ success: false, message: error.message });
    }
}

// Main sync function - handles both upload and download
async function handleSync(sendResponse) {
    if (syncInProgress) {
        console.log('Sync already in progress');
        sendResponse({ success: false, message: 'Sync already in progress' });
        return;
    }

    syncInProgress = true;
    console.log('Starting sync...');

    try {
        // Check authentication
        const isAuth = await driveService.isAuthenticated();
        if (!isAuth) {
            console.log('Not authenticated, starting auth flow...');
            const authSuccess = await driveService.forceAuthentication();
            if (!authSuccess) {
                throw new Error('Authentication failed');
            }
        }

        // Ensure app folder exists
        await driveService.getAppFolderId();

        // Get local data
        const localData = await chrome.storage.local.get(null);
        const localTimestamp = localData.lastSyncTime || 0;

        // Get remote timestamp
        const remoteTimestamp = await getRemoteTimestamp();

        console.log('Local timestamp:', localTimestamp);
        console.log('Remote timestamp:', remoteTimestamp);

        if (remoteTimestamp === null) {
            // No remote data, upload local data
            console.log('No remote data found, uploading local data...');
            await uploadLocalData(localData);
            sendResponse({ success: true, message: 'Initial sync completed' });
        } else if (remoteTimestamp > localTimestamp) {
            // Remote is newer, download
            console.log('Remote data is newer, downloading...');
            await downloadRemoteData();
            sendResponse({ success: true, message: 'Downloaded latest data' });
        } else {
            // Local is newer or same, upload
            console.log('Local data is newer or same, uploading...');
            await uploadLocalData(localData);
            sendResponse({ success: true, message: 'Uploaded local changes' });
        }

    } catch (error) {
        console.error('Sync failed:', error);
        sendResponse({ success: false, message: error.message });
    } finally {
        syncInProgress = false;
    }
}

// Upload local data to Drive
async function uploadLocalData(localData) {
    try {
        const timestamp = Date.now();

        // Upload main sync file
        await driveService.uploadSync(localData);

        // Update timestamp files
        await updateRemoteTimestamp(timestamp);
        await chrome.storage.local.set({ lastSyncTime: timestamp });

        console.log('Upload completed, timestamp:', timestamp);
    } catch (error) {
        console.error('Upload failed:', error);
        throw error;
    }
}

// Download remote data from Drive
async function downloadRemoteData() {
    try {
        // Download main sync file
        const remoteData = await driveService.downloadLatestSync();
        if (!remoteData) {
            throw new Error('Failed to download remote data');
        }

        // Get remote timestamp
        const remoteTimestamp = await getRemoteTimestamp();
        if (remoteTimestamp === null) {
            throw new Error('Failed to get remote timestamp');
        }

        // Update local storage
        await chrome.storage.local.clear();
        await chrome.storage.local.set(remoteData);
        await chrome.storage.local.set({ lastSyncTime: remoteTimestamp });

        // Notify content scripts
        const tabs = await chrome.tabs.query({});
        for (const tab of tabs) {
            try {
                await chrome.tabs.sendMessage(tab.id, { action: 'remoteUpdate' });
            } catch (error) {
                // Ignore errors for tabs without content script
            }
        }

        console.log('Download completed, timestamp:', remoteTimestamp);
    } catch (error) {
        console.error('Download failed:', error);
        throw error;
    }
}

// Cache for remote timestamp to reduce API calls
let timestampCache = { value: null, lastCheck: 0 };

// Get remote timestamp from lastsynctime file
async function getRemoteTimestamp() {
    try {
        // Use cache if less than 2 seconds old
        const now = Date.now();
        if (timestampCache.value !== null && (now - timestampCache.lastCheck) < 2000) {
            return timestampCache.value;
        }

        const folderId = await driveService.getAppFolderId();

        // Search for lastsynctime file with minimal fields for speed
        const searchUrl = `https://www.googleapis.com/drive/v3/files?q='${folderId}' in parents and name='lastsynctime' and trashed=false&fields=files(id)`;

        const response = await fetch(searchUrl, {
            headers: {
                'Authorization': `Bearer ${driveService.authToken}`
            }
        });

        if (!response.ok) {
            if (response.status === 404 || response.status === 403) {
                return null; // Quick fail for common errors
            }
            throw new Error(`Search failed: ${response.status}`);
        }

        const data = await response.json();
        if (!data.files || data.files.length === 0) {
            timestampCache = { value: null, lastCheck: now };
            return null;
        }

        // Download timestamp
        const fileId = data.files[0].id;
        const timestampText = await driveService.downloadTextFile(fileId);
        const timestamp = parseInt(timestampText);

        const result = isNaN(timestamp) ? null : timestamp;

        // Update cache
        timestampCache = { value: result, lastCheck: now };

        return result;
    } catch (error) {
        console.error('Failed to get remote timestamp:', error);
        return null;
    }
}

// Update remote timestamp file
async function updateRemoteTimestamp(timestamp) {
    try {
        const folderId = await driveService.getAppFolderId();

        // Search for existing file
        const searchUrl = `https://www.googleapis.com/drive/v3/files?q='${folderId}' in parents and name='lastsynctime' and trashed=false`;

        const response = await fetch(searchUrl, {
            headers: {
                'Authorization': `Bearer ${driveService.authToken}`
            }
        });

        const data = await response.json();
        const timestampString = timestamp.toString();

        if (data.files && data.files.length > 0) {
            // Update existing file
            const fileId = data.files[0].id;
            await driveService.updateFile(fileId, timestampString);
        } else {
            // Create new file
            const metadata = {
                name: 'lastsynctime',
                parents: [folderId],
                mimeType: 'text/plain'
            };
            await driveService.createFile(metadata, timestampString);
        }

        console.log('Remote timestamp updated:', timestamp);
    } catch (error) {
        console.error('Failed to update remote timestamp:', error);
        throw error;
    }
}

// Handle draft upload (triggered when user saves/deletes messages)
async function handleUploadDraft(draftData, sendResponse) {
    try {
        console.log('Draft operation triggered, starting sync...');

        // Simply trigger a full sync
        await new Promise((resolve, reject) => {
            handleSync((response) => {
                if (response.success) {
                    resolve();
                } else {
                    reject(new Error(response.message));
                }
            });
        });

        sendResponse({ success: true, message: 'Changes synced' });
    } catch (error) {
        console.error('Draft sync failed:', error);
        sendResponse({ success: false, message: error.message });
    }
}

// Handle draft deletion (triggered when user deletes messages)
async function handleDeleteDraft(draftId, sendResponse) {
    try {
        console.log('Delete operation triggered, starting sync...');

        // Simply trigger a full sync
        await new Promise((resolve, reject) => {
            handleSync((response) => {
                if (response.success) {
                    resolve();
                } else {
                    reject(new Error(response.message));
                }
            });
        });

        sendResponse({ success: true, message: 'Deletion synced' });
    } catch (error) {
        console.error('Delete sync failed:', error);
        sendResponse({ success: false, message: error.message });
    }
}

// Handle sync status request
async function handleGetSyncStatus(sendResponse) {
    try {
        const isAuth = await driveService.isAuthenticated();
        const lastSync = await chrome.storage.local.get(['lastSyncTime']);

        // Get remote timestamp for debug info
        let remoteTimestamp = null;
        if (isAuth) {
            try {
                remoteTimestamp = await getRemoteTimestamp();
            } catch (error) {
                console.error('Failed to get remote timestamp for status:', error);
            }
        }

        sendResponse({
            success: true,
            authenticated: isAuth,
            lastSyncTime: lastSync.lastSyncTime || null,
            syncInProgress: syncInProgress,
            // Debug info
            localLastSyncTime: lastSync.lastSyncTime || null,
            remoteLastSyncTime: remoteTimestamp
        });
    } catch (error) {
        console.error('Status check failed:', error);
        sendResponse({ success: false, message: error.message });
    }
}

// Clean up on extension unload
chrome.runtime.onSuspend.addListener(() => {
    if (periodicSyncTimer) {
        clearInterval(periodicSyncTimer);
        periodicSyncTimer = null;
    }
    if (tokenRefreshTimer) {
        clearInterval(tokenRefreshTimer);
        tokenRefreshTimer = null;
    }
    console.log('Extension suspended');
});
