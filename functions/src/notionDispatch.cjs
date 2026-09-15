const { canonicalFromNotionPage, canonicalFromFirestore, hashCanonical, firestorePatch } = require('./canonical.cjs');

function notionPageFirebaseId(pageId){
  const compact=String(pageId||'').replace(/[^a-zA-Z0-9]/g,'');
  if(!compact) throw new Error('Notion page id is required');
  return `notion_${compact}`;
}

async function premark(stateStore,id,hash,pageId){
  const previous=stateStore.get?await stateStore.get(id):null;
  await stateStore.set(id,{lastSyncedHash:hash,lastSource:'notion',notionPageId:pageId,lastError:null});
  return previous;
}
async function restoreAfterFailure(stateStore,id,previous,error,pageId){
  await stateStore.set(id,{
    lastSyncedHash:previous?.lastSyncedHash||null,
    lastSource:'error',
    notionPageId:pageId,
    lastError:error instanceof Error?error.message:String(error)
  });
}

async function dispatchNotionPage({mirror,repo,stateStore,pageId}){
  if(!mirror||!repo||!stateStore) throw new Error('mirror, repo and stateStore are required');
  const page=await mirror.getPage(pageId);
  if(!mirror.isTargetPage(page)) return {action:'ignored',reason:'different-data-source'};
  if(page.in_trash) return {action:'delete-ignored',reason:'notion-page-in-trash'};

  const notion=canonicalFromNotionPage(page);
  const hash=hashCanonical(notion);
  const patch=firestorePatch(notion);

  if(!notion.firebaseId){
    const id=notionPageFirebaseId(pageId);
    const previous=await premark(stateStore,id,hash,pageId);
    try{
      await repo.set(id,{...patch,createdBy:'notion'});
    }catch(error){
      await restoreAfterFailure(stateStore,id,previous,error,pageId);
      throw error;
    }
    await mirror.setFirebaseId(pageId,id);
    return {action:'created-firestore',firebaseId:id,pageId};
  }

  const current=await repo.get(notion.firebaseId);
  if(current?.exists){
    const firebaseCanonical=canonicalFromFirestore(notion.firebaseId,current.data||{});
    if(hashCanonical(firebaseCanonical)===hash){
      await stateStore.set(notion.firebaseId,{lastSyncedHash:hash,lastSource:'notion',notionPageId:pageId,lastError:null});
      return {action:'skipped',reason:'same-data',firebaseId:notion.firebaseId,pageId};
    }
    const previous=await premark(stateStore,notion.firebaseId,hash,pageId);
    try{
      await repo.update(notion.firebaseId,patch);
    }catch(error){
      await restoreAfterFailure(stateStore,notion.firebaseId,previous,error,pageId);
      throw error;
    }
    if(mirror.markSynced) await mirror.markSynced(pageId,'노션');
    return {action:'updated-firestore',firebaseId:notion.firebaseId,pageId};
  }

  const previous=await premark(stateStore,notion.firebaseId,hash,pageId);
  try{
    await repo.set(notion.firebaseId,{...patch,createdBy:'notion'});
  }catch(error){
    await restoreAfterFailure(stateStore,notion.firebaseId,previous,error,pageId);
    throw error;
  }
  if(mirror.markSynced) await mirror.markSynced(pageId,'노션');
  return {action:'created-firestore-at-id',firebaseId:notion.firebaseId,pageId};
}
module.exports={dispatchNotionPage,notionPageFirebaseId};
