// driveService.js - Google Drive API Service for GlitchDraft Extension

class DriveService {
    constructor() {
        this.appFolderName = "GlitchDraft";
        this.appFolderId = null;
        this.authToken = null;
        this.refreshToken = null;
        // Load saved tokens on initialization
        this.loadSavedTokens();
    }

    async loadSavedTokens() {
        try {
            const data = await chrome.storage.local.get(['authToken', 'refreshToken', 'tokenExpiry']);
            if (data.authToken) {
                this.authToken = data.authToken;
                this.refreshToken = data.refreshToken;
                this.tokenExpiry = data.tokenExpiry;
                console.log('Loaded saved auth tokens');
                
                // Check if token is expired and refresh if needed
                if (this.tokenExpiry && Date.now() >= this.tokenExpiry) {
                    console.log('Token expired, refreshing...');
                    await this.refreshAccessToken();
                }
            }
        } catch (error) {
            console.error('Error loading saved tokens:', error);
        }
    }

    // Authentication Function
    async getAuthToken(interactive = false) {
        try {
            console.log("Getting auth token, interactive:", interactive);

            // Check if we have a valid token
            if (this.authToken && this.tokenExpiry && Date.now() < this.tokenExpiry) {
                console.log('Using cached valid token');
                return this.authToken;
            }

            // If token expired and we're not in interactive mode, return null
            // This will allow the caller to decide whether to prompt the user
            if (!interactive && this.tokenExpiry && Date.now() >= this.tokenExpiry) {
                console.log('Token expired, interactive auth required');
                return null;
            }

            // Detect browser type
            const isChrome = navigator.userAgent.includes('Chrome') && !navigator.userAgent.includes('Edge');
            console.log("Browser detection: Chrome =", isChrome);

            const manifest = chrome.runtime.getManifest();
            const clientId = manifest.oauth2.client_id;
            const scopes = manifest.oauth2.scopes.join(' ');

            let token;
            let expiresIn = 3600; // Default 1 hour

            if (isChrome) {
                // Chrome-specific approach: Open a tab for authentication
                console.log("Using Chrome-specific authentication approach");
                const authResult = await this.chromeTabAuth(clientId, scopes, interactive);
                token = authResult.access_token;
                expiresIn = authResult.expires_in || 3600;
            } else {
                // Edge and other browsers: Use web auth flow
                console.log("Using standard web auth flow for non-Chrome browsers");
                const redirectUri = chrome.identity.getRedirectURL("oauth2");
                console.log("Using redirect URI:", redirectUri);

                let authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
                authUrl.searchParams.append('client_id', clientId);
                authUrl.searchParams.append('redirect_uri', redirectUri);
                authUrl.searchParams.append('response_type', 'token');
                authUrl.searchParams.append('scope', scopes);
                authUrl.searchParams.append('prompt', interactive ? 'consent' : 'none');

                const authResult = await new Promise((resolve, reject) => {
                    const options = {
                        url: authUrl.href,
                        interactive: interactive
                    };

                    // Add Edge-specific options
                    if (!interactive) {
                        options.abortOnLoadForNonInteractive = true;
                        options.timeoutMsForNonInteractive = 30000;
                    }

                    chrome.identity.launchWebAuthFlow(options, (responseUrl) => {
                        if (chrome.runtime.lastError) {
                            console.error("launchWebAuthFlow failed:", chrome.runtime.lastError.message);
                            reject(new Error(`Authentication failed: ${chrome.runtime.lastError.message}`));
                            return;
                        }

                        if (!responseUrl) {
                            reject(new Error("Could not get token. User may have cancelled the login flow."));
                            return;
                        }

                        // The token is in the URL fragment.
                        const url = new URL(responseUrl);
                        const params = new URLSearchParams(url.hash.substring(1)); // remove the '#'
                        const accessToken = params.get('access_token');
                        const expires = params.get('expires_in');

                        if (accessToken) {
                            console.log("Auth token received successfully.");
                            resolve({
                                access_token: accessToken,
                                expires_in: parseInt(expires) || 3600
                            });
                        } else {
                            console.error("Could not extract token from response URL.");
                            reject(new Error("Could not extract token from response."));
                        }
                    });
                });
                
                token = authResult.access_token;
                expiresIn = authResult.expires_in;
            }

            if (token) {
                this.authToken = token;
                // Set expiry to 50 minutes (tokens usually last 1 hour, we refresh 10 min early)
                this.tokenExpiry = Date.now() + (Math.min(expiresIn, 3600) * 1000) - 600000;
                
                // Save token to storage
                await chrome.storage.local.set({ 
                    authToken: token,
                    tokenExpiry: this.tokenExpiry
                });
                console.log("Auth token obtained and saved successfully, expires in:", expiresIn, "seconds");
                return token;
            } else {
                throw new Error("Failed to get auth token");
            }
        } catch (error) {
            console.error("Authentication error:", error);
            throw new Error(`Authentication failed: ${error.message}`);
        }
    }

    // Refresh access token by re-authenticating
    async refreshAccessToken() {
        try {
            console.log('Refreshing access token with interactive auth...');
            
            // Clear expired token
            await this.clearAuthToken();
            
            // Get new token with interactive flow
            return await this.getAuthToken(true);
        } catch (error) {
            console.error('Token refresh failed:', error);
            throw error;
        }
    }

    // App Folder Management
    async getAppFolderId() {
        console.log("Getting app folder ID...");

        // Ensure we have auth token first
        if (!this.authToken) {
            console.log("No auth token, getting one...");
            await this.getAuthToken(true);
        }

        // Check if we have cached folder ID
        const cached = await chrome.storage.local.get(['appFolderId']);
        if (cached.appFolderId) {
            console.log("Found cached folder ID:", cached.appFolderId);
            this.appFolderId = cached.appFolderId;

            // Verify the folder still exists
            try {
                console.log("Verifying cached folder exists...");
                const response = await fetch(`https://www.googleapis.com/drive/v3/files/${this.appFolderId}`, {
                    headers: {
                        'Authorization': `Bearer ${this.authToken}`
                    }
                });

                if (response.ok) {
                    console.log("Found existing app folder:", this.appFolderId);
                    return this.appFolderId;
                } else {
                    // Folder doesn't exist, clear cache and create new one
                    console.log("Cached folder not found (status:", response.status, "), creating new one...");
                    await chrome.storage.local.remove(['appFolderId']);
                    this.appFolderId = null;
                }
            } catch (error) {
                console.error("Error verifying folder:", error);
                // Clear cache and create new folder
                await chrome.storage.local.remove(['appFolderId']);
                this.appFolderId = null;
            }
        } else {
            console.log("No cached folder ID found");
        }

        try {
            console.log("Searching for existing folder...");
            // Search for existing folder
            const searchUrl = `https://www.googleapis.com/drive/v3/files?q=name='${this.appFolderName}' and mimeType='application/vnd.google-apps.folder' and trashed=false`;

            const response = await fetch(searchUrl, {
                headers: {
                    'Authorization': `Bearer ${this.authToken}`
                }
            });

            if (!response.ok) {
                if (response.status === 401) {
                    await this.clearAuthToken();
                }
                throw new Error(`Search failed: ${response.status}`);
            }

            const data = await response.json();
            console.log("Search results:", data.files ? data.files.length : 0, "folders found");

            if (data.files && data.files.length > 0) {
                this.appFolderId = data.files[0].id;
                console.log("Found existing app folder:", this.appFolderId);
            } else {
                // Create new folder
                console.log("No existing folder found, creating new one...");
                this.appFolderId = await this.createAppFolder();
            }

            // Cache the folder ID
            console.log("Caching folder ID:", this.appFolderId);
            await chrome.storage.local.set({ appFolderId: this.appFolderId });
            return this.appFolderId;

        } catch (error) {
            console.error("Error getting app folder:", error);
            throw error;
        }
    }

    async createAppFolder() {
        try {
            const folderMetadata = {
                name: this.appFolderName,
                mimeType: 'application/vnd.google-apps.folder'
            };

            const response = await fetch('https://www.googleapis.com/drive/v3/files', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.authToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(folderMetadata)
            });

            if (!response.ok) {
                throw new Error(`Folder creation failed: ${response.status}`);
            }

            const folder = await response.json();
            console.log("Created new app folder:", folder.id);
            return folder.id;

        } catch (error) {
            console.error("Error creating app folder:", error);
            throw error;
        }
    }

    // Sync Functions
    async uploadSync(data) {
        try {
            const folderId = await this.getAppFolderId();

            // Use consistent filename instead of timestamp
            const jsonFileName = 'messenger_sync.json';
            await this.uploadOrUpdateJsonFile(data, jsonFileName, folderId);

            console.log('Sync data updated successfully');
        } catch (error) {
            console.error('Error uploading sync:', error);
            throw error;
        }
    }

    async uploadOrUpdateJsonFile(data, fileName, folderId) {
        try {
            // First, search for existing file
            const existingFileId = await this.findFileByName(fileName, folderId);

            const fileContent = JSON.stringify(data, null, 2);
            const metadata = {
                name: fileName,
                mimeType: 'application/json'
            };

            if (existingFileId) {
                // Update existing file
                console.log('Updating existing file:', existingFileId);
                return await this.updateFile(existingFileId, fileContent);
            } else {
                // Create new file
                console.log('Creating new file:', fileName);
                metadata.parents = [folderId];
                return await this.createFile(metadata, fileContent);
            }
        } catch (error) {
            console.error('Error uploading/updating JSON:', error);
            throw error;
        }
    }

    async findFileByName(fileName, folderId) {
        try {
            const searchUrl = `https://www.googleapis.com/drive/v3/files?q='${folderId}' in parents and name='${fileName}' and trashed=false`;

            const response = await fetch(searchUrl, {
                headers: {
                    'Authorization': `Bearer ${this.authToken}`
                }
            });

            if (!response.ok) {
                throw new Error(`Search failed: ${response.status}`);
            }

            const data = await response.json();
            if (data.files && data.files.length > 0) {
                return data.files[0].id;
            }
            return null;
        } catch (error) {
            console.error('Error finding file:', error);
            return null;
        }
    }

    async createFile(metadata, content) {
        const boundary = 'boundary';
        const multipartBody = this.createMultipartBody(metadata, content);

        const response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${this.authToken}`,
                'Content-Type': `multipart/related; boundary=${boundary}`
            },
            body: multipartBody
        });

        if (!response.ok) {
            throw new Error(`File creation failed: ${response.status}`);
        }

        const file = await response.json();
        console.log('File created:', file.id);
        return file.id;
    }

    async updateFile(fileId, content) {
        const response = await fetch(`https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`, {
            method: 'PATCH',
            headers: {
                'Authorization': `Bearer ${this.authToken}`,
                'Content-Type': 'application/json'
            },
            body: content
        });

        if (!response.ok) {
            throw new Error(`File update failed: ${response.status}`);
        }

        const file = await response.json();
        console.log('File updated:', file.id);
        return file.id;
    }

    // Helper method to create multipart body (simplified)
    createMultipartBody(metadata, content) {
        const boundary = 'boundary';
        const delimiter = `--${boundary}\r\n`;
        const closeDelimiter = `\r\n--${boundary}--`;

        let requestBody = '';

        // Metadata part
        requestBody += delimiter;
        requestBody += 'Content-Type: application/json; charset=UTF-8\r\n\r\n';
        requestBody += JSON.stringify(metadata) + '\r\n';

        // File content part
        requestBody += delimiter;
        requestBody += 'Content-Type: application/json\r\n\r\n';
        requestBody += content;
        requestBody += closeDelimiter;

        return requestBody;
    }

    // Update image upload to also use consistent naming if needed
    async uploadImageFile(imageFile, folderId) {
        try {
            const fileExtension = imageFile.name.split('.').pop();
            const baseName = imageFile.name.replace(/\.[^/.]+$/, ""); // Remove extension
            const fileName = `${baseName}.${fileExtension}`;

            // Search for existing image with same base name
            const searchUrl = `https://www.googleapis.com/drive/v3/files?q='${folderId}' in parents and name='${fileName}' and trashed=false`;

            const searchResponse = await fetch(searchUrl, {
                headers: {
                    'Authorization': `Bearer ${this.authToken}`
                }
            });

            const searchData = await searchResponse.json();

            if (searchData.files && searchData.files.length > 0) {
                // Update existing image
                const fileId = searchData.files[0].id;
                console.log('Updating existing image:', fileId);

                const formData = new FormData();
                formData.append('image', imageFile);

                const response = await fetch(`https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`, {
                    method: 'PATCH',
                    headers: {
                        'Authorization': `Bearer ${this.authToken}`,
                        'Content-Type': imageFile.type
                    },
                    body: imageFile
                });

                if (!response.ok) {
                    throw new Error(`Image update failed: ${response.status}`);
                }

                const file = await response.json();
                console.log('Image updated:', file.id);
                return file.id;
            } else {
                // Create new image file
                const metadata = {
                    name: fileName,
                    parents: [folderId]
                };

                const formData = new FormData();
                formData.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
                formData.append('file', imageFile);

                const response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${this.authToken}`
                    },
                    body: formData
                });

                if (!response.ok) {
                    throw new Error(`Image upload failed: ${response.status}`);
                }

                const file = await response.json();
                console.log('Image uploaded:', file.id);
                return file.id;
            }
        } catch (error) {
            console.error("Error uploading/updating image:", error);
            throw error;
        }
    }

    async downloadLatestSync() {
        try {
            const folderId = await this.getAppFolderId();

            // Search for sync file
            const searchUrl = `https://www.googleapis.com/drive/v3/files?q='${folderId}' in parents and name='messenger_sync.json' and trashed=false`;

            const response = await fetch(searchUrl, {
                headers: {
                    'Authorization': `Bearer ${this.authToken}`
                }
            });

            if (!response.ok) {
                throw new Error(`Search failed: ${response.status}`);
            }

            const data = await response.json();
            if (!data.files || data.files.length === 0) {
                return null;
            }

            // Download the sync file
            const fileId = data.files[0].id;
            const syncData = await this.downloadFile(fileId);
            return syncData;

        } catch (error) {
            console.error('Error downloading sync:', error);
            return null;
        }
    }

    // Get file metadata without downloading content (for efficient change detection)
    async getFileMetadata(fileId) {
        try {
            const response = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?fields=id,name,modifiedTime,size`, {
                headers: {
                    'Authorization': `Bearer ${this.authToken}`
                }
            });

            if (!response.ok) {
                if (response.status === 401) {
                    await this.clearAuthToken();
                }
                throw new Error(`Metadata fetch failed: ${response.status}`);
            }

            return await response.json();
        } catch (error) {
            console.error('Error getting file metadata:', error);
            throw error;
        }
    }

    // Get sync file metadata for quick change detection
    async getSyncFileMetadata() {
        try {
            const folderId = await this.getAppFolderId();

            // Search for sync file with minimal fields
            const searchUrl = `https://www.googleapis.com/drive/v3/files?q='${folderId}' in parents and name='messenger_sync.json' and trashed=false&fields=files(id,modifiedTime)`;

            const response = await fetch(searchUrl, {
                headers: {
                    'Authorization': `Bearer ${this.authToken}`
                }
            });

            if (!response.ok) {
                if (response.status === 401) {
                    await this.clearAuthToken();
                }
                throw new Error(`Search failed: ${response.status}`);
            }

            const data = await response.json();
            if (!data.files || data.files.length === 0) {
                return null;
            }

            return data.files[0];
        } catch (error) {
            console.error('Error getting sync file metadata:', error);
            return null;
        }
    }

    async uploadJsonFile(metadata, fileName, folderId) {
        try {
            const fileContent = JSON.stringify(metadata, null, 2);

            const metadataObj = {
                name: fileName,
                parents: [folderId],
                mimeType: 'application/json'
            };

            const boundary = 'boundary';
            const delimiter = `--${boundary}\r\n`;
            const closeDelimiter = `\r\n--${boundary}--`;

            // Build multipart body
            let requestBody = '';

            // Metadata part
            requestBody += delimiter;
            requestBody += 'Content-Type: application/json; charset=UTF-8\r\n\r\n';
            requestBody += JSON.stringify(metadataObj) + '\r\n';

            // File content part
            requestBody += delimiter;
            requestBody += 'Content-Type: application/json\r\n\r\n';
            requestBody += fileContent;
            requestBody += closeDelimiter;

            const response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.authToken}`,
                    'Content-Type': `multipart/related; boundary=${boundary}`
                },
                body: requestBody
            });

            if (!response.ok) {
                throw new Error(`JSON upload failed: ${response.status}`);
            }

            const file = await response.json();
            console.log("JSON file uploaded:", file.id);
            return file.id;

        } catch (error) {
            console.error("Error uploading JSON:", error);
            throw error;
        }
    }



    // Download file helper
    async downloadFile(fileId) {
        try {
            const response = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
                headers: {
                    'Authorization': `Bearer ${this.authToken}`
                }
            });

            if (!response.ok) {
                throw new Error(`Download failed: ${response.status}`);
            }

            const text = await response.text();
            return JSON.parse(text);

        } catch (error) {
            console.error('Error downloading file:', error);
            throw error;
        }
    }

    async downloadTextFile(fileId) {
        try {
            const response = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
                headers: {
                    'Authorization': `Bearer ${this.authToken}`
                }
            });

            if (!response.ok) {
                throw new Error(`Download failed: ${response.status}`);
            }

            const text = await response.text();
            return text.trim(); // Return plain text, not JSON

        } catch (error) {
            console.error('Error downloading text file:', error);
            throw error;
        }
    }

    async deleteFile(fileId) {
        try {
            const response = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${this.authToken}`
                }
            });

            if (!response.ok) {
                throw new Error(`Delete failed: ${response.status}`);
            }

            console.log("File deleted:", fileId);
        } catch (error) {
            console.error("Error deleting file:", error);
            throw error;
        }
    }

    // Check if user is authenticated
    async isAuthenticated() {
        try {
            // First check if token exists and is not expired
            if (!this.authToken) {
                console.log('No auth token available');
                return false;
            }

            // Check token expiry before making API call
            if (this.tokenExpiry && Date.now() >= this.tokenExpiry) {
                console.log('Token expired, attempting refresh...');
                try {
                    await this.getAuthToken(false); // Try non-interactive refresh
                    return this.authToken !== null;
                } catch (error) {
                    console.error('Token refresh failed:', error);
                    return false;
                }
            }

            // Verify token is still valid with a test API call
            const response = await fetch('https://www.googleapis.com/drive/v3/about?fields=user', {
                headers: {
                    'Authorization': `Bearer ${this.authToken}`
                }
            });

            if (!response.ok) {
                if (response.status === 401) {
                    console.log('Token invalid (401), clearing and attempting refresh...');
                    await this.clearAuthToken();
                    try {
                        await this.getAuthToken(false);
                        return this.authToken !== null;
                    } catch (error) {
                        return false;
                    }
                }
                return false;
            }

            return true;
        } catch (error) {
            console.error('Error checking authentication:', error);
            return false;
        }
    }

    // Force authentication (for when user explicitly requests it)
    async forceAuthentication() {
        try {
            await this.getAuthToken(true);
            return true;
        } catch (error) {
            console.error('Force authentication failed:', error);
            return false;
        }
    }

    // Clear cached folder ID and force recreation
    async clearCachedFolder() {
        try {
            await chrome.storage.local.remove(['appFolderId']);
            this.appFolderId = null;
            console.log('Cleared cached folder ID');
        } catch (error) {
            console.error('Error clearing cached folder:', error);
        }
    }

    // Clear auth token when it becomes invalid
    async clearAuthToken() {
        try {
            await chrome.storage.local.remove(['authToken', 'tokenExpiry', 'refreshToken']);
            this.authToken = null;
            this.tokenExpiry = null;
            this.refreshToken = null;
            console.log('Cleared auth tokens');
        } catch (error) {
            console.error('Error clearing auth tokens:', error);
        }
    }

    // Chrome-specific authentication using tabs
    async chromeTabAuth(clientId, scopes, interactive) {
        if (!interactive) {
            console.log("Non-interactive auth requested, but Chrome requires interactive auth");
            return null;
        }

        console.log("Starting Chrome tab authentication");
        return new Promise((resolve, reject) => {
            // Create the auth URL
            const redirectUri = chrome.identity.getRedirectURL();
            console.log("Chrome auth redirect URI:", redirectUri);

            const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
            authUrl.searchParams.append('client_id', clientId);
            authUrl.searchParams.append('redirect_uri', redirectUri);
            authUrl.searchParams.append('response_type', 'token');
            authUrl.searchParams.append('scope', scopes);
            authUrl.searchParams.append('prompt', 'consent');

            // Create a tab to handle the OAuth flow
            chrome.tabs.create({ url: authUrl.toString() }, (tab) => {
                console.log("Auth tab created with ID:", tab.id);

                // Listen for URL changes in the tab
                const tabUpdateListener = (tabId, changeInfo) => {
                    // Only process if it's our auth tab and URL has changed
                    if (tabId !== tab.id || !changeInfo.url) return;

                    // Check if the URL contains the access token
                    if (changeInfo.url.includes(redirectUri) && changeInfo.url.includes('access_token=')) {
                        console.log("Detected redirect with token");

                        // Extract the token
                        const url = new URL(changeInfo.url);
                        const params = new URLSearchParams(url.hash.substring(1));
                        const accessToken = params.get('access_token');
                        const expiresIn = params.get('expires_in');

                        if (accessToken) {
                            // Clean up
                            chrome.tabs.onUpdated.removeListener(tabUpdateListener);
                            chrome.tabs.remove(tab.id);

                            console.log("Successfully obtained token via Chrome tab");
                            resolve({
                                access_token: accessToken,
                                expires_in: parseInt(expiresIn) || 3600
                            });
                        }
                    }
                };

                // Add the listener
                chrome.tabs.onUpdated.addListener(tabUpdateListener);

                // Set a timeout to prevent hanging
                setTimeout(() => {
                    chrome.tabs.onUpdated.removeListener(tabUpdateListener);
                    chrome.tabs.remove(tab.id);
                    reject(new Error("Authentication timed out after 2 minutes"));
                }, 120000); // 2 minutes timeout
            });
        });
    }

    // Force folder recreation (for testing)
    async forceFolderRecreation() {
        try {
            console.log('Forcing folder recreation...');
            await this.clearCachedFolder();
            const newFolderId = await this.getAppFolderId();
            console.log('New folder created with ID:', newFolderId);
            return newFolderId;
        } catch (error) {
            console.error('Error forcing folder recreation:', error);
            throw error;
        }
    }
}

// Export the service instance
export const driveService = new DriveService();
