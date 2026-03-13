/**
 * GlitchDraft Firestore Migration Script
 *
 * PURPOSE: Multi-step migration of Firestore draft documents:
 *
 *   Phase 1 (legacy → v1):
 *     Rename bare numeric IDs ("410625012") → "messenger_410625012"
 *
 *   Phase 2 (v1 → v2, CURRENT):
 *     Rename "messenger_XXXXX" → "messenger_web_XXXXX_nameslug"
 *     using the stored `contactName` field in the document.
 *     Docs that already match "messenger_web_*" or "messenger_android_*" are skipped.
 *
 * HOW TO RUN:
 *   1. Make sure your .env file in the extension/ folder contains the Firebase
 *      config object (the same format used in the extension popup).
 *   2. Run from the extension/ folder:  pnpm migrate  (or node migrate_firestore.js)
 */

const fs = require('fs');
const path = require('path');

// Parse the .env file which contains a Firebase config JS object literal
function loadEnvConfig() {
    const envPath = path.resolve(__dirname, '.env');
    if (!fs.existsSync(envPath)) {
        console.error('[Migration] .env file not found at', envPath);
        process.exit(1);
    }
    const raw = fs.readFileSync(envPath, 'utf-8').trim();
    try {
        const cfg = new Function('return (' + raw + ')')();
        return cfg;
    } catch (e) {
        console.error('[Migration] Failed to parse .env file:', e.message);
        process.exit(1);
    }
}

/** Converts a display name to a safe Firestore doc ID slug.
 *  e.g. "Cat Fren" → "cat_fren", "فلان" → arabic kept, spaces/specials → "_"
 */
function sanitizeNameSlug(name) {
    if (!name) return '';
    return name
        .trim()
        .toLowerCase()
        .replace(/[^\p{L}\p{N}]/gu, '_')   // non-letter/digit → _
        .replace(/_+/g, '_')                // collapse multiples
        .replace(/^_|_$/g, '')              // trim edges
        .substring(0, 50);
}

const envCfg = loadEnvConfig();
const PROJECT_ID = envCfg.projectId;
const API_KEY    = envCfg.apiKey;

if (!PROJECT_ID || !API_KEY) {
    console.error('[Migration] Missing projectId or apiKey in .env');
    process.exit(1);
}

const BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;
const KEY  = `?key=${API_KEY}`;

(async function migrateMessengerDrafts() {
    console.log('[Migration] Starting Firestore migration v2...');
    console.log('[Migration] Project:', PROJECT_ID);

    // ── List all drafts ──
    const listRes = await fetch(`${BASE}/drafts${KEY}`);
    if (listRes.status === 404) {
        console.log('[Migration] No drafts collection found. Nothing to migrate.');
        return;
    }
    if (!listRes.ok) {
        console.error('[Migration] Failed to list drafts:', listRes.status, await listRes.text());
        process.exit(1);
    }
    const listData = await listRes.json();
    const docs = listData.documents || [];
    console.log(`[Migration] Found ${docs.length} draft document(s).`);

    // ──────────────────────────────────────────────────────────
    // Phase 1: bare numeric IDs → messenger_{id}
    // ──────────────────────────────────────────────────────────
    const phase1 = docs.filter(doc => /^\d+$/.test(doc.name.split('/').pop()));
    if (phase1.length > 0) {
        console.log(`\n[Phase 1] ${phase1.length} bare-numeric doc(s) to prefix with "messenger_":`);
        for (const doc of phase1) {
            const oldId = doc.name.split('/').pop();
            const newId = `messenger_${oldId}`;
            const ok = await copyAndDelete(doc.fields, oldId, newId);
            if (ok) console.log(`[Phase 1] ✅ ${oldId} → ${newId}`);
        }
    } else {
        console.log('[Phase 1] No bare-numeric docs. Skipping.');
    }

    // Re-fetch after Phase 1 changes
    const listRes2 = await fetch(`${BASE}/drafts${KEY}`);
    const docs2 = ((await listRes2.json()).documents || []);

    // ──────────────────────────────────────────────────────────
    // Phase 2: messenger_{id} → messenger_web_{id}_{nameslug}
    // ──────────────────────────────────────────────────────────
    // Match exactly "messenger_" followed by digits only (not already web/android)
    const phase2 = docs2.filter(doc => /^messenger_\d+$/.test(doc.name.split('/').pop()));

    if (phase2.length === 0) {
        console.log('\n[Phase 2] No "messenger_{id}" docs found. Migration not needed.');
    } else {
        console.log(`\n[Phase 2] ${phase2.length} doc(s) to migrate to "messenger_web_{id}_{name}" format:`);
        let migrated = 0, failed = 0, skipped = 0;

        for (const doc of phase2) {
            const oldId = doc.name.split('/').pop();
            const numericId = oldId.replace(/^messenger_/, '');

            // Get contactName from stored doc fields
            const contactName = doc.fields?.contactName?.stringValue || null;
            const slug = contactName ? sanitizeNameSlug(contactName) : '';
            const newId = slug ? `messenger_web_${numericId}_${slug}` : `messenger_web_${numericId}`;

            console.log(`[Phase 2]   ${oldId} → ${newId}  (contactName="${contactName || 'none'}")`);

            const ok = await copyAndDelete(doc.fields, oldId, newId);
            if (ok) { migrated++; console.log(`[Phase 2] ✅ Done`); }
            else { failed++; }
        }

        console.log(`\n[Phase 2] Migrated: ${migrated}, Failed: ${failed}, Skipped: ${skipped}`);
    }

    // ── Summary of current state ──
    const listFinal = await fetch(`${BASE}/drafts${KEY}`);
    const finalDocs = ((await listFinal.json()).documents || []);
    console.log(`\n[Migration] Final state — ${finalDocs.length} doc(s):`);
    finalDocs.forEach(d => console.log(`  • ${d.name.split('/').pop()}`));
    console.log('\n[Migration] Done.');
})();

async function copyAndDelete(fields, oldId, newId) {
    // Write to new ID
    const copyRes = await fetch(`${BASE}/drafts/${encodeURIComponent(newId)}${KEY}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fields })
    });
    if (!copyRes.ok) {
        console.error(`  ❌ Failed to write ${newId}:`, copyRes.status, await copyRes.text());
        return false;
    }
    // Delete old
    const delRes = await fetch(`${BASE}/drafts/${encodeURIComponent(oldId)}${KEY}`, { method: 'DELETE' });
    if (!delRes.ok) {
        console.warn(`  ⚠️  Wrote ${newId} but failed to delete ${oldId}:`, delRes.status);
    }
    return true;
}
