#!/usr/bin/env node
/*
 * Writes google-key.json from GOOGLE_CREDENTIALS_JSON at startup.
 * Accepts either raw JSON or base64-encoded JSON in the env var.
 * A no-op (exits 0) if the env var is absent so local dev with a file-based
 * key keeps working.
 */
const fs = require('fs');
const path = require('path');

const raw = process.env.GOOGLE_CREDENTIALS_JSON;
const outPath = path.resolve(process.cwd(), 'google-key.json');

if (!raw) {
  if (fs.existsSync(outPath)) {
    console.log('[write-gcloud-key] GOOGLE_CREDENTIALS_JSON not set; using existing google-key.json');
  } else {
    console.warn('[write-gcloud-key] GOOGLE_CREDENTIALS_JSON not set and no google-key.json on disk; TTS calls will fail until one is provided.');
  }
  process.exit(0);
}

let decoded = raw.trim();
if (!decoded.startsWith('{')) {
  try {
    decoded = Buffer.from(decoded, 'base64').toString('utf8');
  } catch (error) {
    console.error('[write-gcloud-key] Failed to base64-decode GOOGLE_CREDENTIALS_JSON:', error.message);
    process.exit(1);
  }
}

try {
  JSON.parse(decoded);
} catch (error) {
  console.error('[write-gcloud-key] GOOGLE_CREDENTIALS_JSON is not valid JSON:', error.message);
  process.exit(1);
}

fs.writeFileSync(outPath, decoded, { mode: 0o600 });
console.log(`[write-gcloud-key] Wrote ${outPath}`);
