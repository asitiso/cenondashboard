#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');
const { createNotionMirror } = require('../src/notionMirror.cjs');
const { runBackfill } = require('../src/backfill.cjs');

async function main() {
  const inputPath = process.argv[2];
  if (!inputPath) {
    throw new Error('Usage: node functions/scripts/backfill-from-jsonl.cjs <snapshot.jsonl>');
  }

  const apiKey = process.env.NOTION_API_KEY;
  const dataSourceId = process.env.NOTION_DATA_SOURCE_ID;
  if (!apiKey) throw new Error('NOTION_API_KEY environment variable is required');
  if (!dataSourceId) throw new Error('NOTION_DATA_SOURCE_ID environment variable is required');

  const resolved = path.resolve(inputPath);
  const text = fs.readFileSync(resolved, 'utf8');
  const mirror = createNotionMirror({ apiKey, dataSourceId });
  const delayMs = Number(process.env.NOTION_BACKFILL_DELAY_MS || 750);

  const result = await runBackfill({
    text,
    mirror,
    delayMs: Number.isFinite(delayMs) && delayMs >= 0 ? delayMs : 750,
    onProgress(progress) {
      console.log(`[${progress.processed}] ${progress.id}: ${progress.action}`);
    }
  });

  console.log('Backfill complete', result);
}

main().catch((error) => {
  console.error(error.stack || error.message || error);
  process.exitCode = 1;
});
