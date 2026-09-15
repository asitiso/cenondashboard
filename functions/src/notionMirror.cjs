const { canonicalFromFirestore } = require('./canonical.cjs');

const NOTION_VERSION = '2026-03-11';
const NOTION_BASE_URL = 'https://api.notion.com/v1';

function clean(value){ return typeof value === 'string' ? value.trim().replace(/\s+/g,' ') : ''; }
function richText(value) {
  const text = typeof value === 'string' ? value.trim() : '';
  if (!text) return [];
  const chunks = [];
  for (let i = 0; i < text.length; i += 2000) chunks.push({ type:'text', text:{ content:text.slice(i,i+2000) } });
  return chunks;
}
function toIso(value) {
  if (!value) return null;
  if (typeof value.toDate === 'function') return value.toDate().toISOString();
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value.toISOString();
  if (typeof value === 'string') { const d=new Date(value); return Number.isNaN(d.getTime())?null:d.toISOString(); }
  const seconds = typeof value.seconds === 'number' ? value.seconds : value._seconds;
  if (typeof seconds === 'number') {
    const nanos = typeof value.nanoseconds === 'number' ? value.nanoseconds : (value._nanoseconds || 0);
    return new Date(seconds*1000 + Math.floor(nanos/1e6)).toISOString();
  }
  return null;
}
function normalizeCreatedVia(createdBy){
  const value=clean(createdBy).toLowerCase();
  if(value === 'dashboard') return '대시보드';
  if(value === 'notion') return '노션';
  if(!value || value.includes('assistant') || value.includes('gpt') || value.includes('업무비서')) return '업무비서';
  return '기타';
}

function createNotionMirror({ apiKey, dataSourceId, fetchImpl = globalThis.fetch, now = () => new Date() }) {
  if (!apiKey) throw new Error('NOTION_API_KEY is required');
  if (!dataSourceId) throw new Error('NOTION_DATA_SOURCE_ID is required');
  if (typeof fetchImpl !== 'function') throw new Error('fetch implementation is required');

  async function request(path,{method='GET',body}={}){
    const response=await fetchImpl(`${NOTION_BASE_URL}${path}`,{
      method,
      headers:{Authorization:`Bearer ${apiKey}`,'Notion-Version':NOTION_VERSION,'Content-Type':'application/json'},
      ...(body===undefined?{}:{body:JSON.stringify(body)})
    });
    const text=await response.text(); let parsed={};
    if(text){try{parsed=JSON.parse(text)}catch{parsed={raw:text}}}
    if(!response.ok){const detail=parsed?.message||parsed?.raw||'unknown error';throw new Error(`Notion API ${response.status} ${path}: ${detail}`)}
    return parsed;
  }

  function normalizeManual(id,data={}){
    const canonical=canonicalFromFirestore(id,data);
    return {
      id,
      title:canonical.title,
      category:canonical.category,
      status:canonical.status,
      priority:canonical.priority,
      summary:canonical.staffSummary,
      staffSummary:canonical.staffSummary,
      currentProblem:canonical.currentProblem,
      confirmedFact:canonical.confirmedFact,
      proposal:canonical.proposal,
      createdVia:normalizeCreatedVia(data.createdBy),
      sourceUpdatedAt:toIso(data.updatedAt)||toIso(data.createdAt)
    };
  }

  function buildProperties(manualOrId,dataMaybe){
    const manual = typeof manualOrId === 'string' ? normalizeManual(manualOrId,dataMaybe||{}) : manualOrId;
    const syncTime=now().toISOString();
    const properties={
      '업무명':{title:richText(manual.title)},
      '분류':{select:{name:manual.category}},
      '상태':{select:{name:manual.status}},
      '우선순위':{select:{name:manual.priority}},
      '직원용 한줄 요약':{rich_text:richText(manual.staffSummary || manual.summary || '')},
      '현재 문제':{rich_text:richText(manual.currentProblem)},
      '확인된 사실':{rich_text:richText(manual.confirmedFact)},
      '개선 제안':{rich_text:richText(manual.proposal)},
      '작성 경로':{select:{name:manual.createdVia || '기타'}},
      'Firebase ID':{rich_text:richText(manual.id)},
      '동기화 상태':{select:{name:'동기화완료'}},
      '마지막 동기화':{date:{start:syncTime}}
    };
    properties['원본 수정일']=manual.sourceUpdatedAt?{date:{start:manual.sourceUpdatedAt}}:{date:null};
    return properties;
  }

  async function getPage(pageId){ if(!pageId)throw new Error('Notion page id is required'); return request(`/pages/${encodeURIComponent(pageId)}`); }
  function isTargetPage(page){ return page?.parent?.type==='data_source_id' && page?.parent?.data_source_id===dataSourceId; }

  async function queryByFirebaseId(id){
    const result=await request(`/data_sources/${encodeURIComponent(dataSourceId)}/query`,{method:'POST',body:{filter:{property:'Firebase ID',rich_text:{equals:id}},page_size:2,in_trash:false}});
    const rows=Array.isArray(result.results)?result.results:[];
    if(rows.length>1)throw new Error(`Notion mirror duplicate Firebase ID: ${id}`);
    return rows[0]||null;
  }

  async function upsertManual(id,data){
    const manual=normalizeManual(id,data||{}); const properties=buildProperties(manual); const existing=await queryByFirebaseId(id);
    if(!existing){
      const page=await request('/pages',{method:'POST',body:{parent:{type:'data_source_id',data_source_id:dataSourceId},properties}});
      return {action:'created',pageId:page.id,manual};
    }
    const page=await request(`/pages/${existing.id}`,{method:'PATCH',body:{properties}});
    return {action:'updated',pageId:page.id||existing.id,manual};
  }

  async function setFirebaseId(pageId,firebaseId){
    if(!firebaseId)throw new Error('Firebase ID is required');
    return request(`/pages/${encodeURIComponent(pageId)}`,{method:'PATCH',body:{properties:{
      'Firebase ID':{rich_text:richText(firebaseId)},
      '작성 경로':{select:{name:'노션'}},
      '동기화 상태':{select:{name:'동기화완료'}},
      '마지막 동기화':{date:{start:now().toISOString()}}
    }}});
  }

  async function markSynced(pageId,sourceName='노션'){
    return request(`/pages/${encodeURIComponent(pageId)}`,{method:'PATCH',body:{properties:{
      '작성 경로':{select:{name:sourceName}},
      '동기화 상태':{select:{name:'동기화완료'}},
      '마지막 동기화':{date:{start:now().toISOString()}}
    }}});
  }

  async function trashManual(id){
    const existing=await queryByFirebaseId(id); if(!existing)return {action:'missing'};
    await request(`/pages/${existing.id}`,{method:'PATCH',body:{in_trash:true}});
    return {action:'trashed',pageId:existing.id};
  }

  return {normalizeManual,buildProperties,getPage,isTargetPage,queryByFirebaseId,upsertManual,setFirebaseId,markSynced,trashManual};
}
module.exports={createNotionMirror};
