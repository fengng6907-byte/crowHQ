import {memoryInvites} from './helpers.mjs';
const createInvitationHandler=options=>rawInvitationHandler({store:memoryInvites(),...options});
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createInvitationHandler as rawInvitationHandler } from '../api/invitation.js';
import { createHandler } from '../api/team.js';
import { createCommunityHandler } from '../api/community.js';
import { accessDecision, cookieName, issueSession, verifySession } from '../lib/invitation.js';
import { COMMUNITY_ORIGIN, founderCookieName, claimCookieName, issueFounderSession, verifyFounderSession, verifyFounderClaim, newFounderChallenge, issueFounderClaim } from '../lib/founder-access.js';
import { emptyCommunity } from '../lib/community.js';
import { emptyRoom } from '../lib/team-room.js';
const env={VERCEL:'1',VERCEL_URL:'crow-protected-test.vercel.app',CROW_INVITE_CODE:'CROW-TEST-RECLAIM-1234',CROW_INVITE_SESSION_SECRET:'a-test-only-founder-session-key-at-least-32-characters',BLOB_READ_WRITE_TOKEN:'test-only-private-store-token'};
const host='crow-hq.vercel.app', at=1793550900000;
const response=()=>({headers:{},setHeader(k,v){this.headers[k]=v;},end(v){this.body=v?JSON.parse(v):null;}});
const request=(path,cookie='',hostname=host)=>({method:'GET',url:path,headers:{host:hostname,cookie}});
const cookies=res=>(Array.isArray(res.headers['Set-Cookie'])?res.headers['Set-Cookie']:[res.headers['Set-Cookie']]).filter(Boolean);
const cookie=res=>cookies(res).map(c=>c.split(';')[0]).join('; ');
const founderCookie=()=>founderCookieName(env)+'='+issueFounderSession(env,at);
async function bridge() {
 const handler=createInvitationHandler({env,now:()=>at});const start=response();await handler(request('/api/invitation?action=founder-start'),start);
 assert.equal(start.statusCode,303);const destination=new URL(start.headers.Location);assert.equal(destination.host,env.VERCEL_URL);assert.equal(destination.searchParams.get('action'),'founder-claim');
 const claim=response();await handler(request(destination.pathname+destination.search,'',env.VERCEL_URL),claim);assert.equal(claim.statusCode,303);
 const callback=new URL(claim.headers.Location);assert.equal(callback.origin,COMMUNITY_ORIGIN);
 return {handler,start,claim,callback};
}
test('Vercel-authenticated founder can reclaim Bobby on the stable main site and stay signed in',async()=>{
 const {handler,start,callback}=await bridge();const finish=response();await handler(request(callback.pathname+callback.search,cookie(start)),finish);
 assert.equal(finish.statusCode,303);assert.equal(finish.headers.Location,'/#founder');
 const saved=cookies(finish).find(c=>c.startsWith(founderCookieName(env)+'='));assert.match(saved,/HttpOnly; SameSite=Lax; Max-Age=34560000; Secure/);
 assert.ok(cookies(finish).some(c=>c.startsWith(claimCookieName(env)+'=')&&c.includes('Max-Age=0')));
 const token=saved.split(';')[0].split('=')[1];assert.equal(verifyFounderSession(token,env,at+50*365*24*3600000).role,'founder');
 // Simulate a fresh HTTP client after a browser restart using only its persisted cookie.
 const remembered=response();await createInvitationHandler({env,now:()=>at+24*3600000})(request('/api/invitation',saved.split(';')[0]),remembered);
 assert.equal(remembered.body.role,'founder');assert.equal(remembered.body.expiresAt,null);assert.match(remembered.headers['Set-Cookie'],/Max-Age=34560000/);
 for(const path of ['/','/api/team','/founder.html'])assert.equal(accessDecision(new Request(COMMUNITY_ORIGIN+path,{headers:{host,cookie:saved.split(';')[0]}}),env,at).role,'founder');
});
test('a guest cannot mint a founder claim or masquerade with forwarded-host headers',async()=>{
 const handler=createInvitationHandler({env,now:()=>at}),challenge=newFounderChallenge().challenge;
 for(const cookieValue of ['',cookieName(env)+'='+issueSession(env,at),founderCookie()]){
  const res=response(),req=request('/api/invitation?action=founder-claim&challenge='+challenge,cookieValue);req.headers['x-forwarded-host']=env.VERCEL_URL;
  await handler(req,res);assert.equal(res.statusCode,403);assert.equal(res.headers.Location,undefined);
 }
});
test('the callback requires the original browser secret; stolen, expired or forged tickets fail',async()=>{
 const {handler,start,callback}=await bridge();
 for(const wrong of ['',claimCookieName(env)+'='+newFounderChallenge().nonce]){const res=response();await handler(request(callback.pathname+callback.search,wrong),res);assert.equal(res.statusCode,403);assert.equal(res.headers['Set-Cookie'],undefined);}
 const expiry=response();await createInvitationHandler({env,now:()=>at+120001})(request(callback.pathname+callback.search,cookie(start)),expiry);assert.equal(expiry.statusCode,403);
 const c=newFounderChallenge(),ticket=issueFounderClaim(c.challenge,env,at);assert.equal(verifyFounderClaim(ticket,c.nonce,env,at),true);assert.equal(verifyFounderClaim(ticket+'x',c.nonce,env,at),false);assert.equal(verifyFounderClaim(ticket,c.nonce,{...env,VERCEL_URL:'different.vercel.app'},at),false);
});
test('a guest token is never a founder token; signing-key rotation revokes founder sessions',()=>{
 const token=issueFounderSession(env,at);assert.equal(verifyFounderSession(issueSession(env,at),env,at),null);
 assert.equal(verifySession(token,env,at),null);assert.equal(verifyFounderSession(token+'x',env,at),null);assert.equal(verifyFounderSession(token,{...env,CROW_INVITE_SESSION_SECRET:'a-different-session-key-at-least-32-characters'},at),null);
 const forgedCookie=founderCookieName(env)+'='+issueSession(env,at);assert.equal(accessDecision(new Request(COMMUNITY_ORIGIN+'/api/team',{headers:{host,cookie:forgedCookie}}),env,at).status,403);
});
test('founder private AI API accepts only the verified founder, without calling a model on reads',async()=>{
 let reads=0;const handler=createHandler({env,store:{async read(){reads++;return{room:emptyRoom(),etag:null};}},generate(){throw new Error('No model should run');}});
 const guest=response();await handler(request('/api/team',cookieName(env)+'='+issueSession(env,at)),guest);assert.equal(guest.statusCode,403);assert.equal(reads,0);
 const founder=response();await handler(request('/api/team',founderCookie()),founder);assert.equal(founder.statusCode,200);assert.equal(reads,1);assert.ok(founder.body.csrf);
});
test('reclaimed identity always receives Bobby’s original character and verified founder badge',async()=>{
 const handler=createCommunityHandler({env,store:{async read(){return{room:emptyCommunity(),etag:null};}},now:()=>at});
 const res=response();await handler(request('/api/community',founderCookie()),res);
 assert.equal(res.statusCode,200);assert.equal(res.body.profile.role,'founder');assert.equal(res.body.profile.name,'Bobby Ng');assert.equal(res.body.profile.variant,0);
 const privateHost=response();await handler(request('/api/community','',env.VERCEL_URL),privateHost);assert.equal(privateHost.body.profile.id,res.body.profile.id);
});
test('production cannot activate the local founder fixture, even with its QA environment flag',async()=>{
 const res=response();await createInvitationHandler({env:{...env,CROW_LOCAL_QA:'1'},now:()=>at})(request('/api/invitation?action=founder-start'),res);
 assert.equal(res.statusCode,303);assert.equal(new URL(res.headers.Location).host,env.VERCEL_URL);assert.ok(cookies(res).every(c=>!c.startsWith(founderCookieName(env)+'=')));
});
test('returning guests skip the invitation page and repeated joins preserve their character identity',async()=>{
 const token=issueSession(env,at),guestCookie=cookieName(env)+'='+token;
 const decision=accessDecision(new Request(COMMUNITY_ORIGIN+'/join.html',{headers:{host,cookie:guestCookie}}),env,at);assert.equal(decision.status,303);assert.equal(decision.redirect,'/');
 const handler=createInvitationHandler({env,now:()=>at}),res=response();await handler({method:'POST',url:'/api/invitation',headers:{host,cookie:guestCookie,origin:COMMUNITY_ORIGIN,'content-type':'application/json'},body:{action:'join',code:env.CROW_INVITE_CODE}},res);
 assert.equal(res.statusCode,200);const refreshed=res.headers['Set-Cookie'].split(';')[0].split('=')[1];assert.equal(verifySession(refreshed,env,at).nonce,verifySession(token,env,at).nonce);
});
