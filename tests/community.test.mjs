import { test } from 'node:test';
import assert from 'node:assert/strict';
import { changeCommunity, cleanRoom, emptyCommunity, makeProfile, identity, profileCookie, readProfile, PRESENCE_MS, MESSAGE_MS } from '../lib/community.js';
import { createCommunityHandler } from '../api/community.js';
import { issueSession, cookieName } from '../lib/invitation.js';
const env={VERCEL:'1',VERCEL_URL:'crow-private.vercel.app',CROW_INVITE_CODE:'CROW-TEST-COMMUNITY-CODE',CROW_INVITE_SESSION_SECRET:'community-test-key-at-least-32-characters'};
const at=1793550900000, host='crow-hq.vercel.app';
function memory() {let room=emptyCommunity(),rev=0;return{async read(){return{room:structuredClone(room),etag:String(rev)};},async write(next,etag){if(String(rev)!==etag)throw new Error('conflict');room=structuredClone(next);rev++;},isConflict:e=>e.message==='conflict'};}
const alice=makeProfile({id:'a'.repeat(24),role:'guest'},'Alice',5), bob=makeProfile({id:'b'.repeat(24),role:'founder'},'Bobby',9);
const tabA='alice-tab-001',tabB='bobby-tab-001';
const response=()=>({headers:{},setHeader(k,v){this.headers[k]=v;},end(v){this.body=JSON.parse(v);}});
test('different sessions share presence and human speech, with CAS preserving concurrent sends',async()=>{
 const store=memory();
 await Promise.all([changeCommunity(store,alice,{action:'heartbeat',tab:tabA},at),changeCommunity(store,bob,{action:'heartbeat',tab:tabB},at)]);
 await Promise.all([changeCommunity(store,alice,{action:'say',tab:tabA,text:'Hello Bobby!',messageId:'alice-message-01'},at+1000),changeCommunity(store,bob,{action:'say',tab:tabB,text:'Welcome Alice!',messageId:'bobby-message-01'},at+1000)]);
 const {room}=await store.read();assert.equal(room.people.length,2);assert.equal(room.messages.length,2);assert.equal(room.messages.find(m=>m.personId===bob.id).role,'founder');
 const result=await changeCommunity(store,alice,{action:'say',tab:tabA,text:'Hello Bobby!',messageId:'alice-message-01'},at+1100);assert.equal(result.messages.length,2);assert.equal(result.people[0].tabs,undefined);
});
test('one closing tab does not remove another; stale presence and chat disappear',async()=>{
 const store=memory();await changeCommunity(store,alice,{action:'heartbeat',tab:tabA},at);await changeCommunity(store,alice,{action:'heartbeat',tab:'another-tab-001'},at);
 let result=await changeCommunity(store,alice,{action:'leave',tab:tabA},at+1);assert.equal(result.people.length,1);
 result=await changeCommunity(store,alice,{action:'leave',tab:'another-tab-001'},at+2);assert.equal(result.people.length,0);
 await changeCommunity(store,alice,{action:'say',tab:tabA,messageId:'retention-message',text:'Temporary hello'},at);
 const {room}=await store.read();cleanRoom(room,at+PRESENCE_MS+1);assert.equal(room.people.length,0);assert.equal(room.messages.length,1);cleanRoom(room,at+MESSAGE_MS+1);assert.equal(room.messages.length,0);
});
test('names do not confer founder identity, and profile cookies cannot be forged or borrowed',()=>{
 const token=issueSession(env,at),req={headers:{host,cookie:cookieName(env)+'='+token,'x-forwarded-host':env.VERCEL_URL}};
 const actor=identity(req,env,at);assert.equal(actor.role,'guest');const p=makeProfile(actor,'Bobby');assert.equal(p.role,'guest');
 const cookie=profileCookie(p,env);assert.equal(readProfile(cookie,actor,env).name,'Bobby');assert.equal(readProfile(cookie,{id:bob.id,role:'founder'},env),null);const tampered=cookie.replace(/=(.)/, (_,c)=>'='+(c==='e'?'f':'e')); assert.equal(readProfile(tampered,actor,env),null);
 assert.throws(()=>makeProfile(actor,'   '));assert.throws(()=>makeProfile(actor,'a'.repeat(25)));assert.equal(makeProfile(actor,'\u202eAlice\n').name,'Alice');
 assert.equal(identity({headers:{host:env.VERCEL_URL}},env,at).role,'founder');
});
test('community API requires invitations and same-origin CSRF; role spoofing never grants founder',async()=>{
 const store=memory(),handler=createCommunityHandler({env,store,now:()=>at});
 let res=response();await handler({method:'GET',headers:{host}},res);assert.equal(res.statusCode,401);
 const cookie=cookieName(env)+'='+issueSession(env,at);res=response();await handler({method:'GET',headers:{host,cookie}},res);assert.equal(res.statusCode,200);const csrf=res.body.csrf;assert.equal(res.body.profile,null);
 const headers={host,cookie,origin:'https://'+host,'content-type':'application/json'};
 res=response();await handler({method:'POST',headers:{...headers,origin:'https://evil.invalid'},body:{action:'profile',name:'Eve',variant:0,csrf,tab:tabA}},res);assert.equal(res.statusCode,403);
 res=response();await handler({method:'POST',headers,body:{action:'profile',name:'Alice',variant:1,csrf:'forged',tab:tabA}},res);assert.equal(res.statusCode,403);
 res=response();await handler({method:'POST',headers,body:{action:'profile',name:'Bobby',variant:1,role:'founder',id:bob.id,csrf,tab:tabA}},res);assert.equal(res.statusCode,200);assert.equal(res.body.profile.role,'guest');assert.notEqual(res.body.profile.id,bob.id);
 assert.ok(res.headers['Set-Cookie'].every(c=>c.includes('HttpOnly')&&c.includes('Secure')));
});
test('invalid locations, overlong chat and rapid flooding are rejected',async()=>{
 const store=memory();await assert.rejects(changeCommunity(store,alice,{action:'heartbeat',tab:tabA,spot:'private-hq'},at),e=>e.status===400);
 await assert.rejects(changeCommunity(store,alice,{action:'say',tab:tabA,messageId:'long-message-001',text:'x'.repeat(281)},at),e=>e.status===400);
 for(let i=0;i<12;i++)await changeCommunity(store,alice,{action:'say',tab:tabA,messageId:'message-'+i.toString().padStart(8,'0'),text:'Hi'},at+i);
 await assert.rejects(changeCommunity(store,alice,{action:'say',tab:tabA,messageId:'message-thirteenth',text:'Too many'},at+20),e=>e.status===429);
});
