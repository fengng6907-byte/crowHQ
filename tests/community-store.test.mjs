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
