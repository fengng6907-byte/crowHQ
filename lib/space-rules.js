import { MALL_FLOORS } from './mall-catalog.js';
// Shared, public game rules; no credentials or personal state live here.
export const LOCATIONS = Object.freeze({
 work: { name:'Shared terrace',scene:'town',point:[810,702] },
 hq: { name:'Crow HQ · community floor',scene:'inside',point:[200,700] },
 suite: { name:'My private boss room',scene:'suite',point:[470,345] },
 mamak: { name:'Mamak Corner',scene:'mamak',point:[240,380] },
 kopi: { name:'Kedai Kopi Pagi',scene:'kopi',point:[240,380] },
 seven: { name:'7-Eleven café',scene:'seven',point:[240,380] },
 ...Object.fromEntries(MALL_FLOORS.map(f=>['mall-'+f.id,{name:'Suria KLCC · '+f.name,scene:'mall',point:[700,630]}])),
 park: { name:'Pocket park',scene:'town',point:[450,701] },
});
export const MENU = Object.freeze({
 mamak: [
  { id:'roti',name:'Roti canai + dhal',description:'Flaky roti, warm dhal and curry.',kind:'roti' },
  { id:'nasi',name:'Nasi lemak',description:'Coconut rice, sambal, egg and ikan bilis.',kind:'rice' },
  { id:'mee',name:'Mee goreng mamak',description:'Wok-fried noodles with a little heat.',kind:'noodles' },
  { id:'tarik',name:'Teh tarik',description:'Pulled milk tea with a foamy top.',kind:'tea' },
 ],
 kopi: [
  { id:'toast',name:'Kopi & kaya toast',description:'Butter, kaya and a proper cup of kopi.',kind:'toast' },
  { id:'eggs',name:'Soft-boiled eggs',description:'Two eggs, soy sauce and a little pepper.',kind:'eggs' },
  { id:'kway',name:'Char kway teow',description:'Flat rice noodles with smoky wok flavour.',kind:'noodles' },
  { id:'chicken',name:'Hainanese chicken rice',description:'Fragrant rice and tender chicken.',kind:'rice' },
 ],
 seven: [
  { id:'cold',name:'Cold drink',description:'A chilled drink for a hot afternoon.',kind:'drink' },
  { id:'ice',name:'Ice cream',description:'A small sweet reset.',kind:'icecream' },
  { id:'puff',name:'Curry puff',description:'A warm, flaky snack.',kind:'puff' },
  { id:'cup',name:'Cup noodles',description:'A little hot comfort from the snack counter.',kind:'cup' },
 ],
});
export const findMeal = (place,id) => MENU[place]?.find(item=>item.id===id);
export function inBreak(person,now) { return !!(person.break && person.break.until > now); }
export function messageScope(person) { return person.spot === 'suite' ? 'suite:'+person.id : 'community'; }
export function canReadMessage(message,viewerId) { return !message.scope || message.scope==='community' || message.scope==='suite:'+viewerId || (message.scope.startsWith('dm:')&&(message.personId===viewerId||message.recipientId===viewerId)); }

export const directScope=(a,b)=>'dm:'+ [a,b].sort().join(':');
