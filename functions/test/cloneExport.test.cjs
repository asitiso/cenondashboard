const test = require('node:test');
const assert = require('node:assert/strict');
const { decodeFirestoreValue, fetchManualImproveFromClone } = require('../src/cloneExport.cjs');

function response(body, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async text() { return JSON.stringify(body); }
  };
}

test('decodeFirestoreValue decodes common Firestore REST value types', () => {
  assert.equal(decodeFirestoreValue({ stringValue: 'hello' }), 'hello');
  assert.equal(decodeFirestoreValue({ booleanValue: true }), true);
  assert.equal(decodeFirestoreValue({ integerValue: '42' }), 42);
  assert.equal(decodeFirestoreValue({ doubleValue: 3.5 }), 3.5);
  assert.equal(decodeFirestoreValue({ timestampValue: '2026-09-15T01:02:03Z' }), '2026-09-15T01:02:03Z');
  assert.equal(decodeFirestoreValue({ nullValue: null }), null);
  assert.deepEqual(decodeFirestoreValue({ arrayValue: { values: [{ stringValue: 'a' }, { integerValue: '2' }] } }), ['a', 2]);
  assert.deepEqual(decodeFirestoreValue({ mapValue: { fields: { a: { stringValue: 'x' } } } }), { a: 'x' });
});

test('fetchManualImproveFromClone queries only manual_improve from the named clone database', async () => {
  const calls = [];
  const fetchImpl = async (url, options) => {
    calls.push({ url, options, body: JSON.parse(options.body) });
    return response([
      {
        document: {
          name: 'projects/todaysell-d4bbc/databases/notion-bootstrap/documents/manual_improve/doc%201',
          fields: {
            title: { stringValue: '날짜도장 주문' },
            priority: { stringValue: '보통' },
            updatedAt: { timestampValue: '2026-09-15T01:02:03Z' }
          }
        }
      }
    ]);
  };
  const rows = await fetchManualImproveFromClone({
    projectId: 'todaysell-d4bbc', databaseId: 'notion-bootstrap', accessToken: 'token', fetchImpl
  });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, 'https://firestore.googleapis.com/v1/projects/todaysell-d4bbc/databases/notion-bootstrap/documents:runQuery');
  assert.equal(calls[0].body.structuredQuery.from[0].collectionId, 'manual_improve');
  assert.equal(calls[0].options.headers.Authorization, 'Bearer token');
  assert.deepEqual(rows, [{ id: 'doc 1', data: { title: '날짜도장 주문', priority: '보통', updatedAt: '2026-09-15T01:02:03Z' } }]);
});

test('fetchManualImproveFromClone refuses the production default database', async () => {
  await assert.rejects(
    () => fetchManualImproveFromClone({ projectId: 'todaysell-d4bbc', databaseId: '(default)', accessToken: 'token', fetchImpl: async () => response([]) }),
    /clone|temporary|default/i
  );
});
