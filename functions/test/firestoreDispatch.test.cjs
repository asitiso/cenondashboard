const test = require('node:test');
const assert = require('node:assert/strict');
const { dispatchManualWrite } = require('../src/firestoreDispatch.cjs');

test('dispatchManualWrite upserts when after snapshot exists', async () => {
  const calls = [];
  const mirror = {
    async upsertManual(id, data) { calls.push(['upsert', id, data]); return { action: 'updated' }; },
    async trashManual(id) { calls.push(['trash', id]); }
  };
  const after = { exists: true, data: () => ({ title: '업무' }) };
  const result = await dispatchManualWrite({ mirror, id: 'abc', after });
  assert.deepEqual(calls, [['upsert', 'abc', { title: '업무' }]]);
  assert.equal(result.action, 'updated');
});

test('dispatchManualWrite trashes when after snapshot is missing/deleted', async () => {
  const calls = [];
  const mirror = {
    async upsertManual(id, data) { calls.push(['upsert', id, data]); },
    async trashManual(id) { calls.push(['trash', id]); return { action: 'trashed' }; }
  };
  const result = await dispatchManualWrite({ mirror, id: 'abc', after: { exists: false } });
  assert.deepEqual(calls, [['trash', 'abc']]);
  assert.equal(result.action, 'trashed');
});
