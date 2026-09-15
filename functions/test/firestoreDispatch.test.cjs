const test = require('node:test');
const assert = require('node:assert/strict');
const { dispatchManualWrite } = require('../src/firestoreDispatch.cjs');
const { canonicalFromFirestore, hashCanonical } = require('../src/canonical.cjs');

test('dispatchManualWrite upserts changed Firebase data and records hash', async () => {
  const calls = [];
  const stateStore = {
    async get() { return null; },
    async set(id, state) { calls.push(['state', id, state]); }
  };
  const mirror = {
    async upsertManual(id, data) { calls.push(['upsert', id, data]); return { action: 'updated', pageId: 'p1' }; }
  };
  const after = { exists: true, data: () => ({ title: '업무' }) };
  const result = await dispatchManualWrite({ mirror, stateStore, id: 'abc', after });
  assert.equal(calls[0][0], 'upsert');
  assert.equal(calls[1][0], 'state');
  assert.equal(calls[1][2].lastSource, 'firebase');
  assert.equal(result.action, 'updated');
});

test('dispatchManualWrite skips the bounce when the canonical hash already matches', async () => {
  let called = 0;
  const data = { title: '업무', category: '기타' };
  const stateStore = {
    async get() { return { lastSyncedHash: hashCanonical(canonicalFromFirestore('abc', data)) }; },
    async set() { throw new Error('should not set'); }
  };
  const mirror = { async upsertManual() { called += 1; } };
  const result = await dispatchManualWrite({ mirror, stateStore, id: 'abc', after: { exists: true, data: () => data } });
  assert.equal(result.action, 'skipped');
  assert.equal(called, 0);
});

test('dispatchManualWrite does not auto-delete Notion when Firebase document is deleted', async () => {
  const stateStore = { async get() { return null; }, async set() {} };
  const mirror = { async upsertManual() { throw new Error('should not upsert'); } };
  const result = await dispatchManualWrite({ mirror, stateStore, id: 'abc', after: { exists: false } });
  assert.equal(result.action, 'delete-ignored');
});
