const { verifyNotionSignature } = require('./notionWebhook.cjs');
const SYNC_EVENTS=new Set(['page.created','page.properties_updated']);
async function handleNotionWebhook({rawBody,body,headers={},expectedWebhookKey,providedWebhookKey,verificationToken,tokenStore,dispatch}){
  if(expectedWebhookKey && providedWebhookKey!==expectedWebhookKey)return {status:401,action:'invalid-webhook-key'};
  if(!body||typeof body!=='object')return {status:400,action:'invalid-json'};
  if(typeof body.verification_token==='string'&&body.verification_token){
    if(tokenStore?.set)await tokenStore.set(body.verification_token);
    return {status:200,action:'verification',verificationToken:body.verification_token};
  }
  const token=verificationToken || (tokenStore?.get?await tokenStore.get():null);
  const signature=headers['x-notion-signature']||headers['X-Notion-Signature'];
  if(!verifyNotionSignature(rawBody,signature,token))return {status:401,action:'invalid-signature'};
  if(!SYNC_EVENTS.has(body.type))return {status:200,action:'ignored-event',eventType:body.type||null};
  if(body.entity?.type!=='page'||!body.entity?.id)return {status:200,action:'ignored-entity'};
  if(typeof dispatch!=='function')throw new Error('dispatch is required');
  const result=await dispatch(body.entity.id,body);
  return {status:200,...result};
}
module.exports={handleNotionWebhook};
