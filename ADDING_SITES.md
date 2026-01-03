# Adding Support for New Sites

This extension uses a centralized configuration system for managing supported sites. To add support for a new messaging platform, follow these steps:

## 1. Update config.js

Open `extension/config.js` and add a new entry to the `SUPPORTED_SITES` array:

```javascript
export const SUPPORTED_SITES = [
    {
        domain: 'messenger.com',
        urlPattern: '*://*.messenger.com/*',
        checkUrl: (url) => url.includes('messenger.com')
    },
    {
        domain: 'facebook.com',
        urlPattern: '*://*.facebook.com/messages/t/*',
        checkUrl: (url) => url.includes('facebook.com') && url.includes('/messages/')
    },
    // Add your new site here:
    {
        domain: 'example.com',
        urlPattern: '*://*.example.com/chat/*',
        checkUrl: (url) => url.includes('example.com') && url.includes('/chat/')
    }
];
```

### Site Configuration Properties

- **domain**: The primary domain name (for display purposes)
- **urlPattern**: The match pattern for manifest.json (must follow Chrome extension URL pattern format)
- **checkUrl**: A function that takes a URL string and returns true if it's a supported page

## 2. Update manifest.json

After updating `config.js`, you need to manually update `manifest.json` to include the new URL patterns in the content scripts section:

1. Run the helper script to see the patterns:
   ```bash
   node extension/manifestHelper.js
   ```

2. Copy the generated patterns and update `manifest.json`:
   ```json
   "content_scripts": [
       {
           "matches": [
               "*://*.messenger.com/*",
               "*://*.facebook.com/messages/t/*",
               "*://*.example.com/chat/*"
           ],
           "js": ["content.js"],
           "css": ["styles.css"]
       }
   ]
   ```

## 3. Reload the Extension

1. Go to `chrome://extensions/`
2. Enable "Developer mode"
3. Click the "Reload" button on your extension
4. Navigate to the new supported site to test

## 4. Test the Integration

Verify that:
- The extension icon becomes active on the new site
- Clicking the extension icon toggles the UI
- The saved messages panel appears and functions correctly
- Messages are saved and retrieved properly for the new site

## How It Works

The extension uses the configuration in two ways:

1. **background.js**: Uses `isSupportedSite()` to check if the current tab URL should activate the extension
2. **manifest.json**: Defines where the content scripts are injected (must be updated manually)

This dual approach ensures:
- Content scripts are only loaded on relevant pages (performance)
- Runtime checks validate URLs before attempting to interact with them (security)
- Easy maintenance with a single source of truth for site definitions

## Example: Adding Discord Support

```javascript
// In config.js
{
    domain: 'discord.com',
    urlPattern: '*://*.discord.com/channels/*',
    checkUrl: (url) => url.includes('discord.com') && url.includes('/channels/')
}
```

Then update manifest.json to include `"*://*.discord.com/channels/*"` in the matches array.

## Notes

- URL patterns must follow Chrome extension format: https://developer.chrome.com/docs/extensions/mv3/match_patterns/
- The `checkUrl` function should be as specific as possible to avoid activating on non-chat pages
- Always test thoroughly on the new platform before releasing
- Some sites may require additional modifications to content.js to handle their specific DOM structure
