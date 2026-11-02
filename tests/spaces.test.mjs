import { test } from 'node:test';
import assert from 'node:assert/strict';
import { changeCommunity,cleanRoom,emptyCommunity,publicRoom,makeProfile,PRESENCE_MS } from '../lib/community.js';
import { MENU,findMeal } from '../lib/space-rules.js';
const at=1793580000000;
const alice=makeProfile({id:'a'.repeat(24),role:'guest'},'Alice',1),bob=makeProfile({id:'b'.repeat(24),role:'founder'},'Bobby Ng',0);
function memory(){let state=emptyCommunity(),revision=0;return{async read(){return{room:structuredClone(state),etag:String(revision)};},async write(room,etag){if(etag!==String(revision))throw Error('conflict');state=structuredClone(room);revision++;},isConflict:e=>e.message==='conflict'};}
const cmd=(action,extra={})=>({action,tab:'test-tab-0001',...extra});
test('every newcomer can use the HQ floor and their own private suite without becoming founder',async()=>{
 const store=memory();let snap=await changeCommunity(store,alice,cmd('heartbeat',{spot:'hq'}),at);assert.equal(snap.people[0].spot,'hq');
 snap=await changeCommunity(store,alice,cmd('heartbeat',{spot:'suite'}),at+1);assert.equal(snap.people[0].role,'guest');assert.equal(snap.people[0].spot,'suite');
 await assert.rejects(changeCommunity(store,alice,cmd('heartbeat',{spot:'suite',roomId:bob.id}),at+2),e=>e.status===403);
});
test('private suite messages are isolated server-side, even if the sender tries to override the scope',async()=>{
 const store=memory();await changeCommunity(store,alice,cmd('heartbeat',{spot:'suite'}),at);await changeCommunity(store,bob,cmd('heartbeat',{spot:'hq'}),at);
 await changeCommunity(store,alice,cmd('say',{text:'Private idea',messageId:'private-message-01',scope:'community'}),at+1);
 let {room}=await store.read();assert.equal(publicRoom(room,bob.id,at).messages.length,0);assert.equal(publicRoom(room,alice.id,at).messages[0].text,'Private idea');
 await changeCommunity(store,bob,cmd('say',{text:'Hello everyone',messageId:'public-message-01'}),at+2);
 ({room}=await store.read());assert.equal(publicRoom(room,bob.id,at).messages.length,1);assert.equal(publicRoom(room,alice.id,at).messages.length,2);
});
test('orders use each restaurant’s actual menu and cannot inject dishes or replace an active meal',async()=>{
 const store=memory();await changeCommunity(store,alice,cmd('heartbeat',{spot:'mamak'}),at);
 await assert.rejects(changeCommunity(store,alice,cmd('order',{mealId:'toast'}),at+1),e=>e.status===400);
 let snap=await changeCommunity(store,alice,cmd('order',{mealId:'roti'}),at+2);let p=snap.people[0];assert.equal(p.meal.place,'mamak');assert.equal(p.meal.servedAt,at+6002);assert.equal(p.meal.finishAt,at+96002);
 await assert.rejects(changeCommunity(store,alice,cmd('order',{mealId:'tarik'}),at+3),e=>e.status===409);
 snap=await changeCommunity(store,alice,cmd('heartbeat'),at+97000);assert.equal(snap.people[0].meal,null);
 for(const [place,items]of Object.entries(MENU)){for(const item of items)assert.ok(findMeal(place,item.id));}
});
test('real-time breaks are marked away, remain visible without a tab and do not falsely return a disconnected person online',async()=>{
 const store=memory();await changeCommunity(store,alice,cmd('heartbeat',{spot:'suite'}),at);
 const snap=await changeCommunity(store,alice,cmd('break',{kind:'lunch',minutes:30}),at+1);const p=snap.people[0];assert.equal(p.availability,'away');assert.equal(p.spot,'mamak');assert.equal(p.break.returnSpot,'suite');assert.equal(p.break.until,at+1+30*60000);
 await changeCommunity(store,alice,cmd('leave'),at+2);let {room}=await store.read();cleanRoom(room,at+PRESENCE_MS+1000);assert.equal(room.people.length,1);assert.equal(publicRoom(room,alice.id,at+PRESENCE_MS+1000).people[0].availability,'away');
 cleanRoom(room,at+31*60000);assert.equal(room.people.length,0);
});
test('a connected visitor returns to their original workspace after the break or can come back early',async()=>{
 const store=memory();await changeCommunity(store,alice,cmd('heartbeat',{spot:'hq'}),at);await changeCommunity(store,alice,cmd('break',{kind:'coffee',minutes:1}),at+1);
 let snap=await changeCommunity(store,alice,cmd('heartbeat'),at+61002);assert.equal(snap.people[0].availability,'available');assert.equal(snap.people[0].spot,'hq');assert.equal(snap.people[0].break,null);
 await changeCommunity(store,alice,cmd('break',{kind:'lunch',minutes:45}),at+62000);snap=await changeCommunity(store,alice,cmd('return'),at+63000);assert.equal(snap.people[0].availability,'available');assert.equal(snap.people[0].spot,'hq');
});
test('invalid break durations are rejected and server time controls the deadline',async()=>{
 const store=memory();for(const minutes of [0,-1,241,1.5,'30'])await assert.rejects(changeCommunity(store,alice,cmd('break',{kind:'lunch',minutes}),at),e=>e.status===400);
 await assert.rejects(changeCommunity(store,alice,cmd('break',{kind:'vacation',minutes:30}),at),e=>e.status===400);
 const snap=await changeCommunity(store,alice,cmd('break',{kind:'coffee',minutes:5,until:1}),at);assert.equal(snap.people[0].break.until,at+300000);
});
test('conditional writes allocate different restaurant seats for simultaneous arrivals',async()=>{
 const store=memory();await Promise.all([changeCommunity(store,alice,cmd('heartbeat',{spot:'kopi'}),at),changeCommunity(store,bob,cmd('heartbeat',{spot:'kopi'}),at)]);
 const {room}=await store.read();assert.notEqual(room.people[0].seat,room.people[1].seat);assert.equal(room.revision,2);
});

test('visiting a restaurant before starting a break remembers the last working space',async()=>{
 const store=memory();await changeCommunity(store,alice,cmd('heartbeat',{spot:'suite'}),at);await changeCommunity(store,alice,cmd('heartbeat',{spot:'kopi'}),at+1);
 const snap=await changeCommunity(store,alice,cmd('break',{kind:'coffee',minutes:5}),at+2);assert.equal(snap.people[0].break.returnSpot,'suite');
});
