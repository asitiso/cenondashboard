const NOTION_VERSION = '2026-03-11';
const NOTION_BASE_URL = 'https://api.notion.com/v1';
const ALLOWED_CATEGORIES = new Set([
  '일반약', '조제', '고객응대', '주문·반품', '재고·발주', '동물약',
  '청구·보험', '매장관리', '안전관리', '비품관리', '직원교육', '응급상황', '기타'
]);
const ALLOWED_STATUSES = new Set(['검토중', '검토완료', '반영완료']);

function cleanText(value) {
  return typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : '';
}

function richText(value) {
  const text = typeof value === 'string' ? value.trim() : '';
  if (!text) return [];
  const chunks = [];
  for (let index = 0; index < text.length; index += 2000) {
    chunks.push({ type: 'text', text: { content: text.slice(index, index + 2000) } });
  }
  return chunks;
}

function toIso(value) {
  if (!value) return null;
  if (typeof value.toDate === 'function') return value.toDate().toISOString();
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value.toISOString();
  if (typeof value === 'string') {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  }
  const seconds = typeof value.seconds === 'number' ? value.seconds : value._seconds;
  if (typeof seconds === 'number') {
    const nanos = typeof value.nanoseconds === 'number' ? value.nanoseconds : (value._nanoseconds || 0);
    return new Date(seconds * 1000 + Math.floor(nanos / 1e6)).toISOString();
  }
  return null;
}

function normalizeCreatedVia(createdBy) {
  const value = cleanText(createdBy).toLowerCase();
  if (value === 'dashboard') return '대시보드';
  if (value.includes('assistant') || value.includes('gpt') || value.includes('업무비서')) return '업무비서';
  return '기타';
}

function normalizePriority(value) {
  const text = cleanText(value);
  if (text === '높음' || text === '중' || text === '보통') return text;
  if (text === '중간' || text.toLowerCase() === 'medium') return '중';
  if (text.toLowerCase() === 'high') return '높음';
  return '보통';
}

function makeSummary(data, title) {
  const source = [data.confirmedFact, data.proposal, data.currentProblem, title]
    .map(cleanText)
    .find(Boolean) || '내용 확인 필요';
  return source.length <= 120 ? source : `${source.slice(0, 117)}…`;
}

function createNotionMirror({ apiKey, dataSourceId, fetchImpl = globalThis.fetch, now = () => new Date() }) {
  if (!apiKey) throw new Error('NOTION_API_KEY is required');
  if (!dataSourceId) throw new Error('NOTION_DATA_SOURCE_ID is required');
  if (typeof fetchImpl !== 'function') throw new Error('fetch implementation is required');

  async function request(path, { method = 'GET', body } = {}) {
    const url = `${NOTION_BASE_URL}${path}`;
    const response = await fetchImpl(url, {
      method,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Notion-Version': NOTION_VERSION,
        'Content-Type': 'application/json'
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) })
    });
    const text = await response.text();
    let parsed = {};
    if (text) {
      try { parsed = JSON.parse(text); } catch { parsed = { raw: text }; }
    }
    if (!response.ok) {
      const detail = parsed?.message || parsed?.raw || 'unknown error';
      throw new Error(`Notion API ${response.status} ${path}: ${detail}`);
    }
    return parsed;
  }

  function normalizeManual(id, data = {}) {
    const title = cleanText(data.title) || '제목 없음';
    const categoryRaw = cleanText(data.category);
    const category = ALLOWED_CATEGORIES.has(categoryRaw) ? categoryRaw : '기타';
    const statusRaw = cleanText(data.status);
    const status = ALLOWED_STATUSES.has(statusRaw) ? statusRaw : '검토중';
    const sourceUpdatedAt = toIso(data.updatedAt) || toIso(data.createdAt);
    return {
      id,
      title,
      category,
      status,
      priority: normalizePriority(data.priority),
      summary: makeSummary(data, title),
      currentProblem: typeof data.currentProblem === 'string' ? data.currentProblem.trim() : '',
      confirmedFact: typeof data.confirmedFact === 'string' ? data.confirmedFact.trim() : '',
      proposal: typeof data.proposal === 'string' ? data.proposal.trim() : '',
      createdVia: normalizeCreatedVia(data.createdBy),
      sourceUpdatedAt
    };
  }

  function buildProperties(manual) {
    const syncTime = now().toISOString();
    const properties = {
      '업무명': { title: richText(manual.title) },
      '분류': { select: { name: manual.category } },
      '상태': { select: { name: manual.status } },
      '우선순위': { select: { name: manual.priority } },
      '직원용 한줄 요약': { rich_text: richText(manual.summary) },
      '현재 문제': { rich_text: richText(manual.currentProblem) },
      '확인된 사실': { rich_text: richText(manual.confirmedFact) },
      '개선 제안': { rich_text: richText(manual.proposal) },
      '작성 경로': { select: { name: manual.createdVia } },
      'Firebase ID': { rich_text: richText(manual.id) },
      '동기화 상태': { select: { name: '동기화완료' } },
      '마지막 동기화': { date: { start: syncTime } }
    };
    properties['원본 수정일'] = manual.sourceUpdatedAt
      ? { date: { start: manual.sourceUpdatedAt } }
      : { date: null };
    return properties;
  }

  async function queryByFirebaseId(id) {
    const result = await request(`/data_sources/${encodeURIComponent(dataSourceId)}/query`, {
      method: 'POST',
      body: {
        filter: { property: 'Firebase ID', rich_text: { equals: id } },
        page_size: 2,
        in_trash: false
      }
    });
    const rows = Array.isArray(result.results) ? result.results : [];
    if (rows.length > 1) throw new Error(`Notion mirror duplicate Firebase ID: ${id}`);
    return rows[0] || null;
  }

  async function upsertManual(id, data) {
    const manual = normalizeManual(id, data);
    const properties = buildProperties(manual);
    const existing = await queryByFirebaseId(id);
    if (!existing) {
      const page = await request('/pages', {
        method: 'POST',
        body: {
          parent: { type: 'data_source_id', data_source_id: dataSourceId },
          properties
        }
      });
      return { action: 'created', pageId: page.id, manual };
    }
    const page = await request(`/pages/${existing.id}`, {
      method: 'PATCH',
      body: { properties }
    });
    return { action: 'updated', pageId: page.id || existing.id, manual };
  }

  async function trashManual(id) {
    const existing = await queryByFirebaseId(id);
    if (!existing) return { action: 'missing' };
    await request(`/pages/${existing.id}`, { method: 'PATCH', body: { in_trash: true } });
    return { action: 'trashed', pageId: existing.id };
  }

  return { normalizeManual, buildProperties, queryByFirebaseId, upsertManual, trashManual };
}

module.exports = { createNotionMirror };
