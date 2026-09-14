const test = require('node:test');
const assert = require('node:assert/strict');
const { parseJsonl, runBackfill } = require('../src/backfill.cjs');

test('parseJsonl ignores blank lines and preserves records', () => {
  const rows = parseJsonl('\n{"id":"a","data":{"title":"A"}}\n  \n{"id":"b","data":{"title":"B"}}\n');
  assert.deepEqual(rows.map((row) => row.id), ['a', 'b']);
});

test('parseJsonl reports malformed JSON with 1-based line number', () => {
  assert.throws(() => parseJsonl('{"id":"a","data":{}}\nnot-json\n'), /line 2/i);
});

test('parseJsonl reports missing id/data with line number', () => {
  assert.throws(() => parseJsonl('{"data":{}}\n'), /line 1.*id/i);
  assert.throws(() => parseJsonl('{"id":"a"}\n'), /line 1.*data/i);
});

test('runBackfill processes records sequentially', async () => {
  let active = 0;
  let maxActive = 0;
  const seen = [];
  const mirror = {
    async upsertManual(id, data) {
      active += 1;
      maxActive = Math.max(maxActive, active);
      await new Promise((resolve) => setTimeout(resolve, 5));
      seen.push([id, data.title]);
      active -= 1;
      return { action: 'created', pageId: `p-${id}` };
    }
  };
  const result = await runBackfill({
    text: '{"id":"a","data":{"title":"A"}}\n{"id":"b","data":{"title":"B"}}\n',
    mirror
  });
  assert.equal(maxActive, 1);
  assert.deepEqual(seen, [['a', 'A'], ['b', 'B']]);
  assert.equal(result.processed, 2);
});
