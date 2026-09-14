const test = require('node:test');
const assert = require('node:assert/strict');
const { createNotionMirror } = require('../src/notionMirror.cjs');

function jsonResponse(status, body) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async text() { return JSON.stringify(body); }
  };
}

function makeFetch(responses, calls) {
  return async (url, options = {}) => {
    calls.push({ url, options, body: options.body ? JSON.parse(options.body) : undefined });
    const next = responses.shift();
    if (!next) throw new Error(`No mock response for ${url}`);
    return jsonResponse(next.status ?? 200, next.body ?? {});
  };
}

test('normalizeManual maps fallback values and summary deterministically', () => {
  const mirror = createNotionMirror({ apiKey: 'k', dataSourceId: 'ds', fetchImpl: async () => { throw new Error('unused'); } });
  const longFact = '  확인된   사실 '.repeat(20);
  const normalized = mirror.normalizeManual('abc123', {
    title: ' 테스트 업무 ', category: '알수없음', priority: '중간', status: '???',
    confirmedFact: longFact, proposal: '제안', createdBy: 'dashboard',
    updatedAt: { toDate: () => new Date('2026-09-15T01:02:03.000Z') }
  });
  assert.equal(normalized.id, 'abc123');
  assert.equal(normalized.title, '테스트 업무');
  assert.equal(normalized.category, '기타');
  assert.equal(normalized.priority, '중');
  assert.equal(normalized.status, '검토중');
  assert.equal(normalized.createdVia, '대시보드');
  assert.equal(normalized.sourceUpdatedAt, '2026-09-15T01:02:03.000Z');
  assert.ok(normalized.summary.length <= 120);
  assert.ok(normalized.summary.startsWith('확인된 사실'));
});

test('upsertManual creates a page when Firebase ID is absent', async () => {
  const calls = [];
  const fetchImpl = makeFetch([
    { body: { results: [] } },
    { body: { id: 'new-page' } }
  ], calls);
  const mirror = createNotionMirror({ apiKey: 'secret', dataSourceId: 'ds123', fetchImpl, now: () => new Date('2026-09-15T02:00:00.000Z') });
  const result = await mirror.upsertManual('fire-1', {
    title: '날짜도장 주문', category: '비품관리', priority: '보통', status: '반영완료',
    currentProblem: '어디서 사는지 모름', confirmedFact: '휴베이스몰에서 주문', proposal: '주문 절차 고정', createdBy: 'assistant'
  });
  assert.equal(result.action, 'created');
  assert.equal(calls.length, 2);
  assert.equal(calls[0].url, 'https://api.notion.com/v1/data_sources/ds123/query');
  assert.deepEqual(calls[0].body.filter, { property: 'Firebase ID', rich_text: { equals: 'fire-1' } });
  assert.equal(calls[1].url, 'https://api.notion.com/v1/pages');
  assert.equal(calls[1].body.parent.data_source_id, 'ds123');
  assert.equal(calls[1].body.properties['업무명'].title[0].text.content, '날짜도장 주문');
  assert.equal(calls[1].body.properties['작성 경로'].select.name, '업무비서');
  assert.equal(calls[1].body.properties['동기화 상태'].select.name, '동기화완료');
  for (const call of calls) assert.equal(call.options.headers['Notion-Version'], '2026-03-11');
});

test('upsertManual updates an existing page', async () => {
  const calls = [];
  const mirror = createNotionMirror({
    apiKey: 'secret', dataSourceId: 'ds',
    fetchImpl: makeFetch([{ body: { results: [{ id: 'page-7' }] } }, { body: { id: 'page-7' } }], calls),
    now: () => new Date('2026-09-15T03:00:00.000Z')
  });
  const result = await mirror.upsertManual('fire-7', { title: '업무', category: '일반약' });
  assert.equal(result.action, 'updated');
  assert.equal(calls[1].url, 'https://api.notion.com/v1/pages/page-7');
  assert.equal(calls[1].options.method, 'PATCH');
});

test('trashManual trashes the matching page and is a no-op when missing', async () => {
  const calls1 = [];
  const mirror1 = createNotionMirror({ apiKey: 'k', dataSourceId: 'ds', fetchImpl: makeFetch([{ body: { results: [{ id: 'p1' }] } }, { body: { id: 'p1', in_trash: true } }], calls1) });
  const trashed = await mirror1.trashManual('fire-x');
  assert.equal(trashed.action, 'trashed');
  assert.deepEqual(calls1[1].body, { in_trash: true });

  const calls2 = [];
  const mirror2 = createNotionMirror({ apiKey: 'k', dataSourceId: 'ds', fetchImpl: makeFetch([{ body: { results: [] } }], calls2) });
  const missing = await mirror2.trashManual('none');
  assert.equal(missing.action, 'missing');
  assert.equal(calls2.length, 1);
});

test('Notion API failures reject with status and endpoint', async () => {
  const mirror = createNotionMirror({ apiKey: 'k', dataSourceId: 'ds', fetchImpl: async () => jsonResponse(429, { message: 'rate limited' }) });
  await assert.rejects(() => mirror.upsertManual('x', { title: 't' }), /429.*data_sources\/ds\/query/);
});

test('duplicate Firebase IDs in Notion fail instead of silently choosing one', async () => {
  const mirror = createNotionMirror({ apiKey: 'k', dataSourceId: 'ds', fetchImpl: makeFetch([{ body: { results: [{ id: 'a' }, { id: 'b' }] } }], []) });
  await assert.rejects(() => mirror.upsertManual('dup', { title: 't' }), /duplicate/i);
});
