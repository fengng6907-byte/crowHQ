import { test } from 'node:test';
import assert from 'node:assert/strict';
import { changeCommunity,cleanRoom,emptyCommunity,publicRoom,makeProfile,PRESENCE_MS } from '../lib/community.js';
const at=1793580000000,alice=makeProfile({id:'a'.repeat(24),role:'guest'},'Alice'),bob=makeProfile({id:'b'.repeat(24),role:'founder'},'Bobby Ng');
function memory(){let state=emptyCommunity(),rev=0;return{async read(){return{room:structuredClone(state),etag:String(rev)};},async write(room,etag){if(String(rev)!==etag)throw Error('conflict');state=structuredClone(room);rev++;},isConflict:e=>e.message==='conflict'};}
const c=(action,extra={})=>({action,tab:'visit-test-tab-01',...extra});
async function setup(){const store=memory();await changeCommunity(store,bob,c('heartbeat',{spot:'suite'}),at);await changeCommunity(store,alice,c('heartbeat',{spot:'hq'}),at);return store;}
test('an invited human can visit an open boss room alongside its owner without acquiring founder privileges',async()=>{
 const store=await setup(),snap=await changeCommunity(store,alice,c('visit',{roomId:bob.id}),at+1),guest=snap.people.find(p=>p.id===alice.id);
 assert.equal(guest.spot,'suite');assert.equal(guest.roomId,bob.id);assert.equal(guest.role,'guest');assert.equal(snap.people.filter(p=>p.spot==='suite'&&p.roomId===bob.id).length,2);
});
test('room visits never expose existing private notes, and explicit public chat works from inside a room',async()=>{
 const store=await setup();await changeCommunity(store,bob,c('say',{text:'Owner only',messageId:'owner-note-0001',channel:'notes'}),at+1);
 await changeCommunity(store,alice,c('visit',{roomId:bob.id}),at+2);
 let snap=await changeCommunity(store,alice,c('say',{text:'Hello from Bobby’s room',messageId:'visitor-public-001',channel:'public'}),at+3);
 assert.equal(snap.messages.some(m=>m.text==='Owner only'),false);assert.equal(snap.messages.find(m=>m.id==='visitor-public-001').scope,'community');
 await changeCommunity(store,alice,c('say',{text:'My own note',messageId:'visitor-note-001',channel:'notes',scope:'suite:'+bob.id}),at+4);
 const {room}=await store.read(),ownerView=publicRoom(room,bob.id,at+4);assert.equal(ownerView.messages.some(m=>m.text==='My own note'),false);assert.ok(ownerView.messages.some(m=>m.text==='Owner only'));assert.ok(ownerView.messages.some(m=>m.id==='visitor-public-001'));
});
test('closing a room removes visitors and blocks re-entry without blocking the owner',async()=>{
 const store=await setup();await changeCommunity(store,alice,c('visit',{roomId:bob.id}),at+1);
 let snap=await changeCommunity(store,bob,c('room-access',{open:false}),at+2);assert.equal(snap.people.find(p=>p.id===alice.id).spot,'hq');assert.equal(snap.people.find(p=>p.id===bob.id).spot,'suite');
 await assert.rejects(changeCommunity(store,alice,c('visit',{roomId:bob.id}),at+3),e=>e.status===403);
 await changeCommunity(store,bob,c('heartbeat'),at+4);const {room}=await store.read();assert.equal(room.people.find(p=>p.id===bob.id).roomOpen,false);
 await changeCommunity(store,bob,c('room-access',{open:true}),at+5);snap=await changeCommunity(store,alice,c('visit',{roomId:bob.id}),at+6);assert.equal(snap.people.find(p=>p.id===alice.id).roomId,bob.id);
});
test('visitors return to the HQ floor if their host disconnects; unknown rooms and door overrides fail',async()=>{
 const store=await setup();await changeCommunity(store,alice,c('visit',{roomId:bob.id}),at+1);
 await changeCommunity(store,alice,c('heartbeat'),at+PRESENCE_MS-10);let {room}=await store.read();cleanRoom(room,at+PRESENCE_MS+1);assert.equal(room.people.find(p=>p.id===alice.id).spot,'hq');
 await assert.rejects(changeCommunity(store,alice,c('visit',{roomId:'c'.repeat(24)}),at+2),e=>e.status===404);
 await assert.rejects(changeCommunity(store,alice,c('room-access',{roomId:bob.id,open:false}),at+3),e=>e.status===403);
 await assert.rejects(changeCommunity(store,alice,c('say',{text:'bad',messageId:'invalid-channel',channel:'another-room'}),at+4),e=>e.status===400);
});
test('a saved closed-door preference is restored when a guest returns after presence expiry',async()=>{
 const store=memory();const privateAlice={...alice,roomOpen:false};let snap=await changeCommunity(store,privateAlice,c('heartbeat',{spot:'suite'}),at);assert.equal(snap.people[0].roomOpen,false);
 snap=await changeCommunity(store,privateAlice,c('heartbeat'),at+PRESENCE_MS+1);assert.equal(snap.people[0].roomOpen,false);
});
