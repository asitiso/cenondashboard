const test=require('node:test');
const assert=require('node:assert/strict');
const {createManualRepo,createSyncStateStore,createWebhookTokenStore}=require('../src/firebaseAdapters.cjs');

function fakeDb(seed={}){
  const data=new Map(Object.entries(seed));
  function docRef(path){return {async get(){const value=data.get(path);return {exists:value!==undefined,data:()=>value};},async update(patch){data.set(path,{...(data.get(path)||{}),...patch});},async set(value,opts){data.set(path,opts?.merge?{...(data.get(path)||{}),...value}:value);}};}
  return {_data:data,collection(name){return {doc(id){return docRef(`${name}/${id}`)},async add(value){data.set(`${name}/generated`,value);return {id:'generated'};}}}};
}

test('manual repo updates only the target document and stamps updatedAt',async()=>{
  const db=fakeDb({'manual_improve/f1':{title:'old',keep:'yes'}});
  const repo=createManualRepo({db,serverTimestamp:()=> 'TS'});
  await repo.update('f1',{title:'new'});
  assert.deepEqual(db._data.get('manual_improve/f1'),{title:'new',keep:'yes',updatedAt:'TS'});
});

test('sync state stays outside manual_improve',async()=>{
  const db=fakeDb(); const store=createSyncStateStore({db,serverTimestamp:()=> 'TS'});
  await store.set('f1',{lastSyncedHash:'abc',lastSource:'notion'});
  assert.equal(db._data.has('manual_improve/f1'),false);
  assert.equal(db._data.get('_sync_manual_improve_notion/f1').lastSyncedHash,'abc');
});

test('webhook verification token uses isolated config document and cache',async()=>{
  const db=fakeDb(); const store=createWebhookTokenStore({db,serverTimestamp:()=> 'TS'});
  await store.set('verify-token');
  assert.equal(await store.get(),'verify-token');
  assert.equal(db._data.get('_sync_manual_improve_notion_config/webhook').verificationToken,'verify-token');
});
