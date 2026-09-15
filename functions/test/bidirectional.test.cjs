const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { canonicalFromFirestore, canonicalFromNotionPage, hashCanonical } = require('../src/canonical.cjs');
const { dispatchNotionPage } = require('../src/notionDispatch.cjs');
const { verifyNotionSignature } = require('../src/notionWebhook.cjs');

test('canonical Firestore and Notion shapes hash identically', () => {
  const firestore = canonicalFromFirestore('f1', { title:'무좀 세트', category:'일반약', status:'검토중', priority:'보통', currentProblem:'문제', confirmedFact:'사실', proposal:'제안', staffSummary:'요약' });
  const notion = canonicalFromNotionPage({ properties:{
    'Firebase ID':{rich_text:[{plain_text:'f1'}]}, '업무명':{title:[{plain_text:'무좀 세트'}]}, '분류':{select:{name:'일반약'}}, '상태':{select:{name:'검토중'}}, '우선순위':{select:{name:'보통'}}, '직원용 한줄 요약':{rich_text:[{plain_text:'요약'}]}, '현재 문제':{rich_text:[{plain_text:'문제'}]}, '확인된 사실':{rich_text:[{plain_text:'사실'}]}, '개선 제안':{rich_text:[{plain_text:'제안'}]}
  }});
  assert.equal(hashCanonical(firestore), hashCanonical(notion));
});

test('legacy manual_improve fields are preserved through canonical mapping', () => {
  const c = canonicalFromFirestore('old1', { title:'예전 항목', content:'예전 현재 내용', proposedContent:'예전 개선안', status:'검토중' });
  assert.equal(c.currentProblem, '예전 현재 내용');
  assert.equal(c.proposal, '예전 개선안');
});

test('Notion update pre-marks hash then updates Firebase once', async () => {
  const order=[];
  const page={id:'p1',parent:{type:'data_source_id',data_source_id:'ds'},properties:{'Firebase ID':{rich_text:[{plain_text:'f1'}]},'업무명':{title:[{plain_text:'변경 제목'}]},'분류':{select:{name:'기타'}},'상태':{select:{name:'검토중'}},'우선순위':{select:{name:'보통'}},'직원용 한줄 요약':{rich_text:[]},'현재 문제':{rich_text:[]},'확인된 사실':{rich_text:[]},'개선 제안':{rich_text:[]}}};
  const mirror={getPage:async()=>page,isTargetPage:()=>true,markSynced:async()=>order.push(['mark'])};
  const repo={get:async()=>({exists:true,data:{title:'기존 제목'}}),update:async(id,patch)=>order.push(['update',id,patch])};
  const stateStore={get:async()=>null,set:async(id,state)=>order.push(['state',id,state])};
  const result=await dispatchNotionPage({mirror,repo,stateStore,pageId:'p1'});
  assert.equal(result.action,'updated-firestore');
  assert.equal(order[0][0],'state');
  assert.equal(order[1][0],'update');
});

test('new Notion row uses deterministic Firebase id so retries cannot duplicate it', async () => {
  const page={id:'12345678-1234-1234-1234-123456789abc',parent:{type:'data_source_id',data_source_id:'ds'},properties:{'Firebase ID':{rich_text:[]},'업무명':{title:[{plain_text:'새 업무'}]},'분류':{select:{name:'기타'}},'상태':{select:{name:'검토중'}},'우선순위':{select:{name:'보통'}},'직원용 한줄 요약':{rich_text:[]},'현재 문제':{rich_text:[]},'확인된 사실':{rich_text:[]},'개선 제안':{rich_text:[]}}};
  const actions=[];
  const mirror={getPage:async()=>page,isTargetPage:()=>true,setFirebaseId:async(pageId,id)=>actions.push(['notion-id',pageId,id])};
  const repo={set:async(id,data)=>actions.push(['set',id,data])};
  const stateStore={get:async()=>null,set:async(id,state)=>actions.push(['state',id,state])};
  const result=await dispatchNotionPage({mirror,repo,stateStore,pageId:page.id});
  assert.equal(result.firebaseId,'notion_12345678123412341234123456789abc');
  assert.equal(actions[1][0],'set');
});

test('Notion webhook signature uses HMAC SHA256 raw body', () => {
  const raw='{"type":"page.properties_updated"}'; const token='secret-token';
  const signature='sha256='+crypto.createHmac('sha256',token).update(raw).digest('hex');
  assert.equal(verifyNotionSignature(raw,signature,token),true);
  assert.equal(verifyNotionSignature(raw+' ',signature,token),false);
});
