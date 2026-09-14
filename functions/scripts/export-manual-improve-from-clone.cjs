#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { fetchManualImproveFromClone } = require('../src/cloneExport.cjs');

async function main() {
  const databaseId = process.argv[2];
  const outputPath = process.argv[3];
  const projectId = process.env.FIREBASE_PROJECT_ID || 'todaysell-d4bbc';

  if (!databaseId || !outputPath) {
    throw new Error('Usage: node functions/scripts/export-manual-improve-from-clone.cjs <clone-database-id> <output.jsonl>');
  }
  if (databaseId === '(default)') {
    throw new Error('Refusing to export from (default). Create a temporary Firestore clone first.');
  }

  const accessToken = process.env.GCLOUD_ACCESS_TOKEN || execFileSync(
    'gcloud', ['auth', 'print-access-token'], { encoding: 'utf8' }
  ).trim();

  const records = await fetchManualImproveFromClone({
    projectId,
    databaseId,
    accessToken
  });

  const resolved = path.resolve(outputPath);
  const jsonl = records.map((record) => JSON.stringify(record)).join('\n') + (records.length ? '\n' : '');
  fs.writeFileSync(resolved, jsonl, 'utf8');
  console.log(`Exported ${records.length} manual_improve records from clone ${databaseId} to ${resolved}`);
}

main().catch((error) => {
  console.error(error.stack || error.message || error);
  process.exitCode = 1;
});
