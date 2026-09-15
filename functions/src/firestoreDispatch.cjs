const { canonicalFromFirestore, hashCanonical } = require('./canonical.cjs');

async function dispatchManualWrite({mirror,stateStore,id,after}){
  if(!mirror||!stateStore) throw new Error('mirror and stateStore are required');
  if(!id) throw new Error('Firestore document id is required');
  if(!after || !after.exists) return {action:'delete-ignored'};
  const data=after.data()||{};
  const canonical=canonicalFromFirestore(id,data);
  const hash=hashCanonical(canonical);
  const state=await stateStore.get(id);
  if(state?.lastSyncedHash===hash) return {action:'skipped',reason:'hash-match'};
  const result=await mirror.upsertManual(id,data);
  await stateStore.set(id,{lastSyncedHash:hash,lastSource:'firebase',notionPageId:result.pageId||state?.notionPageId||null,lastError:null});
  return result;
}
module.exports={dispatchManualWrite};
