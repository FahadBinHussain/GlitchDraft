// config.js - Centralized configuration for supported sites

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
    {
        domain: 'hostseba.com',
        urlPattern: '*://*.hostseba.com/register.php*',
        checkUrl: (url) => url.includes('hostseba.com') && url.includes('/register.php')
    }
];

// Helper function to check if current URL is a supported site
export function isSupportedSite(url) {
    return SUPPORTED_SITES.some(site => site.checkUrl(url));
}

// Helper function to get all URL patterns for manifest
export function getUrlPatterns() {
    return SUPPORTED_SITES.map(site => site.urlPattern);
}

// Helper function to get domain list for display
export function getDomainList() {
    return SUPPORTED_SITES.map(site => site.domain);
}
