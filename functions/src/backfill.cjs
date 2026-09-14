function parseJsonl(text) {
  if (typeof text !== 'string') throw new Error('JSONL text is required');
  const records = [];
  text.split(/\r?\n/).forEach((line, index) => {
    const trimmed = line.trim();
    if (!trimmed) return;
    let record;
    try {
      record = JSON.parse(trimmed);
    } catch (error) {
      throw new Error(`Invalid JSONL at line ${index + 1}: ${error.message}`);
    }
    if (!record || typeof record.id !== 'string' || !record.id.trim()) {
      throw new Error(`Invalid JSONL at line ${index + 1}: id is required`);
    }
    if (!record.data || typeof record.data !== 'object' || Array.isArray(record.data)) {
      throw new Error(`Invalid JSONL at line ${index + 1}: data object is required`);
    }
    records.push({ id: record.id.trim(), data: record.data });
  });
  return records;
}

async function runBackfill({ text, mirror, onProgress = () => {}, delayMs = 0 }) {
  if (!mirror || typeof mirror.upsertManual !== 'function') throw new Error('mirror.upsertManual is required');
  const records = parseJsonl(text);
  const counts = { processed: 0, created: 0, updated: 0 };
  for (const record of records) {
    const result = await mirror.upsertManual(record.id, record.data);
    counts.processed += 1;
    if (result.action === 'created') counts.created += 1;
    if (result.action === 'updated') counts.updated += 1;
    onProgress({ ...counts, id: record.id, action: result.action });
    if (delayMs > 0 && counts.processed < records.length) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
  return counts;
}

module.exports = { parseJsonl, runBackfill };
