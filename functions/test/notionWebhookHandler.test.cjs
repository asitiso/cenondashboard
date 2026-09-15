const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { handleNotionWebhook } = require('../src/notionWebhookHandler.cjs');
function sign(raw,token){return 'sha256='+crypto.createHmac('sha256',token).update(raw).digest('hex');}

test('wrong private webhook URL key is rejected', async () => {
  const body={verification_token:'v'};
  const result=await handleNotionWebhook({rawBody:JSON.stringify(body),body,headers:{},expectedWebhookKey:'key1',providedWebhookKey:'bad',tokenStore:{set:async()=>{}},dispatch:async()=>{}});
  assert.equal(result.status,401);
});

test('verification payload stores token after URL key check', async () => {
  const stored=[]; const body={verification_token:'verify-me'};
  const result=await handleNotionWebhook({rawBody:JSON.stringify(body),body,headers:{},expectedWebhookKey:'key1',providedWebhookKey:'key1',tokenStore:{set:async t=>stored.push(t)},dispatch:async()=>{}});
  assert.equal(result.status,200);
  assert.deepEqual(stored,['verify-me']);
});

test('page property update dispatches the changed page after signature validation', async () => {
  const body={type:'page.properties_updated',entity:{type:'page',id:'p1'}}; const raw=JSON.stringify(body); const calls=[];
  const result=await handleNotionWebhook({rawBody:raw,body,headers:{'x-notion-signature':sign(raw,'secret')},expectedWebhookKey:'k',providedWebhookKey:'k',tokenStore:{get:async()=> 'secret'},dispatch:async id=>{calls.push(id);return {action:'ok'}}});
  assert.equal(result.status,200);
  assert.deepEqual(calls,['p1']);
});
