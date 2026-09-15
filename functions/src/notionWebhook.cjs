const crypto=require('node:crypto');
function verifyNotionSignature(rawBody,signature,verificationToken){
  if(!rawBody||!signature||!verificationToken) return false;
  const expected='sha256='+crypto.createHmac('sha256',verificationToken).update(rawBody).digest('hex');
  const a=Buffer.from(expected); const b=Buffer.from(signature);
  return a.length===b.length && crypto.timingSafeEqual(a,b);
}
module.exports={verifyNotionSignature};
