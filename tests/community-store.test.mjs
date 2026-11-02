import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createCommunityStore } from '../lib/community-store.js';
import { changeCommunity, emptyCommunity, makeProfile } from '../lib/community.js';
test('storage updates use the authoritative metadata ETag rather than a transformed content ETag',async()=>{
 const calls=[];let written;
 const store=createCommunityStore({headBlob:async()=>{calls.push('head');return{etag:'"storage-version"'};},readBlob:async(_,options)=>{calls.push('get');assert.equal(options.useCache,false);assert.equal(options.headers['accept-encoding'],'identity');return{statusCode:200,blob:{etag:'W/"transformed-version"'},stream:new Response(JSON.stringify(emptyCommunity())).body};},writeBlob:async(_,body,options)=>{written=options;}});
 const {room,etag}=await store.read();await store.write(room,etag);assert.deepEqual(calls,['head','get']);assert.equal(written.ifMatch,'"storage-version"');assert.equal(written.allowOverwrite,true);
});
test('a concurrent write between metadata and body reads is retried without losing the other visitor',async()=>{
 const alice=makeProfile({id:'a'.repeat(24),role:'guest'},'Alice'),bob=makeProfile({id:'b'.repeat(24),role:'guest'},'Bobby');
 let state=emptyCommunity(),revision=0,injected=false,conflicts=0;
 const store=createCommunityStore({
  headBlob:async()=>({etag:'"'+revision+'"'}),
  readBlob:async()=>{if(!injected){state.people.push({...bob,spot:'hq',tabs:{'bob-test-tab':1000000}});revision++;injected=true;}return{statusCode:200,blob:{etag:'W/"'+revision+'"'},stream:new Response(JSON.stringify(state)).body};},
  writeBlob:async(_,body,options)=>{if(options.ifMatch!=='"'+revision+'"'){conflicts++;throw new Error('precondition');}state=JSON.parse(body);revision++;},
 });
 const result=await changeCommunity(store,alice,{action:'heartbeat',tab:'alice-test-tab',spot:'kopi'},1000001);assert.equal(result.people.length,2);assert.ok(result.people.some(p=>p.id===bob.id));assert.equal(conflicts,1);
});
test('warm polling shares a read, skips unchanged body downloads, and returns isolated copies',async()=>{let at=0,heads=0,gets=0;const store=createCommunityStore({now:()=>at,cacheMs:750,headBlob:async()=>{heads++;return{etag:'one'};},readBlob:async()=>{gets++;return{statusCode:200,stream:new Response(JSON.stringify(emptyCommunity())).body};}});const [a,b]=await Promise.all([store.read(),store.read()]);assert.equal(heads,1);assert.equal(gets,1);a.room.messages.push({text:'A private note'});assert.equal(b.room.messages.length,0);assert.equal((await store.read()).room.messages.length,0);at=800;await store.read();assert.equal(heads,2);assert.equal(gets,1);});
test('stale warm-cache writes invalidate and retry against a different worker without losing messages',async()=>{let state=emptyCommunity(),revision=1,reads=0;const store=createCommunityStore({headBlob:async()=>({etag:String(revision)}),readBlob:async()=>{reads++;return{statusCode:200,stream:new Response(JSON.stringify(state)).body};},writeBlob:async(_,body,options)=>{if(options.ifMatch!==String(revision))throw Error('precondition');state=JSON.parse(body);revision++;return{etag:String(revision)};}});await store.read();state.messages.push({id:'other-worker',personId:'b'.repeat(24),text:'Keep me',scope:'community',at:1000000});revision++;const p=makeProfile({id:'a'.repeat(24),role:'guest'},'Alice');const snap=await changeCommunity(store,p,{action:'heartbeat',tab:'test-tab-cache'},1000000);assert.equal(snap.messages.length,1);assert.ok(reads>=2);});
