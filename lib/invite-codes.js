import {createHash,createHmac,randomBytes,timingSafeEqual} from 'node:crypto';
import {normalizeCode} from './invitation.js';
export class InviteError extends Error {constructor(status,message){super(message);this.status=status;}}
const hash=s=>createHash('sha256').update(s).digest('hex');
const epoch=env=>hash(normalizeCode(env.CROW_INVITE_CODE)).slice(0,24);
export const emptyInvites=()=>({version:1,generation:0,epoch:null,receipts:[]});
function stateFor(room,env){return room.epoch===epoch(env)?room:{...emptyInvites(),epoch:epoch(env)};}
export function codeFor(generation,env){
 if(generation===0)return env.CROW_INVITE_CODE;
 const hex=createHmac('sha256',env.CROW_INVITE_SESSION_SECRET).update('single-use-invitation:'+epoch(env)+':'+generation).digest('hex').slice(0,24).toUpperCase();
 return 'CROW-'+hex.match(/.{4}/g).join('-');
}
export async function currentInvite(store,env){const {room}=await store.read();const state=stateFor(room,env);return {inviteCode:codeFor(state.generation,env),generation:state.generation,singleUse:true};}
export async function refreshInvite(store,env){
 for(let attempt=0;attempt<7;attempt++){
  const {room,etag}=await store.read(),state=stateFor(room,env);state.generation++;
  try{await store.write(state,etag);return {inviteCode:codeFor(state.generation,env),generation:state.generation,singleUse:true};}catch(e){if(!store.isConflict(e))throw e;}
 }
 throw new InviteError(409,'The invitation desk is busy. Please try again.');
}
export async function redeemInvite(store,env,input,requestId,now){
 if(typeof input!=='string'||input.length>100||normalizeCode(input).length<16)throw new InviteError(401,'That code is invalid or has already been used. Ask Bobby for the latest invitation.');
 if(requestId!==undefined&&!/^[a-f0-9]{32,64}$/.test(requestId))throw new InviteError(400,'Refresh this invitation page and try again.');
 const id=hash(requestId||randomBytes(24).toString('hex')),codeHash=hash(normalizeCode(input));
 for(let attempt=0;attempt<7;attempt++){
  const {room,etag}=await store.read(),state=stateFor(room,env);
  const previous=state.receipts.find(r=>r.request===id&&r.code===codeHash);
  if(previous)return previous.nonce;
  if(!timingSafeEqual(Buffer.from(codeHash,'hex'),Buffer.from(hash(normalizeCode(codeFor(state.generation,env))),'hex')))throw new InviteError(401,'That code is invalid or has already been used. Ask Bobby for the latest invitation.');
  const nonce=randomBytes(12).toString('hex');state.generation++;
  state.receipts=state.receipts.filter(r=>r.at>now-24*3600000).slice(-127);state.receipts.push({request:id,code:codeHash,nonce,at:now});
  try{await store.write(state,etag);return nonce;}catch(e){if(!store.isConflict(e))throw e;}
 }
 throw new InviteError(409,'The invitation desk is busy. Please try again.');
}
