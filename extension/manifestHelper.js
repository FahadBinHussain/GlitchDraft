// manifestHelper.js - Helper to generate manifest patterns from config
// This file helps maintain consistency between config.js and manifest.json

import { getUrlPatterns, getDomainList } from './config.js';

console.log('=== Manifest Content Scripts Patterns ===');
console.log('Copy these patterns to manifest.json content_scripts.matches:');
console.log(JSON.stringify(getUrlPatterns(), null, 4));

console.log('\n=== Supported Domains ===');
console.log('Supported sites:', getDomainList().join(', '));

console.log('\n=== Instructions ===');
console.log('1. Update SUPPORTED_SITES in config.js to add/remove sites');
console.log('2. Run this script to get the new patterns');
console.log('3. Update manifest.json content_scripts.matches array');
console.log('4. Reload the extension in Chrome');
