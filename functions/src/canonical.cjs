const crypto = require('node:crypto');

const CATEGORIES = new Set(['일반약','조제','고객응대','주문·반품','재고·발주','동물약','청구·보험','매장관리','안전관리','비품관리','직원교육','응급상황','기타']);
const STATUSES = new Set(['검토중','검토완료','반영완료']);
const PRIORITIES = new Set(['높음','중','보통']);

function clean(value) {
  return typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : '';
}
function raw(value) { return typeof value === 'string' ? value.trim() : ''; }
function normalizeCategory(v){ const t=clean(v); return CATEGORIES.has(t)?t:'기타'; }
function normalizeStatus(v){ const t=clean(v); return STATUSES.has(t)?t:'검토중'; }
function normalizePriority(v){ const t=clean(v); if(PRIORITIES.has(t)) return t; if(t==='중간'||t.toLowerCase()==='medium') return '중'; if(t.toLowerCase()==='high') return '높음'; return '보통'; }
function summaryOf(data,title){ const s=raw(data.staffSummary)||clean(data.confirmedFact)||clean(data.proposal)||clean(data.currentProblem)||title||'내용 확인 필요'; return s.length<=120?s:s.slice(0,117)+'…'; }
function propText(prop){
  if(!prop) return '';
  const arr = prop.title || prop.rich_text || [];
  return arr.map(x=>x.plain_text ?? x.text?.content ?? '').join('').trim();
}
function propSelect(prop){ return prop?.select?.name || ''; }
function canonicalFromFirestore(id,data={}){
  const title=clean(data.title || data.manualTitle || data.section || data.subject)||'제목 없음';
  const normalizedData={
    ...data,
    currentProblem: raw(data.currentProblem) || raw(data.content),
    confirmedFact: raw(data.confirmedFact),
    proposal: raw(data.proposal) || raw(data.proposedContent)
  };
  return {
    firebaseId:id||'',
    title,
    category:normalizeCategory(data.category),
    status:normalizeStatus(data.status || data.reviewStatus),
    priority:normalizePriority(data.priority),
    staffSummary:summaryOf(normalizedData,title),
    currentProblem:normalizedData.currentProblem,
    confirmedFact:normalizedData.confirmedFact,
    proposal:normalizedData.proposal
  };
}
function canonicalFromNotionPage(page={}){
  const p=page.properties||{};
  const title=clean(propText(p['업무명']))||'제목 없음';
  const data={
    staffSummary:propText(p['직원용 한줄 요약']),
    currentProblem:propText(p['현재 문제']),
    confirmedFact:propText(p['확인된 사실']),
    proposal:propText(p['개선 제안'])
  };
  return {
    firebaseId:propText(p['Firebase ID']),
    title,
    category:normalizeCategory(propSelect(p['분류'])),
    status:normalizeStatus(propSelect(p['상태'])),
    priority:normalizePriority(propSelect(p['우선순위'])),
    staffSummary:summaryOf(data,title),
    currentProblem:data.currentProblem,
    confirmedFact:data.confirmedFact,
    proposal:data.proposal
  };
}
function syncPayload(c){
  return {title:c.title,category:c.category,status:c.status,priority:c.priority,staffSummary:c.staffSummary,currentProblem:c.currentProblem,confirmedFact:c.confirmedFact,proposal:c.proposal};
}
function hashCanonical(c){ return crypto.createHash('sha256').update(JSON.stringify(syncPayload(c))).digest('hex'); }
function firestorePatch(c){ return syncPayload(c); }
module.exports={canonicalFromFirestore,canonicalFromNotionPage,hashCanonical,firestorePatch,propText};
